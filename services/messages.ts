import "server-only";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ConversationOrigin } from "@prisma/client";
import { conversationPair } from "@/lib/introduction-graph";
import { getTrustProfilesBulk } from "@/services/trust-profile";
import type { ConversationSummary } from "@/types";
import { analyticsService } from "@/services/analytics/analytics-service";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { notifyMessageReceived, notifyDiscoveryMessage } from "@/services/notifications/emitters";
import { isUserBlocked } from "@/services/moderation";
import { clampLimit, type PaginatedResult } from "@/lib/pagination";
import { resolveMediaUrlForClient } from "@/lib/storage-url";

const storySelect = {
  id: true,
  mediaUrl: true,
  mediaType: true,
  text: true,
  userId: true,
  user: { select: { id: true, name: true, profilePicture: true } },
  tags: {
    include: {
      taggedUser: { select: { id: true, name: true, profilePicture: true } },
    },
  },
} as const;

export async function sendMessage(args: {
  senderId: string;
  receiverId: string;
  message: string;
  storyReference?: string | null;
  discoveriesPostReference?: string | null;
  conversationOrigin?: ConversationOrigin | null;
}) {
  if (!args.message.trim()) {
    throw new Error("Message can't be empty.");
  }

  if (await isUserBlocked(args.senderId, args.receiverId)) {
    throw new Error("You cannot message this user.");
  }

  const existingCount = await prisma.message.count({
    where: {
      OR: [
        { senderId: args.senderId, receiverId: args.receiverId },
        { senderId: args.receiverId, receiverId: args.senderId },
      ],
    },
  });
  const isNewConversation = existingCount === 0;

  const msg = await prisma.message.create({
    data: {
      senderId: args.senderId,
      receiverId: args.receiverId,
      message: args.message.trim(),
      storyReference: args.storyReference ?? null,
      discoveriesPostReference: args.discoveriesPostReference ?? null,
      conversationOrigin: args.conversationOrigin ?? null,
    },
  });

  const sender = await prisma.user.findUnique({
    where: { id: args.senderId },
    select: { name: true },
  });

  void analyticsService.track({
    userId: args.senderId,
    eventType: ANALYTICS_EVENTS.MESSAGE_SENT,
    entityType: "message",
    entityId: msg.id,
    metadata: { receiverId: args.receiverId },
  });

  if (args.storyReference) {
    void analyticsService.track({
      userId: args.senderId,
      eventType: ANALYTICS_EVENTS.INTRODUCTION_REPLIED,
      entityType: "story",
      entityId: args.storyReference,
      metadata: { receiverId: args.receiverId },
    });
  }

  void analyticsService.track({
    userId: args.receiverId,
    eventType: ANALYTICS_EVENTS.MESSAGE_RECEIVED,
    entityType: "message",
    entityId: msg.id,
    metadata: { senderId: args.senderId },
  });

  if (isNewConversation) {
    void analyticsService.track({
      userId: args.senderId,
      eventType: ANALYTICS_EVENTS.CONVERSATION_STARTED,
      entityType: "message",
      entityId: msg.id,
      metadata: { otherUserId: args.receiverId },
    });
  }

  if (sender) {
    void notifyMessageReceived({
      receiverId: args.receiverId,
      senderId: args.senderId,
      senderName: sender.name,
      preview: args.message.trim(),
      storyReference: args.storyReference,
      discoveriesPostReference: args.discoveriesPostReference,
    }).catch((err) => console.error("[messages] notify failed", err));

    if (args.discoveriesPostReference) {
      const post = await prisma.discoveriesPost.findUnique({
        where: { id: args.discoveriesPostReference },
        select: { userId: true },
      });
      if (post && post.userId !== args.senderId) {
        void notifyDiscoveryMessage({
          postAuthorId: post.userId,
          actorId: args.senderId,
          actorName: sender.name,
          postId: args.discoveriesPostReference,
        }).catch((err) => console.error("[messages] discovery notify failed", err));
        void analyticsService.track({
          userId: args.senderId,
          eventType: ANALYTICS_EVENTS.DISCOVERY_MESSAGE_STARTED,
          entityType: "discoveries_post",
          entityId: args.discoveriesPostReference,
          metadata: { receiverId: args.receiverId },
        });
        void analyticsService.track({
          userId: args.senderId,
          eventType: ANALYTICS_EVENTS.DISCOVERY_MESSAGE_CLICKED,
          entityType: "discoveries_post",
          entityId: args.discoveriesPostReference,
        });
      }
    }
  }

  return msg;
}

export async function getConversationContext(userId: string, otherUserId: string) {
  const [userAId, userBId] = conversationPair(userId, otherUserId);
  return prisma.conversationContext.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
    include: {
      story: { select: storySelect },
      discoveriesPost: {
        select: {
          id: true,
          content: true,
          mediaUrl: true,
          mediaType: true,
          userId: true,
          user: { select: { id: true, name: true, profilePicture: true } },
        },
      },
    },
  });
}

export async function getOriginatingStoryForConversation(
  userId: string,
  otherUserId: string,
  existingContext?: Awaited<ReturnType<typeof getConversationContext>>
) {
  if (existingContext?.story) return existingContext.story;
  return getOriginatingStoryFromMessages(userId, otherUserId);
}

