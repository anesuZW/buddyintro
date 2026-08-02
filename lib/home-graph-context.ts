import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { HomeUserConnectionRow } from "@/lib/home-projection";

export type { HomeUserConnectionRow } from "@/lib/home-projection";
export {
  pickTrustRecommendationConnections,
  sumMutualConnectionsForTargets,
} from "@/lib/home-projection";

/**
 * Single request-scoped UserConnection load for /home.
 * Evidence: Sprint 3 verification — 2× UserConnection.findMany on /home (677ms + 3651ms).
 */
export const getHomeUserConnections = cache(
  async (userId: string): Promise<HomeUserConnectionRow[]> => {
    return prisma.userConnection.findMany({
      where: { sourceUserId: userId },
      select: {
        targetUserId: true,
        degree: true,
        sharedIntroducerCount: true,
        trustScore: true,
        targetUser: { select: { id: true, name: true } },
      },
    });
  }
);

/** Dedupe global materialization probe within one request (Sprint 3: findFirst 646ms). */
export const isUserConnectionsMaterializedCached = cache(async (): Promise<boolean> => {
  const row = await prisma.userConnection.findFirst({ select: { id: true } });
  return Boolean(row);
});
