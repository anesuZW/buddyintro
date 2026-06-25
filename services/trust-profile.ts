import "server-only";

import type { AdminSettings } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAdminSettings } from "@/services/admin";
import {
  getSharedIntroducerCount,
  getSharedIntroducersForPair,
} from "@/lib/shared-introducers";
import {
  computeTrustScore,
  trustLevelFromSharedCount,
  trustLevelLabel,
  userPair,
  type TrustLevel,
} from "@/lib/trust-score";
import { getConnectionDegreeFromStore } from "@/services/introduction-graph-builder";
import { introductionDetailHref } from "@/lib/introduction-routes";

import type { TrustProfilePayload } from "@/types";

export type { TrustProfilePayload };

export async function getTrustProfile(
  viewerId: string,
  otherUserId: string,
  settingsOverride?: AdminSettings,
  preloaded?: {
    sharedIntroducerCount?: number;
    sharedIntroducers?: TrustProfilePayload["sharedIntroducers"];
  }
): Promise<TrustProfilePayload> {
  const settings = settingsOverride ?? (await getAdminSettings());
  const [otherUser, connectionRow] = await Promise.all([
    prisma.user.findUnique({
      where: { id: otherUserId },
      select: {
        emailVerified: true,
        phoneVerified: true,
        identityVerified: true,
        trustedUser: true,
      },
    }),
    prisma.userConnection.findUnique({
      where: {
        sourceUserId_targetUserId: { sourceUserId: viewerId, targetUserId: otherUserId },
      },
      select: {
        sharedIntroducerCount: true,
        trustScore: true,
        trustRank: true,
        trustRankTier: true,
        degree: true,
      },
    }),
  ]);

  let sharedIntroducers = preloaded?.sharedIntroducers;
  if (!sharedIntroducers && settings.showSharedIntroducers) {
    const rows = await getSharedIntroducersForPair(viewerId, otherUserId);
    sharedIntroducers = rows.map((s) => ({
      id: s.introducer.id,
      name: s.introducer.name,
      profilePicture: s.introducer.profilePicture,
      storyHref: s.storyHref,
      category: s.category,
    }));
  }

  const sharedIntroducerCount =
    preloaded?.sharedIntroducerCount ??
    connectionRow?.sharedIntroducerCount ??
    sharedIntroducers?.length ??
    (settings.showSharedIntroducers
      ? await getSharedIntroducerCount(viewerId, otherUserId)
      : 0);

  const connectionDegree =
    connectionRow?.degree ??
    (await getConnectionDegreeFromStore(viewerId, otherUserId));

  const trustScore =
    connectionRow?.trustScore ??
    computeTrustScore({
      sharedIntroducerCount,
      connectionDegree: connectionDegree ?? undefined,
      emailVerified: otherUser?.emailVerified,
      phoneVerified: otherUser?.phoneVerified,
      identityVerified: otherUser?.identityVerified,
      sharedWeight: settings.sharedIntroducerWeight,
    });

  const level = trustLevelFromSharedCount(sharedIntroducerCount);

  return {
    sharedIntroducerCount,
    sharedIntroducers: sharedIntroducers ?? [],
    trustScore: settings.enableTrustScores ? trustScore : sharedIntroducerCount * 10,
    trustRank: connectionRow?.trustRank ?? 0,
    trustRankTier: connectionRow?.trustRankTier ?? "bronze",
    trustLevel: level,
    trustLevelLabel: trustLevelLabel(level),
    connectionDegree,
    verification: {
      emailVerified: otherUser?.emailVerified ?? false,
      phoneVerified: otherUser?.phoneVerified ?? false,
      identityVerified: otherUser?.identityVerified ?? false,
      trustedUser: otherUser?.trustedUser ?? false,
    },
  };
}

