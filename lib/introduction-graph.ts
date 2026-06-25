import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { BRAND } from "@/lib/branding";
import {
  computeMutualIntroducersFromIndex,
  mutualIntroducersToPaths,
} from "@/lib/introduction-graph-mutual";
import { buildReasonFromEvidence, reasonTextForDepth } from "@/lib/introduction-graph-reason";

export { computeMutualIntroducersFromIndex, mutualIntroducersToPaths };

export type IntroUser = {
  id: string;
  name: string;
  profilePicture: string | null;
};

export type IntroductionEdge = {
  introducerId: string;
  introducedId: string;
  storyId: string;
  introducedAt: Date;
  introducer: IntroUser;
};

export type MutualIntroducer = IntroUser & {
  introducedViewerAt: Date;
  introducedOtherAt: Date;
  viewerStoryId: string;
  otherStoryId: string;
};

export type IntroductionPath = {
  introducer: IntroUser;
  toViewer: { storyId: string; at: Date };
  toOther: { storyId: string; at: Date };
};

export type IntroductionEvidence = {
  storyId: string;
  introducer: IntroUser;
  introducedUsers: IntroUser[];
  date: Date;
  caption: string;
  thumbnail: string;
};

export type ConnectionReason = {
  reason: string;
  label: string;
  detail: string;
  introducerUser: IntroUser | null;
  introducerName: string | null;
  introductionStoryId: string | null;
  introductionStoryIds: string[];
  introductionDate: Date | null;
  introducers: IntroUser[];
  mutualCount: number;
  kind:
    | "mutual_introducer"
    | "you_introduced"
    | "introduced_you"
    | "same_introducer_peer"
    | "direct"
    | "second_degree"
    | "own_post";
  connectionDepth: number | null;
  evidence: IntroductionEvidence[];
};

export type RelatedIntroduction = IntroUser & {
  storyId: string;
  introducedAt: Date;
};

export type ConversationGraphContext = {
  mutualIntroducers: MutualIntroducer[];
  mutualCount: number;
  paths: IntroductionPath[];
  pathChain: PathChainNode[];
  firstConnectionAt: Date | null;
  relatedByIntroducer: Array<{
    introducer: IntroUser;
    people: RelatedIntroduction[];
  }>;
  connectionReason: ConnectionReason;
};

const userSelect = { id: true, name: true, profilePicture: true } as const;

const storyMetaSelect = {
  id: true,
  mediaUrl: true,
  mediaType: true,
  text: true,
  userId: true,
  publishedAt: true,
  createdAt: true,
  user: { select: userSelect },
  tags: {
    where: { taggedUserId: { not: null } },
    select: {
      taggedUserId: true,
      taggedUser: { select: userSelect },
    },
  },
} as const;

export function conversationPair(userA: string, userB: string): [string, string] {
  return userA < userB ? [userA, userB] : [userB, userA];
}

export const loadIntroductionEdges = cache(async (): Promise<IntroductionEdge[]> => {
  const tags = await prisma.storyTag.findMany({
    where: {
      taggedUserId: { not: null },
      story: { status: "published" },
    },
    select: {
      taggedUserId: true,
      storyId: true,
      story: {
        select: {
          userId: true,
          publishedAt: true,
          createdAt: true,
          user: { select: userSelect },
        },
      },
    },
  });

  return tags
    .filter((t): t is typeof t & { taggedUserId: string } => Boolean(t.taggedUserId))
    .map((t) => ({
      introducerId: t.story.userId,
      introducedId: t.taggedUserId,
      storyId: t.storyId,
      introducedAt: t.story.publishedAt ?? t.story.createdAt,
      introducer: t.story.user,
    }));
});

type GraphIndex = {
  introducersOf: Map<string, IntroductionEdge[]>;
  introducedBy: Map<string, IntroductionEdge[]>;
};

