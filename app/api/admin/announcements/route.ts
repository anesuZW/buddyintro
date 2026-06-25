import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { notificationService } from "@/services/notifications/notification-service";
import { NOTIFICATION_TYPES } from "@/lib/notification-types";
import { logAdminAction } from "@/services/audit-log";

const Schema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  kind: z.enum(["announcement", "maintenance", "policy"]).optional(),
});

export async function POST(request: Request) {
  const admin = await requireAdminApi();
  if (admin instanceof NextResponse) return admin;
  const body = Schema.parse(await request.json());
  const typeMap = {
    announcement: NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT,
    maintenance: NOTIFICATION_TYPES.ADMIN_MAINTENANCE,
    policy: NOTIFICATION_TYPES.ADMIN_POLICY_UPDATE,
  };
  await notificationService.broadcastAnnouncement({
    title: body.title,
    message: body.message,
    type: typeMap[body.kind ?? "announcement"],
  });
  await logAdminAction({
    adminId: admin.id,
    action: "announcement.send",
    metadata: { title: body.title, kind: body.kind ?? "announcement" },
  });
  return NextResponse.json({ ok: true });
}