export async function getOriginatingStoryFromMessages(
  userId: string,
  otherUserId: string
) {
  const msgWithStory = await prisma.message.findFirst({
    where: {
      storyReference: { not: null },
      OR: [
        { senderId: userId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: userId },
      ],
    },
    orderBy: { createdAt: "asc" },
    include: { story: { select: storySelect } },
  });

  return msgWithStory?.story ?? null;
}

const messageInclude = {
  sender: { select: { id: true, name: true, profilePicture: true } },
  receiver: { select: { id: true, name: true, profilePicture: true } },
  story: { select: { id: true, mediaUrl: true, mediaType: true, text: true } },
} as const;

type ConversationMessage = Prisma.MessageGetPayload<{ include: typeof messageInclude }>;

export async function getConversation(args: {
  userId: string;
  otherUserId: string;
  cursor?: string;
  limit?: number;
}): Promise<PaginatedResult<ConversationMessage>> {
  const limit = clampLimit(args.limit);
  const rows = await prisma.message.findMany({
    where: {
      OR: [
        { senderId: args.userId, receiverId: args.otherUserId },
        { senderId: args.otherUserId, receiverId: args.userId },
      ],
      ...(args.cursor ? { createdAt: { lt: new Date(args.cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: messageInclude,
  });

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;

  return {
    items: slice.reverse().map((msg) =>
      msg.story
        ? {
            ...msg,
            story: {
              ...msg.story,
              mediaUrl: resolveMediaUrlForClient(msg.story.mediaUrl),
            },
          }
        : msg
    ),
    nextCursor: hasMore ? slice[slice.length - 1].createdAt.toISOString() : null,
  };
}

export async function getConversationList(
  userId: string,
  args?: { cursor?: string; limit?: number }
): Promise<PaginatedResult<ConversationSummary>> {
  const limit = clampLimit(args?.limit);
  const cursorDate = args?.cursor ? new Date(args.cursor) : null;

  type LatestRow = {
    id: string;
    sender_id: string;
    receiver_id: string;
    message: string;
    created_at: Date;
    read_at: Date | null;
  };

  const latest = await prisma.$queryRaw<LatestRow[]>`
    SELECT m.id, m.sender_id, m.receiver_id, m.message, m.created_at, m.read_at
    FROM (
      SELECT m.*,
        ROW_NUMBER() OVER (
          PARTITION BY LEAST(m.sender_id, m.receiver_id), GREATEST(m.sender_id, m.receiver_id)
          ORDER BY m.created_at DESC
        ) AS rn
      FROM messages m
      WHERE m.sender_id = ${userId}::uuid OR m.receiver_id = ${userId}::uuid
    ) m
    WHERE m.rn = 1
    ${cursorDate ? Prisma.sql`AND m.created_at < ${cursorDate}` : Prisma.empty}
    ORDER BY m.created_at DESC
    LIMIT ${limit + 1}
  `;

  const hasMore = latest.length > limit;
  const slice = hasMore ? latest.slice(0, limit) : latest;
  const otherIds = slice.map((m) =>
    m.sender_id === userId ? m.receiver_id : m.sender_id
  );

  const [users, unreadGroups, trustMap] = await Promise.all([
    otherIds.length
      ? prisma.user.findMany({
          where: { id: { in: otherIds } },
          select: { id: true, name: true, profilePicture: true },
        })
      : Promise.resolve([]),
    otherIds.length
      ? prisma.message.groupBy({
          by: ["senderId"],
          where: {
            senderId: { in: otherIds },
            receiverId: userId,
            readAt: null,
          },
          _count: { id: true },
        })
      : Promise.resolve([]),
    otherIds.length ? getTrustProfilesBulk(userId, otherIds) : Promise.resolve(new Map()),
  ]);

  const userMap = new Map(users.map((u) => [u.id, u]));
  const unreadMap = new Map(unreadGroups.map((g) => [g.senderId, g._count.id]));

  const items: ConversationSummary[] = slice.map((m) => {
    const otherId = m.sender_id === userId ? m.receiver_id : m.sender_id;
    const otherUser = userMap.get(otherId)!;
    return {
      otherUser,
      lastMessage: {
        id: m.id,
        senderId: m.sender_id,
        receiverId: m.receiver_id,
        message: m.message,
        createdAt: m.created_at,
        readAt: m.read_at,
        storyReference: null,
        discoveriesPostReference: null,
        conversationOrigin: null,
      },
      unreadCount: unreadMap.get(otherId) ?? 0,
      trustProfile: trustMap.get(otherId),
    };
  });

  return {
    items,
    nextCursor: hasMore ? slice[slice.length - 1].created_at.toISOString() : null,
  };
}

export async function markRead(userId: string, otherUserId: string) {
  await prisma.message.updateMany({
    where: { senderId: otherUserId, receiverId: userId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function ensureConversationContext(args: {
  userId: string;
  otherUserId: string;
  origin: ConversationOrigin;
  storyReference?: string | null;
  discoveriesPostReference?: string | null;
}) {
  const [userAId, userBId] = conversationPair(args.userId, args.otherUserId);
  return prisma.conversationContext.upsert({
    where: { userAId_userBId: { userAId, userBId } },
    create: {
      userAId,
      userBId,
      origin: args.origin,
      storyReference: args.storyReference ?? null,
      discoveriesPostReference: args.discoveriesPostReference ?? null,
    },
    update: {},
  });
}