const buildGraphIndex = cache(async (): Promise<GraphIndex> => {
  const edges = await loadIntroductionEdges();
  const introducersOf = new Map<string, IntroductionEdge[]>();
  const introducedBy = new Map<string, IntroductionEdge[]>();

  for (const edge of edges) {
    const toIntroduced = introducersOf.get(edge.introducedId) ?? [];
    toIntroduced.push(edge);
    introducersOf.set(edge.introducedId, toIntroduced);

    const byIntro = introducedBy.get(edge.introducerId) ?? [];
    byIntro.push(edge);
    introducedBy.set(edge.introducerId, byIntro);
  }

  return { introducersOf, introducedBy };
});

async function loadStoryMetaByIds(storyIds: string[]) {
  const unique = Array.from(new Set(storyIds));
  if (!unique.length) return new Map<string, StoryMetaRow>();

  const stories = await prisma.story.findMany({
    where: { id: { in: unique } },
    select: storyMetaSelect,
  });

  return new Map(stories.map((s) => [s.id, s]));
}

type StoryMetaRow = Awaited<
  ReturnType<typeof prisma.story.findMany<{ select: typeof storyMetaSelect }>>
>[number];

function storyCaption(meta: StoryMetaRow): string {
  const tagged = meta.tags
    .map((t) => t.taggedUser?.name)
    .filter(Boolean)
    .slice(0, 2);
  if (tagged.length) {
    return `${meta.user.name} introducing ${tagged.join(" & ")}`;
  }
  return meta.text ?? `${meta.user.name}'s introduction`;
}

function edgeToEvidence(
  edge: IntroductionEdge,
  meta: StoryMetaRow | undefined,
  introducedUsers: IntroUser[]
): IntroductionEvidence {
  return {
    storyId: edge.storyId,
    introducer: edge.introducer,
    introducedUsers,
    date: edge.introducedAt,
    caption: meta ? storyCaption(meta) : `${edge.introducer.name}'s introduction`,
    thumbnail: meta?.mediaUrl ?? "",
  };
}

function earliestDate(dates: Date[]): Date | null {
  if (!dates.length) return null;
  return dates.reduce((a, b) => (a < b ? a : b));
}

export async function getIntroductionEvidence(
  userAId: string,
  userBId: string
): Promise<IntroductionEvidence[]> {
  const index = await buildGraphIndex();
  return getIntroductionEvidenceWithIndex(userAId, userBId, index);
}

async function getIntroductionEvidenceWithIndex(
  userAId: string,
  userBId: string,
  index: GraphIndex
): Promise<IntroductionEvidence[]> {
  const { introducersOf, introducedBy } = index;
  const edgesA = introducersOf.get(userAId) ?? [];
  const edgesB = introducersOf.get(userBId) ?? [];
  const byIntroducerB = new Map(edgesB.map((e) => [e.introducerId, e]));

  const rawEdges: IntroductionEdge[] = [];

  for (const edgeA of edgesA) {
    if (byIntroducerB.has(edgeA.introducerId)) {
      rawEdges.push(edgeA);
      rawEdges.push(byIntroducerB.get(edgeA.introducerId)!);
    }
  }

  const youIntroduced = (introducedBy.get(userAId) ?? []).find(
    (e) => e.introducedId === userBId
  );
  if (youIntroduced) rawEdges.push(youIntroduced);

  const theyIntroduced = (introducedBy.get(userBId) ?? []).find(
    (e) => e.introducedId === userAId
  );
  if (theyIntroduced) rawEdges.push(theyIntroduced);

  const deduped = Array.from(
    new Map(rawEdges.map((e) => [e.storyId, e])).values()
  );
  if (!deduped.length) return [];

  const storyIds = deduped.map((e) => e.storyId);
  const metaMap = await loadStoryMetaByIds(storyIds);
  const userIds = new Set<string>([userAId, userBId]);
  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(userIds) } },
    select: userSelect,
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return deduped.map((edge) => {
    const meta = metaMap.get(edge.storyId);
    const introducedUsers: IntroUser[] = [];
    if (meta) {
      for (const tag of meta.tags) {
        if (tag.taggedUser && userIds.has(tag.taggedUser.id)) {
          introducedUsers.push(tag.taggedUser);
        }
      }
    }
    if (!introducedUsers.length) {
      const u = userMap.get(edge.introducedId);
      if (u) introducedUsers.push(u);
    }
    return edgeToEvidence(edge, meta, introducedUsers);
  });
}

