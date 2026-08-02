import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import {
  createDiscoveriesPost,
  getDiscoveriesFeed,
} from "@/services/discoveries";
import { checkVerificationGate } from "@/lib/verification-gates";
import { enforceRateLimit } from "@/lib/api-rate-limit";
import { clampLimit } from "@/lib/pagination";
import { RouteProfiler } from "@/lib/profile/route-profiler";
import { runWithAuthProfile } from "@/lib/auth-profile";
import { optionalStoredMediaUrlSchema } from "@/lib/storage/validation";
import {
  mapUnknownErrorToResponse,
  withApiHandler,
  apiJson,
} from "@/lib/api-error";
import { isPrismaConnectivityError } from "@/lib/prisma-errors";

export const GET = withApiHandler(async (request: Request) => {
  return runWithAuthProfile(async () => {
    const p = new RouteProfiler("/api/discoveries");

    const userAuth = await p.time("auth", () => requireUserApi());
    if (isApiAuthError(userAuth)) return userAuth;
    const user = userAuth;

    const url = new URL(request.url);
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const limit = clampLimit(Number(url.searchParams.get("limit") ?? undefined));

    const feed = await p.time("discoveriesFeed", () =>
      getDiscoveriesFeed({ viewerId: user.id, cursor, limit })
    );

    await p.time("serialize", async () => JSON.stringify(feed));
    p.finish();
    return p.finishResponse(NextResponse.json(feed));
  });
});

const CreateSchema = z.object({
  content: z.string().max(2000).nullable().optional(),
  mediaUrl: optionalStoredMediaUrlSchema,
  mediaType: z.enum(["image", "video"]).nullable().optional(),
  visibility: z.enum(["network", "public"]).optional(),
});

export const POST = withApiHandler(async (request: Request) => {
  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;
  const user = userAuth;

  const limited = await enforceRateLimit(user.id, "discoveries:post");
  if (limited) return limited;

  const gate = await checkVerificationGate(user, "create_discovery");
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.message, code: gate.code },
      { status: gate.status }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiJson(422, {
      error: "Invalid JSON body",
      code: "invalid_json",
    });
  }

  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    return apiJson(422, {
      error: "Invalid input",
      code: "validation_error",
      details: parsed.error.flatten(),
    });
  }

  try {
    const post = await createDiscoveriesPost({ userId: user.id, ...parsed.data });
    return NextResponse.json({ post }, { status: 201 });
  } catch (err: unknown) {
    if (isPrismaConnectivityError(err)) return mapUnknownErrorToResponse(err);
    const message = err instanceof Error ? err.message : "Could not create post";
    return apiJson(400, { error: message, code: "create_failed" });
  }
});
