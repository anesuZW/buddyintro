# Query Reduction Plan

**Sprint:** Performance Optimization Planning (READ-ONLY)  
**Generated:** 2026-07-26  
**Sources:** DATABASE_QUERY_TRACE, N_PLUS_ONE_REPORT, DUPLICATE_QUERY_MATRIX, PAGE_BY_PAGE_QUERY_BREAKDOWN

---

## Methodology

For each Prisma model/operation we document:

- **Current** — max observed call count per authenticated request (worst page)
- **Target** — minimum achievable without behaviour change
- **Savings** — eliminable round-trips
- **Implementation** — where to change (next sprint only)
- **Verification** — how to prove equivalence

Pooler RTT baseline: **455ms avg** (profiling sprint). Each saved query ≈ **455ms** today, **40ms** after infra sprint.

---

## User.findUnique

| | |
|--|--|
| **Current** | 1 effective per SSR request (React `cache()` in `lib/auth.ts`) |
| **Worst case** | 2–3 on API routes that bypass shared request context |
| **Target** | 1 |
| **Savings** | **0** on pages; **0–2** on isolated API handlers |
| **Implementation** | Ensure all API routes use `getCurrentUser()` not raw `prisma.user.findUnique`; propagate middleware auth headers |
| **Verification** | `AUTH_PROFILE=1` → `getCurrentUserCalls` ≤ 1 |

---

## AdminSettings.findUnique

| | |
|--|--|
| **Current** | 1 effective (React `cache()` in `services/admin.ts`); 3–8 call sites |
| **Target** | 1 |
| **Savings** | **0** (already optimal within request) |
| **Implementation** | Pass `settingsOverride` from page into `getDiscoveriesFeed`, `getTrustRecommendations`, visibility gates — avoids cache miss on first-call ordering only |
| **Verification** | Phase2 `[PROFILE-ISSUE]` no repeated AdminSettings |

---

## StoryTag.findMany / count

| | |
|--|--|
| **Current (/home)** | **6 round-trips**: 4× in `getHomeStoryContext`, 1× in `getVisibleStories` fallback, 1× in `getMutualTagFeed` overlap |
| **Current (/profile)** | 2× via `getTrustNetworkStats` |
| **Target (/home)** | **1–2** consolidated queries returning all needed projections |
| **Savings** | **4–5 queries** on `/home`; **1** on `/profile` if stats reuse home context |
| **Implementation** | New `getHomeTagGraph(userId)` returning `{ myTags, taggedMe, introducedBy, introducedTo, coTagAuthors }` in 1–2 SQL statements; feed + story bar consume same structure |
| **Latency savings** | **~2.0–2.3s** today; **~160–200ms** at 40ms RTT |
| **Verification** | Same StoryBar groups + FeedList items vs baseline snapshot |

### Breakdown — `/home` StoryTag calls today

| # | Caller | Query purpose |
|---|--------|---------------|
| 1 | `getHomeStoryContext` | myTags |
| 2 | `getHomeStoryContext` | taggedMe → coTagAuthorIds |
| 3 | `getHomeStoryContext` | introducedByViewer |
| 4 | `getHomeStoryContext` | introducedToViewer |
| 5 | `getVisibleStories` | introducerAuthorIds (skipped when ctx passed ✓) |
| 6 | `getTrustNetworkStats` | introducerIds + introducedUserIds (overlaps ctx) |

**Consolidation opportunity:** Merge #1–4 into one query with conditional filters OR single raw SQL CTE. Merge #6 into shared context passed to `loadHomeDashboardStats`.

---

## Story.findMany / count

| | |
|--|--|
| **Current (/home)** | **5–7**: 2× count in trust stats, 2× findMany recent in trust stats, 1× getVisibleStories, 1× getMutualTagFeed, 1× layout Story.count (badge) |
| **Target** | **2–3** |
| **Savings** | **3–4 queries** |
| **Implementation** | (a) Combine trust stat counts into one grouped query; (b) reuse recent story rows from visibility query; (c) badge count from same expiry filter cached with layout badges |
| **Latency savings** | **~1.4–1.8s** today |
| **Verification** | TrustNetworkDashboard numbers unchanged; intro badge unchanged |

---

## Message.count / findMany / groupBy

| | |
|--|--|
| **Current** | Layout: `Message.count` (unread). API `/api/messages`: `$queryRaw` latest + `User.findMany` + `groupBy` unread + `getTrustProfilesBulk` |
| **Target** | Layout count stays; inbox API **3 queries** (raw SQL already optimized) |
| **Savings** | **1** if badge count derived from inbox cache or shared request memo |
| **Implementation** | Optional: `getLayoutBadges` stores unread total; messages API reads same request-scoped value for initial render |
| **Note** | Profiling report flagged unbounded findMany — **already fixed** via ROW_NUMBER raw SQL in `getConversationList`. No further reduction without UI change. |
| **Latency savings** | **~455ms** (1 RTT) |

