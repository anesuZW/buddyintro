import "server-only";

import { prisma } from "@/lib/prisma";
import { getIntroductionExpiryFilter } from "@/lib/introductions-settings";
import { listBlockedUserIds } from "@/services/moderation";
import type { IntroductionGroup, IntroductionItem } from "@/types";
import { clampLimit, type PaginatedResult } from "@/lib/pagination";
import { introductionNetworkHref } from "@/lib/introduction-routes";
import { isProfileEnabled } from "@/lib/profile/route-profiler";

const storyInclude = {
  user: { select: { id: true, name: true, profilePicture: true } },
  category: { select: { id: true, name: true } },
  tags: {
    include: {
      taggedUser: { select: { id: true, name: true, profilePicture: true } },
    },
  },
};

const RECENT_DAYS = 30;

function classifyIntroduction(
  story: { status: string; publishedAt: Date | null; createdAt: Date },
  lastSeen: Date | null
): { group: IntroductionGroup; isUnread: boolean } {
  const isUnread = !lastSeen || story.createdAt > lastSeen;

  if (story.status === "draft") {
    return { group: "pending", isUnread };
  }

  const cutoff = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);
  const refDate = story.publishedAt ?? story.createdAt;
  if (refDate >= cutoff) return { group: "recent", isUnread };
  return { group: "past", isUnread };
}

export async function getIntroductionsForUser(
  userId: string,
  args?: { group?: IntroductionGroup; cursor?: string; limit?: number }
): Promise<
  PaginatedResult<IntroductionItem> & {
    unreadCount: number;
    neverExpire: boolean;
    counts: Record<IntroductionGroup, number>;
  }
> {
  const profile = isProfileEnabled();
  const marks: Record<string, number> = {};
  let last = performance.now();
  const mark = (label: string) => {
    if (!profile) return;
    const now = performance.now();
    marks[label] = Math.round(now - last);
    last = now;
  };

  const expiryFilter = await getIntroductionExpiryFilter();
  mark("expiryFilter");
  const limit = clampLimit(args?.limit);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastIntroductionsSeenAt: true },
  });
  const lastSeen = user?.lastIntroductionsSeenAt ?? null;
  mark("queryUser");

  const [stories, blockedIds] = await Promise.all([
    prisma.story.findMany({
      where: {
        ...expiryFilter,
        tags: { some: { taggedUserId: userId } },
        OR: [{ status: "published" }, { status: "draft" }, { status: "expired" }],
        ...(args?.cursor ? { createdAt: { lt: new Date(args.cursor) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      include: storyInclude,
    }),
    listBlockedUserIds(userId),
  ]);
  mark("queryStories");

  const blocked = new Set(blockedIds);

  const allItems: IntroductionItem[] = stories
    .filter((s) => !blocked.has(s.userId))
    .map((s) => {
      const { group, isUnread } = classifyIntroduction(s, lastSeen);
      return { ...s, group, isUnread };
    });

  const filtered = args?.group
    ? allItems.filter((i) => i.group === args.group)
    : allItems;

  const hasMore = filtered.length > limit || stories.length > limit;
  const slice = filtered.slice(0, limit);

  const counts: Record<IntroductionGroup, number> = {
    recent: allItems.filter((i) => i.group === "recent").length,
    past: allItems.filter((i) => i.group === "past").length,
    pending: allItems.filter((i) => i.group === "pending").length,
  };
  mark("loopsAndFilter");

  if (profile) {
    console.log(
      `[PROFILE] getIntroductionsForUser\n${Object.entries(marks)
        .map(([k, v]) => `${k}=${v}ms`)
        .join("\n")}`
    );
  }

  return {
    items: slice,
    nextCursor:
      hasMore && slice.length
        ? slice[slice.length - 1].createdAt.toISOString()
        : null,
    unreadCount: allItems.filter((i) => i.isUnread).length,
    neverExpire: Object.keys(expiryFilter).length === 0,
    counts,
  };
}

export async function getIntroductionsUnreadCount(userId: string) {
  const expiryFilter = await getIntroductionExpiryFilter();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastIntroductionsSeenAt: true },
  });
  const lastSeen = user?.lastIntroductionsSeenAt;

  return prisma.story.count({
    where: {
      ...expiryFilter,
      tags: { some: { taggedUserId: userId } },
      ...(lastSeen ? { createdAt: { gt: lastSeen } } : {}),
    },
  });
}

export async function markIntroductionsSeen(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { lastIntroductionsSeenAt: new Date() },
  });
}

export async function getSentIntroductionsForUser(userId: string, limit = 50) {
  const expiryFilter = await getIntroductionExpiryFilter();
  const rows = await prisma.story.findMany({
    where: {
      ...expiryFilter,
      userId,
      status: { in: ["published", "expired", "draft"] },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: storyInclude,
  });
  return rows.map((s) => ({
    ...s,
    group: "recent" as const,
    isUnread: false,
  }));
}

export type MutualIntroductionPartner = {
  userId: string;
  name: string;
  profilePicture: string | null;
  sharedIntroducerCount: number;
  networkHref: string;
};

export async function getMutualIntroductionPartners(
  userId: string,
  limit = 30
): Promise<MutualIntroductionPartner[]> {
  const connections = await prisma.userConnection.findMany({
    where: {
      sourceUserId: userId,
      degree: 1,
      sharedIntroducerCount: { gt: 0 },
    },
    orderBy: [{ sharedIntroducerCount: "desc" }, { trustScore: "desc" }],
    take: limit,
    include: {
      targetUser: { select: { id: true, name: true, profilePicture: true } },
    },
  });

  return connections.map((c) => ({
    userId: c.targetUser.id,
    name: c.targetUser.name,
    profilePicture: c.targetUser.profilePicture,
    sharedIntroducerCount: c.sharedIntroducerCount,
    networkHref: introductionNetworkHref([userId, c.targetUser.id]),
  }));
}