export async function enrichEvidenceBatch(
  evidenceList: IntroductionEvidence[][]
): Promise<IntroductionEvidence[][]> {
  const allIds = evidenceList.flat().map((e) => e.storyId);
  const metaMap = await loadStoryMetaByIds(allIds);

  return evidenceList.map((list) =>
    list.map((e) => {
      const meta = metaMap.get(e.storyId);
      if (!meta) return e;
      return {
        ...e,
        caption: storyCaption(meta),
        thumbnail: meta.mediaUrl,
      };
    })
  );
}

export async function getMutualIntroducers(
  userAId: string,
  userBId: string
): Promise<MutualIntroducer[]> {
  const { introducersOf } = await buildGraphIndex();
  return computeMutualIntroducersFromIndex(userAId, userBId, introducersOf);
}

export async function getSharedIntroductionCount(
  userAId: string,
  userBId: string
): Promise<number> {
  return (await getMutualIntroducers(userAId, userBId)).length;
}

export async function getIntroductionPath(
  userAId: string,
  userBId: string
): Promise<IntroductionPath[]> {
  return mutualIntroducersToPaths(await getMutualIntroducers(userAId, userBId));
}

export type PathChainNode = IntroUser & {
  storyId: string | null;
};

function edgeBetween(
  userId: string,
  neighborId: string,
  index: GraphIndex
): IntroductionEdge | null {
  for (const e of index.introducersOf.get(userId) ?? []) {
    if (e.introducerId === neighborId) return e;
  }
  for (const e of index.introducedBy.get(userId) ?? []) {
    if (e.introducedId === neighborId) return e;
  }
  return null;
}

export async function getIntroductionPathChain(
  viewerId: string,
  otherUserId: string
): Promise<PathChainNode[]> {
  const index = await buildGraphIndex();
  return getIntroductionPathChainWithIndex(viewerId, otherUserId, index);
}

