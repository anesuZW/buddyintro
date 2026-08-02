import "server-only";



import { cache } from "react";

import { prisma } from "@/lib/prisma";

import type { FeedItem } from "@/types";

import { getMutualTagFeed } from "@/services/feed";

import { getIntroductionSuggestions } from "@/services/introduction-suggestions";

import { getStoryBarForViewer } from "@/services/stories";

import { getTrustNetworkStats } from "@/services/trust-network";

import { getTrustRecommendations } from "@/services/trust-recommendations";

import type { TrustRecommendation } from "@/services/trust-recommendations";

import type { IntroductionSuggestion } from "@/services/introduction-suggestions";

import type { StoryGroup } from "@/components/stories/StoryBar";

import {

  buildHomeStoryContextFromRows,

  type HomeStoryContext,

} from "@/lib/home-story-context";

import { getHomeUserConnections } from "@/lib/home-graph-context";

import { getHomeVisibleStoryRows } from "@/lib/home-story-loader";



export type { HomeStoryContext, HomeVisibilityPrefetch, TrustNetworkStatsContext } from "@/lib/home-story-context";



/**

 * Authoritative request-scoped home story scan — two StoryTag.findMany replace

 * the previous four-query fan-out plus downstream duplicate scans.

 */

export const getHomeStoryContext = cache(async (userId: string): Promise<HomeStoryContext> => {

  const [viewerAuthoredTags, viewerTaggedTags] = await Promise.all([

    prisma.storyTag.findMany({

      where: { story: { userId } },

      select: {

        taggedUserId: true,

        taggedUser: { select: { id: true, name: true, profilePicture: true } },

        story: { select: { status: true, category: { select: { name: true } } } },

      },

    }),

    prisma.storyTag.findMany({

      where: { taggedUserId: userId },

      select: {

        storyId: true,

        story: {

          select: {

            userId: true,

            status: true,

            user: { select: { id: true, name: true, profilePicture: true } },

            category: { select: { name: true } },

          },

        },

      },

    }),

  ]);



  return buildHomeStoryContextFromRows(viewerAuthoredTags, viewerTaggedTags);

});



/** Sprint 4 — shared graph + story pool for all home Suspense branches. */

export const getHomeRequestBundle = cache(async (userId: string) => {

  const ctx = await getHomeStoryContext(userId);

  const storyOpts = {

    introducerAuthorIds: ctx.introducerAuthorIds,

    visibilityPrefetch: ctx.visibility,

  };

  const [connectionRows, visibleStoryRows] = await Promise.all([

    getHomeUserConnections(userId),

    getHomeVisibleStoryRows(userId, storyOpts),

  ]);

  return { ctx, connectionRows, visibleStoryRows, storyOpts };

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

  const { ctx, connectionRows } = await getHomeRequestBundle(userId);

  return getTrustNetworkStats(userId, ctx.trustStats, { connectionRows });

});



/** Secondary widgets — recommendations and introduction suggestions. */

export const loadHomeDashboardSecondary = cache(async (userId: string) => {

  const { ctx, connectionRows } = await getHomeRequestBundle(userId);

  const [suggestions, recommendations] = await Promise.all([

    getIntroductionSuggestions(userId, 3, ctx.suggestionsCtx),

    getTrustRecommendations(userId, { connectionRows }),

  ]);

  return { suggestions, recommendations };

});



/** Below-the-fold feed — story bar and mutual-tag feed. */

export const loadHomeDashboardFeed = cache(async (userId: string) => {

  const { ctx, visibleStoryRows, storyOpts } = await getHomeRequestBundle(userId);

  const [groups, feed] = await Promise.all([

    getStoryBarForViewer(userId, {

      ...storyOpts,

      homeVisibleStoryRows: visibleStoryRows,

    }),

    getMutualTagFeed(userId, undefined, ctx.feedCtx, {

      homeVisibleStoryRows: visibleStoryRows,

    }),

  ]);

  return { groups, feed };

});



/** Consolidated home dashboard loader — all sections in one parallel batch. */

export const loadHomeDashboardData = cache(async (userId: string): Promise<HomeDashboardData> => {

  const { ctx, connectionRows, visibleStoryRows, storyOpts } = await getHomeRequestBundle(userId);

  const [stats, groups, feed, suggestions, recommendations] = await Promise.all([

    getTrustNetworkStats(userId, ctx.trustStats, { connectionRows }),

    getStoryBarForViewer(userId, {

      ...storyOpts,

      homeVisibleStoryRows: visibleStoryRows,

    }),

    getMutualTagFeed(userId, undefined, ctx.feedCtx, {

      homeVisibleStoryRows: visibleStoryRows,

    }),

    getIntroductionSuggestions(userId, 3, ctx.suggestionsCtx),

    getTrustRecommendations(userId, { connectionRows }),

  ]);

  return { stats, groups, feed, suggestions, recommendations };

});



/** Estimated Prisma round-trips for benchmarking docs (approximate). */

export const HOME_DASHBOARD_QUERY_ESTIMATES = {

  beforeSprint3: { min: 22, max: 26, storyTagFindMany: 10 },

  afterSprint3: { min: 14, max: 17, storyTagFindMany: 2 },

  afterSprint4: { min: 10, max: 12, storyTagFindMany: 2, storyFindMany: 3 },

} as const;

