import "server-only";

import type { AdminSettings } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getDiscoveriesNetworkAuthorIds } from "@/lib/discoveries-network";
import { getConnectionReasonsBulk } from "@/lib/introduction-graph";
import { serializeConnectionReason } from "@/lib/connection-reason";
import { getAdminSettings } from "@/services/admin";
import { getTrustProfilesBulk } from "@/services/trust-profile";
import { filterByCategoryVisibility } from "@/lib/category-visibility";
import type { DiscoveriesPostWithMeta } from "@/types";
import { analyticsService } from "@/services/analytics/analytics-service";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import { notifyDiscoveryEngagement } from "@/services/notifications/emitters";
import { filterDiscoveryAuthorIds } from "@/lib/verification-gates";
import { listBlockedUserIds } from "@/services/moderation";
import { clampLimit } from "@/lib/pagination";
import { canViewDiscoveryPost } from "@/lib/access-control";
import { resolveMediaUrlForClient } from "@/lib/storage-url";
import { isProfileEnabled } from "@/lib/profile/route-profiler";

const userSelect = { id: true, name: true, profilePicture: true } as const;

export async function getDiscoveriesFeed(args: {
  viewerId: string;
  cursor?: string;
  limit?: number;
  settingsOverride?: AdminSettings;
}): Promise<{ posts: DiscoveriesPostWithMeta[]; nextCursor: string | null }> {
  const profile = isProfileEnabled();
  const marks: Record<string, number> = {};
  let last = performance.now();
  const mark = (label: string) => {
    if (!profile) return;
    const now = performance.now();
    marks[label] = Math.round(now - last);
    last = now;
  };

  const settings = args.settingsOverride ?? (await getAdminSettings());
  mark("adminSettings");
  if (!settings.discoveriesEnabled) {
    return { posts: [], nextCursor: null };
  }

  const limit = clampLimit(args.limit);
  const [networkIds, viewer, blockedIds] = await Promise.all([
    getDiscoveriesNetworkAuthorIds(args.viewerId),
    prisma.user.findUnique({
      where: { id: args.viewerId },
      select: {
        id: true,
        phoneVerified: true,
        emailVerified: true,
        identityVerified: true,
        trustedUser: true,
        verificationLevel: true,
        suspendedAt: true,
      },
    }),
    listBlockedUserIds(args.viewerId),
  ]);
  mark("graphNetworkAndViewer");

  if (!viewer) return { posts: [], nextCursor: null };

  const blocked = new Set(blockedIds);
  let allowedAuthors = networkIds.filter((id) => !blocked.has(id));
  allowedAuthors = await filterDiscoveryAuthorIds(args.viewerId, allowedAuthors, viewer);
  mark("verificationFilter");

  const now = new Date();

  const posts = await prisma.discoveriesPost.findMany({
    where: {
      AND: [
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        {
          OR: [
            { visibility: "network", userId: { in: allowedAuthors } },
            ...(settings.discoveriesPublicEnabled
              ? [{ visibility: "public" as const }]
              : []),
          ],
        },
        args.cursor ? { createdAt: { lt: new Date(args.cursor) } } : {},
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    include: {
      user: { select: userSelect },
      likes: { where: { userId: args.viewerId }, select: { id: true } },
      bookmarks: { where: { userId: args.viewerId }, select: { id: true } },
      _count: { select: { likes: true, comments: true, shares: true } },
    },
  });
  mark("queryPosts");

  const hasMore = posts.length > limit;
  let slice = hasMore ? posts.slice(0, limit) : posts;

  slice = await filterByCategoryVisibility(args.viewerId, slice);
  mark("visibilityFilter");

  let enriched: DiscoveriesPostWithMeta[];

  if (!settings.showConnectionReasons || !settings.enableIntroductionGraph) {
    enriched = slice.map((p) => ({
      id: p.id,
      userId: p.userId,
      content: p.content,
      mediaUrl: p.mediaUrl ? resolveMediaUrlForClient(p.mediaUrl) : p.mediaUrl,
      mediaType: p.mediaType,
      visibility: p.visibility,
      introductionCategoryId: p.introductionCategoryId,
      visibilityMode: p.visibilityMode,
      createdAt: p.createdAt,
      expiresAt: p.expiresAt,
      user: p.user,
      likeCount: p._count.likes,
      commentCount: p._count.comments,
      shareCount: p._count.shares,
      likedByMe: p.likes.length > 0,
      bookmarkedByMe: p.bookmarks.length > 0,
    }));
  } else {
    const authorIds = slice.map((p) => p.userId);
    const [reasonMap, trustMap] = await Promise.all([
      getConnectionReasonsBulk(args.viewerId, authorIds),
      settings.showSharedIntroducers
        ? getTrustProfilesBulk(args.viewerId, authorIds)
        : Promise.resolve(new Map()),
    ]);

    enriched = slice.map((p) => {
      const reason = reasonMap.get(p.userId);
      const trustProfile = trustMap.get(p.userId);
      return {
        id: p.id,
        userId: p.userId,
        content: p.content,
        mediaUrl: p.mediaUrl ? resolveMediaUrlForClient(p.mediaUrl) : p.mediaUrl,
        mediaType: p.mediaType,
        visibility: p.visibility,
        introductionCategoryId: p.introductionCategoryId,
        visibilityMode: p.visibilityMode,
        createdAt: p.createdAt,
        expiresAt: p.expiresAt,
        user: p.user,
        likeCount: p._count.likes,
        commentCount: p._count.comments,
        shareCount: p._count.shares,
        likedByMe: p.likes.length > 0,
        bookmarkedByMe: p.bookmarks.length > 0,
        connectionReason: reason
          ? serializeConnectionReason(reason, args.viewerId, p.userId)
          : undefined,
        trustProfile: settings.showSharedIntroducers ? trustProfile : undefined,
      };
    });

    enriched.sort((a, b) => {
      const sharedA = a.trustProfile?.sharedIntroducerCount ?? 0;
      const sharedB = b.trustProfile?.sharedIntroducerCount ?? 0;
      if (sharedB !== sharedA) return sharedB - sharedA;
      const scoreA = a.trustProfile?.trustScore ?? 0;
      const scoreB = b.trustProfile?.trustScore ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      const depthA = a.connectionReason?.connectionDepth ?? 99;
      const depthB = b.connectionReason?.connectionDepth ?? 99;
      if (depthA !== depthB) return depthA - depthB;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    mark("trustEnrichment");
  }

  if (profile) {
    console.log(
      `[PROFILE] getDiscoveriesFeed\n${Object.entries(marks)
        .map(([k, v]) => `${k}=${v}ms`)
        .join("\n")}`
    );
  }

  return {
    posts: enriched,
    nextCursor: hasMore ? slice[slice.length - 1].createdAt.toISOString() : null,
  };
}

export async function createDiscoveriesPost(args: {
  userId: string;
  content?: string | null;
  mediaUrl?: string | null;
  mediaType?: "image" | "video" | null;
  visibility?: "network" | "public";
}) {
  const settings = await getAdminSettings();
  if (!settings.discoveriesEnabled) throw new Error("Discoveries is disabled");

  if (args.visibility === "public" && !settings.discoveriesPublicEnabled) {
    throw new Error("Public discoveries are not enabled");
  }

  const expiresAt =
    settings.discoveriesExpiryHours && settings.discoveriesExpiryHours > 0
      ? new Date(Date.now() + settings.discoveriesExpiryHours * 60 * 60 * 1000)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

  return prisma.discoveriesPost.create({
    data: {
      userId: args.userId,
      content: args.content ?? null,
      mediaUrl: args.mediaUrl ?? null,
      mediaType: args.mediaType ?? null,
      visibility: args.visibility ?? "network",
      expiresAt,
    },
    include: { user: { select: userSelect } },
  }).then(async (post) => {
    void analyticsService.track({
      userId: args.userId,
      eventType: ANALYTICS_EVENTS.DISCOVERY_CREATED,
      entityType: "discoveries_post",
      entityId: post.id,
    });
    return post;
  });
}

async function assertDiscoveryAccess(viewerId: string, postId: string) {
  if (!(await canViewDiscoveryPost(viewerId, postId))) {
    throw new Error("Forbidden");
  }
}

export async function toggleDiscoveriesLike(postId: string, userId: string) {
  await assertDiscoveryAccess(userId, postId);
  const post = await prisma.discoveriesPost.findUnique({
    where: { id: postId },
    select: { userId: true },
  });
  const existing = await prisma.discoveriesLike.findUnique({
    where: { postId_userId: { postId, userId } },
  });
  if (existing) {
    await prisma.discoveriesLike.delete({ where: { id: existing.id } });
    return { liked: false };
  }
  await prisma.discoveriesLike.create({ data: { postId, userId } });
  void analyticsService.track({
    userId,
    eventType: ANALYTICS_EVENTS.DISCOVERY_LIKED,
    entityType: "discoveries_post",
    entityId: postId,
  });
  if (post && post.userId !== userId) {
    const actor = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    if (actor) {
      void notifyDiscoveryEngagement({
        postAuthorId: post.userId,
        actorId: userId,
        actorName: actor.name,
        postId,
        kind: "liked",
      }).catch(() => {});
    }
  }
  return { liked: true };
}

export async function addDiscoveriesComment(args: {
  postId: string;
  userId: string;
  content: string;
}) {
  await assertDiscoveryAccess(args.userId, args.postId);
  const comment = await prisma.discoveriesComment.create({
    data: args,
    include: { user: { select: userSelect } },
  });
  void analyticsService.track({
    userId: args.userId,
    eventType: ANALYTICS_EVENTS.DISCOVERY_COMMENTED,
    entityType: "discoveries_post",
    entityId: args.postId,
  });
  const post = await prisma.discoveriesPost.findUnique({
    where: { id: args.postId },
    select: { userId: true },
  });
  if (post && post.userId !== args.userId) {
    void notifyDiscoveryEngagement({
      postAuthorId: post.userId,
      actorId: args.userId,
      actorName: comment.user.name,
      postId: args.postId,
      kind: "commented",
      preview: args.content,
    }).catch(() => {});
  }
  return comment;
}

export async function getDiscoveriesComments(postId: string, viewerId: string, limit = 30) {
  await assertDiscoveryAccess(viewerId, postId);
  return prisma.discoveriesComment.findMany({
    where: { postId },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: { user: { select: userSelect } },
  });
}

export async function toggleDiscoveriesBookmark(postId: string, userId: string) {
  await assertDiscoveryAccess(userId, postId);
  const existing = await prisma.discoveriesBookmark.findUnique({
    where: { postId_userId: { postId, userId } },
  });
  if (existing) {
    await prisma.discoveriesBookmark.delete({ where: { id: existing.id } });
    return { bookmarked: false };
  }
  await prisma.discoveriesBookmark.create({ data: { postId, userId } });
  return { bookmarked: true };
}

export async function recordDiscoveriesShare(postId: string, userId: string) {
  await assertDiscoveryAccess(userId, postId);
  await prisma.discoveriesShare.create({ data: { postId, userId } });
  void analyticsService.track({
    userId,
    eventType: ANALYTICS_EVENTS.DISCOVERY_SHARED,
    entityType: "discoveries_post",
    entityId: postId,
  });
  const post = await prisma.discoveriesPost.findUnique({
    where: { id: postId },
    select: { userId: true },
  });
  if (post && post.userId !== userId) {
    const actor = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    if (actor) {
      void notifyDiscoveryEngagement({
        postAuthorId: post.userId,
        actorId: userId,
        actorName: actor.name,
        postId,
        kind: "shared",
      }).catch(() => {});
    }
  }
  return { ok: true };
}

/** Track analytics once per post when discoveries expire. */
export async function trackRecentlyExpiredDiscoveries() {
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const expired = await prisma.discoveriesPost.findMany({
    where: {
      expiresAt: { lte: new Date(), gte: since },
    },
    select: { id: true, userId: true },
    take: 50,
  });

  for (const post of expired) {
    const already = await prisma.analyticsEvent.findFirst({
      where: {
        eventType: ANALYTICS_EVENTS.DISCOVERY_EXPIRED,
        entityId: post.id,
      },
      select: { id: true },
    });
    if (already) continue;
    await analyticsService.track({
      userId: post.userId,
      eventType: ANALYTICS_EVENTS.DISCOVERY_EXPIRED,
      entityType: "discoveries_post",
      entityId: post.id,
    });
  }
}
