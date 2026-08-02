import "server-only";

import { prisma } from "@/lib/prisma";
import { getMutualIntroducers, getIntroductionEvidence } from "@/lib/introduction-graph";
import type { TrustNetworkStatsContext } from "@/lib/home-story-context";
import type { HomeUserConnectionRow } from "@/lib/home-graph-context";
import {
  isUserConnectionsMaterializedCached,
  sumMutualConnectionsForTargets,
} from "@/lib/home-graph-context";

export async function getTrustNetworkStats(
  userId: string,
  statsCtx?: TrustNetworkStatsContext,
  graphCtx?: { connectionRows?: HomeUserConnectionRow[] }
) {
  const [myStories, taggedMe] = await Promise.all([
    prisma.story.findMany({
      where: { userId, status: "published" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        text: true,
        mediaUrl: true,
        mediaType: true,
        createdAt: true,
        user: { select: { id: true, name: true, profilePicture: true } },
      },
    }),
    prisma.story.findMany({
      where: { tags: { some: { taggedUserId: userId } }, status: "published" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        text: true,
        mediaUrl: true,
        mediaType: true,
        createdAt: true,
        user: { select: { id: true, name: true, profilePicture: true } },
      },
    }),
  ]);

  let introducedByMe: number;
  let introducedToMe: number;
  let uniqueIntroducers: number;
  let targetIds: string[];

  if (statsCtx) {
    introducedByMe = statsCtx.introducedByMeCount;
    introducedToMe = statsCtx.introducedToMeCount;
    uniqueIntroducers = statsCtx.uniqueIntroducerCount;
    targetIds = statsCtx.introducedTargetIds;
  } else {
    const [introducedByMeCount, introducedToMeCount, introducerIds, introducedUserIds] =
      await Promise.all([
        prisma.storyTag.count({
          where: { story: { userId, status: "published" } },
        }),
        prisma.storyTag.count({
          where: { taggedUserId: userId, story: { status: "published" } },
        }),
        prisma.storyTag.findMany({
          where: { taggedUserId: userId, story: { status: "published" } },
          select: { story: { select: { userId: true } } },
          distinct: ["storyId"],
        }),
        prisma.storyTag.findMany({
          where: { story: { userId, status: "published" }, taggedUserId: { not: null } },
          select: { taggedUserId: true },
          distinct: ["taggedUserId"],
        }),
      ]);
    introducedByMe = introducedByMeCount;
    introducedToMe = introducedToMeCount;
    uniqueIntroducers = new Set(introducerIds.map((t) => t.story.userId)).size;
    targetIds = introducedUserIds
      .map((t) => t.taggedUserId)
      .filter((id): id is string => Boolean(id));
  }

  let mutualCount = 0;
  if (targetIds.length && (await isUserConnectionsMaterializedCached())) {
    if (graphCtx?.connectionRows) {
      mutualCount = sumMutualConnectionsForTargets(graphCtx.connectionRows, targetIds);
    } else {
      const rows = await prisma.userConnection.findMany({
        where: { sourceUserId: userId, targetUserId: { in: targetIds } },
        select: { sharedIntroducerCount: true },
      });
      mutualCount = rows.reduce((sum, row) => sum + row.sharedIntroducerCount, 0);
    }
  } else if (targetIds.length) {
    for (const targetId of targetIds) {
      mutualCount += (await getMutualIntroducers(userId, targetId)).length;
    }
  }

  return {
    peopleYouIntroduced: introducedByMe,
    peopleIntroducedToYou: introducedToMe,
    mutualConnections: mutualCount,
    trustedIntroductions: introducedByMe + introducedToMe,
    uniqueIntroducers,
    recentSent: myStories,
    recentReceived: taggedMe,
  };
}

export async function getProfileTrustNetwork(viewerId: string, profileUserId: string) {
  const stats = await getTrustNetworkStats(profileUserId);
  const connectionReason =
    viewerId === profileUserId
      ? null
      : await getIntroductionEvidence(viewerId, profileUserId);
  const mutual =
    viewerId === profileUserId
      ? []
      : await getMutualIntroducers(viewerId, profileUserId);

  return { stats, evidence: connectionReason, mutualCount: mutual.length, mutual };
}
