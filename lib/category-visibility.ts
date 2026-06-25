import { prisma } from "@/lib/prisma";

import { userPair } from "@/lib/trust-score";

import { getAdminSettings } from "@/services/admin";

export async function viewerSharesCategoryWithAuthor(

  viewerId: string,

  authorId: string,

  categoryId: string | null

): Promise<boolean> {

  if (viewerId === authorId) return true;

  if (!categoryId) return true;



  const direct = await prisma.story.count({

    where: {

      status: "published",

      introductionCategoryId: categoryId,

      OR: [

        { userId: viewerId, tags: { some: { taggedUserId: authorId } } },

        { userId: authorId, tags: { some: { taggedUserId: viewerId } } },

        {

          tags: {

            some: { taggedUserId: viewerId },

          },

          AND: {

            tags: {

              some: { taggedUserId: authorId },

            },

          },

        },

      ],

    },

  });

  if (direct > 0) return true;



  const sharedIntroducer = await prisma.sharedIntroducerRelationship.count({

    where: (() => {

      const [userAId, userBId] = userPair(viewerId, authorId);

      return {

        userAId,

        userBId,

        firstIntroductionStory: { introductionCategoryId: categoryId },

        secondIntroductionStory: { introductionCategoryId: categoryId },

      };

    })(),

  });

  return sharedIntroducer > 0;

}



export async function filterByCategoryVisibility<
  T extends { userId: string; introductionCategoryId?: string | null }
>(viewerId: string, items: T[]): Promise<T[]> {
  const settings = await getAdminSettings();

  if (settings.enableDiscoveryControls && !settings.allowCrossCategoryDiscovery) {
    if (!items.length) return [];

    const toCheck = items.filter(
      (item) => item.introductionCategoryId && item.userId !== viewerId
    );
    const allowedAuthors = new Set<string>(
      items
        .filter((item) => !item.introductionCategoryId || item.userId === viewerId)
        .map((item) => item.userId)
    );

    if (!toCheck.length) return items;

    const categoryIds = Array.from(
      new Set(toCheck.map((i) => i.introductionCategoryId!).filter(Boolean))
    );
    const authorIds = Array.from(new Set(toCheck.map((i) => i.userId)));

    // Batch direct category overlap — one query instead of 2× per post.
    const directStories = await prisma.story.findMany({
      where: {
        status: "published",
        introductionCategoryId: { in: categoryIds },
        OR: [
          { userId: viewerId, tags: { some: { taggedUserId: { in: authorIds } } } },
          { userId: { in: authorIds }, tags: { some: { taggedUserId: viewerId } } },
        ],
      },
      select: { userId: true, introductionCategoryId: true },
    });

    const directOk = new Set(
      directStories.map((s) => `${s.userId}:${s.introductionCategoryId}`)
    );

    const remaining = toCheck.filter(
      (item) => !directOk.has(`${item.userId}:${item.introductionCategoryId}`)
    );

    if (remaining.length) {
      const pairs = remaining.map((item) => {
        const [userAId, userBId] = userPair(viewerId, item.userId);
        return { userAId, userBId, categoryId: item.introductionCategoryId! };
      });

      const sharedRows = await prisma.sharedIntroducerRelationship.findMany({
        where: {
          OR: pairs.map((p) => ({
            userAId: p.userAId,
            userBId: p.userBId,
            firstIntroductionStory: { introductionCategoryId: p.categoryId },
            secondIntroductionStory: { introductionCategoryId: p.categoryId },
          })),
        },
        select: { userAId: true, userBId: true },
      });

      for (const row of sharedRows) {
        const otherId = row.userAId === viewerId ? row.userBId : row.userAId;
        allowedAuthors.add(otherId);
      }
    }

    for (const s of directStories) {
      allowedAuthors.add(s.userId);
    }

    return items.filter(
      (item) =>
        !item.introductionCategoryId ||
        item.userId === viewerId ||
        allowedAuthors.has(item.userId)
    );
  }

  return items;
}



export async function storyPassesCategoryGate(

  viewerId: string,

  story: {

    userId: string;

    status: string;

    introductionCategoryId: string | null;

  }

): Promise<boolean> {

  if (viewerId === story.userId) return true;

  if (story.status !== "published" && story.status !== "expired") return false;



  const settings = await getAdminSettings();

  if (

    settings.enableDiscoveryControls &&

    !settings.allowCrossCategoryDiscovery &&

    story.introductionCategoryId

  ) {

    return viewerSharesCategoryWithAuthor(

      viewerId,

      story.userId,

      story.introductionCategoryId

    );

  }



  return true;

}

