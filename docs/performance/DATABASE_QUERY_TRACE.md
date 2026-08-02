# Database Query Trace

**Generated:** 2026-07-26T06:37:26.870Z  
**Mode:** Static execution trees + Prisma extension timing (runtime requires PROFILE_* on server)

---

## Trace Mechanism

Every Prisma operation passes through:

```
Page / API Route
  ↓ runWithPerf({ label, kind })
  ↓ Server Component / Service
  ↓ lib/prisma.ts $extends
  ↓ trackPrismaQuery(model, operation, durationMs)
  ↓ recordPhase2PrismaQuery (when PROFILE_PHASE2=1)
  ↓ PostgreSQL via Supabase pooler
```

With `AUTH_PROFILE=1`, auth segment logs include `requestId`, `getCurrentUser`, `prismaUserLookup`, `supabaseGetUser`.

With `PROFILE_PRODUCTION=1`, responses include `x-bench-*` headers and `GET /api/bench/metrics/[id]`.

---

## Execution Trees by Page

### /home

```
app/[locale]/(main)/home/page.tsx → runWithPerf
  → requireUser → getCurrentUser → getAuthUser (Supabase) → User.findUnique/upsert
  → HomeTrustDashboard → loadHomeDashboardStats → getTrustNetworkStats
      → StoryTag.findMany ×2, UserConnection.findMany, Story.count
  → HomeSecondaryPanels → loadHomeDashboardSecondary
      → getHomeStoryContext (4× StoryTag.findMany) → getIntroductionSuggestions + getTrustRecommendations
  → HomeFeedPanels → loadHomeDashboardFeed
      → getHomeStoryContext (deduped) → getStoryBarForViewer → Story.findMany + StoryTag.findMany
      → getMutualTagFeed → Story.findMany + StoryTag.findMany
  layout: TopBarWithBadges + BottomNavWithBadge → getLayoutBadges (deduped)
      → Story.count, Message.count, Notification.count
```

### /discoveries

```
app/[locale]/(main)/discoveries/page.tsx → runWithPerf
  → requireUser → getCurrentUser
  → getAdminSettings (AdminSettings.findUnique)
  → getTrustRecommendations → UserConnection.findMany + getAdminSettings
  → getDiscoveriesFeed
      → getDiscoveriesNetworkAuthorIds → UserConnection.findMany
      → User.findUnique (viewer verification fields)
      → listBlockedUserIds → UserBlock.findMany
      → filterDiscoveryAuthorIds → verification gates
      → DiscoveriesPost.findMany (includes likes, bookmarks, _count)
      → filterByCategoryVisibility → Story.findMany (batched) + SharedIntroducerRelationship
      → getConnectionReasonsBulk + getTrustProfilesBulk
          → UserConnection.findMany, User.findMany, SharedIntroducerRelationship.findMany
```

### /messages

```
app/[locale]/(main)/messages/page.tsx (client shell)
  → MessagesInboxClient → GET /api/messages
      → getCurrentUser → getConversationList
          → Message.findMany (all user messages) + User.findMany + getTrustProfilesBulk
```

### /profile

```
app/[locale]/(main)/profile/page.tsx → runWithPerf
  → requireUser
  → getProfileTrustNetwork → StoryTag.findMany + UserConnection.findMany
  → getTrustRecommendations
  → analyticsService.queryUserInsights → AnalyticsEvent aggregations
  → notificationService.getPreferences → NotificationPreferences.findUnique
```

---

## Prisma Call Site Index

| Model | Operation | File | Function | Lines |
| --- | --- | --- | --- | --- |
| Story | findMany | services/home-dashboard.ts | getHomeStoryContext | 21-53 |
| StoryTag | findMany | services/home-dashboard.ts | getHomeStoryContext | 21-53 |
| Story | findMany | services/stories.ts | getStoryBarForViewer | 290 |
| AdminSettings | findUnique | services/admin.ts | getAdminSettings | cached |
| User | findUnique | lib/auth.ts | getCurrentUser | 124 |
| DiscoveriesPost | findMany | services/discoveries.ts | getDiscoveriesFeed | 74 |
| SharedIntroducerRelationship | findMany | services/trust-profile.ts | getTrustProfilesBulk | 146 |
| Notification | count | services/notifications/notification-service.ts | getUnreadNotificationCount | via layout-badges |
| Message | count | services/layout-badges.ts | getLayoutBadges | 22 |
| Story | count | services/layout-badges.ts | getLayoutBadges | 15 |
| UserConnection | findMany | lib/discoveries-network.ts | getDiscoveriesNetworkAuthorIds | network depth |
| AnalyticsEvent | count | services/analytics/analytics-service.ts | queryUserInsights | profile page |

---

## Runtime Capture Instructions

1. Start: `PROFILE_PRODUCTION=1 PROFILE_PHASE2=1 AUTH_PROFILE=1 npm run dev`
2. Load page — inspect server console for `[PROFILE]` and `[prisma:slow]` lines
3. Read `x-bench-request-id` header → `GET /api/bench/metrics/{id}`
