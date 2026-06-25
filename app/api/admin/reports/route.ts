import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { listPendingReports, resolveReport, suspendUser, banUser } from "@/services/moderation";
import { logAdminAction } from "@/services/audit-log";

export async function GET() {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  const reports = await listPendingReports();
  return NextResponse.json({ reports });
}

const ResolveSchema = z.object({
  reportId: z.string().uuid(),
  status: z.enum(["reviewed", "dismissed", "action_taken"]),
  resolution: z.string().max(1000).optional(),
  suspendUserId: z.string().uuid().optional(),
  banUserId: z.string().uuid().optional(),
});

export async function PATCH(request: Request) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  const body = ResolveSchema.parse(await request.json());
  const report = await resolveReport({
    reportId: body.reportId,
    reviewerId: admin.id,
    status: body.status,
    resolution: body.resolution,
  });
  if (body.suspendUserId && body.status === "action_taken") {
    await suspendUser(body.suspendUserId, true);
    await logAdminAction({
      adminId: admin.id,
      action: "user.suspend",
      targetType: "user",
      targetId: body.suspendUserId,
      metadata: { reportId: body.reportId },
    });
  }
  if (body.banUserId && body.status === "action_taken") {
    await banUser(body.banUserId, true);
    await logAdminAction({
      adminId: admin.id,
      action: "user.ban",
      targetType: "user",
      targetId: body.banUserId,
      metadata: { reportId: body.reportId },
    });
  }
  return NextResponse.json({ report });
}
