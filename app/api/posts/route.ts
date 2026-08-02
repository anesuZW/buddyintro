import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { createPost } from "@/services/feed";
import { getAdminSettings } from "@/services/admin";
import { apiJson, withApiHandler } from "@/lib/api-error";

const Schema = z.object({
  content: z.string().max(2000).nullable().optional(),
  media: z.string().url().nullable().optional(),
});

export const POST = withApiHandler(async (request: Request) => {
  const meAuth = await requireUserApi();
  if (isApiAuthError(meAuth)) return meAuth;
  const parsed = Schema.safeParse(await request.json());
  if (!parsed.success) {
    return apiJson(422, {
      error: "Validation failed",
      code: "validation_error",
      reason: "Post content or media is invalid.",
      details: parsed.error.flatten(),
    });
  }
  const settings = await getAdminSettings();
  const post = await createPost({
    userId: meAuth.id,
    content: parsed.data.content ?? null,
    media: parsed.data.media ?? null,
    expiresInHours: settings.postExpiryHours,
  });
  return NextResponse.json({ post });
});
