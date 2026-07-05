# BuddyIntro Performance Audit Report

**Date:** 2026-06-21  
**Type:** Static + measured audit (no code changes)  
**Related:** [`docs/PERFORMANCE_AUDIT.md`](./PERFORMANCE_AUDIT.md), [`docs/PERFORMANCE_REMEDIATION_PLAN.md`](./PERFORMANCE_REMEDIATION_PLAN.md), [`docs/DATABASE_URL_AUDIT.md`](./DATABASE_URL_AUDIT.md)

---

## Methodology & important caveat

Route load times are derived from **two reliable inputs** rather than a single noisy live run:

1. **Static DB-call counting** — every Server Component, layout, and service method on each route path was traced to count Prisma queries.
2. **Measured per-query latency** — `scripts/check-db-latency.ts` (10 runs each):

   | Query | min | avg | p95 | max |
   |-------|-----|-----|-----|-----|
   | `SELECT 1` | 1,178 ms | 1,375 ms | 3,022 ms | 3,022 ms |
   | `adminSettings.findUnique` | 1,440 ms | 3,295 ms | 9,343 ms | 9,343 ms |
   | `story.count()` | 1,185 ms | 1,228 ms | 1,464 ms | 1,464 ms |

> **Critical context:** The Supabase pooler is currently returning **~1.2 s per round-trip** (target: <50 ms). This infra latency dominates every route. Estimated DB times below use **avg ≈ 1.2 s/query** for the *current broken* state, plus a **healthy-pooler projection** (≈ 35 ms/query) so application-level cost is visible independently of infra. No dev server was running and live route timing would be dominated by cold compile + pooler latency, so it is not used as the primary signal.

---

## 1. Route load time table

Estimated server-side DB time = (sequential-equivalent query count) × per-query latency. Parallel queries (`Promise.all`) reduce wall-clock but not pooler load; "DB Time" below is wall-clock estimate accounting for parallelism.

| Route | Server DB queries | Total DB time (current ~1.2 s/q) | Total DB time (healthy ~35 ms/q) | Slowest query / unit |
|-------|-------------------|----------------------------------|----------------------------------|----------------------|
| `/` (landing) | **0** (auth only in middleware) | ~0 ms + 1 auth call | ~0 ms | `supabase.auth.getUser()` (network, not DB) |
| `/home` | **~18–22** (layout 6 + feed/stats/suggestions) | **8–15 s** | **400–700 ms** | `getVisibleStories` N+1 visibility gate |
| `/discoveries` | **~6 SSR** + client `/api/discoveries` | **6–9 s** (mostly client API) | **300–600 ms** | `getDiscoveriesNetworkAuthorIds` BFS / `filterByCategoryVisibility` |
| `/introductions` | **~6 SSR** + 3 client APIs | **6–9 s** | **300–500 ms** | `getIntroductionsForViewer` (over-fetch + group filter) |
| `/messages` | **~6 SSR** + client `/api/messages` | **6–10 s** | **300–500 ms** | `getConversationList` raw window + `getTrustProfilesBulk` |
| `/profile` | **~12–14** (layout 6 + `getProfileTrustNetwork`) | **7–12 s** | **400–600 ms** | `getTrustNetworkStats` (mutual-count fallback) |
| `/maindash` | **~12 SSR** + client `/api/admin/analytics` | **10–18 s** | **600 ms–1.2 s** | `analyticsService.queryMetrics` (~30 aggregations) |

**Ranked slowest → fastest:** `/maindash` → `/home` → `/profile` → `/messages` → `/discoveries` → `/introductions` → `/`.

---

## 2. Findings by category

### 2.1 Layout-level database calls (affects EVERY authenticated route)

`app/(main)/layout.tsx` runs on every main route and issues, per request:

```12:18:app/(main)/layout.tsx
  const [introBadge, unreadMessages, unreadNotifications] = await Promise.all([
    getIntroductionsUnreadCount(user.id),
    prisma.message.count({
      where: { receiverId: user.id, readAt: null },
    }),
    getUnreadNotificationCount(user.id),
  ]);
```

