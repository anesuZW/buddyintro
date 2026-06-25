import "server-only";

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { PhoneInviteShare, StoryWithRelations, TagInput } from "@/types";
import {
  createInvitation,
  sendInvitationEmail,
  toPhoneInviteShare,
} from "@/services/invites";
import { STORY_DEFAULTS } from "@/lib/constants";
import { getAdminSettings } from "@/services/admin";
import { scheduleTrustGraphRefresh } from "@/services/trust-graph-jobs";
import { analyticsService } from "@/services/analytics/analytics-service";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { notifyIntroductionReceived } from "@/services/notifications/emitters";
import { storyPassesCategoryGate } from "@/lib/category-visibility";
import {
  resolveStoryVisibilityMode,
  storyPassesVisibilityGate,
  filterStoriesByVisibilityGate,
  type StoryVisibilityModeValue,
} from "@/lib/story-visibility";
import { withProxiedMedia } from "@/lib/storage-url";

const storyInclude = {
  user: { select: { id: true, name: true, profilePicture: true } },
  tags: {
    include: {
      taggedUser: { select: { id: true, name: true, profilePicture: true } },
    },
  },
} satisfies Prisma.StoryInclude;

export type CreateStoryResult = {
  story: StoryWithRelations;
  phoneInvites: PhoneInviteShare[];
};

export async function createStoryWithTags(args: {
  authorId: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  voiceNoteUrl?: string | null;
  text?: string | null;
  tags: TagInput[];
  expiresInHours?: number;
  introductionCategoryId?: string | null;
  visibilityMode?: StoryVisibilityModeValue;
}): Promise<CreateStoryResult> {
  if (!args.tags?.length) {
    throw new Error("A story must include at least one tag.");
  }

  const settings = await getAdminSettings();
  const visibilityMode = resolveStoryVisibilityMode(args.visibilityMode, settings);
  const expiresInHours = settings.introductionsNeverExpire
    ? 24 * 365 * 100
    : (args.expiresInHours ?? settings.storyExpiryHours ?? STORY_DEFAULTS.expiryHours);
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  const result = await prisma.$transaction(async (tx) => {
    const story = await tx.story.create({
      data: {
        userId: args.authorId,
        mediaUrl: args.mediaUrl,
        mediaType: args.mediaType,
        voiceNoteUrl: args.voiceNoteUrl ?? null,
        text: args.text ?? null,
        status: "draft",
        expiresAt,
        introductionCategoryId: args.introductionCategoryId ?? null,
        visibilityMode,
      },
    });

    let hasExternalTag = false;
    const pendingEmails: Array<{ invitation: Awaited<ReturnType<typeof createInvitation>> }> =
      [];
    const pendingPhones: Array<{ invitation: Awaited<ReturnType<typeof createInvitation>> }> =
      [];

    const author = await tx.user.findUniqueOrThrow({
      where: { id: args.authorId },
      select: { name: true, profilePicture: true },
    });

    for (const tag of args.tags) {
      if (tag.kind === "user") {
        await tx.storyTag.create({
          data: { storyId: story.id, taggedUserId: tag.userId },
        });
      } else if (tag.kind === "external") {
        hasExternalTag = true;
        const existingUser = await tx.user.findUnique({
          where: { email: tag.email.toLowerCase() },
        });
        if (existingUser) {
          await tx.storyTag.create({
            data: { storyId: story.id, taggedUserId: existingUser.id },
          });
        } else {
          const invitation = await createInvitation(
            { kind: "email", email: tag.email, invitedById: args.authorId, expiresAt },
            tx
          );
          await tx.storyTag.create({
            data: {
              storyId: story.id,
              taggedExternalEmail: tag.email.toLowerCase(),
              invitationId: invitation.id,
            },
          });
          pendingEmails.push({ invitation });
        }
      } else if (tag.kind === "phone") {
        hasExternalTag = true;
        const invitation = await createInvitation(
          { kind: "phone", phone: tag.phone, invitedById: args.authorId, expiresAt },
          tx
        );
        await tx.storyTag.create({
          data: {
            storyId: story.id,
            taggedExternalPhone: invitation.phoneNumber,
            invitationId: invitation.id,
          },
        });
        pendingPhones.push({ invitation });
      }
    }

    if (!hasExternalTag) {
      await tx.story.update({
        where: { id: story.id },
        data: { status: "published", publishedAt: new Date() },
      });
    }

    const saved = await tx.story.findUniqueOrThrow({
      where: { id: story.id },
      include: storyInclude,
    });

    return { saved, pendingEmails, pendingPhones, author };
  });

  for (const { invitation } of result.pendingEmails) {
    try {
      await sendInvitationEmail({
        invitation,
        inviterName: result.author.name,
        inviterAvatar: result.author.profilePicture,
        story: {
          mediaUrl: result.saved.mediaUrl,
          mediaType: result.saved.mediaType,
          text: result.saved.text,
          inviterName: result.author.name,
          inviterAvatar: result.author.profilePicture,
        },
      });
    } catch (error) {
      console.error("[stories] invitation email failed", error);
    }
  }

  const phoneInvites = result.pendingPhones
    .map(({ invitation }) => toPhoneInviteShare(invitation))
    .filter((s): s is PhoneInviteShare => s !== null);

  if (result.saved.status === "published") {
    const affected = [
      args.authorId,
      ...result.saved.tags
        .map((t) => t.taggedUserId)
        .filter((id): id is string => Boolean(id)),
    ];
    void scheduleTrustGraphRefresh(affected).catch((err) =>
      console.error("[stories] user_connections refresh failed", err)
    );

    void analyticsService.track({
      userId: args.authorId,
      eventType: ANALYTICS_EVENTS.CONNECTION_CREATED,
      entityType: "story",
      entityId: result.saved.id,
      metadata: { affectedCount: affected.length },
    });

    if (result.saved.introductionCategoryId) {
      void analyticsService.track({
        userId: args.authorId,
        eventType: ANALYTICS_EVENTS.CATEGORY_JOINED,
        entityType: "introduction_category",
        entityId: result.saved.introductionCategoryId,
      });
    }

    void analyticsService.track({
      userId: args.authorId,
      eventType: ANALYTICS_EVENTS.INTRODUCTION_CREATED,
      entityType: "story",
      entityId: result.saved.id,
    });

    for (const tag of result.saved.tags) {
      if (tag.taggedUserId && tag.taggedUserId !== args.authorId) {
        void notifyIntroductionReceived({
          taggedUserId: tag.taggedUserId,
          authorId: args.authorId,
          authorName: result.author.name,
          storyId: result.saved.id,
        }).catch((err) => console.error("[stories] notify failed", err));
      }
    }
  }

  return { story: result.saved, phoneInvites };
}

