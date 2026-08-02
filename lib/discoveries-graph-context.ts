import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getEffectiveDiscoveryDepth } from "@/lib/network-depth";
import { getAdminSettings } from "@/services/admin";
import { USER_CONNECTION_LIMITS } from "@/lib/user-connection-limits";

export type DiscoveriesViewerConnectionRow = {
  targetUserId: string;
  degree: number;
  sharedIntroducerCount: number;
  trustScore: number;
  trustRank: number;
  trustRankTier: string;
  targetUser: { id: string; name: string };
};

/**
 * Single request-scoped UserConnection load for /discoveries.
 * Evidence: Sprint 3 — discoveries duplicates UserConnection (network + trust profiles + recommendations).
 */
export const getDiscoveriesViewerConnections = cache(
  async (viewerId: string): Promise<DiscoveriesViewerConnectionRow[]> => {
    return prisma.userConnection.findMany({
      where: { sourceUserId: viewerId },
      select: {
        targetUserId: true,
        degree: true,
        sharedIntroducerCount: true,
        trustScore: true,
        trustRank: true,
        trustRankTier: true,
        targetUser: { select: { id: true, name: true } },
      },
    });
  }
);

export async function networkAuthorIdsFromConnectionRows(
  viewerId: string,
  rows: DiscoveriesViewerConnectionRow[]
): Promise<string[]> {
  const settings = await getAdminSettings();
  if (!settings.discoveriesEnabled || !settings.enableIntroductionGraph) {
    return [viewerId];
  }
  const depth = getEffectiveDiscoveryDepth(settings);
  if (depth <= 0) return [viewerId];

  const ids = rows
    .filter((r) => r.degree >= 1 && r.degree <= depth)
    .map((r) => r.targetUserId)
    .slice(0, USER_CONNECTION_LIMITS.networkIds);

  return [viewerId, ...ids];
}