Tracing the calls:

| Call | Prisma queries |
|------|----------------|
| `requireUser()` → `getCurrentUser()` | 1 (`user.findUnique`) + **2 if admin** (`syncLegacyAdminRole`) |
| `getIntroductionsUnreadCount` | `getAdminSettings` (cached) + `user.findUnique` + `story.count` = **2** |
| `prisma.message.count` | 1 |
| `getUnreadNotificationCount` | 1 |

**~6 DB queries on every page** (8 for admins), before the page itself runs. At current latency that is **~2–4 s of pure layout overhead per navigation**.

### 2.2 Repeated admin settings lookups

- `getAdminSettings` **is** wrapped in `React.cache()` (`services/admin.ts:92`), so it is deduped **within a single request**. **Good.**
- **But** it is *not* cached across requests. Every navigation re-fetches settings (≥1.2 s when cold). It is referenced in 7+ server entry points (`maindash`, `discoveries`, introductions visibility, messages, posts, settings API).
- **Recommendation:** module-level TTL cache or Redis for `AdminSettings` (changes rarely).

### 2.3 Repeated trust-graph calculations

- `TrustRecommendationsPanel` is mounted on **4 routes** (`/home`, `/discoveries`, `/introductions`, `/profile`). Each mount fetches `/api/trust/recommendations` (7 s API, no server cache).
- Client has a module-level promise cache (`components/trust/TrustRecommendationsPanel.tsx:12`) that dedupes **within one tab session only** — a fresh navigation/another user re-computes.
- `getTrustNetworkStats` is called by both `/home` (via dashboard) and `/profile` (via `getProfileTrustNetwork`) and recomputes mutual counts each time.
- **Recommendation:** server-side Redis cache keyed by `userId` (see remediation plan §7).

### 2.4 Uncached dashboard metrics

- `/maindash` page runs 5 `count()` queries inline (`maindash/page.tsx:17-22`) on every load — never cached.
- `AnalyticsDashboard` fetches `/api/admin/analytics` which runs **~30 parallel aggregations** (`analyticsService.queryMetrics`) with no caching layer.
- **Recommendation:** cache analytics results for 5–15 min; cache landing counts.

### 2.5 Slow Prisma queries (>200 ms, application-level)

Even on a healthy pooler these stay expensive because of scan/loop shape:

| Query | Location | Issue |
|-------|----------|-------|
| `storyTag.findMany` (published) | `lib/introduction-graph.ts:108` `loadIntroductionEdges` | Full published-tag scan; 30 s observed |
| `getVisibleStories` loop | `services/stories.ts:240` | N+1: per-story `storyPassesVisibilityGate` |
| `filterByCategoryVisibility` loop | `lib/category-visibility.ts:111` | N+1: 2 counts per post |
| `getConversationList` window | `services/messages.ts:255` | `ROW_NUMBER()` over all user messages |
| `queryMetrics` | `services/analytics/analytics-service.ts:28` | ~30 aggregations per call |

### 2.6 N+1 query patterns

| # | Location | Pattern |
|---|----------|---------|
| 1 | `services/stories.ts` `getVisibleStories` | `for (story) await storyPassesVisibilityGate()` → 1–2 queries each |
| 2 | `lib/category-visibility.ts` `filterByCategoryVisibility` | `for (item) await viewerSharesCategoryWithAuthor()` → 2 counts each |
| 3 | `lib/introduction-graph.ts` `getConnectionReasonsBulk` slow path | `Promise.all(missing.map(getConnectionReason))` |
| 4 | `services/trust-network.ts` `getTrustNetworkStats` fallback | `for (t) await getMutualIntroducers()` when connections not materialized |
| 5 | `services/discoveries.ts` `trackRecentlyExpiredDiscoveries` | `for (post) await analyticsEvent.findFirst` (off hot path now) |

### 2.7 Middleware database calls

