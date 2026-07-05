/**
 * Trust graph rebuild for simulation scripts — avoids server-only imports.
 */
import type { PrismaClient } from "@prisma/client";
import { bfsConnections, type AdjEdge } from "@/lib/introduction-graph-materialization";
import { computeTrustScore, userPair } from "@/lib/trust-score";
import { calculateTrustRank } from "@/lib/trust-rank";

const BATCH = 500;
const SHARED_WEIGHT = 70;

async function loadIntroductionAdjacency(db: PrismaClient): Promise<Map<string, AdjEdge[]>> {
  const tags = await db.storyTag.findMany({
    where: { taggedUserId: { not: null }, story: { status: "published" } },
    select: { taggedUserId: true, storyId: true, story: { select: { userId: true } } },
  });

  const adj = new Map<string, AdjEdge[]>();
  const addEdge = (a: string, b: string, storyId: string) => {
    const listA = adj.get(a) ?? [];
    listA.push({ neighborId: b, storyId });
    adj.set(a, listA);
    const listB = adj.get(b) ?? [];
    listB.push({ neighborId: a, storyId });
    adj.set(b, listB);
  };

  for (const tag of tags) {
    if (!tag.taggedUserId) continue;
    addEdge(tag.story.userId, tag.taggedUserId, tag.storyId);
  }
  return adj;
}

async function rebuildSharedIntroducers(db: PrismaClient): Promise<number> {
  const tags = await db.storyTag.findMany({
    where: { taggedUserId: { not: null }, story: { status: "published" } },
    select: { taggedUserId: true, storyId: true, story: { select: { userId: true } } },
  });

  const byIntroducer = new Map<string, Map<string, string>>();
  for (const tag of tags) {
    if (!tag.taggedUserId) continue;
    const map = byIntroducer.get(tag.story.userId) ?? new Map<string, string>();
    if (!map.has(tag.taggedUserId)) map.set(tag.taggedUserId, tag.storyId);
    byIntroducer.set(tag.story.userId, map);
  }

  const rows: Array<{
    userAId: string;
    userBId: string;
    sharedIntroducerId: string;
    firstIntroductionStoryId: string;
    secondIntroductionStoryId: string;
  }> = [];

  for (const [introducerId, introducedMap] of byIntroducer) {
    const introducedIds = Array.from(introducedMap.keys());
    for (let i = 0; i < introducedIds.length; i += 1) {
      for (let j = i + 1; j < introducedIds.length; j += 1) {
        const a = introducedIds[i];
        const b = introducedIds[j];
        const [userAId, userBId] = userPair(a, b);
        const firstStoryId = userAId === a ? introducedMap.get(a)! : introducedMap.get(b)!;
        const secondStoryId = userBId === b ? introducedMap.get(b)! : introducedMap.get(a)!;
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

  await db.sharedIntroducerRelationship.deleteMany({});
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.sharedIntroducerRelationship.createMany({
      data: rows.slice(i, i + BATCH),
      skipDuplicates: true,
    });
  }
  return rows.length;
}

async function refreshTrustScores(db: PrismaClient): Promise<number> {
  const [sharedGroups, pairs] = await Promise.all([
    db.sharedIntroducerRelationship.groupBy({
      by: ["userAId", "userBId"],
      _count: { id: true },
    }),
    db.userConnection.findMany({
      select: {
        id: true,
        sourceUserId: true,
        targetUserId: true,
        degree: true,
        targetUser: {
          select: {
            emailVerified: true,
            phoneVerified: true,
            identityVerified: true,
            trustedUser: true,
          },
        },
      },
    }),
  ]);

  const countMap = new Map(
    sharedGroups.map((g) => [`${g.userAId}:${g.userBId}`, g._count.id])
  );

  let updated = 0;
  for (const conn of pairs) {
    const [userAId, userBId] = userPair(conn.sourceUserId, conn.targetUserId);
    const sharedCount = countMap.get(`${userAId}:${userBId}`) ?? 0;
    const trustScore = computeTrustScore({
      sharedIntroducerCount: sharedCount,
      connectionDegree: conn.degree,
      emailVerified: conn.targetUser.emailVerified,
      phoneVerified: conn.targetUser.phoneVerified,
      identityVerified: conn.targetUser.identityVerified,
      sharedWeight: SHARED_WEIGHT,
    });
    const rankResult = calculateTrustRank({
      sharedIntroducerCount: sharedCount,
      connectionDegree: conn.degree,
      emailVerified: conn.targetUser.emailVerified,
      phoneVerified: conn.targetUser.phoneVerified,
      identityVerified: conn.targetUser.identityVerified,
      trustedUser: conn.targetUser.trustedUser,
    });

    await db.userConnection.update({
      where: { id: conn.id },
      data: {
        sharedIntroducerCount: sharedCount,
        trustScore,
        trustRank: rankResult.rank,
        trustRankTier: rankResult.tier,
      },
    });
    updated += 1;
  }
  return updated;
}

export async function rebuildSimulationGraph(db: PrismaClient): Promise<{
  rows: number;
  users: number;
  sharedRows: number;
  scored: number;
}> {
  const [adj, users] = await Promise.all([
    loadIntroductionAdjacency(db),
    db.user.findMany({ select: { id: true } }),
  ]);

  const userIds = users.length ? users.map((u) => u.id) : Array.from(adj.keys());
  const allRows: Array<{
    sourceUserId: string;
    targetUserId: string;
    degree: number;
    introducedViaStoryId: string | null;
  }> = [];

  for (const userId of userIds) {
    allRows.push(...bfsConnections(userId, adj));
  }

  await db.userConnection.deleteMany({});
  for (let i = 0; i < allRows.length; i += BATCH) {
    await db.userConnection.createMany({
      data: allRows.slice(i, i + BATCH),
      skipDuplicates: true,
    });
  }

  const sharedRows = await rebuildSharedIntroducers(db);
  const scored = await refreshTrustScores(db);

  return { rows: allRows.length, users: userIds.length, sharedRows, scored };
}
