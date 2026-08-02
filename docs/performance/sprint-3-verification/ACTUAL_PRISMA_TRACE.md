# Actual Prisma Trace — GET /home

**Generated:** 2026-07-26T18:05:00.000Z  
**Status:** **PARTIAL RUNTIME CAPTURE** — model/operation/duration verified; SQL/rows/caller file **UNVERIFIED** (instrumentation gap)

---

## Capture metadata

| Field | Value |
| --- | --- |
| **Git commit** | `87edda065bda93cf7c7dba6f74e2c263a133cb29` |
| **Date/time** | 2026-07-26T18:02:13Z (HTTP) / server log through 18:02:30Z |
| **Environment** | Windows, Next.js 14.2.15 dev, port 3010 |
| **DATABASE_URL** | Supabase pooler `aws-1-us-east-1.pooler.supabase.com:5432` |
| **PROFILE flags** | `PROFILE_PRODUCTION=1`, `AUTH_PROFILE=1`, `PROFILE_PHASE2=1` |
| **Test user** | `user1@friendintro.com` |
| **Request ID** | `2afc354d` |
| **HTTP result** | **200** — TTFB 43,395ms, total 52,696ms (cold compile dominated) |
| **Commands** | `$env:PROFILE_PRODUCTION='1'; npm run dev -- -p 3010` then `npx tsx scripts/capture-http-profile.ts --base=http://localhost:3010` |
| **Evidence source** | Server `[prisma:slow]` log lines (queries >200ms) — **RUNTIME VERIFIED** |

---

## Instrumentation limitation

Existing profiling (`lib/prisma.ts` extension) records model, operation, and duration. It does **not** emit generated SQL, bind parameters, or row counts per query. Prisma client `log` config excludes `query` events.

Fields marked **UNVERIFIED** below are not available without application code changes (forbidden this sprint).

---

## Authenticated GET /home — observed Prisma operations

Execution order reflects **log emission order** across parallel Suspense branches (approximate).

| # | Timestamp (rel.) | Model | Operation | Caller (mapped) | Caller file | Duration | Rows | SQL | Parameters |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | T+0.7s | User | findUnique | `getCurrentUser` | `lib/auth.ts` | 2,538ms | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| 2 | T+0.7s | User | findUnique | `getCurrentUser` (layout/parallel) | `lib/auth.ts` | 6,639ms | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| 3 | T+29s | AdminSettings | findUnique | `getAdminSettings` | `services/admin.ts` | 607ms | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| 4 | T+29s | StoryTag | findMany | `getHomeStoryContext` scan A | `services/home-dashboard.ts` | 612ms | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| 5 | T+29s | Message | count | `getLayoutBadges` | `services/layout-badges.ts` | 596ms | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| 6 | T+29s | Notification | count | `getUnreadNotificationCount` | `services/notifications/notification-service.ts` | 604ms | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| 7 | T+29s | Story | count | `getLayoutBadges` | `services/layout-badges.ts` | 2,755ms | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| 8 | T+29s | StoryTag | findMany | `getHomeStoryContext` scan B | `services/home-dashboard.ts` | 4,600ms | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| 9 | T+30s | Story | findMany | `getTrustNetworkStats` recentSent | `services/trust-network.ts` | 682ms | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| 10 | T+30s | Story | findMany | `getTrustNetworkStats` recentReceived | `services/trust-network.ts` | 687ms | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| 11 | T+30s | SharedIntroducerRelationship | groupBy | `getIntroductionSuggestions` | `services/introduction-suggestions.ts` | 693ms | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| 12 | T+30s | Story | findMany | `getVisibleStories` | `services/stories.ts` | 624ms | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| 13 | T+30s | Post | findMany | `getMutualTagFeed` | `services/feed.ts` | 624ms | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| 14 | T+30s | Story | findMany | `getMutualTagFeed` co-tag stories | `services/feed.ts` | 1,310ms | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| 15 | T+30s | UserConnection | findFirst | `isUserConnectionsMaterialized` | `services/introduction-graph-builder.ts` | 646ms | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| 16 | T+30s | UserConnection | findMany | `getTrustNetworkStats` mutual sum | `services/trust-network.ts` | 677ms | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| 17 | T+31s | UserConnection | findMany | `computeTrustRecommendations` | `services/trust-recommendations.ts` | 3,651ms | UNVERIFIED | UNVERIFIED | UNVERIFIED |
| 18 | T+31s | Story | findMany | `getMutualTagFeed` mutual authors | `services/feed.ts` | 4,898ms | UNVERIFIED | UNVERIFIED | UNVERIFIED |

**Caller mapping evidence:** STATIC ANALYSIS (call graph) + log interleaving with `[PROFILE] computeTrustRecommendations`.

---

## Aggregate counts (RUNTIME VERIFIED)

| Model.Operation | Count | Sprint 3 target |
| --- | --- | --- |
| StoryTag.findMany | **2** | ≤4 ✅ |
| StoryTag.count | **0** | — ✅ |
| Story.findMany | **5** | ≤3 ❌ |
| Story.count | **1** | — |
| UserConnection.findMany | **2** | — |
| UserConnection.findFirst | **1** | — |
| SharedIntroducerRelationship.groupBy | **1** | — |
| Post.findMany | **1** | — |
| Notification.count | **1** | — |
| Message.count | **1** | — |
| AdminSettings.findUnique | **1** | — |
| User.findUnique | **2** | Sprint 2 auth path |

**Dashboard Prisma ops (excl. auth User):** ~16 counted above.

---

## Auth profile (RUNTIME VERIFIED)

```
[AUTH-PROFILE][2afc354d] route-summary /home
middlewareGetUser=795ms
routeGetUser=0ms
prisma=6653ms
duplicateAuth=no
getUserCalls=1
```

Sprint 2 auth deduplication confirmed on this request.

---

## Prior failed capture (historical)

2026-07-26T16:33Z capture returned **500** (pooler unreachable). Superseded by this successful capture. See `home-trace-capture.json`.