`middleware.ts` → `lib/supabase/middleware.ts` runs on **every matched request** and calls:

```34:36:lib/supabase/middleware.ts
  const {
    data: { user },
  } = await supabase.auth.getUser();
```

- This is a **Supabase Auth network call** (not Prisma), but it runs on every page, asset-adjacent path, and API route not excluded by the matcher.
- The matcher excludes `_next/static`, `_next/image`, and a few files, but **not `/api/*`** generally — so API routes pay the auth round-trip in middleware **and** again in the handler.
- **No Prisma calls in middleware.** Good — but `auth.getUser()` hitting Supabase on every request adds latency; consider `getSession()` (JWT-local) where full user revalidation isn't required.

### 2.8 Excessive / duplicate API calls (client)

| Pattern | Routes | Impact |
|---------|--------|--------|
| `/api/trust/recommendations` | home, discoveries, introductions, profile | 4× per session; 7 s each cold |
| Unread notification count | layout SSR (`getUnreadNotificationCount`) + `NotificationBell` (`/api/notifications?limit=5` on open) + realtime hook | 3 sources of truth |
| `/api/introductions` GET + immediate POST (mark-seen) | introductions | 2 round-trips on load (`IntroductionsList.tsx:39,48`) |
| `/api/introduction-categories` | introductions list + story uploader | fetched per component mount |
| Analytics `track`/`pwa` fire-and-forget | discoveries cards, PWA shell | low impact (non-blocking) |

---

## 3. Index review & recommendations

The schema is already **well-indexed** (see `prisma/schema.prisma`). Existing coverage is strong on `Message`, `UserConnection`, `Notification`, `DiscoveriesPost`, `StoryTag`, `AnalyticsEvent`.

### Gaps / recommended additions

| Table | Recommended index | Reason |
|-------|-------------------|--------|
| `Story` | `@@index([userId, status])` | `getVisibleStories`, `getTrustNetworkStats` filter by author + status repeatedly |
| `Story` | `@@index([status, introductionCategoryId])` | `viewerSharesCategoryWithAuthor` `story.count` filters status + category |
| `StoryTag` | `@@index([taggedUserId, storyId])` (composite) | covers tag→story joins in feed/graph without extra lookup |
| `StoryTag` | partial index `WHERE taggedUserId IS NOT NULL` | `loadIntroductionEdges` filters `taggedUserId: { not: null }` over published |
| `SharedIntroducerRelationship` | already `@@index([userAId, userBId])` ✓ | adequate |
| `AdminSettings` | single row (id=1) — no index needed | — |

> Indexes alone will **not** fix the current 1.2 s/query baseline (that is connect latency). They matter once the pooler is healthy and tables grow.

---

## 4. React component review

### 4.1 Unnecessary re-renders

| Component | Issue | Severity |
|-----------|-------|----------|
| `DiscoveriesFeed` / `DiscoveriesPostCard` | `framer-motion` `motion` per card; `onUpdate` callback recreated unless memoized | Medium |
| `ConversationList` rows | Re-render on each inbox poll; no `React.memo` on row | Low |
| `TopBar` / `NotificationBell` | Re-renders on every realtime notification UPDATE | Low (mitigated by local decrement) |

### 4.2 Repeated `useEffect` fetches

| Component | Fetch | Note |
|-----------|-------|------|
| `MessagesInboxClient` | `/api/messages` on mount | OK, single load |
| `IntroductionsList` | `/api/introductions` + `/api/introduction-categories` + mark-seen POST | 3 calls on mount; categories could be SSR-passed |
| `NotificationPreferencesPanel`, `UserInsightsPanel`, `PhoneVerificationPanel` | one fetch each on `/profile` mount | 3 separate client round-trips on profile load |
| `NotificationBell` | `/api/notifications?limit=5` each time dropdown opens | re-fetches every open (no cache) |

### 4.3 Duplicate API requests

