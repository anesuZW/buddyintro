import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { FeedItem } from "@/types";
import { getMutualTagFeed, type MutualTagFeedContext } from "@/services/feed";
import {
  getIntroductionSuggestions,
  type IntroductionSuggestionsContext,
} from "@/services/introduction-suggestions";
import { getStoryBarForViewer } from "@/services/stories";
import { getTrustNetworkStats } from "@/services/trust-network";
import { getTrustRecommendations } from "@/services/trust-recommendations";
import type { TrustRecommendation } from "@/services/trust-recommendations";
import type { IntroductionSuggestion } from "@/services/introduction-suggestions";
import type { StoryGroup } from "@/components/stories/StoryBar";

/** Shared story-tag context — dedupes overlapping scans across home loaders (request-scoped). */
export const getHomeStoryContext = cache(async (userId: string) => {
  const [myTags, taggedMe, introducedByViewer, introducedToViewer] = await Promise.all([
    prisma.storyTag.findMany({
      where: { story: { userId }, taggedUserId: { not: null } },
      select: { taggedUserId: true },
    }),
    prisma.storyTag.findMany({
      where: { taggedUserId: userId },
      select: { story: { select: { userId: true } } },
    }),
    prisma.storyTag.findMany({
      where: {
        story: { userId, status: "published" },
        taggedUserId: { not: null },
      },
      select: {
        taggedUserId: true,
        taggedUser: { select: { id: true, name: true, profilePicture: true } },
        story: { select: { category: { select: { name: true } } } },
      },
      take: 20,
    }),
    prisma.storyTag.findMany({
      where: { taggedUserId: userId, story: { status: "published" } },
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

  const myTaggedUserIds = Array.from(
    new Set(myTags.map((t) => t.taggedUserId!).filter(Boolean))
  );
  const coTagAuthorIds = Array.from(new Set(taggedMe.map((t) => t.story.userId)));
  const introducerAuthorIds = coTagAuthorIds;

  const feedCtx: MutualTagFeedContext = { myTaggedUserIds, coTagAuthorIds };
  const suggestionsCtx: IntroductionSuggestionsContext = {
    introducedByViewer,
    introducedToViewer,
  };

  return { feedCtx, suggestionsCtx, introducerAuthorIds };
});

export type HomeDashboardData = {
  stats: Awaited<ReturnType<typeof getTrustNetworkStats>>;
  groups: StoryGroup[];
  feed: FeedItem[];
  suggestions: IntroductionSuggestion[];
  recommendations: TrustRecommendation[];
};

/** Critical home stats — trust network summary cards and recent introductions. */
export const loadHomeDashboardStats = cache(async (userId: string) => {
  return getTrustNetworkStats(userId);
});

/** Secondary widgets — recommendations and introduction suggestions. */
export const loadHomeDashboardSecondary = cache(async (userId: string) => {
  const ctx = await getHomeStoryContext(userId);
  const [suggestions, recommendations] = await Promise.all([
    getIntroductionSuggestions(userId, 3, ctx.suggestionsCtx),
    getTrustRecommendations(userId),
  ]);
  return { suggestions, recommendations };
});

/** Below-the-fold feed — story bar and mutual-tag feed. */
export const loadHomeDashboardFeed = cache(async (userId: string) => {
  const ctx = await getHomeStoryContext(userId);
  const [groups, feed] = await Promise.all([
    getStoryBarForViewer(userId, { introducerAuthorIds: ctx.introducerAuthorIds }),
    getMutualTagFeed(userId, undefined, ctx.feedCtx),
  ]);
  return { groups, feed };
});

/** Consolidated home dashboard loader — all sections in one parallel batch. */
export const loadHomeDashboardData = cache(async (userId: string): Promise<HomeDashboardData> => {
  const ctx = await getHomeStoryContext(userId);
  const [stats, groups, feed, suggestions, recommendations] = await Promise.all([
    getTrustNetworkStats(userId),
    getStoryBarForViewer(userId, { introducerAuthorIds: ctx.introducerAuthorIds }),
    getMutualTagFeed(userId, undefined, ctx.feedCtx),
    getIntroductionSuggestions(userId, 3, ctx.suggestionsCtx),
    getTrustRecommendations(userId),
  ]);
  return { stats, groups, feed, suggestions, recommendations };
});

/** Estimated Prisma round-trips for benchmarking docs (approximate). */
export const HOME_DASHBOARD_QUERY_ESTIMATES = {
  beforeFragmented: { min: 20, max: 25 },
  afterConsolidated: { min: 14, max: 18 },
} as const;
