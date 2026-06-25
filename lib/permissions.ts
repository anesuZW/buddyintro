import "server-only";

import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import type { User as DbUser } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission, syncLegacyAdminRole } from "@/services/rbac";

export const PERMISSIONS = {
  USERS_VIEW: "users.view",
  USERS_SUSPEND: "users.suspend",
  USERS_BAN: "users.ban",
  USERS_VERIFY: "users.verify",
  ANALYTICS_VIEW: "analytics.view",
  ANALYTICS_EXPORT: "analytics.export",
  SETTINGS_MANAGE: "settings.manage",
  CATEGORIES_MANAGE: "categories.manage",
  ANNOUNCEMENTS_SEND: "announcements.send",
  TRUST_MANAGE: "trust.manage",
  ROLES_MANAGE: "roles.manage",
  AUDIT_VIEW: "audit.view",
  JOBS_VIEW: "jobs.view",
  JOBS_MANAGE: "jobs.manage",
  SECURITY_VIEW: "security.view",
  REPORTS_MODERATE: "reports.moderate",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export { hasPermission };

export async function requirePermission(permission: PermissionKey): Promise<DbUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.suspendedAt || user.bannedAt) redirect("/login?suspended=1");
  await syncLegacyAdminRole(user);
  const allowed = await hasPermission(user.id, permission);
  if (!allowed) redirect("/home");
  return user;
}

export type PermissionAuthResult = DbUser | NextResponse;

export async function requirePermissionApi(
  permission: PermissionKey
): Promise<PermissionAuthResult> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.suspendedAt || user.bannedAt) {
    return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  }
  await syncLegacyAdminRole(user);
  const allowed = await hasPermission(user.id, permission);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return user;
}

export async function requireAnyPermissionApi(
  permissions: PermissionKey[]
): Promise<PermissionAuthResult> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.suspendedAt || user.bannedAt) {
    return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  }
  await syncLegacyAdminRole(user);
  for (const p of permissions) {
    if (await hasPermission(user.id, p)) return user;
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
