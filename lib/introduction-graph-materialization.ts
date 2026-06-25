/**
 * Pure introduction graph materialization — no DB or server-only imports.
 * Used to build user_connections rows (always up to MAX_INTRODUCTION_GRAPH_DEGREE).
 * Runtime discovery/messaging reads the materialized store and applies separate depth caps.
 */

export const MAX_INTRODUCTION_GRAPH_DEGREE = 4;

export type AdjEdge = { neighborId: string; storyId: string };

export type MaterializedConnectionRow = {
  sourceUserId: string;
  targetUserId: string;
  degree: number;
  introducedViaStoryId: string | null;
};

/** BFS up to MAX_INTRODUCTION_GRAPH_DEGREE; stores minimum degree and story on the connecting edge. */
export function bfsConnections(
  sourceUserId: string,
  adj: Map<string, AdjEdge[]>
): MaterializedConnectionRow[] {
  const results: MaterializedConnectionRow[] = [];
  const visited = new Map<string, { degree: number; storyId: string | null }>();
  visited.set(sourceUserId, { degree: 0, storyId: null });

  let frontier = [sourceUserId];

  for (let depth = 1; depth <= MAX_INTRODUCTION_GRAPH_DEGREE; depth++) {
    const next: string[] = [];

    for (const uid of frontier) {
      for (const edge of adj.get(uid) ?? []) {
        if (visited.has(edge.neighborId)) continue;
        visited.set(edge.neighborId, { degree: depth, storyId: edge.storyId });
        next.push(edge.neighborId);

        if (edge.neighborId !== sourceUserId) {
          results.push({
            sourceUserId,
            targetUserId: edge.neighborId,
            degree: depth,
            introducedViaStoryId: edge.storyId,
          });
        }
      }
    }

    frontier = next;
    if (!frontier.length) break;
  }

  return results;
}

/** Mirrors getNetworkUserIdsFromConnections — query materialized rows with a viewer depth cap. */
export function networkUserIdsFromMaterializedRows(
  rows: MaterializedConnectionRow[],
  viewerId: string,
  maxDegree: number
): string[] {
  if (maxDegree <= 0) return [];
  return rows
    .filter(
      (r) =>
        r.sourceUserId === viewerId &&
        r.degree >= 1 &&
        r.degree <= maxDegree
    )
    .map((r) => r.targetUserId);
}
