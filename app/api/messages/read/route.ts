import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { markRead } from "@/services/messages";
import { apiJson, withApiHandler } from "@/lib/api-error";

const Schema = z.object({
  otherUserId: z.string().uuid(),
});

export const POST = withApiHandler(async (request: Request) => {
  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;
  const parsed = Schema.safeParse(await request.json());
  if (!parsed.success) {
    return apiJson(422, {
      error: "Validation failed",
      code: "validation_error",
      reason: "A valid otherUserId is required.",
    });
  }
  await markRead(userAuth.id, parsed.data.otherUserId);
  return NextResponse.json({ ok: true });
});
