import "server-only";

import { prisma } from "@/lib/prisma";
import { userPair } from "@/lib/trust-score";
import { getSharedIntroducerCountsBulk } from "@/lib/shared-introducers";

export type IntroductionSuggestion = {
  id: string;
  message: string;
  personA: { id: string; name: string; profilePicture: string | null };
  personB: { id: string; name: string; profilePicture: string | null };
  reason: string;
};

const MAX_PAIR_CANDIDATES = 60;

type IntroducedByViewerRow = {
  taggedUserId: string | null;
  taggedUser: { id: string; name: string; profilePicture: string | null } | null;
  story: { category: { name: string } | null };
};

type IntroducedToViewerRow = {
  story: {
    userId: string;
    user: { id: string; name: string; profilePicture: string | null };
    category: { name: string } | null;
  };
};

export type IntroductionSuggestionsContext = {
  introducedByViewer: IntroducedByViewerRow[];
  introducedToViewer: IntroducedToViewerRow[];
};

/** Generate human-centered introduction suggestions from categories and graph. */
export async function getIntroductionSuggestions(
  viewerId: string,
  limit = 5,
  ctx?: IntroductionSuggestionsContext
): Promise<IntroductionSuggestion[]> {
  let introducedByViewer: IntroducedByViewerRow[];
  let introducedToViewer: IntroducedToViewerRow[];

  if (ctx) {
    introducedByViewer = ctx.introducedByViewer;
    introducedToViewer = ctx.introducedToViewer;
  } else {
    [introducedByViewer, introducedToViewer] = await Promise.all([
      prisma.storyTag.findMany({
        where: {
          story: { userId: viewerId, status: "published" },
          taggedUserId: { not: null },
        },
        select: {
          taggedUserId: true,
          taggedUser: { select: { id: true, name: true, profilePicture: true } },
          story: {
            select: {
              category: { select: { name: true } },
            },
          },
        },
        take: 20,
      }),
      prisma.storyTag.findMany({
        where: {
          taggedUserId: viewerId,
          story: { status: "published" },
        },
        select: {
          story: {
            select: {
              userId: true,
              user: { select: { id: true, name: true, profilePicture: true } },
              category: { select: { name: true } },
            },
          },
        },
        take: 20,
      }),
    ]);
  }

  const suggestions: IntroductionSuggestion[] = [];
  const seen = new Set<string>();
  const pairCandidates: Array<{
    key: string;
    personA: { id: string; name: string; profilePicture: string | null };
    personB: { id: string; name: string; profilePicture: string | null };
    catA: string;
    catB: string;
  }> = [];

  for (const a of introducedByViewer) {
    if (!a.taggedUser) continue;
    for (const b of introducedByViewer) {
      if (!b.taggedUser || a.taggedUser.id === b.taggedUser.id) continue;
      const key = [a.taggedUser.id, b.taggedUser.id].sort().join(":");
      if (seen.has(key)) continue;
      seen.add(key);
      pairCandidates.push({
        key,
        personA: a.taggedUser,
        personB: b.taggedUser,
        catA: a.story.category?.name ?? "your network",
        catB: b.story.category?.name ?? "your network",
      });
      if (pairCandidates.length >= MAX_PAIR_CANDIDATES) break;
    }
    if (pairCandidates.length >= MAX_PAIR_CANDIDATES) break;
  }

  const countMap = await getSharedIntroducerCountsBulk(
    pairCandidates.map((p) => [p.personA.id, p.personB.id])
  );

  for (const p of pairCandidates) {
    const [userAId, userBId] = userPair(p.personA.id, p.personB.id);
    const shared = countMap.get(`${userAId}:${userBId}`) ?? 0;
    if (shared > 0) continue;

    const sameCategory = p.catA === p.catB && p.catA !== "your network";
    suggestions.push({
      id: p.key,
      message: sameCategory
        ? `Your ${p.catA.toLowerCase()} friend ${p.personA.name.split(" ")[0]} might enjoy meeting ${p.personB.name.split(" ")[0]}.`
        : `${p.personA.name.split(" ")[0]} and ${p.personB.name.split(" ")[0]} are both people you trust — they might have a lot in common.`,
      personA: p.personA,
      personB: p.personB,
      reason: sameCategory ? `Both in your ${p.catA} circle` : "Both in your trusted network",
    });
    if (suggestions.length >= limit) return suggestions;
  }

  if (suggestions.length < limit && introducedToViewer.length >= 2) {
    const mentors = introducedToViewer.filter((t) =>
      t.story.category?.name?.match(/mentor|business|professional/i)
    );
    const friends = introducedByViewer.filter((t) =>
      t.story.category?.name?.match(/friend|family|church/i)
    );
    if (mentors[0]?.story.user && friends[0]?.taggedUser) {
      const key = `m:${mentors[0].story.user.id}:${friends[0].taggedUser!.id}`;
      if (!seen.has(key)) {
        suggestions.push({
          id: key,
          message: `Your mentor ${mentors[0].story.user.name.split(" ")[0]} may enjoy meeting ${friends[0].taggedUser!.name.split(" ")[0]}.`,
          personA: mentors[0].story.user,
          personB: friends[0].taggedUser!,
          reason: "Mentorship × trusted friend",
        });
      }
    }
  }

  return suggestions.slice(0, limit);
}
