import { prisma } from "@/lib/prisma";
import { computeTrustScore, userPair } from "@/lib/trust-score";
import { calculateTrustRank } from "@/lib/trust-rank";
import { USER_CONNECTION_LIMITS } from "@/lib/user-connection-limits";
import { getAdminSettings } from "@/services/admin";
import { analyticsService } from "@/services/analytics/analytics-service";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { introductionDetailHref } from "@/lib/introduction-routes";
import {
  notifySharedIntroducerDiscovered,
  notifyTrustScoreIncreased,
} from "@/services/notifications/emitters";

const BATCH = 300;

type TrustGraphOptions = { notifyForUserIds?: string[] };

type IntroEdge = {
  introducerId: string;
  introducedId: string;
  storyId: string;
};

async function loadIntroducerEdges(): Promise<Map<string, IntroEdge[]>> {
  const tags = await prisma.storyTag.findMany({
    where: {
      taggedUserId: { not: null },
      story: { status: "published" },
    },
    select: {
      taggedUserId: true,
      storyId: true,
      story: { select: { userId: true } },
    },
  });

  const byIntroducer = new Map<string, IntroEdge[]>();
  for (const tag of tags) {
    if (!tag.taggedUserId) continue;
    const list = byIntroducer.get(tag.story.userId) ?? [];
    list.push({
      introducerId: tag.story.userId,
      introducedId: tag.taggedUserId,
      storyId: tag.storyId,
    });
    byIntroducer.set(tag.story.userId, list);
  }
  return byIntroducer;
}

/** Rebuild shared_introducer_relationships from published introductions. */
export async function rebuildSharedIntroducerRelationships(
  options?: TrustGraphOptions
): Promise<number> {
  const existing = await prisma.sharedIntroducerRelationship.findMany({
    select: { userAId: true, userBId: true, sharedIntroducerId: true },
  });
  const existingSet = new Set(
    existing.map((r) => `${r.userAId}:${r.userBId}:${r.sharedIntroducerId}`)
  );

  const byIntroducer = await loadIntroducerEdges();
  const rows: Array<{
    userAId: string;
    userBId: string;
    sharedIntroducerId: string;
    firstIntroductionStoryId: string;
    secondIntroductionStoryId: string;
  }> = [];

  for (const [introducerId, edges] of byIntroducer) {
    const byIntroduced = new Map<string, string>();
    for (const e of edges) {
      if (!byIntroduced.has(e.introducedId)) {
        byIntroduced.set(e.introducedId, e.storyId);
      }
    }
    const introducedIds = Array.from(byIntroduced.keys());
    for (let i = 0; i < introducedIds.length; i++) {
      for (let j = i + 1; j < introducedIds.length; j++) {
        const a = introducedIds[i];
        const b = introducedIds[j];
        const [userAId, userBId] = userPair(a, b);
        const firstStoryId = userAId === a ? byIntroduced.get(a)! : byIntroduced.get(b)!;
        const secondStoryId = userBId === b ? byIntroduced.get(b)! : byIntroduced.get(a)!;
        rows.push({
          userAId,
          userBId,
          sharedIntroducerId: introducerId,
          firstIntroductionStoryId: firstStoryId,
          secondIntroductionStoryId: secondStoryId,
        });
      }
    }
  }

  await prisma.sharedIntroducerRelationship.deleteMany({});

  for (let i = 0; i < rows.length; i += BATCH) {
    await prisma.sharedIntroducerRelationship.createMany({
      data: rows.slice(i, i + BATCH),
      skipDuplicates: true,
    });
  }

  const notifyUsers = new Set(options?.notifyForUserIds ?? []);
  if (notifyUsers.size && existing.length) {
    const newRows = rows.filter((r) => {
      const key = `${r.userAId}:${r.userBId}:${r.sharedIntroducerId}`;
      return (
        !existingSet.has(key) &&
        (notifyUsers.has(r.userAId) || notifyUsers.has(r.userBId))
      );
    });
    if (newRows.length) {
      void notifyNewSharedIntroducerRows(newRows).catch((err) =>
        console.error("[trust] shared introducer notify failed", err)
      );
    }
  }

  return rows.length;
}

