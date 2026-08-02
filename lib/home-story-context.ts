import type { MutualTagFeedContext } from "@/services/feed";
import type { IntroductionSuggestionsContext } from "@/services/introduction-suggestions";

/** Request-scoped visibility prefetch — replaces filterStoriesByVisibilityGate StoryTag scans. */
export type HomeVisibilityPrefetch = {
  coTagAuthorIds: ReadonlySet<string>;
  everIntroducedAuthorIds: ReadonlySet<string>;
};

/** Precomputed trust-network tag metrics from consolidated home scan. */
export type TrustNetworkStatsContext = {
  introducedByMeCount: number;
  introducedToMeCount: number;
  uniqueIntroducerCount: number;
  introducedTargetIds: string[];
};

export type HomeStoryContext = {
  feedCtx: MutualTagFeedContext;
  suggestionsCtx: IntroductionSuggestionsContext;
  introducerAuthorIds: string[];
  visibility: HomeVisibilityPrefetch;
  trustStats: TrustNetworkStatsContext;
};

type AuthoredTagRow = {
  taggedUserId: string | null;
  taggedUser: { id: string; name: string; profilePicture: string | null } | null;
  story: { status: string; category: { name: string } | null };
};

type ViewerTaggedRow = {
  storyId: string;
  story: {
    userId: string;
    status: string;
    user: { id: string; name: string; profilePicture: string | null };
    category: { name: string } | null;
  };
};

const PUBLISHED = "published";
const EVER_INTRO_STATUSES = new Set([PUBLISHED, "expired"]);

export function buildHomeStoryContextFromRows(
  viewerAuthoredTags: AuthoredTagRow[],
  viewerTaggedTags: ViewerTaggedRow[]
): HomeStoryContext {
  const myTaggedUserIds = Array.from(
    new Set(
      viewerAuthoredTags
        .map((t) => t.taggedUserId)
        .filter((id): id is string => Boolean(id))
    )
  );

  const publishedAuthored = viewerAuthoredTags.filter(
    (t) => t.taggedUserId && t.story.status === PUBLISHED
  );

  const introducedByMeCount = viewerAuthoredTags.filter(
    (t) => t.story.status === PUBLISHED
  ).length;

  const introducedByViewer = publishedAuthored.slice(0, 20).map((t) => ({
    taggedUserId: t.taggedUserId,
    taggedUser: t.taggedUser,
    story: { category: t.story.category },
  }));

  const introducedTargetIds = Array.from(
    new Set(
      publishedAuthored
        .map((t) => t.taggedUserId)
        .filter((id): id is string => Boolean(id))
    )
  );

  const coTagAuthorIds = Array.from(
    new Set(viewerTaggedTags.map((t) => t.story.userId))
  );

  const publishedTagged = viewerTaggedTags.filter((t) => t.story.status === PUBLISHED);
  const introducedToViewer = publishedTagged.slice(0, 20).map((t) => ({
    story: {
      userId: t.story.userId,
      user: t.story.user,
      category: t.story.category,
    },
  }));

  const everIntroducedAuthorIds = new Set<string>();
  for (const t of viewerTaggedTags) {
    if (EVER_INTRO_STATUSES.has(t.story.status)) {
      everIntroducedAuthorIds.add(t.story.userId);
    }
  }

  const uniqueIntroducerCount = new Set(publishedTagged.map((t) => t.story.userId)).size;

  return {
    feedCtx: { myTaggedUserIds, coTagAuthorIds },
    suggestionsCtx: { introducedByViewer, introducedToViewer },
    introducerAuthorIds: coTagAuthorIds,
    visibility: {
      coTagAuthorIds: new Set(coTagAuthorIds),
      everIntroducedAuthorIds,
    },
    trustStats: {
      introducedByMeCount,
      introducedToMeCount: publishedTagged.length,
      uniqueIntroducerCount,
      introducedTargetIds,
    },
  };
}
