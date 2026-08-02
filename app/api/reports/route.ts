import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUserApi, isApiAuthError } from "@/lib/auth";
import { createReport } from "@/services/moderation";
import { apiJson, withApiHandler } from "@/lib/api-error";

const Schema = z.object({
  targetType: z.enum(["user", "story", "discoveries_post", "message"]),
  targetId: z.string().uuid(),
  reason: z.string().min(3).max(200),
  details: z.string().max(2000).optional(),
});

export const POST = withApiHandler(async (request: Request) => {
  const userAuth = await requireUserApi();
  if (isApiAuthError(userAuth)) return userAuth;
  const parsed = Schema.safeParse(await request.json());
  if (!parsed.success) {
    return apiJson(422, {
      error: "Validation failed",
      code: "validation_error",
      reason: "Report details are invalid.",
      details: parsed.error.flatten(),
    });
  }
  const report = await createReport({
    reporterId: userAuth.id,
    targetType: parsed.data.targetType,
    targetId: parsed.data.targetId,
    reason: parsed.data.reason,
    details: parsed.data.details,
  });
  return NextResponse.json({ report }, { status: 201 });
});
