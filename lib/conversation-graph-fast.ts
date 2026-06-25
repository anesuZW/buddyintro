import "server-only";

import { prisma } from "@/lib/prisma";
import { userPair } from "@/lib/trust-score";
import { mutualIntroducersToPaths } from "@/lib/introduction-graph-mutual";
import type {
  ConnectionReason,
  ConversationGraphContext,
  IntroductionEdge,
  IntroductionEvidence,
  MutualIntroducer,
  PathChainNode,
  RelatedIntroduction,
} from "@/lib/introduction-graph";
import {
  buildReasonFromEvidence,
  reasonTextForDepth,
} from "@/lib/introduction-graph-reason";

const userSelect = { id: true, name: true, profilePicture: true } as const;

type Neighbor = { id: string; storyId: string | null };

async function getMaterializedNeighborsBatch(userIds: string[]): Promise<Map<string, Neighbor[]>> {
  if (!userIds.length) return new Map();

  const [forward, backward] = await Promise.all([
    prisma.userConnection.findMany({
      where: { sourceUserId: { in: userIds }, degree: 1 },
      select: { sourceUserId: true, targetUserId: true, introducedViaStoryId: true },
    }),
    prisma.userConnection.findMany({
      where: { targetUserId: { in: userIds }, degree: 1 },
      select: { sourceUserId: true, targetUserId: true, introducedViaStoryId: true },
    }),
  ]);

  const map = new Map<string, Neighbor[]>();
  const push = (uid: string, neighbor: Neighbor) => {
    const list = map.get(uid) ?? [];
    list.push(neighbor);
    map.set(uid, list);
  };

  for (const row of forward) {
    push(row.sourceUserId, { id: row.targetUserId, storyId: row.introducedViaStoryId });
  }
  for (const row of backward) {
    push(row.targetUserId, { id: row.sourceUserId, storyId: row.introducedViaStoryId });
  }

  return map;
}

