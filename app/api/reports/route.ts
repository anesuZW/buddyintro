import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createReport } from "@/services/moderation";

const Schema = z.object({
  targetType: z.enum(["user", "story", "discoveries_post", "message"]),
  targetId: z.string().uuid(),
  reason: z.string().min(3).max(200),
  details: z.string().max(2000).optional(),
});

export async function POST(request: Request) {
  const user = await requireUser();
  const body = Schema.parse(await request.json());
  const report = await createReport({
    reporterId: user.id,
    targetType: body.targetType,
    targetId: body.targetId,
    reason: body.reason,
    details: body.details,
  });
  return NextResponse.json({ report }, { status: 201 });
}