export async function getVisibleStories(
  viewerId: string,
  opts?: { introducerAuthorIds?: string[] }
): Promise<StoryWithRelations[]> {
  let authorIds: string[];
  if (opts?.introducerAuthorIds) {
    authorIds = opts.introducerAuthorIds;
  } else {
    const tagged = await prisma.storyTag.findMany({
      where: { taggedUserId: viewerId },
      select: { story: { select: { userId: true } } },
    });
    authorIds = Array.from(new Set(tagged.map((t) => t.story.userId)));
  }

  const rows = await prisma.story.findMany({
    where: {
      expiresAt: { gt: new Date() },
      OR: [
        { userId: viewerId },
        { status: "published", userId: { in: authorIds } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: storyInclude,
  });

  const visibleStories = await filterStoriesByVisibilityGate(viewerId, rows);
  const visible: StoryWithRelations[] = visibleStories.map((story) =>
    withProxiedMedia(story as StoryWithRelations)
  );
  return visible;
}

export async function getStoryBarForViewer(
  viewerId: string,
  opts?: { introducerAuthorIds?: string[] }
) {
  const stories = await getVisibleStories(viewerId, opts);
  const map = new Map<
    string,
    {
      user: StoryWithRelations["user"];
      stories: StoryWithRelations[];
      hasUnseen: boolean;
    }
  >();
  for (const s of stories) {
    if (s.status === "draft" && s.userId !== viewerId) continue;
    const entry = map.get(s.userId);
    if (entry) entry.stories.push(s);
    else map.set(s.userId, { user: s.user, stories: [s], hasUnseen: true });
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.user.id === viewerId) return -1;
    if (b.user.id === viewerId) return 1;
    return (
      new Date(b.stories[0].createdAt).getTime() -
      new Date(a.stories[0].createdAt).getTime()
    );
  });
}

export async function getStoryById(id: string): Promise<StoryWithRelations | null> {
  return prisma.story.findUnique({ where: { id }, include: storyInclude });
}

/** Returns a single story if the viewer may open it directly */
export async function getStoryForViewer(
  storyId: string,
  viewerId: string
): Promise<StoryWithRelations | null> {
  const story = await getStoryById(storyId);
  if (!story) return null;

  const allowed = await storyPassesVisibilityGate(viewerId, story, {
    allowMessageContext: true,
  });
  if (!allowed) return null;
  if (!(await storyPassesCategoryGate(viewerId, story))) return null;
  return withProxiedMedia(story);
}

export async function deleteStory(id: string, ownerId: string) {
  await prisma.story.deleteMany({ where: { id, userId: ownerId } });
}

export async function expireStories() {
  await prisma.story.updateMany({
    where: { expiresAt: { lt: new Date() }, status: { not: "expired" } },
    data: { status: "expired" },
  });
}