export async function getTrustProfilesBulk(
  viewerId: string,
  otherUserIds: string[]
): Promise<Map<string, TrustProfilePayload>> {
  const map = new Map<string, TrustProfilePayload>();
  const unique = Array.from(new Set(otherUserIds.filter((id) => id && id !== viewerId)));
  if (!unique.length) return map;

  const settings = await getAdminSettings();

  const [connections, users, sharedRows] = await Promise.all([
    prisma.userConnection.findMany({
      where: { sourceUserId: viewerId, targetUserId: { in: unique } },
      select: {
        targetUserId: true,
        sharedIntroducerCount: true,
        trustScore: true,
        trustRank: true,
        trustRankTier: true,
        degree: true,
      },
    }),
    prisma.user.findMany({
      where: { id: { in: unique } },
      select: {
        id: true,
        emailVerified: true,
        phoneVerified: true,
        identityVerified: true,
        trustedUser: true,
      },
    }),
    settings.showSharedIntroducers
      ? prisma.sharedIntroducerRelationship.findMany({
          where: {
            OR: unique.map((otherId) => {
              const [userAId, userBId] = userPair(viewerId, otherId);
              return { userAId, userBId };
            }),
          },
          include: {
            sharedIntroducer: { select: { id: true, name: true, profilePicture: true } },
            firstStory: {
              select: {
                id: true,
                category: { select: { id: true, name: true, icon: true, color: true } },
              },
            },
            secondStory: {
              select: {
                id: true,
                category: { select: { id: true, name: true, icon: true, color: true } },
              },
            },
          },
          take: 500,
        })
      : Promise.resolve([]),
  ]);

  const connMap = new Map(connections.map((c) => [c.targetUserId, c]));
  const userMap = new Map(users.map((u) => [u.id, u]));

  const sharedByOther = new Map<string, typeof sharedRows>();
  for (const row of sharedRows) {
    const otherId = row.userAId === viewerId ? row.userBId : row.userAId;
    const list = sharedByOther.get(otherId) ?? [];
    list.push(row);
    sharedByOther.set(otherId, list);
  }

  for (const otherId of unique) {
    const connectionRow = connMap.get(otherId);
    const otherUser = userMap.get(otherId);
    const sharedIntroducerCount = connectionRow?.sharedIntroducerCount ?? 0;
    const connectionDegree = connectionRow?.degree ?? null;

    const trustScore =
      connectionRow?.trustScore ??
      computeTrustScore({
        sharedIntroducerCount,
        connectionDegree: connectionDegree ?? undefined,
        emailVerified: otherUser?.emailVerified,
        phoneVerified: otherUser?.phoneVerified,
        identityVerified: otherUser?.identityVerified,
        sharedWeight: settings.sharedIntroducerWeight,
      });

    const level = trustLevelFromSharedCount(sharedIntroducerCount);
    const pairShared = sharedByOther.get(otherId) ?? [];

    map.set(otherId, {
      sharedIntroducerCount,
      sharedIntroducers: pairShared.slice(0, 10).map((r) => {
        const viewerIsA = viewerId === r.userAId;
        const viewerStoryId = viewerIsA
          ? r.firstIntroductionStoryId
          : r.secondIntroductionStoryId;
        const categoryStory = viewerIsA ? r.firstStory : r.secondStory;
        const storyId = viewerStoryId ?? r.firstIntroductionStoryId;
        return {
          id: r.sharedIntroducer.id,
          name: r.sharedIntroducer.name,
          profilePicture: r.sharedIntroducer.profilePicture,
          storyHref: storyId ? introductionDetailHref(storyId) : "/introductions",
          category: categoryStory?.category ?? null,
        };
      }),
      trustScore: settings.enableTrustScores ? trustScore : sharedIntroducerCount * 10,
      trustRank: connectionRow?.trustRank ?? 0,
      trustRankTier: connectionRow?.trustRankTier ?? "bronze",
      trustLevel: level,
      trustLevelLabel: trustLevelLabel(level),
      connectionDegree,
      verification: {
        emailVerified: otherUser?.emailVerified ?? false,
        phoneVerified: otherUser?.phoneVerified ?? false,
        identityVerified: otherUser?.identityVerified ?? false,
        trustedUser: otherUser?.trustedUser ?? false,
      },
    });
  }

  return map;
}
