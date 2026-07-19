import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  createDiscoveriesPost,
  getDiscoveriesFeed,
} from "@/services/discoveries";
import { checkVerificationGate } from "@/lib/verification-gates";
import { enforceRateLimit } from "@/lib/api-rate-limit";
import { clampLimit } from "@/lib/pagination";
import { RouteProfiler } from "@/lib/profile/route-profiler";
import { runWithAuthProfile } from "@/lib/auth-profile";

export async function GET(request: Request) {
  return runWithAuthProfile(async () => {
  const p = new RouteProfiler("/api/discoveries");

  const user = await p.time("auth", async () => {
    const u = await getCurrentUser();
    if (!u) throw new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    return u;
  });

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
}

import { optionalStoredMediaUrlSchema } from "@/lib/storage/validation";

const CreateSchema = z.object({
  content: z.string().max(2000).nullable().optional(),
  mediaUrl: optionalStoredMediaUrlSchema,
  mediaType: z.enum(["image", "video"]).nullable().optional(),
  visibility: z.enum(["network", "public"]).optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await enforceRateLimit(user.id, "discoveries:post");
  if (limited) return limited;

  const gate = await checkVerificationGate(user, "create_discovery");
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message, code: gate.code }, { status: gate.status });
  }
  const parsed = CreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  try {
    const post = await createDiscoveriesPost({ userId: user.id, ...parsed.data });
    return NextResponse.json({ post }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Could not create post";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
