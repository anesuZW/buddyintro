import "server-only";

import { prisma } from "@/lib/prisma";
import type { FeedItem } from "@/types";
import { clampLimit } from "@/lib/pagination";

export type MutualTagFeedContext = {
  myTaggedUserIds: string[];
  coTagAuthorIds: string[];
};

/**
 * Mutual-tag feed.
 *
 * For viewer V we want all authors A who have at least one story tagging
 * a person P that V has also tagged in any of V's stories.
 */
export async function getMutualTagFeed(
  viewerId: string,
  limit?: number,
  ctx?: MutualTagFeedContext
): Promise<FeedItem[]> {
  const pageSize = clampLimit(limit);

  let myTaggedUserIds: string[];
  let coTagAuthorIds: string[];

  if (ctx) {
    myTaggedUserIds = ctx.myTaggedUserIds;
    coTagAuthorIds = ctx.coTagAuthorIds;
  } else {
    const myTags = await prisma.storyTag.findMany({
      where: {
        story: { userId: viewerId },
        taggedUserId: { not: null },
      },
      select: { taggedUserId: true },
    });
    myTaggedUserIds = Array.from(
      new Set(myTags.map((t) => t.taggedUserId!).filter(Boolean))
    );

    const myCoTagStoryAuthors = await prisma.storyTag.findMany({
      where: { taggedUserId: viewerId },
      select: { story: { select: { userId: true } } },
    });
    coTagAuthorIds = Array.from(new Set(myCoTagStoryAuthors.map((t) => t.story.userId)));
  }

  // Authors who tagged at least one user in myTaggedUserIds
  const otherAuthors = myTaggedUserIds.length
    ? await prisma.story.findMany({
        where: {
          userId: { not: viewerId },
          tags: { some: { taggedUserId: { in: myTaggedUserIds } } },
        },
        select: { userId: true },
        distinct: ["userId"],
      })
    : [];
  const mutualAuthorIds = otherAuthors.map((s) => s.userId);

  // Stories from people I've been tagged with (co-tagged)
  const allAuthorIds = Array.from(
    new Set([viewerId, ...mutualAuthorIds, ...coTagAuthorIds])
  );

  const [posts, stories] = await Promise.all([
    prisma.post.findMany({
      where: {
        userId: { in: allAuthorIds },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      include: { user: { select: { id: true, name: true, profilePicture: true } } },
    }),
    prisma.story.findMany({
      where: {
        userId: { in: coTagAuthorIds },
        status: "published",
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      include: {
        user: { select: { id: true, name: true, profilePicture: true } },
        tags: {
          include: {
            taggedUser: { select: { id: true, name: true, profilePicture: true } },
          },
        },
      },
    }),
  ]);

  const feed: FeedItem[] = [
    ...posts.map((p) => ({ kind: "post" as const, post: p })),
    ...stories.map((s) => ({ kind: "story" as const, story: s })),
  ];

  feed.sort((a, b) => {
    const aDate = a.kind === "post" ? a.post.createdAt : a.story.createdAt;
    const bDate = b.kind === "post" ? b.post.createdAt : b.story.createdAt;
    return new Date(bDate).getTime() - new Date(aDate).getTime();
  });

  return feed.slice(0, pageSize);
}

export async function createPost(args: {
  userId: string;
  content?: string | null;
  media?: string | null;
  expiresInHours?: number | null;
}) {
  const expiresAt =
    args.expiresInHours && args.expiresInHours > 0
      ? new Date(Date.now() + args.expiresInHours * 60 * 60 * 1000)
      : null;
  return prisma.post.create({
    data: {
      userId: args.userId,
      content: args.content ?? null,
      media: args.media ?? null,
      expiresAt,
    },
  });
}
