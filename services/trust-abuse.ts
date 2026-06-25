import "server-only";

import { prisma } from "@/lib/prisma";
import type { TrustRiskLevel } from "@prisma/client";
import { trackSecurityEvent, SECURITY_EVENT_TYPES } from "@/services/security-events";
import { analyticsService } from "@/services/analytics/analytics-service";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";

function levelFromScore(score: number): TrustRiskLevel {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

/** Compute trust abuse risk score (0–100) for a user. */
export async function computeTrustRiskScore(userId: string): Promise<{
  score: number;
  level: TrustRiskLevel;
  signals: Record<string, number>;
}> {
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    storiesAuthored,
    storiesTagged,
    messagesSent,
    invitesSent,
    discoveriesPosts,
    likesGiven,
    connections,
    sharedRows,
  ] = await Promise.all([
    prisma.story.count({ where: { userId, createdAt: { gte: since7d } } }),
    prisma.storyTag.count({ where: { taggedUserId: userId, createdAt: { gte: since7d } } }),
    prisma.message.count({ where: { senderId: userId, createdAt: { gte: since24h } } }),
    prisma.invitation.count({ where: { invitedById: userId, createdAt: { gte: since7d } } }),
    prisma.discoveriesPost.count({ where: { userId, createdAt: { gte: since24h } } }),
    prisma.discoveriesLike.count({ where: { userId, createdAt: { gte: since24h } } }),
    prisma.userConnection.count({ where: { sourceUserId: userId } }),
    prisma.sharedIntroducerRelationship.count({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }, { sharedIntroducerId: userId }],
      },
    }),
  ]);

  const signals: Record<string, number> = {
    rapidIntroductions: Math.min(storiesAuthored * 8, 40),
    reciprocityCluster: Math.min(storiesTagged > 0 && storiesAuthored > 3 ? 20 : 0, 20),
    messagingBurst: Math.min(messagesSent * 2, 25),
    inviteSpam: Math.min(invitesSent * 5, 30),
    discoverySpam: Math.min(discoveriesPosts * 10, 30),
    coordinatedEngagement: Math.min(likesGiven * 3, 20),
    closedGraph:
      connections > 0 && sharedRows > 0 && connections / Math.max(sharedRows, 1) < 0.5 ? 25 : 0,
    lowExternalReach: connections < 2 && storiesAuthored > 5 ? 15 : 0,
  };

  const score = Math.min(
    100,
    Object.values(signals).reduce((a, b) => a + b, 0)
  );

  return { score, level: levelFromScore(score), signals };
}

export async function refreshTrustRiskForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { trustRiskFalsePositive: true, trustRiskLevel: true },
  });
  if (!user || user.trustRiskFalsePositive) return user;

  const { score, level, signals } = await computeTrustRiskScore(userId);
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { trustRiskScore: score, trustRiskLevel: level },
  });

  if (
    (level === "high" || level === "critical") &&
    user.trustRiskLevel !== level
  ) {
    void trackSecurityEvent({
      userId,
      eventType: SECURITY_EVENT_TYPES.TRUST_RISK_ELEVATED,
      severity: level === "critical" ? "critical" : "high",
      metadata: { score, level, signals },
    }).catch(() => {});
    void analyticsService.track({
      userId,
      eventType: ANALYTICS_EVENTS.TRUST_PROFILE_VIEWED,
      metadata: { trustRiskScore: score, trustRiskLevel: level },
    }).catch(() => {});
  }

  return updated;
}

export async function listTrustRiskUsers(args: {
  minLevel?: TrustRiskLevel;
  cursor?: string;
  limit?: number;
}) {
  const limit = Math.min(args.limit ?? 20, 100);
  const levelOrder: TrustRiskLevel[] = ["critical", "high", "medium", "low"];
  const minIdx = args.minLevel ? levelOrder.indexOf(args.minLevel) : levelOrder.length - 1;
  const allowedLevels = levelOrder.slice(0, minIdx + 1);

  const rows = await prisma.user.findMany({
    where: {
      trustRiskFalsePositive: false,
      trustRiskLevel: { in: allowedLevels },
      ...(args.cursor ? { trustRiskScore: { lt: Number(args.cursor) } } : {}),
    },
    orderBy: [{ trustRiskScore: "desc" }, { createdAt: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      name: true,
      email: true,
      profilePicture: true,
      trustRiskScore: true,
      trustRiskLevel: true,
      trustRiskReviewedAt: true,
      suspendedAt: true,
      bannedAt: true,
    },
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return {
    items,
    nextCursor: hasMore ? String(items[items.length - 1].trustRiskScore) : null,
  };
}

export async function markTrustRiskFalsePositive(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      trustRiskFalsePositive: true,
      trustRiskReviewedAt: new Date(),
      trustRiskLevel: "low",
      trustRiskScore: 0,
    },
  });
}

export async function resetUserTrustScore(userId: string) {
  await prisma.$transaction([
    prisma.userConnection.updateMany({
      where: { sourceUserId: userId },
      data: { trustScore: 10, sharedIntroducerCount: 0 },
    }),
    prisma.userConnection.updateMany({
      where: { targetUserId: userId },
      data: { trustScore: 10, sharedIntroducerCount: 0 },
    }),
  ]);
  return prisma.user.update({
    where: { id: userId },
    data: { trustRiskScore: 0, trustRiskLevel: "low", trustRiskReviewedAt: new Date() },
  });
}

export async function scanTrustRiskBatch(limit = 50) {
  const users = await prisma.user.findMany({
    where: { suspendedAt: null, bannedAt: null, trustRiskFalsePositive: false },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  let elevated = 0;
  for (const u of users) {
    const before = await prisma.user.findUnique({
      where: { id: u.id },
      select: { trustRiskLevel: true },
    });
    await refreshTrustRiskForUser(u.id);
    const after = await prisma.user.findUnique({
      where: { id: u.id },
      select: { trustRiskLevel: true },
    });
    if (
      after &&
      before &&
      (after.trustRiskLevel === "high" || after.trustRiskLevel === "critical") &&
      before.trustRiskLevel !== after.trustRiskLevel
    ) {
      elevated++;
    }
  }
  return { scanned: users.length, elevated };
}
