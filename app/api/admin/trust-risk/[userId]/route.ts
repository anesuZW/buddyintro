import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi, PERMISSIONS } from "@/lib/permissions";
import {
  listTrustRiskUsers,
  markTrustRiskFalsePositive,
  resetUserTrustScore,
  refreshTrustRiskForUser,
} from "@/services/trust-abuse";
import { logAdminAction } from "@/services/audit-log";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const admin = await requirePermissionApi(PERMISSIONS.TRUST_MANAGE);
  if (admin instanceof NextResponse) return admin;
  const { searchParams } = new URL(request.url);
  const result = await listTrustRiskUsers({
    minLevel: (searchParams.get("minLevel") as any) ?? "medium",
    cursor: searchParams.get("cursor") ?? undefined,
    limit: Number(searchParams.get("limit") ?? 20),
  });
  return NextResponse.json(result);
}

const ActionSchema = z.object({
  action: z.enum(["suspend", "false_positive", "reset_trust", "rescan"]),
});

export async function PATCH(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const admin = await requirePermissionApi(PERMISSIONS.TRUST_MANAGE);
  if (admin instanceof NextResponse) return admin;
  const body = ActionSchema.parse(await request.json());
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? null;

  if (body.action === "suspend") {
    await prisma.user.update({
      where: { id: params.userId },
      data: { suspendedAt: new Date() },
    });
    await logAdminAction({
      adminId: admin.id,
      action: "user.suspend",
      targetType: "user",
      targetId: params.userId,
      ipAddress: ip,
    });
  } else if (body.action === "false_positive") {
    await markTrustRiskFalsePositive(params.userId);
    await logAdminAction({
      adminId: admin.id,
      action: "trust.false_positive",
      targetType: "user",
      targetId: params.userId,
      ipAddress: ip,
    });
  } else if (body.action === "reset_trust") {
    await resetUserTrustScore(params.userId);
    await logAdminAction({
      adminId: admin.id,
      action: "trust.reset",
      targetType: "user",
      targetId: params.userId,
      ipAddress: ip,
    });
  } else {
    await refreshTrustRiskForUser(params.userId);
    await logAdminAction({
      adminId: admin.id,
      action: "trust.rescan",
      targetType: "user",
      targetId: params.userId,
      ipAddress: ip,
    });
  }

  return NextResponse.json({ ok: true });
}