async function notifyNewSharedIntroducerRows(
  rows: Array<{
    userAId: string;
    userBId: string;
    sharedIntroducerId: string;
  }>
) {
  const userIds = Array.from(
    new Set(rows.flatMap((r) => [r.userAId, r.userBId, r.sharedIntroducerId]))
  );
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const nameMap = new Map(users.map((u) => [u.id, u.name]));

  for (const row of rows.slice(0, 20)) {
    const otherForA = row.userBId;
    const otherForB = row.userAId;
    const introducerName = nameMap.get(row.sharedIntroducerId) ?? "Someone";

    void analyticsService.track({
      userId: row.userAId,
      eventType: ANALYTICS_EVENTS.NEW_SHARED_INTRODUCER,
      entityType: "user",
      entityId: otherForA,
      metadata: { sharedIntroducerId: row.sharedIntroducerId },
    });
    void analyticsService.track({
      userId: row.userAId,
      eventType: ANALYTICS_EVENTS.SHARED_INTRODUCER_RELATIONSHIP_CREATED,
      entityType: "user",
      entityId: otherForA,
      metadata: { sharedIntroducerId: row.sharedIntroducerId },
    });

    await notifySharedIntroducerDiscovered({
      userId: row.userAId,
      otherUserId: otherForA,
      otherName: nameMap.get(otherForA) ?? "Someone",
      introducerName,
    });
    await notifySharedIntroducerDiscovered({
      userId: row.userBId,
      otherUserId: otherForB,
      otherName: nameMap.get(otherForB) ?? "Someone",
      introducerName,
    });
  }
}

