import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermissionApi, PERMISSIONS } from "@/lib/permissions";
import { listRolesWithPermissions, assignUserRole, revokeUserRole } from "@/services/rbac";
import { logAdminAction } from "@/services/audit-log";
import { trackSecurityEvent, SECURITY_EVENT_TYPES } from "@/services/security-events";

export async function GET() {
  const admin = await requirePermissionApi(PERMISSIONS.ROLES_MANAGE);
  if (admin instanceof NextResponse) return admin;
  const roles = await listRolesWithPermissions();
  return NextResponse.json({ roles });
}

const AssignSchema = z.object({
  userId: z.string().uuid(),
  roleId: z.string().uuid(),
});

export async function POST(request: Request) {
  const admin = await requirePermissionApi(PERMISSIONS.ROLES_MANAGE);
  if (admin instanceof NextResponse) return admin;
  const body = AssignSchema.parse(await request.json());
  const row = await assignUserRole({
    userId: body.userId,
    roleId: body.roleId,
    grantedById: admin.id,
  });
  const forwarded = request.headers.get("x-forwarded-for");
  await logAdminAction({
    adminId: admin.id,
    action: "role.assign",
    targetType: "user",
    targetId: body.userId,
    metadata: { roleId: body.roleId, roleName: row.role.name },
    ipAddress: forwarded?.split(",")[0]?.trim() ?? null,
  });
  void trackSecurityEvent({
    userId: body.userId,
    eventType: SECURITY_EVENT_TYPES.ROLE_CHANGED,
    severity: "medium",
    metadata: { action: "assign", roleId: body.roleId, by: admin.id },
  });
  return NextResponse.json({ userRole: row });
}

export async function DELETE(request: Request) {
  const admin = await requirePermissionApi(PERMISSIONS.ROLES_MANAGE);
  if (admin instanceof NextResponse) return admin;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const roleId = searchParams.get("roleId");
  if (!userId || !roleId) {
    return NextResponse.json({ error: "userId and roleId required" }, { status: 400 });
  }
  await revokeUserRole(userId, roleId);
  const forwarded = request.headers.get("x-forwarded-for");
  await logAdminAction({
    adminId: admin.id,
    action: "role.revoke",
    targetType: "user",
    targetId: userId,
    metadata: { roleId },
    ipAddress: forwarded?.split(",")[0]?.trim() ?? null,
  });
  void trackSecurityEvent({
    userId,
    eventType: SECURITY_EVENT_TYPES.ROLE_CHANGED,
    severity: "medium",
    metadata: { action: "revoke", roleId, by: admin.id },
  });
  return NextResponse.json({ ok: true });
}
