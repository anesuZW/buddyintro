# BuddyIntro Performance Fix Report

**Date:** 2026-06-21  
**Engineer scope:** React hooks, Prisma/Supabase latency, API profiling, media 403, observability  
**Build status:** `npm run build` passes after fixes

---

## 1. Problems found

### A. React — Invalid hook call / useContext null

| Symptom | Root cause | Severity |
|---------|------------|----------|
| `Invalid hook call` | **Secondary effect** of SSR failures (DB timeouts) triggering Fast Refresh full reload | High |
| `Cannot read properties of null (reading 'useContext')` | React tree torn down mid-render when server components throw; client hooks run in invalid context | High |
| References to `usePathname`, `LinkComponent`, `ErrorBoundary` | Standard Next.js error overlay stack — not incorrect hook placement | Info |

**Code audit result:** All hook usage is in `"use client"` components. No hooks in server components, loops, conditionals, or async functions. Single React version (`18.3.1`) in `package.json`.

### B. Database — Slow routes & N+1

| Route / API | Queries (before) | Primary bottleneck |
|-------------|------------------|-------------------|
| `/home` | ~18–22 | N+1 `storyPassesVisibilityGate` per story; layout badge duplicate user fetch |
| `/discoveries` | ~6 SSR + client API | Category visibility N+1; trust recs client fetch |
| `/introductions` | ~6 SSR + 3 client APIs | Over-fetch; duplicate categories fetch |
| `/profile` | ~12–14 | Trust network stats; duplicate trust recs fetch |
| `/api/trust/recommendations` | 2–3 | No server cache; ~11s with slow pooler |
| `/api/introductions` | 3–4 | Story fetch + classify in memory |
| `/api/introduction-categories` | 2 | Repeated `getAdminSettings` + category list |
| Layout (all pages) | ~6–8 | Separate badge queries including duplicate user lookup |

**Infrastructure:** Supabase pooler latency ~1.2s/query (measured via `check-db-latency`). This amplifies all application issues.

### C. Media — `/api/media` 403 after 5–6s

| Finding | Detail |
|---------|--------|
| **403 root cause** | `canAccessStoragePath` denied access to `{userId}/image/*` paths (profile avatars) — only owner or story/post media was allowed |
| **Slow response** | `requireUser()` + `story.findFirst` with `CONTAINS` on full URL + visibility gate chain before 403 |
| **Not** bucket RLS | Admin signed URLs use service role; 403 was application logic, not Supabase Storage policy |

### D. Duplicate client API calls

- `/api/trust/recommendations` fetched on 4 routes via `TrustRecommendationsPanel`
- `/api/introduction-categories` fetched on introductions mount despite SSR-capable data
- Layout SSR unread count + `NotificationBell` dropdown refetch

---

## 2. Root causes (summary)

1. **Pooler connect latency** — dominant factor for 5–11s API times  
2. **N+1 visibility loops** — `getVisibleStories`, `filterByCategoryVisibility`  
3. **No cross-request caching** — admin settings, trust recommendations, categories  
4. **Layout query duplication** — `getIntroductionsUnreadCount` re-fetched user row  
5. **Media ACL too strict** — avatar paths blocked for non-owners  
6. **Hook errors** — cascade from failed SSR, not hook misuse  

---

## 3. Fixes applied

### React / resilience

| File | Change |
|------|--------|
| `app/(main)/error.tsx` | **New** — error boundary with retry for hook/SSR cascade recovery |

### Database / N+1

| File | Change |
|------|--------|
| `lib/story-visibility.ts` | **New** `filterStoriesByVisibilityGate()` — 2 batch queries replace O(n) per-story lookups |
| `services/stories.ts` | Uses batch visibility filter in `getVisibleStories` |
| `lib/category-visibility.ts` | Batch `filterByCategoryVisibility` — 1–2 queries replace 2× per post |
| `services/layout-badges.ts` | **New** — combined badge queries; reuses `user.lastIntroductionsSeenAt` |
| `app/(main)/layout.tsx` | Uses `getLayoutBadges(user)` — saves 1–2 queries per navigation |
| `services/rbac.ts` | `syncLegacyAdminRole` skips repeat upserts per process lifetime |
| `prisma/migrations/202615_performance_indexes/` | **New** indexes on `stories(user_id, status)`, category, `story_tags(tagged_user_id)` |

### Caching

| File | Change |
|------|--------|
| `services/admin.ts` | 60s TTL cross-request cache + `invalidateAdminSettingsCache()` |
| `lib/perf-cache.ts` | **New** — trust recommendations (5 min) + categories (5 min) caches |
| `services/trust-recommendations.ts` | Wrapped in `getCachedTrustRecommendations` |
| `services/introduction-categories.ts` | Uses cached list; invalidates on mutations |

### API / duplicate fetch elimination

| File | Change |
|------|--------|
| `app/(main)/home/page.tsx` | SSR `getTrustRecommendations` → `initialRecommendations` prop |
| `app/(main)/discoveries/page.tsx` | Same |
| `app/(main)/introductions/page.tsx` | SSR recommendations + categories → props |
| `app/(main)/profile/page.tsx` | Same |
| `components/trust/TrustRecommendationsPanel.tsx` | Accepts `initialRecommendations`; seeds module cache |
| `components/introductions/IntroductionsList.tsx` | Accepts `initialCategories`; skips client fetch when provided |
| `app/api/introduction-categories/route.ts` | `Cache-Control: private, max-age=300` |

### Media

