import { prisma } from "@/lib/prisma";
import { rebuildTrustGraph } from "@/lib/shared-introducers";
import {
  bfsConnections,
  type AdjEdge,
} from "@/lib/introduction-graph-materialization";
import { USER_CONNECTION_LIMITS } from "@/lib/user-connection-limits";

const BATCH_SIZE = 500;

/** Load undirected introduction adjacency from published story tags (single query). */
async function loadIntroductionAdjacency(): Promise<Map<string, AdjEdge[]>> {
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

type ConnectionRow = {
  sourceUserId: string;
  targetUserId: string;
  degree: number;
  introducedViaStoryId: string | null;
};

/** Rebuild the entire user_connections table from published introductions. */
export async function rebuildUserConnections(): Promise<{ rows: number; users: number }> {
  const [adj, users] = await Promise.all([
    loadIntroductionAdjacency(),
    prisma.user.findMany({ select: { id: true } }),
  ]);

  const userIds =
    users.length > 0 ? users.map((u) => u.id) : Array.from(adj.keys());

  const allRows: ConnectionRow[] = [];
  for (const userId of userIds) {
    allRows.push(...bfsConnections(userId, adj));
  }

  await prisma.userConnection.deleteMany({});

  for (let i = 0; i < allRows.length; i += BATCH_SIZE) {
    await prisma.userConnection.createMany({
      data: allRows.slice(i, i + BATCH_SIZE),
      skipDuplicates: true,
    });
  }

  await rebuildTrustGraph();

  return { rows: allRows.length, users: userIds.length };
}

/** Rebuild connections for one source user (after they publish an introduction). */
export async function rebuildUserConnectionsForUser(userId: string): Promise<number> {
  const adj = await loadIntroductionAdjacency();
  const rows = bfsConnections(userId, adj);

  await prisma.userConnection.deleteMany({ where: { sourceUserId: userId } });

  if (rows.length) {
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      await prisma.userConnection.createMany({
        data: rows.slice(i, i + BATCH_SIZE),
        skipDuplicates: true,
      });
    }
  }

  return rows.length;
}

/** Refresh materialized graph for users affected by a new/changed introduction. */
export async function refreshConnectionsForUsers(userIds: string[]): Promise<void> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (!unique.length) return;

  await Promise.all(unique.map((id) => rebuildUserConnectionsForUser(id)));
  await rebuildTrustGraph({ notifyForUserIds: unique });
}

async function connectionsAtDegree(sourceUserId: string, degree: number) {
  return prisma.userConnection.findMany({
    where: { sourceUserId, degree },
    select: {
      targetUserId: true,
      introducedViaStoryId: true,
      degree: true,
      targetUser: {
        select: { id: true, name: true, profilePicture: true },
      },
    },
    orderBy: { targetUserId: "asc" },
    take: USER_CONNECTION_LIMITS.perDegree,
  });
}

export async function getFirstDegreeConnections(userId: string) {
  return connectionsAtDegree(userId, 1);
}

export async function getSecondDegreeConnections(userId: string) {
  return connectionsAtDegree(userId, 2);
}

export async function getThirdDegreeConnections(userId: string) {
  return connectionsAtDegree(userId, 3);
}

export async function getFourthDegreeConnections(userId: string) {
  return connectionsAtDegree(userId, 4);
}

/** All target user IDs within maxDegree hops (excludes self). */
export async function getNetworkUserIdsFromConnections(
  viewerId: string,
  maxDegree: number
): Promise<string[]> {
  if (maxDegree <= 0) return [];

  const rows = await prisma.userConnection.findMany({
    where: {
      sourceUserId: viewerId,
      degree: { lte: maxDegree, gte: 1 },
    },
    select: { targetUserId: true },
    take: USER_CONNECTION_LIMITS.networkIds,
  });

  return rows.map((r) => r.targetUserId);
}

/** Minimum introduction degree between two users (null if not connected within 4 hops). */
export async function getConnectionDegreeFromStore(
  sourceUserId: string,
  targetUserId: string
): Promise<number | null> {
  if (sourceUserId === targetUserId) return 0;

  const row = await prisma.userConnection.findUnique({
    where: {
      sourceUserId_targetUserId: { sourceUserId, targetUserId },
    },
    select: { degree: true },
  });

  return row?.degree ?? null;
}

/** Whether the materialized graph has been populated at all. */
export async function isUserConnectionsMaterialized(): Promise<boolean> {
  const row = await prisma.userConnection.findFirst({ select: { id: true } });
  return Boolean(row);
}

export { bfsConnections, MAX_INTRODUCTION_GRAPH_DEGREE } from "@/lib/introduction-graph-materialization";