---

## Notification.count / preferences

| | |
|--|--|
| **Current** | 1× `Notification.count` in layout; 1× `NotificationPreferences.findUnique` on `/profile` only |
| **Target** | 1 + 1 (unchanged count) |
| **Savings** | **0** on count; **0** on preferences (page-specific) |
| **Implementation** | Wrap `notificationService.getPreferences` in React `cache(userId)` — avoids duplicate if profile panels mount twice |
| **Risk** | SAFE |

---

## AnalyticsEvent

| | |
|--|--|
| **Current (story viewer)** | 1–2× synchronous `AnalyticsEvent.create` via `analyticsService.track` during SSR |
| **Current (/profile)** | Multiple aggregation queries in `queryUserInsights` |
| **Target** | **0 blocking** on SSR; insights loaded async or cached |
| **Savings** | **1–2 RTT** on story viewer; **2–4 RTT** deferrable on profile |
| **Implementation** | Queue analytics writes (existing job worker); move insights to client fetch or Suspense boundary with skeleton |
| **Behaviour** | Events still recorded; timing shifts to post-render |
| **Verification** | Event counts in DB match within 60s |

---

## DiscoveriesPost.findMany

| | |
|--|--|
| **Current (/discoveries)** | 1 heavy findMany with likes, bookmarks, `_count` |
| **Target** | 1 (cannot reduce without changing feed size) |
| **Savings** | **0 queries**; optimize select projections only |
| **SQL note** | Seq scan at 13 rows — index matters at scale, not now |
| **Latency** | Dominated by RTT (713ms p95 isolated), not rows |

---

## UserConnection.findMany

| | |
|--|--|
| **Current (/discoveries)** | 1× network author IDs + 1× trust recommendations + 1× getTrustProfilesBulk |
| **Current (/home)** | 1× in trust stats (conditional) |
| **Target** | **1–2** per page via shared `getViewerNetworkContext(viewerId)` |
| **Savings** | **1–2 queries** on discoveries |
| **Implementation** | Request-scoped cache returning `{ networkIds, connections }` consumed by feed + recommendations |
| **Latency savings** | **~455–910ms** today |

---

## SharedIntroducerRelationship.findMany

| | |
|--|--|
| **Current** | 1 bulk query with OR per author pair in `getTrustProfilesBulk`; additional in `filterByCategoryVisibility` |
| **Target** | 1–2 bulk queries (unchanged count, better shape) |
| **Savings** | **0 RTT** at current author counts; prevent OR explosion at scale |
| **Implementation** | Replace `OR: unique.map(...)` with `WHERE (user_a_id, user_b_id) IN (...)` or temp table pattern |
| **Verification** | Trust profiles identical for same feed slice |

---

## Invitation

| | |
|--|--|
| **Current** | 0 on listed pages SSR; used in create-story flow via API |
| **Target** | 0 |
| **Savings** | 0 on hot paths |

---

## IntroductionCategory.findMany

| | |
|--|--|
| **Current** | 1× via `listIntroductionCategoriesCached` (React cache + 5min module cache) |
| **Target** | 1 |
| **Savings** | 0 |

---

## Consolidated Savings Table

| Page | Current queries | Target queries | Saved | Est. latency saved (455ms RTT) | Est. at 40ms RTT |
|------|-----------------|----------------|-------|-------------------------------|------------------|
| `/home` | 18 | 10 | **8** | **3.6s** | **320ms** |
| `/discoveries` | 12 | 8 | **4** | **1.8s** | **160ms** |
| `/profile` | 10 | 7 | **3** | **1.4s** | **120ms** |
| `/introductions` | 8 (+4 API) | 6 (+3 API) | **3** | **1.4s** | **120ms** |
| `/messages` | 4+5 | 4+4 | **1** | **455ms** | **40ms** |
| `/create-story` | 4+3 | 4+2 | **1** | **455ms** | **40ms** |
| Story viewer | 10 | 7 | **3** | **1.4s** | **120ms** |
| Layout (shared) | 4 | 4 | 0 | 0 | 0 |

---

## Non-Goals (Behaviour-Preserving)

- Do not reduce feed item count or story visibility rules
- Do not skip auth or permission checks
- Do not remove trust enrichment when admin settings require it
- Do not change sort order of feeds

---

## Before/After Measurement Checklist

```bash
# Before each optimization PR
PROFILE_PRODUCTION=1 npm run build && npm run start -- -p 3010
npx tsx scripts/capture-http-profile.ts --base=http://localhost:3010
npx tsx scripts/database-performance-profile.ts --skip-server

# Assert
# - query count ↓
# - HTML snapshot equivalent (excluding timestamps)
# - API JSON diff empty
```