async function getIntroductionPathChainWithIndex(
  viewerId: string,
  otherUserId: string,
  index: GraphIndex
): Promise<PathChainNode[]> {
  if (viewerId === otherUserId) {
    const user = await prisma.user.findUnique({
      where: { id: viewerId },
      select: userSelect,
    });
    return user ? [{ ...user, storyId: null }] : [];
  }

  const visited = new Set<string>([viewerId]);
  const parent = new Map<string, { from: string; storyId: string }>();
  let frontier = [viewerId];
  let found = false;

  for (let depth = 1; depth <= 4 && !found; depth++) {
    const next: string[] = [];
    for (const uid of frontier) {
      for (const n of neighbors(uid, index)) {
        if (visited.has(n)) continue;
        const edge = edgeBetween(uid, n, index);
        if (!edge) continue;
        visited.add(n);
        parent.set(n, { from: uid, storyId: edge.storyId });
        if (n === otherUserId) {
          found = true;
          break;
        }
        next.push(n);
      }
      if (found) break;
    }
    frontier = next;
  }

  if (!found) return [];

  const orderedIds: string[] = [otherUserId];
  let cur = otherUserId;
  while (parent.has(cur)) {
    const p = parent.get(cur)!;
    orderedIds.unshift(p.from);
    cur = p.from;
  }

  const edgeStoryByTarget = new Map<string, string>();
  cur = otherUserId;
  while (parent.has(cur)) {
    const p = parent.get(cur)!;
    edgeStoryByTarget.set(cur, p.storyId);
    cur = p.from;
  }

  const users = await prisma.user.findMany({
    where: { id: { in: orderedIds } },
    select: userSelect,
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return orderedIds
    .map((id) => {
      const user = userMap.get(id);
      if (!user) return null;
      return { ...user, storyId: edgeStoryByTarget.get(id) ?? null };
    })
    .filter((n): n is PathChainNode => Boolean(n));
}

function neighbors(userId: string, index: GraphIndex): string[] {
  const ids = new Set<string>();
  for (const e of index.introducersOf.get(userId) ?? []) ids.add(e.introducerId);
  for (const e of index.introducedBy.get(userId) ?? []) ids.add(e.introducedId);
  return Array.from(ids);
}

async function resolveConnectionDepth(
  viewerId: string,
  otherUserId: string,
  index: GraphIndex
): Promise<number | null> {
  if (viewerId === otherUserId) return 0;

  const { getConnectionDegreeFromStore, isUserConnectionsMaterialized } =
    await import("@/services/introduction-graph-builder");

  if (await isUserConnectionsMaterialized()) {
    const stored = await getConnectionDegreeFromStore(viewerId, otherUserId);
    if (stored !== null) return stored;
  }

  return getConnectionDepthWithIndex(viewerId, otherUserId, index);
}

export async function getConnectionDepth(
  viewerId: string,
  otherUserId: string
): Promise<number | null> {
  const index = await buildGraphIndex();
  return resolveConnectionDepth(viewerId, otherUserId, index);
}

function getConnectionDepthWithIndex(
  viewerId: string,
  otherUserId: string,
  index: GraphIndex
): number | null {
  const visited = new Set<string>([viewerId]);
  let frontier = [viewerId];
  for (let depth = 1; depth <= 4; depth++) {
    const next: string[] = [];
    for (const uid of frontier) {
      for (const n of neighbors(uid, index)) {
        if (n === otherUserId) return depth;
        if (!visited.has(n)) {
          visited.add(n);
          next.push(n);
        }
      }
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return null;
}

export async function getConnectionReason(
  viewerId: string,
  otherUserId: string
): Promise<ConnectionReason> {
  const index = await buildGraphIndex();
  const mutual = computeMutualIntroducersFromIndex(viewerId, otherUserId, index.introducersOf);
  return getConnectionReasonWithIndex(viewerId, otherUserId, index, mutual);
}

async function getConnectionReasonWithIndex(
  viewerId: string,
  otherUserId: string,
  index: GraphIndex,
  mutual: MutualIntroducer[]
): Promise<ConnectionReason> {
  const [evidence, depth] = await Promise.all([
    getIntroductionEvidenceWithIndex(viewerId, otherUserId, index),
    resolveConnectionDepth(viewerId, otherUserId, index),
  ]);
  const { introducedBy } = index;

  const youEdge = (introducedBy.get(viewerId) ?? []).find(
    (e) => e.introducedId === otherUserId
  );
  if (youEdge) {
    const ev = evidence.filter((e) => e.storyId === youEdge.storyId);
    return buildReasonFromEvidence(
      "you_introduced",
      "You introduced them",
      "You introduced them",
      "You recommended them to your trusted network",
      ev.length ? ev : evidence.slice(0, 1),
      [],
      0,
      1
    );
  }

  const theyEdge = (introducedBy.get(otherUserId) ?? []).find(
    (e) => e.introducedId === viewerId
  );
  if (theyEdge) {
    const ev = evidence.filter((e) => e.storyId === theyEdge.storyId);
    const rt = reasonTextForDepth(1, theyEdge.introducer.name, 0);
    return buildReasonFromEvidence(
      "introduced_you",
      rt.reason,
      rt.label,
      "They recommended you through an introduction",
      ev.length ? ev : evidence.slice(0, 1),
      [theyEdge.introducer],
      0,
      1
    );
  }

  if (mutual.length === 1) {
    const m = mutual[0];
    const mutualEvidence = evidence.filter((e) => e.introducer.id === m.id);
    const rt = reasonTextForDepth(1, m.name, 1);
    return buildReasonFromEvidence(
      "mutual_introducer",
      rt.reason,
      rt.label,
      `${m.name} introduced you both`,
      mutualEvidence.length ? mutualEvidence : evidence,
      [m],
      1,
      depth
    );
  }

  if (mutual.length > 1) {
    const rt = reasonTextForDepth(depth, null, mutual.length);
    return buildReasonFromEvidence(
      "mutual_introducer",
      rt.reason,
      rt.label,
      mutual.map((m) => m.name).join(", "),
      evidence,
      mutual,
      mutual.length,
      depth
    );
  }

  if (evidence.length) {
    const intro = evidence[0].introducer;
    const rt = reasonTextForDepth(depth, intro.name, 0);
    return buildReasonFromEvidence(
      "same_introducer_peer",
      rt.reason,
      rt.label,
      "Connected through your trusted introduction network",
      evidence,
      [intro],
      1,
      depth
    );
  }

  return buildReasonFromEvidence(
    "direct",
    "Trusted network",
    "In your trusted introduction network",
    `Connected through ${BRAND.name} introductions`,
    [],
    [],
    0,
    depth
  );
}

/** Bulk connection reasons for Discoveries feed — prefer materialized connections. */
export async function getConnectionReasonsBulk(
  viewerId: string,
  otherUserIds: string[]
): Promise<Map<string, ConnectionReason>> {
  const uniqueOthers = Array.from(new Set(otherUserIds.filter((id) => id !== viewerId)));
  const map = new Map<string, ConnectionReason>();
  if (!uniqueOthers.length) return map;

  const connections = await prisma.userConnection.findMany({
    where: { sourceUserId: viewerId, targetUserId: { in: uniqueOthers } },
    select: {
      targetUserId: true,
      degree: true,
      sharedIntroducerCount: true,
    },
  });
  const connByTarget = new Map(connections.map((c) => [c.targetUserId, c]));
  const slowPath: string[] = [];

  for (const otherId of uniqueOthers) {
    const conn = connByTarget.get(otherId);
    if (conn) {
      const { reason, label } = reasonTextForDepth(
        conn.degree,
        null,
        conn.sharedIntroducerCount
      );
      map.set(
        otherId,
        buildReasonFromEvidence(
          conn.degree <= 1 ? "direct" : conn.degree === 2 ? "second_degree" : "second_degree",
          reason,
          label,
          label,
          [],
          [],
          conn.sharedIntroducerCount,
          conn.degree
        )
      );
    } else {
      slowPath.push(otherId);
    }
  }

  if (slowPath.length) {
    await Promise.all(
      slowPath.map(async (otherId) => {
        map.set(otherId, await getConnectionReason(viewerId, otherId));
      })
    );
  }

  return map;
}

export async function getRelatedIntroductions(args: {
  viewerId: string;
  otherUserId: string;
  introducerId?: string;
  limit?: number;
}): Promise<Array<{ introducer: IntroUser; people: RelatedIntroduction[] }>> {
  const mutual = await getMutualIntroducers(args.viewerId, args.otherUserId);
  const introducerIds = args.introducerId
    ? [args.introducerId]
    : mutual.map((m) => m.id);
  return getRelatedIntroductionsResolved(
    args.viewerId,
    args.otherUserId,
    introducerIds,
    args.limit ?? 6
  );
}

export async function getNetworkUsers(
  viewerId: string,
  maxDepth: number = 2
): Promise<string[]> {
  if (maxDepth <= 0) return [viewerId];

  const { getNetworkUserIdsFromConnections, isUserConnectionsMaterialized } =
    await import("@/services/introduction-graph-builder");

  if (await isUserConnectionsMaterialized()) {
    const connected = await getNetworkUserIdsFromConnections(viewerId, maxDepth);
    return [viewerId, ...connected];
  }

  const index = await buildGraphIndex();
  const reachable = new Set<string>([viewerId]);
  let frontier = [viewerId];

  for (let d = 0; d < maxDepth; d++) {
    const next: string[] = [];
    for (const uid of frontier) {
      for (const n of neighbors(uid, index)) {
        if (!reachable.has(n)) {
          reachable.add(n);
          next.push(n);
        }
      }
    }
    frontier = next;
  }

  return Array.from(reachable);
}

export async function getConversationGraphContext(
  viewerId: string,
  otherUserId: string
): Promise<ConversationGraphContext> {
  const { isUserConnectionsMaterialized } = await import(
    "@/services/introduction-graph-builder"
  );
  if (await isUserConnectionsMaterialized()) {
    const { getConversationGraphContextFromStore } = await import(
      "@/lib/conversation-graph-fast"
    );
    return getConversationGraphContextFromStore(viewerId, otherUserId);
  }

  const index = await buildGraphIndex();
  const mutualIntroducers = computeMutualIntroducersFromIndex(
    viewerId,
    otherUserId,
    index.introducersOf
  );
  const paths = mutualIntroducersToPaths(mutualIntroducers);

  const [pathChain, connectionReason, relatedByIntroducer] = await Promise.all([
    getIntroductionPathChainWithIndex(viewerId, otherUserId, index),
    getConnectionReasonWithIndex(viewerId, otherUserId, index, mutualIntroducers),
    getRelatedIntroductionsResolved(
      viewerId,
      otherUserId,
      mutualIntroducers.map((m) => m.id),
      6,
      index
    ),
  ]);

  const dates = mutualIntroducers.flatMap((m) => [
    m.introducedViewerAt,
    m.introducedOtherAt,
  ]);
  const firstConnectionAt = earliestDate(dates);

  return {
    mutualIntroducers,
    mutualCount: mutualIntroducers.length,
    paths,
    pathChain,
    firstConnectionAt,
    relatedByIntroducer,
    connectionReason,
  };
}

async function getRelatedIntroductionsResolved(
  viewerId: string,
  otherUserId: string,
  introducerIds: string[],
  limit = 6,
  index?: GraphIndex
): Promise<Array<{ introducer: IntroUser; people: RelatedIntroduction[] }>> {
  if (!introducerIds.length) return [];

  const graphIndex = index ?? (await buildGraphIndex());
  const { introducedBy } = graphIndex;
  const exclude = new Set([viewerId, otherUserId]);
  const userIds = new Set<string>();

  const sections: Array<{ introducer: IntroUser; people: RelatedIntroduction[] }> = [];

  for (const introducerId of introducerIds.slice(0, 3)) {
    const edges = introducedBy.get(introducerId) ?? [];
    if (!edges.length) continue;
    const introducer = edges[0].introducer;
    const peopleEdges = edges.filter((e) => !exclude.has(e.introducedId)).slice(0, limit);
    for (const e of peopleEdges) userIds.add(e.introducedId);
    sections.push({
      introducer,
      people: peopleEdges.map((e) => ({
        id: e.introducedId,
        name: "",
        profilePicture: null,
        storyId: e.storyId,
        introducedAt: e.introducedAt,
      })),
    });
  }

  if (userIds.size === 0) return sections;

  const users = await prisma.user.findMany({
    where: { id: { in: Array.from(userIds) } },
    select: userSelect,
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  return sections.map((s) => ({
    ...s,
    people: s.people.map((p) => {
      const u = userMap.get(p.id);
      return u ? { ...p, name: u.name, profilePicture: u.profilePicture } : p;
    }),
  }));
}

export async function getDiscoveriesConnectionReason(
  viewerId: string,
  postAuthorId: string
): Promise<ConnectionReason> {
  if (viewerId === postAuthorId) {
    return buildReasonFromEvidence(
      "own_post",
      "Your post",
      "Your post",
      "You authored this discoveries post",
      [],
      [],
      0,
      0
    );
  }
  return getConnectionReason(viewerId, postAuthorId);
}