- **`/api/trust/recommendations`** — biggest offender; same data fetched on 4 routes (see §2.3). The module-level cache helps within a tab but not across full navigations/SSR.
- **Unread counts** fetched in layout (SSR) and again by `NotificationBell`/realtime hook.

**Recommendation:** Pass SSR-fetched data (recommendations, categories, unread counts) as props instead of refetching client-side; add HTTP `Cache-Control` to read-only APIs.

---

## 5. Middleware & providers review

| Item | Finding | Action |
|------|---------|--------|
| `middleware.ts` matcher | Runs `auth.getUser()` on most paths incl. `/api/*` | Narrow matcher to exclude pure API routes that re-auth internally; or use `getSession()` |
| `lib/supabase/middleware.ts` | No Prisma calls ✓ | Keep |
| `app/layout.tsx` `ThemeProvider` | Client provider, no server work ✓ | Keep |
| `ServiceWorkerRegister`, `CookieConsentBanner`, `Toaster` | Client-only, lightweight ✓ | Keep |
| `getCurrentUser` `syncLegacyAdminRole` | 2 extra writes per request **for admins** | Gate behind a once-per-session check or cache |

---

## 6. Prioritized remediation list

### Critical

| Fix | Expected load-time improvement |
|-----|-------------------------------|
| **C1.** Fix Supabase pooler latency + add `connection_limit=1` | **10–100×** on every route (1.2 s/q → ~35 ms/q). `/home` 8–15 s → <1 s |
| **C2.** Eliminate `getVisibleStories` N+1 (batch visibility) | `/home` −3–6 s (current infra) / −150 ms (healthy) |
| **C3.** Cache `loadIntroductionEdges` / always use materialized `user_connections` | removes 30 s worst-case scans on home/discoveries |

### High

| Fix | Expected improvement |
|-----|----------------------|
| **H1.** Server-side Redis cache for `/api/trust/recommendations` | 7 s → <50 ms on hit; removes 4× duplicate work |
| **H2.** Batch `filterByCategoryVisibility` | `/discoveries` −1–4 s |
| **H3.** Cross-request cache for `getAdminSettings` (TTL/Redis) | −1.2 s on most routes (cold) |
| **H4.** Cache `analyticsService.queryMetrics` (5–15 min) | `/maindash` −several seconds |
| **H5.** Denormalize/index `getConversationList` | `/messages` −2–6 s |

### Medium

| Fix | Expected improvement |
|-----|----------------------|
| **M1.** Pass SSR data to client panels (recommendations, categories, unread) | −1–2 client round-trips per route |
| **M2.** Add recommended indexes (§3) | scales with data size; ~−100–500 ms once pooler healthy |
| **M3.** Narrow middleware matcher / use `getSession()` | −1 auth round-trip on API-heavy flows |
| **M4.** Gate `syncLegacyAdminRole` writes | −2 queries/request for admins |
| **M5.** Reduce layout DB calls (combine badge counts into one query) | −1–2 queries on every navigation |

### Low

| Fix | Expected improvement |
|-----|----------------------|
| **L1.** `React.memo` on Discoveries cards / conversation rows | smoother scroll, no load-time change |
| **L2.** `NotificationBell` cache dropdown results | −1 fetch per open |
| **L3.** Lazy-load `framer-motion` / heavy client imports | smaller First Load JS on `/discoveries` |

---

## 7. Summary

- **The dominant bottleneck is infrastructure** — the Supabase pooler is responding at ~1.2 s/query (should be <50 ms). Fixing C1 alone collapses every route's load time by an order of magnitude.
- **Application-level issues** are real and worth fixing for scale: layout runs ~6 DB queries on every navigation, trust recommendations are recomputed on 4 routes, dashboard metrics and admin settings are uncached, and there are 4 remaining N+1 loops.
- **Schema indexing is already strong**; only a handful of composite/partial indexes are recommended, and they matter only after the pooler is healthy.
- **No code was modified.** This report is the audit deliverable; actionable fixes are tracked in `docs/PERFORMANCE_REMEDIATION_PLAN.md`.