/** Refresh sharedIntroducerCount + trustScore on user_connections (batched). */
export async function refreshConnectionTrustScores(options?: TrustGraphOptions): Promise<number> {
  const notifyUsers = new Set(options?.notifyForUserIds ?? []);
  const connectionWhere = notifyUsers.size
    ? { sourceUserId: { in: [...notifyUsers] } }
    : undefined;

  const sharedGroups = await prisma.sharedIntroducerRelationship.groupBy({
    by: ["userAId", "userBId"],
    _count: { id: true },
  });

  const countMap = new Map(
    sharedGroups.map((g) => [`${g.userAId}:${g.userBId}`, g._count.id])
  );

  const settings = await getAdminSettings();
  const notifications: Array<Promise<unknown>> = [];
  let updated = 0;
  let cursor: string | undefined;
  const batchSize = USER_CONNECTION_LIMITS.trustRefreshBatch;

  while (true) {
    const pairs = await prisma.userConnection.findMany({
      where: connectionWhere,
      take: batchSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        sourceUserId: true,
        targetUserId: true,
        degree: true,
        trustScore: true,
      },
    });
    if (!pairs.length) break;

    const targetIds = [...new Set(pairs.map((p) => p.targetUserId))];
    const users = await prisma.user.findMany({
      where: { id: { in: targetIds } },
      select: {
        id: true,
        name: true,
        emailVerified: true,
        phoneVerified: true,
        identityVerified: true,
        trustedUser: true,
      },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    await prisma.$transaction(
      pairs.map((conn) => {
        const targetUser = userMap.get(conn.targetUserId);
        const [userAId, userBId] = userPair(conn.sourceUserId, conn.targetUserId);
        const sharedCount = countMap.get(`${userAId}:${userBId}`) ?? 0;
        const previousScore = conn.trustScore ?? 0;
        const trustScore = computeTrustScore({
          sharedIntroducerCount: sharedCount,
          connectionDegree: conn.degree,
          emailVerified: targetUser?.emailVerified ?? false,
          phoneVerified: targetUser?.phoneVerified ?? false,
          identityVerified: targetUser?.identityVerified ?? false,
          sharedWeight: settings.sharedIntroducerWeight,
        });
        const rankResult =
          settings.enableTrustRankings && targetUser
            ? calculateTrustRank({
                sharedIntroducerCount: sharedCount,
                connectionDegree: conn.degree,
                emailVerified: targetUser.emailVerified,
                phoneVerified: targetUser.phoneVerified,
                identityVerified: targetUser.identityVerified,
                trustedUser: targetUser.trustedUser,
              })
            : null;

        if (
          targetUser &&
          notifyUsers.has(conn.sourceUserId) &&
          trustScore > previousScore &&
          previousScore > 0
        ) {
          notifications.push(
            notifyTrustScoreIncreased({
              userId: conn.sourceUserId,
              otherUserId: conn.targetUserId,
              otherName: targetUser.name,
              newScore: trustScore,
              sharedCount,
            })
          );
          notifications.push(
            analyticsService.track({
              userId: conn.sourceUserId,
              eventType: ANALYTICS_EVENTS.TRUST_SCORE_INCREASED,
              entityType: "user",
              entityId: conn.targetUserId,
              metadata: { previousScore, trustScore, sharedCount },
            })
          );
        }

        return prisma.userConnection.update({
          where: { id: conn.id },
          data: {
            sharedIntroducerCount: sharedCount,
            trustScore,
            trustRank: rankResult?.rank ?? 0,
            trustRankTier: rankResult?.tier ?? "bronze",
            highestTrustPath: conn.degree === 1 && sharedCount >= 3,
          },
        });
      })
    );

    updated += pairs.length;
    cursor = pairs[pairs.length - 1].id;
    if (pairs.length < batchSize) break;
  }

  if (notifications.length) {
    void Promise.all(notifications).catch((err) =>
      console.error("[trust] score notify failed", err)
    );
  }

  return updated;
}

export async function getSharedIntroducersForPair(
  viewerId: string,
  otherUserId: string
) {
  const [userAId, userBId] = userPair(viewerId, otherUserId);
  const rows = await prisma.sharedIntroducerRelationship.findMany({
    where: { userAId, userBId },
    include: {
      sharedIntroducer: { select: { id: true, name: true, profilePicture: true } },
      firstStory: {
        select: {
          id: true,
          introductionCategoryId: true,
          category: { select: { id: true, name: true, icon: true, color: true } },
        },
      },
      secondStory: {
        select: {
          id: true,
          introductionCategoryId: true,
          category: { select: { id: true, name: true, icon: true, color: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((r) => {
    const viewerIsA = viewerId === userAId;
    const viewerStoryId = viewerIsA
      ? r.firstIntroductionStoryId
      : r.secondIntroductionStoryId;
    const otherStoryId = viewerIsA
      ? r.secondIntroductionStoryId
      : r.firstIntroductionStoryId;
    const categoryStory = viewerIsA ? r.firstStory : r.secondStory;
    const storyId = viewerStoryId ?? otherStoryId ?? r.firstIntroductionStoryId;
    return {
      introducer: r.sharedIntroducer,
      viewerStoryId,
      otherStoryId,
      category: categoryStory?.category ?? null,
      storyHref: storyId ? introductionDetailHref(storyId) : "/introductions",
    };
  });
}

export async function getSharedIntroducerCount(
  viewerId: string,
  otherUserId: string
): Promise<number> {
  const [userAId, userBId] = userPair(viewerId, otherUserId);
  return prisma.sharedIntroducerRelationship.count({ where: { userAId, userBId } });
}

/** Batch shared-introducer counts for many pairs (one query). */
export async function getSharedIntroducerCountsBulk(
  pairs: Array<[string, string]>
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!pairs.length) return map;

  const uniquePairs = Array.from(
    new Map(
      pairs.map(([a, b]) => {
        const [userAId, userBId] = userPair(a, b);
        const key = `${userAId}:${userBId}`;
        return [key, { userAId, userBId, key }];
      })
    ).values()
  );

  const rows = await prisma.sharedIntroducerRelationship.groupBy({
    by: ["userAId", "userBId"],
    where: { OR: uniquePairs.map((p) => ({ userAId: p.userAId, userBId: p.userBId })) },
    _count: { _all: true },
  });

  for (const row of rows) {
    map.set(`${row.userAId}:${row.userBId}`, row._count._all);
  }
  for (const p of uniquePairs) {
    if (!map.has(p.key)) map.set(p.key, 0);
  }
  return map;
}

export async function rebuildTrustGraph(options?: TrustGraphOptions): Promise<{
  sharedRows: number;
  connectionsUpdated: number;
}> {
  const sharedRows = await rebuildSharedIntroducerRelationships(options);
  const connectionsUpdated = await refreshConnectionTrustScores(options);
  return { sharedRows, connectionsUpdated };
}
