import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { blockUser, listBlockedUserIds } from "@/services/moderation";
import { apiJson, withApiHandler } from "@/lib/api-error";

const Schema = z.object({
  userId: z.string().uuid(),
});

export const GET = withApiHandler(async () => {
  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;
  const blockedIds = await listBlockedUserIds(userAuth.id);
  return NextResponse.json({ blockedIds });
});

export const POST = withApiHandler(async (request: Request) => {
  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;
  const parsed = Schema.safeParse(await request.json());
  if (!parsed.success) {
    return apiJson(422, {
      error: "Validation failed",
      code: "validation_error",
      reason: "A valid user ID is required.",
    });
  }
  try {
    await blockUser(userAuth.id, parsed.data.userId);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Could not block user";
    return apiJson(400, {
      error: "Could not block user",
      code: "block_failed",
      reason: message,
    });
  }
});
