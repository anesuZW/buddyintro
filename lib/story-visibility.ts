import "server-only";

import { prisma } from "@/lib/prisma";
import {
  STORY_VISIBILITY_MODES,
  type StoryVisibilityModeValue,
} from "@/lib/story-visibility-shared";

export {
  STORY_VISIBILITY_MODES,
  STORY_VISIBILITY_MODE_LABELS,
  type StoryVisibilityModeValue,
  isStoryVisibilityMode,
  getEnabledStoryVisibilityModes,
  resolveDefaultStoryVisibilityMode,
  assertStoryVisibilityModeAllowed,
  resolveStoryVisibilityMode,
  serializeStoryVisibilityConfig,
} from "@/lib/story-visibility-shared";

export type StoryVisibilitySubject = {
  id: string;
  userId: string;
  status: string;
  visibilityMode: string | null;
  tags: Array<{ taggedUserId: string | null }>;
};

/** Batch visibility filter — replaces per-story N+1 storyPassesVisibilityGate calls. */
export async function filterStoriesByVisibilityGate(
  viewerId: string,
  stories: StoryVisibilitySubject[]
): Promise<StoryVisibilitySubject[]> {
  if (!stories.length) return [];

  const otherAuthorIds = Array.from(
    new Set(stories.map((s) => s.userId).filter((id) => id !== viewerId))
  );

  // Prefetch co-tag and ever-introduced relationships in two queries instead of O(n).
  const [cotaggedRows, everIntroducedRows] = await Promise.all([
    otherAuthorIds.length
      ? prisma.storyTag.findMany({
          where: {
            taggedUserId: viewerId,
            story: { userId: { in: otherAuthorIds } },
          },
          select: { story: { select: { userId: true } } },
        })
      : Promise.resolve([]),
    otherAuthorIds.length
      ? prisma.storyTag.findMany({
          where: {
            taggedUserId: viewerId,
            story: {
              userId: { in: otherAuthorIds },
              status: { in: ["published", "expired"] },
            },
          },
          select: { story: { select: { userId: true } } },
        })
      : Promise.resolve([]),
  ]);

  const cotaggedAuthors = new Set(cotaggedRows.map((r) => r.story.userId));
  const everIntroducedAuthors = new Set(everIntroducedRows.map((r) => r.story.userId));

  return stories.filter((story) => {
    if (story.userId === viewerId) return true;

    const isTagged = story.tags.some((t) => t.taggedUserId === viewerId);
    if (story.status === "draft") return isTagged;

    const mode = (story.visibilityMode ??
      STORY_VISIBILITY_MODES.MUTUAL_INTRODUCTION_NETWORK) as StoryVisibilityModeValue;

    switch (mode) {
      case STORY_VISIBILITY_MODES.SPECIFIC_PEOPLE_ONLY:
        return isTagged;
      case STORY_VISIBILITY_MODES.EVERYONE_I_HAVE_INTRODUCED:
        return isTagged || everIntroducedAuthors.has(story.userId);
      case STORY_VISIBILITY_MODES.MUTUAL_INTRODUCTION_NETWORK:
      default:
        if (isTagged) return true;
        if (story.status !== "published" && story.status !== "expired") return false;
        return cotaggedAuthors.has(story.userId);
    }
  });
}

/** Whether a viewer may access a story under its visibility mode. */
export async function storyPassesVisibilityGate(
  viewerId: string,
  story: StoryVisibilitySubject,
  options?: { allowMessageContext?: boolean }
): Promise<boolean> {
  if (story.userId === viewerId) return true;

  const isTagged = story.tags.some((t) => t.taggedUserId === viewerId);
  if (story.status === "draft") return isTagged;

  if (options?.allowMessageContext) {
    const inConversation = await prisma.message.findFirst({
      where: {
        storyReference: story.id,
        OR: [{ senderId: viewerId }, { receiverId: viewerId }],
      },
    });
    if (inConversation) return true;
  }

  const mode = (story.visibilityMode ??
    STORY_VISIBILITY_MODES.MUTUAL_INTRODUCTION_NETWORK) as StoryVisibilityModeValue;

  switch (mode) {
    case STORY_VISIBILITY_MODES.SPECIFIC_PEOPLE_ONLY:
      return isTagged;

    case STORY_VISIBILITY_MODES.EVERYONE_I_HAVE_INTRODUCED: {
      if (isTagged) return true;
      const everIntroduced = await prisma.storyTag.findFirst({
        where: {
          taggedUserId: viewerId,
          story: {
            userId: story.userId,
            status: { in: ["published", "expired"] },
          },
        },
      });
      return Boolean(everIntroduced);
    }

    case STORY_VISIBILITY_MODES.MUTUAL_INTRODUCTION_NETWORK:
    default: {
      if (isTagged) return true;
      if (story.status !== "published" && story.status !== "expired") return false;
      const cotagged = await prisma.storyTag.findFirst({
        where: {
          taggedUserId: viewerId,
          story: { userId: story.userId },
        },
      });
      return Boolean(cotagged);
    }
  }
}
