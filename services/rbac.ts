import "server-only";

import { prisma } from "@/lib/prisma";
import { isAdminEmail } from "@/lib/utils";
import type { PermissionKey } from "@/lib/permissions";

const permissionCache = new Map<string, { keys: Set<string>; expires: number }>();
const CACHE_TTL_MS = 60_000;

export async function hasPermission(userId: string, permission: PermissionKey): Promise<boolean> {
  const keys = await getUserPermissionKeys(userId);
  return keys.has(permission);
}

export async function getUserPermissionKeys(userId: string): Promise<Set<string>> {
  const cached = permissionCache.get(userId);
  if (cached && cached.expires > Date.now()) return cached.keys;

  const rows = await prisma.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: {
          rolePermissions: { include: { permission: true } },
        },
      },
    },
  });

  const keys = new Set<string>();
  for (const ur of rows) {
    for (const rp of ur.role.rolePermissions) {
      keys.add(rp.permission.key);
    }
  }

  permissionCache.set(userId, { keys, expires: Date.now() + CACHE_TTL_MS });
  return keys;
}

export function clearPermissionCache(userId?: string) {
  if (userId) permissionCache.delete(userId);
  else permissionCache.clear();
}

/** Assign SuperAdmin to legacy ADMIN_EMAILS users once. */
const syncedLegacyAdmins = new Set<string>();

export async function syncLegacyAdminRole(user: { id: string; email: string }) {
  if (!isAdminEmail(user.email)) return;
  // Skip repeat upserts within process lifetime — saves 2 DB round-trips per admin navigation.
  if (syncedLegacyAdmins.has(user.id)) return;
  const superAdmin = await prisma.role.findUnique({ where: { name: "SuperAdmin" } });
  if (!superAdmin) return;
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: superAdmin.id } },
    create: { userId: user.id, roleId: superAdmin.id },
    update: {},
  });
  syncedLegacyAdmins.add(user.id);
  clearPermissionCache(user.id);
}

export async function listRolesWithPermissions() {
  return prisma.role.findMany({
    include: {
      rolePermissions: { include: { permission: true } },
      _count: { select: { userRoles: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function assignUserRole(args: {
  userId: string;
  roleId: string;
  grantedById: string;
}) {
  const row = await prisma.userRole.upsert({
    where: { userId_roleId: { userId: args.userId, roleId: args.roleId } },
    create: args,
    update: { grantedById: args.grantedById },
    include: { role: true, user: { select: { id: true, name: true, email: true } } },
  });
  clearPermissionCache(args.userId);
  return row;
}

export async function revokeUserRole(userId: string, roleId: string) {
  await prisma.userRole.deleteMany({ where: { userId, roleId } });
  clearPermissionCache(userId);
}

export async function getUserRoles(userId: string) {
  return prisma.userRole.findMany({
    where: { userId },
    include: { role: true, grantedBy: { select: { id: true, name: true } } },
  });
}

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const keys = await getUserPermissionKeys(userId);
  return keys.has("settings.manage") || keys.has("roles.manage");
}