| File | Change |
|------|--------|
| `lib/access-control.ts` | Allow authenticated access to `{userId}/image/*` (avatars); normalized path lookup |
| `app/api/media/route.ts` | `Cache-Control: private, max-age=300` on redirect |

### Observability (Phase 3)

| File | Change |
|------|--------|
| `lib/perf/store.ts` | In-memory perf ring buffer |
| `lib/perf/context.ts` | AsyncLocalStorage request context + query tracking |
| `lib/perf/with-perf.ts` | API route timing wrapper |
| `lib/prisma.ts` | `$extends` query middleware — logs >200ms, counts queries |
| `app/api/admin/performance/route.ts` | Admin metrics API |
| `app/(main)/maindash/performance/page.tsx` | **New** performance dashboard |
| `components/admin/PerformanceDashboard.tsx` | UI for slow pages/APIs/queries |
| `components/admin/AdminNav.tsx` | Added Performance link |
| Key pages | Wrapped with `runWithPerf` for page timing |

---

## 4. Estimated impact

| Fix | Before (typical, slow pooler) | After (same pooler) | After (healthy pooler ~35ms/q) |
|-----|------------------------------|---------------------|--------------------------------|
| Batch story visibility | +3–6s on `/home` | +200–400ms | +70ms |
| Layout badge dedupe | +2 queries/nav | −1–2 queries | −70ms/nav |
| Admin settings TTL | +1.2s per cold read | ~0ms (cached) | ~0ms |
| Trust recs cache + SSR | 11s × 4 routes | 11s once / 5min | ~35ms hit |
| Category batch filter | +1–4s discoveries | +100–300ms | +35ms |
| Media avatar ACL | 403 + 5–6s | 200–500ms redirect | ~100ms |
| Categories SSR + cache | 4–6s client | 0 client (SSR) | ~35ms |

**Critical remaining dependency:** Add `connection_limit=1` to `DATABASE_URL` and fix pooler reachability (see `docs/DATABASE_URL_AUDIT.md`). Without this, absolute times stay in seconds regardless of app fixes.

---

## 5. Before vs after comparison

### Query counts (estimated per request)

| Path | Queries before | Queries after |
|------|----------------|---------------|
| `/home` SSR | ~20 | ~8–10 |
| Layout | ~6–8 | ~4–5 |
| `/api/trust/recommendations` (cache hit) | 2–3 | 0 |
| `/api/media` (avatar) | 3–5 + 403 | 1–2 + 302 |
| `getVisibleStories` (50 stories) | ~100 | ~4 |

### Client API calls per session navigation

| Pattern | Before | After |
|---------|--------|-------|
| Trust recommendations | 4× fetch | 0× (SSR seed) + cache |
| Introduction categories | 1× per mount | 0× on introductions page |

---

## 6. Remaining bottlenecks

| Priority | Issue | Recommendation |
|----------|-------|----------------|
| **Critical** | Supabase pooler ~1.2s/query | Fix `DATABASE_URL` + `connection_limit=1` |
| **High** | `loadIntroductionEdges` full scan when graph not materialized | Ensure `user_connections` always populated |
| **High** | `getConversationList` window over all messages | Denormalize last-message table |
| **Medium** | `analyticsService.queryMetrics` (~30 aggregations) | Redis cache 5–15 min |
| **Medium** | Middleware `auth.getUser()` on every `/api/*` | Narrow matcher or use JWT session |
| **Low** | In-memory perf store resets on deploy | Export to Redis/Postgres for production APM |

---

## 7. Verification steps

```bash
npm run build                    # must pass
npm run check-db-latency         # SELECT 1 p95 target <100ms after pooler fix
npm run dev                      # navigate /home, /discoveries, /introductions
# Admin: /maindash/performance   # view slow pages, APIs, Prisma queries
```

### Observability dashboard

Navigate to **`/maindash/performance`** (admin only) to view:

- Slowest pages (SSR timing)
- Slowest APIs
- Prisma queries >200ms
- Average response time and query count per request

---

## 8. Files changed (index)

```
lib/perf/store.ts                          NEW
lib/perf/context.ts                        NEW
lib/perf/with-perf.ts                      NEW
lib/perf-cache.ts                          NEW
lib/prisma.ts                              MODIFIED
lib/story-visibility.ts                    MODIFIED
lib/category-visibility.ts                 MODIFIED
lib/access-control.ts                      MODIFIED
services/admin.ts                          MODIFIED
services/trust-recommendations.ts          MODIFIED
services/introduction-categories.ts        MODIFIED
services/stories.ts                        MODIFIED
services/layout-badges.ts                  NEW
services/rbac.ts                           MODIFIED
app/(main)/layout.tsx                      MODIFIED
app/(main)/error.tsx                       NEW
app/(main)/home/page.tsx                   MODIFIED
app/(main)/discoveries/page.tsx            MODIFIED
app/(main)/introductions/page.tsx          MODIFIED
app/(main)/profile/page.tsx                MODIFIED
app/(main)/maindash/performance/page.tsx   NEW
app/api/trust/recommendations/route.ts     MODIFIED
app/api/introductions/route.ts             MODIFIED
app/api/introduction-categories/route.ts   MODIFIED
app/api/media/route.ts                     MODIFIED
app/api/admin/performance/route.ts         NEW
components/trust/TrustRecommendationsPanel.tsx  MODIFIED
components/introductions/IntroductionsList.tsx MODIFIED
components/admin/PerformanceDashboard.tsx  NEW
components/admin/AdminNav.tsx                MODIFIED
prisma/migrations/202615_performance_indexes/migration.sql  NEW
docs/PERFORMANCE_FIX_REPORT.md             NEW
```