async function mutualIntroducersFromStore(
  viewerId: string,
  otherUserId: string
): Promise<MutualIntroducer[]> {
  const [userAId, userBId] = userPair(viewerId, otherUserId);
  const rows = await prisma.sharedIntroducerRelationship.findMany({
    where: { userAId, userBId },
    include: {
      sharedIntroducer: { select: userSelect },
      firstStory: { select: { id: true, publishedAt: true, createdAt: true } },
      secondStory: { select: { id: true, publishedAt: true, createdAt: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((row) => {
    const viewerIsA = viewerId === userAId;
    const viewerStoryId = viewerIsA
      ? row.firstIntroductionStoryId!
      : row.secondIntroductionStoryId!;
    const otherStoryId = viewerIsA
      ? row.secondIntroductionStoryId!
      : row.firstIntroductionStoryId!;
    const viewerStory = viewerIsA ? row.firstStory : row.secondStory;
    const otherStory = viewerIsA ? row.secondStory : row.firstStory;
    const fallback = row.createdAt;
    return {
      ...row.sharedIntroducer,
      introducedViewerAt: viewerStory?.publishedAt ?? viewerStory?.createdAt ?? fallback,
      introducedOtherAt: otherStory?.publishedAt ?? otherStory?.createdAt ?? fallback,
      viewerStoryId: viewerStoryId ?? row.firstIntroductionStoryId!,
      otherStoryId: otherStoryId ?? row.secondIntroductionStoryId!,
    };
  });
}

async function loadDirectIntroductionEdges(
  userAId: string,
  userBId: string
): Promise<IntroductionEdge[]> {
  const tags = await prisma.storyTag.findMany({
    where: {
      taggedUserId: { not: null },
      story: { status: "published" },
      OR: [
        { story: { userId: userAId }, taggedUserId: userBId },
        { story: { userId: userBId }, taggedUserId: userAId },
      ],
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
}

async function getPathChainFromMaterializedGraph(
  viewerId: string,
  otherUserId: string
): Promise<PathChainNode[]> {
  if (viewerId === otherUserId) {
    const user = await prisma.user.findUnique({ where: { id: viewerId }, select: userSelect });
    return user ? [{ ...user, storyId: null }] : [];
  }

  const visited = new Set<string>([viewerId]);
  const parent = new Map<string, { from: string; storyId: string | null }>();
  let frontier = [viewerId];
  let found = false;

  for (let depth = 0; depth < 4 && !found; depth += 1) {
    const neighborMap = await getMaterializedNeighborsBatch(frontier);
    const next: string[] = [];

    for (const uid of frontier) {
      for (const neighbor of neighborMap.get(uid) ?? []) {
        if (visited.has(neighbor.id)) continue;
        visited.add(neighbor.id);
        parent.set(neighbor.id, { from: uid, storyId: neighbor.storyId });
        if (neighbor.id === otherUserId) {
          found = true;
          break;
        }
        next.push(neighbor.id);
      }
      if (found) break;
    }
    frontier = next;
  }

  if (!found) return [];

  const orderedIds: string[] = [otherUserId];
  let cur = otherUserId;
  while (parent.has(cur)) {
    orderedIds.unshift(parent.get(cur)!.from);
    cur = parent.get(cur)!.from;
  }

  const edgeStoryByTarget = new Map<string, string | null>();
  cur = otherUserId;
  while (parent.has(cur)) {
    edgeStoryByTarget.set(cur, parent.get(cur)!.storyId);
    cur = parent.get(cur)!.from;
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

async function loadRelatedIntroductionsScoped(
  viewerId: string,
  otherUserId: string,
  introducerIds: string[],
  limit = 6
): Promise<Array<{ introducer: { id: string; name: string; profilePicture: string | null }; people: RelatedIntroduction[] }>> {
  const ids = introducerIds.slice(0, 3);
  if (!ids.length) return [];

  const tags = await prisma.storyTag.findMany({
    where: {
      story: { userId: { in: ids }, status: "published" },
      taggedUserId: { not: null, notIn: [viewerId, otherUserId] },
    },
    select: {
      storyId: true,
      taggedUserId: true,
      story: {
        select: {
          userId: true,
          publishedAt: true,
          createdAt: true,
          user: { select: userSelect },
        },
      },
      taggedUser: { select: userSelect },
    },
    orderBy: { story: { publishedAt: "asc" } },
    take: limit * ids.length,
  });

  const byIntroducer = new Map<string, RelatedIntroduction[]>();
  const introducerUsers = new Map<string, { id: string; name: string; profilePicture: string | null }>();

  for (const tag of tags) {
    if (!tag.taggedUserId || !tag.taggedUser) continue;
    const introId = tag.story.userId;
    if (!ids.includes(introId)) continue;
    introducerUsers.set(introId, tag.story.user);
    const list = byIntroducer.get(introId) ?? [];
    if (list.length >= limit) continue;
    list.push({
      id: tag.taggedUserId,
      name: tag.taggedUser.name,
      profilePicture: tag.taggedUser.profilePicture,
      storyId: tag.storyId,
      introducedAt: tag.story.publishedAt ?? tag.story.createdAt,
    });
    byIntroducer.set(introId, list);
  }

  return ids
    .filter((id) => byIntroducer.has(id))
    .map((id) => ({
      introducer: introducerUsers.get(id)!,
      people: byIntroducer.get(id) ?? [],
    }));
}

async function buildEvidenceFromMutualAndDirect(
  viewerId: string,
  otherUserId: string,
  mutual: MutualIntroducer[],
  directEdges: IntroductionEdge[]
): Promise<IntroductionEvidence[]> {
  const storyIds = new Set<string>();
  for (const m of mutual.slice(0, 3)) {
    storyIds.add(m.viewerStoryId);
    storyIds.add(m.otherStoryId);
  }
  for (const e of directEdges) storyIds.add(e.storyId);

  if (!storyIds.size) return [];

  const stories = await prisma.story.findMany({
    where: { id: { in: Array.from(storyIds) } },
    select: {
      id: true,
      mediaUrl: true,
      text: true,
      userId: true,
      publishedAt: true,
      createdAt: true,
      user: { select: userSelect },
      tags: {
        where: { taggedUserId: { in: [viewerId, otherUserId] } },
        select: { taggedUser: { select: userSelect } },
      },
    },
  });

  const metaMap = new Map(stories.map((s) => [s.id, s]));
  const evidence: IntroductionEvidence[] = [];

  for (const edge of directEdges) {
    const meta = metaMap.get(edge.storyId);
    const tagged = meta?.tags.map((t) => t.taggedUser).filter((u): u is NonNullable<typeof u> => Boolean(u)) ?? [];
    evidence.push({
      storyId: edge.storyId,
      introducer: edge.introducer,
      introducedUsers: tagged.length ? tagged : [{ id: edge.introducedId, name: "", profilePicture: null }],
      date: edge.introducedAt,
      caption: meta?.text ?? `${edge.introducer.name}'s introduction`,
      thumbnail: meta?.mediaUrl ?? "",
    });
  }

  for (const m of mutual.slice(0, 2)) {
    const meta = metaMap.get(m.viewerStoryId);
    if (!meta) continue;
    evidence.push({
      storyId: m.viewerStoryId,
      introducer: m,
      introducedUsers: [{ id: viewerId, name: "", profilePicture: null }],
      date: m.introducedViewerAt,
      caption: meta.text ?? `${m.name}'s introduction`,
      thumbnail: meta.mediaUrl ?? "",
    });
  }

  return evidence.slice(0, 6);
}

async function buildConnectionReasonFromStore(
  viewerId: string,
  otherUserId: string,
  mutual: MutualIntroducer[],
  directEdges: IntroductionEdge[],
  depth: number | null,
  evidence: IntroductionEvidence[]
): Promise<ConnectionReason> {
  const youEdge = directEdges.find(
    (e) => e.introducerId === viewerId && e.introducedId === otherUserId
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

  const theyEdge = directEdges.find(
    (e) => e.introducerId === otherUserId && e.introducedId === viewerId
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

  const rt = reasonTextForDepth(depth, null, 0);
  return buildReasonFromEvidence(
    depth && depth > 1 ? "second_degree" : "direct",
    rt.reason,
    rt.label,
    rt.label,
    [],
    [],
    0,
    depth
  );
}

function earliestDate(dates: Date[]): Date | null {
  if (!dates.length) return null;
  return dates.reduce((a, b) => (a < b ? a : b));
}

/** Fast path using materialized trust graph — avoids full StoryTag scan. */
export async function getConversationGraphContextFromStore(
  viewerId: string,
  otherUserId: string
): Promise<ConversationGraphContext> {
  const [mutualIntroducers, directEdges, pathChain, connectionRow] = await Promise.all([
    mutualIntroducersFromStore(viewerId, otherUserId),
    loadDirectIntroductionEdges(viewerId, otherUserId),
    getPathChainFromMaterializedGraph(viewerId, otherUserId),
    prisma.userConnection.findUnique({
      where: {
        sourceUserId_targetUserId: { sourceUserId: viewerId, targetUserId: otherUserId },
      },
      select: { degree: true },
    }),
  ]);

  const paths = mutualIntroducersToPaths(mutualIntroducers);
  const depth = connectionRow?.degree ?? null;

  const [evidence, relatedByIntroducer] = await Promise.all([
    buildEvidenceFromMutualAndDirect(viewerId, otherUserId, mutualIntroducers, directEdges),
    loadRelatedIntroductionsScoped(
      viewerId,
      otherUserId,
      mutualIntroducers.map((m) => m.id)
    ),
  ]);

  const connectionReason = await buildConnectionReasonFromStore(
    viewerId,
    otherUserId,
    mutualIntroducers,
    directEdges,
    depth,
    evidence
  );

  const dates = mutualIntroducers.flatMap((m) => [m.introducedViewerAt, m.introducedOtherAt]);

  return {
    mutualIntroducers,
    mutualCount: mutualIntroducers.length,
    paths,
    pathChain,
    firstConnectionAt: earliestDate(dates),
    relatedByIntroducer,
    connectionReason,
  };
}
