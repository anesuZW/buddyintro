import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  filterStoriesByVisibilityGate,
  type StoryVisibilitySubject,
} from "@/lib/story-visibility";
import type { HomeVisibilityPrefetch } from "@/lib/home-story-context";
import type { StoryWithRelations } from "@/types";
import { withProxiedMedia } from "@/lib/storage-url";
import type { HomeVisibleStoryRow } from "@/lib/home-story-loader-types";
import { pickCoTagFeedStories } from "@/lib/home-projection";

export type { HomeVisibleStoryRow } from "@/lib/home-story-loader-types";
export { pickCoTagFeedStories } from "@/lib/home-projection";

const storyInclude = {
  user: { select: { id: true, name: true, profilePicture: true } },
  tags: {
    include: {
      taggedUser: { select: { id: true, name: true, profilePicture: true } },
    },
  },
} satisfies Prisma.StoryInclude;

export type HomeStoryLoaderOpts = {
  introducerAuthorIds: string[];
  visibilityPrefetch: HomeVisibilityPrefetch;
};

/**
 * One visibility-filtered story pool for story bar + mutual-tag feed co-tag slice.
 * Evidence: Sprint 3 verification — separate Story.findMany for bar (624ms) and feed (1310ms).
 */
export const getHomeVisibleStoryRows = cache(
  async (viewerId: string, opts: HomeStoryLoaderOpts): Promise<HomeVisibleStoryRow[]> => {
    const rows = await prisma.story.findMany({
      where: {
        expiresAt: { gt: new Date() },
        OR: [
          { userId: viewerId },
          { status: "published", userId: { in: opts.introducerAuthorIds } },
        ],
      },
      orderBy: { createdAt: "desc" },
      include: storyInclude,
    });

    return (await filterStoriesByVisibilityGate(
      viewerId,
      rows as StoryVisibilitySubject[],
      opts.visibilityPrefetch
    )) as HomeVisibleStoryRow[];
  }
);

export function projectHomeStoryBarStories(
  rows: HomeVisibleStoryRow[]
): StoryWithRelations[] {
  return rows.map((story) => withProxiedMedia(story as StoryWithRelations));
}
