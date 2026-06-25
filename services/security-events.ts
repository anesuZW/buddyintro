import "server-only";

import { prisma } from "@/lib/prisma";
import type { Prisma, SecurityEventSeverity } from "@prisma/client";
import { notificationQueue } from "@/services/notifications/notification-service";
import { NOTIFICATION_TYPES } from "@/lib/notification-types";

export const SECURITY_EVENT_TYPES = {
  FAILED_LOGIN: "failed_login",
  EXCESSIVE_MESSAGING: "excessive_messaging",
  EXCESSIVE_INVITATIONS: "excessive_invitations",
  RATE_LIMIT_HIT: "rate_limit_hit",
  VERIFICATION_CHANGED: "verification_changed",
  ADMIN_ACCESS: "admin_access",
  ROLE_CHANGED: "role_changed",
  DISCOVERY_ABUSE: "discovery_abuse",
  TRUST_ANOMALY: "trust_anomaly",
  TRUST_RISK_ELEVATED: "trust_risk_elevated",
} as const;

export async function trackSecurityEvent(args: {
  userId?: string | null;
  eventType: string;
  severity: SecurityEventSeverity;
  metadata?: Record<string, unknown>;
}) {
  const event = await prisma.securityEvent.create({
    data: {
      userId: args.userId ?? null,
      eventType: args.eventType,
      severity: args.severity,
      metadata: (args.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });

  if (args.severity === "high" || args.severity === "critical") {
    void notifyAdminsOfSecurityEvent(event).catch(() => {});
  }

  return event;
}

async function notifyAdminsOfSecurityEvent(event: {
  id: string;
  eventType: string;
  severity: SecurityEventSeverity;
  userId: string | null;
}) {
  const admins = await prisma.userRole.findMany({
    where: { role: { name: { in: ["SuperAdmin", "Admin"] } } },
    select: { userId: true },
    distinct: ["userId"],
  });

  await Promise.all(
    admins.map((a) =>
      notificationQueue.enqueue({
        userId: a.userId,
        type: NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT,
        title: `Security alert (${event.severity})`,
        message: `${event.eventType} detected`,
        entityType: "security_event",
        entityId: event.id,
        skipEmail: false,
      })
    )
  );
}

export async function listSecurityEvents(args: {
  cursor?: string;
  limit?: number;
  severity?: SecurityEventSeverity;
  eventType?: string;
  userId?: string;
}) {
  const limit = Math.min(args.limit ?? 20, 100);
  const where = {
    ...(args.severity ? { severity: args.severity } : {}),
    ...(args.eventType ? { eventType: args.eventType } : {}),
    ...(args.userId ? { userId: args.userId } : {}),
    ...(args.cursor ? { createdAt: { lt: new Date(args.cursor) } } : {}),
  };

  const rows = await prisma.securityEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].createdAt.toISOString() : null,
  };
}

export async function securityEventTrends(days = 7) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.securityEvent.findMany({
    where: { createdAt: { gte: since } },
    select: { severity: true, createdAt: true },
  });

  const byDay = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const day = r.createdAt.toISOString().slice(0, 10);
    const bucket = byDay.get(day) ?? { low: 0, medium: 0, high: 0, critical: 0 };
    bucket[r.severity] = (bucket[r.severity] ?? 0) + 1;
    byDay.set(day, bucket);
  }

  return Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }));
}

export async function securitySeverityBreakdown(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const grouped = await prisma.securityEvent.groupBy({
    by: ["severity"],
    where: { createdAt: { gte: since } },
    _count: true,
  });
  return grouped.map((g) => ({ severity: g.severity, count: g._count }));
}
