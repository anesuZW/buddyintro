import type { Prisma } from "@prisma/client";

/** Pluggable analytics backend — swap for PostHog/ClickHouse without changing callers. */
export interface AnalyticsProvider {
  track(input: TrackEventInput): Promise<void>;
  queryMetrics(args: AnalyticsQueryArgs): Promise<AnalyticsMetricsResult>;
  queryUserInsights(userId: string): Promise<UserInsightsResult>;
  listEvents(args: AnalyticsListEventsArgs): Promise<AnalyticsEventsListResult>;
}

export type AnalyticsListEventsArgs = {
  days?: number;
  cursor?: string;
  limit?: number;
  eventType?: string;
  userId?: string;
};

export type AnalyticsEventRow = {
  id: string;
  userId: string | null;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: Date;
};

export type AnalyticsEventsListResult = {
  items: AnalyticsEventRow[];
  nextCursor: string | null;
};

export type TrackEventInput = {
  userId?: string | null;
  eventType: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

export type AnalyticsQueryArgs = {
  days: number;
};

export type LeaderboardEntry = {
  userId: string;
  name: string;
  value: number;
};

export type AnalyticsMetricsResult = {
  dailyActiveUsers: number;
  monthlyActiveUsers: number;
  introductionsCreated: number;
  introductionsViewed: number;
  invitesSent: number;
  invitesAccepted: number;
  discoveryEngagement: number;
  messagesSent: number;
  trustConnectionsCreated: number;
  sharedIntroducersGenerated: number;
  verificationConversions: number;
  topCategories: Array<{ name: string; count: number }>;
  chart: Array<{ date: string; count: number }>;
  trustMetrics: {
    mostTrustedUsers: LeaderboardEntry[];
    topSharedIntroducers: LeaderboardEntry[];
    mostConnectedUsers: LeaderboardEntry[];
    highestTrustScores: LeaderboardEntry[];
    fastestGrowingNetworks: LeaderboardEntry[];
  };
  introductionMetrics: {
    created: number;
    viewed: number;
    replied: number;
    accepted: number;
    acceptanceRate: number;
  };
  discoveryMetrics: {
    views: number;
    messages: number;
    shares: number;
  };
  verificationMetrics: {
    phoneVerified: number;
    identityVerified: number;
    trustedUsers: number;
  };
  categoryMetrics: Array<{ name: string; count: number }>;
};

export type UserInsightsResult = {
  peopleIntroduced: number;
  introductionsReceived: number;
  sharedIntroducers: number;
  trustScore: number;
  trustGrowth: number;
  discoveryReach: number;
  messagesStarted: number;
  invitationsAccepted: number;
  categoriesUsed: Array<{ name: string; count: number }>;
  peopleConnected: number;
  networkGrowth: number;
  introductionsCreated: number;
  introductionViews: number;
  introductionsAccepted: number;
};
