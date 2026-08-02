import type { HomeVisibleStoryRow } from "@/lib/home-story-loader-types";

export type HomeUserConnectionRow = {
  targetUserId: string;
  degree: number;
  sharedIntroducerCount: number;
  trustScore: number;
  targetUser: { id: string; name: string };
};

export function pickTrustRecommendationConnections(
  rows: HomeUserConnectionRow[]
): HomeUserConnectionRow[] {
  return rows
    .filter((r) => r.degree <= 2)
    .sort((a, b) => {
      if (b.sharedIntroducerCount !== a.sharedIntroducerCount) {
        return b.sharedIntroducerCount - a.sharedIntroducerCount;
      }
      return b.trustScore - a.trustScore;
    })
    .slice(0, 12);
}

export function sumMutualConnectionsForTargets(
  rows: HomeUserConnectionRow[],
  targetIds: string[]
): number {
  if (!targetIds.length) return 0;
  const targets = new Set(targetIds);
  return rows
    .filter((r) => targets.has(r.targetUserId))
    .reduce((sum, row) => sum + row.sharedIntroducerCount, 0);
}

export function pickCoTagFeedStories(
  rows: HomeVisibleStoryRow[],
  coTagAuthorIds: string[],
  pageSize: number
) {
  const authors = new Set(coTagAuthorIds);
  const now = Date.now();
  return rows
    .filter(
      (s) =>
        authors.has(s.userId) &&
        s.status === "published" &&
        s.expiresAt.getTime() > now
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, pageSize);
}
