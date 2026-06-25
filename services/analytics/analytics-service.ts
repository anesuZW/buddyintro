import { prisma } from "@/lib/prisma";
import { ANALYTICS_EVENTS } from "@/lib/analytics-events";
import type { Prisma } from "@prisma/client";
import type {
  AnalyticsProvider,
  AnalyticsQueryArgs,
  AnalyticsMetricsResult,
  TrackEventInput,
  UserInsightsResult,
  AnalyticsListEventsArgs,
  AnalyticsEventsListResult,
} from "@/services/analytics/types";
import { clampLimit } from "@/lib/pagination";

export class PrismaAnalyticsProvider implements AnalyticsProvider {
  async track(input: TrackEventInput): Promise<void> {
    await prisma.analyticsEvent.create({
      data: {
        userId: input.userId ?? null,
        eventType: input.eventType,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async queryMetrics(args: AnalyticsQueryArgs): Promise<AnalyticsMetricsResult> {
    const since = new Date(Date.now() - args.days * 24 * 60 * 60 * 1000);
    const monthSince = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const daySince = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      dau,
      mau,
      introductionsCreated,
      introductionsViewed,
      invitesSent,
      invitesAccepted,
      discoveryEngagement,
      messagesSent,
      trustConnections,
      sharedIntroducers,
      verificationConversions,
      events,
      categoryRows,
      introductionsReplied,
      introductionsAccepted,
      introductionsOpened,
      discoveryViews,
      discoveryShares,
      discoveryMessages,
      phoneVerifiedCount,
      identityVerifiedCount,
      trustedUserCount,
      trustGrowthEvents,
      topTrustConnections,
      topSharedIntroRows,
      connectionCounts,
      categoryJoinRows,
    ] = await Promise.all([
      prisma.analyticsEvent.groupBy({
        by: ["userId"],
        where: { createdAt: { gte: daySince }, userId: { not: null } },
      }),
      prisma.analyticsEvent.groupBy({
        by: ["userId"],
        where: { createdAt: { gte: monthSince }, userId: { not: null } },
      }),
      prisma.analyticsEvent.count({
        where: { eventType: ANALYTICS_EVENTS.INTRODUCTION_CREATED, createdAt: { gte: since } },
      }),
      prisma.analyticsEvent.count({
        where: { eventType: ANALYTICS_EVENTS.INTRODUCTION_VIEWED, createdAt: { gte: since } },
      }),
      prisma.analyticsEvent.count({
        where: { eventType: ANALYTICS_EVENTS.INVITE_SENT, createdAt: { gte: since } },
      }),
      prisma.analyticsEvent.count({
        where: { eventType: ANALYTICS_EVENTS.INVITE_ACCEPTED, createdAt: { gte: since } },
      }),
      prisma.analyticsEvent.count({
        where: {
          eventType: {
            in: [
              ANALYTICS_EVENTS.DISCOVERY_LIKED,
              ANALYTICS_EVENTS.DISCOVERY_COMMENTED,
              ANALYTICS_EVENTS.DISCOVERY_SHARED,
            ],
          },
          createdAt: { gte: since },
        },
      }),
      prisma.analyticsEvent.count({
        where: { eventType: ANALYTICS_EVENTS.MESSAGE_SENT, createdAt: { gte: since } },
      }),
      prisma.userConnection.count({ where: { createdAt: { gte: since } } }),
      prisma.sharedIntroducerRelationship.count({ where: { createdAt: { gte: since } } }),
      prisma.analyticsEvent.count({
        where: {
          eventType: { in: [ANALYTICS_EVENTS.PHONE_VERIFIED, ANALYTICS_EVENTS.IDENTITY_VERIFIED] },
          createdAt: { gte: since },
        },
      }),
      prisma.analyticsEvent.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.story.groupBy({
        by: ["introductionCategoryId"],
        where: { createdAt: { gte: since }, introductionCategoryId: { not: null } },
        _count: { id: true },
      }),
      prisma.analyticsEvent.count({
        where: { eventType: ANALYTICS_EVENTS.INTRODUCTION_REPLIED, createdAt: { gte: since } },
      }),
      prisma.analyticsEvent.count({
        where: { eventType: ANALYTICS_EVENTS.INTRODUCTION_ACCEPTED, createdAt: { gte: since } },
      }),
      prisma.analyticsEvent.count({
        where: { eventType: ANALYTICS_EVENTS.INTRODUCTION_OPENED, createdAt: { gte: since } },
      }),
      prisma.analyticsEvent.count({
        where: { eventType: ANALYTICS_EVENTS.DISCOVERY_VIEWED, createdAt: { gte: since } },
      }),
      prisma.analyticsEvent.count({
        where: { eventType: ANALYTICS_EVENTS.DISCOVERY_SHARED, createdAt: { gte: since } },
      }),
      prisma.analyticsEvent.count({
        where: {
          eventType: {
            in: [
              ANALYTICS_EVENTS.DISCOVERY_MESSAGE_STARTED,
              ANALYTICS_EVENTS.DISCOVERY_MESSAGE_CLICKED,
            ],
          },
          createdAt: { gte: since },
        },
      }),
      prisma.user.count({ where: { phoneVerified: true } }),
      prisma.user.count({ where: { identityVerified: true } }),
      prisma.user.count({ where: { trustedUser: true } }),
      prisma.analyticsEvent.groupBy({
        by: ["userId"],
        where: {
          eventType: ANALYTICS_EVENTS.TRUST_SCORE_INCREASED,
          createdAt: { gte: since },
          userId: { not: null },
        },
        _count: { id: true },
      }),
      prisma.userConnection.findMany({
        where: { degree: 1 },
        orderBy: { trustScore: "desc" },
        take: 5,
        include: { sourceUser: { select: { id: true, name: true } } },
      }),
      prisma.sharedIntroducerRelationship.groupBy({
        by: ["sharedIntroducerId"],
        where: { createdAt: { gte: since } },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
      prisma.userConnection.groupBy({
        by: ["sourceUserId"],
        where: { degree: 1 },
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
        take: 5,
      }),
      prisma.analyticsEvent.groupBy({
        by: ["entityId"],
        where: { eventType: ANALYTICS_EVENTS.CATEGORY_JOINED, createdAt: { gte: since } },
        _count: { id: true },
      }),
    ]);

    const categoryIds = categoryRows
      .map((r) => r.introductionCategoryId)
      .filter((id): id is string => Boolean(id));
    const categories = categoryIds.length
      ? await prisma.introductionCategory.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true, name: true },
        })
      : [];
    const catMap = new Map(categories.map((c) => [c.id, c.name]));

    const introducerIds = topSharedIntroRows.map((r) => r.sharedIntroducerId);
    const introducers = introducerIds.length
      ? await prisma.user.findMany({
          where: { id: { in: introducerIds } },
          select: { id: true, name: true },
        })
      : [];
    const introducerMap = new Map(introducers.map((u) => [u.id, u.name]));

    const connectedUserIds = connectionCounts.map((r) => r.sourceUserId);
    const connectedUsers = connectedUserIds.length
      ? await prisma.user.findMany({
          where: { id: { in: connectedUserIds } },
          select: { id: true, name: true },
        })
      : [];
    const connectedMap = new Map(connectedUsers.map((u) => [u.id, u.name]));

    const categoryJoinIds = categoryJoinRows
      .map((r) => r.entityId)
      .filter((id): id is string => Boolean(id));
    const joinedCategories = categoryJoinIds.length
      ? await prisma.introductionCategory.findMany({
          where: { id: { in: categoryJoinIds } },
          select: { id: true, name: true },
        })
      : [];
    const joinedCatMap = new Map(joinedCategories.map((c) => [c.id, c.name]));

    const growthSorted = [...trustGrowthEvents].sort((a, b) => b._count.id - a._count.id).slice(0, 5);
    const growthIds = growthSorted.map((r) => r.userId!).filter(Boolean);
    const growthUsers = growthIds.length
      ? await prisma.user.findMany({
          where: { id: { in: growthIds } },
          select: { id: true, name: true },
        })
      : [];
    const growthMap = new Map(growthUsers.map((u) => [u.id, u.name]));

    const byDay = new Map<string, number>();
    for (const e of events) {
      const d = e.createdAt.toISOString().slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
    }

    return {
      dailyActiveUsers: dau.length,
      monthlyActiveUsers: mau.length,
      introductionsCreated,
      introductionsViewed,
      invitesSent,
      invitesAccepted,
      discoveryEngagement,
      messagesSent,
      trustConnectionsCreated: trustConnections,
      sharedIntroducersGenerated: sharedIntroducers,
      verificationConversions,
      topCategories: categoryRows
        .map((r) => ({
          name: catMap.get(r.introductionCategoryId!) ?? "Unknown",
          count: r._count.id,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      chart: Array.from(byDay.entries()).map(([date, count]) => ({ date, count })),
      trustMetrics: {
        mostTrustedUsers: topTrustConnections.map((c) => ({
          userId: c.sourceUser.id,
          name: c.sourceUser.name,
          value: c.trustScore,
        })),
        topSharedIntroducers: topSharedIntroRows.map((r) => ({
          userId: r.sharedIntroducerId,
          name: introducerMap.get(r.sharedIntroducerId) ?? "Unknown",
          value: r._count.id,
        })),
        mostConnectedUsers: connectionCounts.map((r) => ({
          userId: r.sourceUserId,
          name: connectedMap.get(r.sourceUserId) ?? "Unknown",
          value: r._count.id,
        })),
        highestTrustScores: topTrustConnections.map((c) => ({
          userId: c.sourceUser.id,
          name: c.sourceUser.name,
          value: c.trustScore,
        })),
        fastestGrowingNetworks: growthSorted.map((r) => ({
          userId: r.userId!,
          name: growthMap.get(r.userId!) ?? "Unknown",
          value: r._count.id,
        })),
      },
      introductionMetrics: {
        created: introductionsCreated,
        viewed: introductionsViewed,
        replied: introductionsReplied,
        accepted: introductionsAccepted,
        acceptanceRate:
          introductionsViewed > 0
            ? Math.round((introductionsAccepted / introductionsViewed) * 100)
            : 0,
      },
      discoveryMetrics: {
        views: discoveryViews,
        messages: discoveryMessages,
        shares: discoveryShares,
      },
      verificationMetrics: {
        phoneVerified: phoneVerifiedCount,
        identityVerified: identityVerifiedCount,
        trustedUsers: trustedUserCount,
      },
      categoryMetrics: categoryJoinRows
        .map((r) => ({
          name: joinedCatMap.get(r.entityId!) ?? catMap.get(r.entityId!) ?? "Unknown",
          count: r._count.id,
        }))
        .sort((a, b) => b.count - a.count),
    };
  }

  async queryUserInsights(userId: string): Promise<UserInsightsResult> {
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      peopleIntroduced,
      introductionsReceived,
      connection,
      messagesStarted,
      invitationsAccepted,
      discoveryPosts,
      categoriesUsed,
      trustGrowthEvents,
      peopleConnected,
      networkGrowthConnections,
      introductionsCreated,
      introductionViews,
      introductionsAccepted,
      discoveryViews,
    ] = await Promise.all([
      prisma.storyTag.count({
        where: { story: { userId, status: "published" }, taggedUserId: { not: null } },
      }),
      prisma.storyTag.count({ where: { taggedUserId: userId, story: { status: "published" } } }),
      prisma.userConnection.findFirst({
        where: { sourceUserId: userId },
        orderBy: { trustScore: "desc" },
        select: { trustScore: true, sharedIntroducerCount: true },
      }),
      prisma.message.count({
        where: { senderId: userId, createdAt: { gte: monthAgo } },
      }),
      prisma.invitation.count({
        where: { invitedById: userId, registered: true },
      }),
      prisma.discoveriesPost.count({ where: { userId } }),
      prisma.story.groupBy({
        by: ["introductionCategoryId"],
        where: { userId, introductionCategoryId: { not: null } },
        _count: { id: true },
      }),
      prisma.analyticsEvent.count({
        where: {
          userId,
          eventType: ANALYTICS_EVENTS.TRUST_SCORE_INCREASED,
          createdAt: { gte: monthAgo },
        },
      }),
      prisma.userConnection.count({
        where: { sourceUserId: userId, degree: { gte: 1, lte: 4 } },
      }),
      prisma.userConnection.count({
        where: { sourceUserId: userId, createdAt: { gte: monthAgo } },
      }),
      prisma.story.count({ where: { userId, status: "published" } }),
      prisma.analyticsEvent.count({
        where: {
          userId,
          eventType: ANALYTICS_EVENTS.INTRODUCTION_VIEWED,
          createdAt: { gte: monthAgo },
        },
      }),
      prisma.analyticsEvent.count({
        where: {
          userId,
          eventType: ANALYTICS_EVENTS.INTRODUCTION_ACCEPTED,
        },
      }),
      prisma.analyticsEvent.count({
        where: {
          userId,
          eventType: ANALYTICS_EVENTS.DISCOVERY_VIEWED,
          entityType: "discoveries_post",
        },
      }),
    ]);

    const catIds = categoriesUsed.map((c) => c.introductionCategoryId!).filter(Boolean);
    const cats = catIds.length
      ? await prisma.introductionCategory.findMany({ where: { id: { in: catIds } } })
      : [];
    const nameMap = new Map(cats.map((c) => [c.id, c.name]));

    return {
      peopleIntroduced,
      introductionsReceived,
      sharedIntroducers: connection?.sharedIntroducerCount ?? 0,
      trustScore: connection?.trustScore ?? 10,
      trustGrowth: trustGrowthEvents,
      discoveryReach: discoveryViews || discoveryPosts,
      messagesStarted,
      invitationsAccepted,
      categoriesUsed: categoriesUsed.map((c) => ({
        name: nameMap.get(c.introductionCategoryId!) ?? "Unknown",
        count: c._count.id,
      })),
      peopleConnected,
      networkGrowth: networkGrowthConnections,
      introductionsCreated,
      introductionViews,
      introductionsAccepted,
    };
  }

  async listEvents(args: AnalyticsListEventsArgs): Promise<AnalyticsEventsListResult> {
    const limit = clampLimit(args.limit);
    const days = args.days ?? 30;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await prisma.analyticsEvent.findMany({
      where: {
        ...(args.eventType ? { eventType: args.eventType } : {}),
        ...(args.userId ? { userId: args.userId } : {}),
        createdAt: args.cursor
          ? { gte: since, lt: new Date(args.cursor) }
          : { gte: since },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      select: {
        id: true,
        userId: true,
        eventType: true,
        entityType: true,
        entityId: true,
        createdAt: true,
      },
    });

    const hasMore = rows.length > limit;
    const slice = hasMore ? rows.slice(0, limit) : rows;

    return {
      items: slice,
      nextCursor: hasMore ? slice[slice.length - 1].createdAt.toISOString() : null,
    };
  }
}

export const analyticsProvider: AnalyticsProvider = new PrismaAnalyticsProvider();

export const analyticsService = {
  track(input: TrackEventInput) {
    return analyticsProvider.track(input);
  },
  queryMetrics(args: AnalyticsQueryArgs) {
    return analyticsProvider.queryMetrics(args);
  },
  queryUserInsights(userId: string) {
    return analyticsProvider.queryUserInsights(userId);
  },
  listEvents(args: AnalyticsListEventsArgs) {
    return analyticsProvider.listEvents(args);
  },
};
