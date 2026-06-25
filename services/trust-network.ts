import "server-only";

import { prisma } from "@/lib/prisma";
import { getMutualIntroducers, getIntroductionEvidence } from "@/lib/introduction-graph";
import { isUserConnectionsMaterialized } from "@/services/introduction-graph-builder";

export async function getTrustNetworkStats(userId: string) {
  const [introducedByMe, introducedToMe, myStories, taggedMe] = await Promise.all([
    prisma.storyTag.count({
      where: { story: { userId, status: "published" } },
    }),
    prisma.storyTag.count({
      where: { taggedUserId: userId, story: { status: "published" } },
    }),
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

  const introducerIds = await prisma.storyTag.findMany({
    where: { taggedUserId: userId, story: { status: "published" } },
    select: { story: { select: { userId: true } } },
    distinct: ["storyId"],
  });
  const uniqueIntroducers = new Set(introducerIds.map((t) => t.story.userId));

  let mutualCount = 0;
  const introducedUserIds = await prisma.storyTag.findMany({
    where: { story: { userId, status: "published" }, taggedUserId: { not: null } },
    select: { taggedUserId: true },
    distinct: ["taggedUserId"],
  });
  const targetIds = introducedUserIds
    .map((t) => t.taggedUserId)
    .filter((id): id is string => Boolean(id));

  if (targetIds.length && (await isUserConnectionsMaterialized())) {
    const rows = await prisma.userConnection.findMany({
      where: { sourceUserId: userId, targetUserId: { in: targetIds } },
      select: { sharedIntroducerCount: true },
    });
    mutualCount = rows.reduce((sum, row) => sum + row.sharedIntroducerCount, 0);
  } else {
    for (const t of introducedUserIds) {
      if (!t.taggedUserId) continue;
      mutualCount += (await getMutualIntroducers(userId, t.taggedUserId)).length;
    }
  }

  return {
    peopleYouIntroduced: introducedByMe,
    peopleIntroducedToYou: introducedToMe,
    mutualConnections: mutualCount,
    trustedIntroductions: introducedByMe + introducedToMe,
    uniqueIntroducers: uniqueIntroducers.size,
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
