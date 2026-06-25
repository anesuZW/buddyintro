import "server-only";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type AuditLogInput = {
  adminId: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
};

export async function logAdminAction(input: AuditLogInput) {
  return prisma.adminAuditLog.create({
    data: {
      adminId: input.adminId,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      ipAddress: input.ipAddress ?? null,
    },
  });
}

export async function listAuditLogs(args: {
  cursor?: string;
  limit?: number;
  action?: string;
  adminId?: string;
}) {
  const limit = Math.min(args.limit ?? 20, 100);
  const where = {
    ...(args.action ? { action: args.action } : {}),
    ...(args.adminId ? { adminId: args.adminId } : {}),
    ...(args.cursor ? { createdAt: { lt: new Date(args.cursor) } } : {}),
  };

  const rows = await prisma.adminAuditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: {
      admin: { select: { id: true, name: true, email: true } },
    },
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].createdAt.toISOString() : null,
  };
}

export function auditLogsToCsv(
  rows: Array<{
    id: string;
    action: string;
    targetType: string | null;
    targetId: string | null;
    ipAddress: string | null;
    createdAt: Date;
    admin: { name: string; email: string };
  }>
) {
  const header = "id,created_at,admin_email,action,target_type,target_id,ip_address";
  const lines = rows.map((r) =>
    [
      r.id,
      r.createdAt.toISOString(),
      r.admin.email,
      r.action,
      r.targetType ?? "",
      r.targetId ?? "",
      r.ipAddress ?? "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  return [header, ...lines].join("\n");
}
