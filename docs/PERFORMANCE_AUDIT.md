# BuddyIntro Performance Audit

**Date:** 2026-06-20  
**Environment:** Local dev (`npm run dev` on port **3001**; port **3000** occupied by broken `npm run start`)  
**Test account:** `user1@friendintro.com` / `123456` (login succeeded intermittently; Supabase DB pooler timeouts observed)

---

## Executive summary

Live testing revealed **critical infrastructure latency** (Supabase pooler unreachable / 200s+ home page loads) layered on top of **predictable application-level N+1 queries**, **duplicate client fetches**, and **heavy dev cold-compile times**. Safe code optimizations were applied in this pass (see §10). Remaining issues require DB connectivity fixes and larger refactors.

---

## 1. Live page load measurements (server TTFB from Next.js dev logs)

| Route | First load (ms) | Notes |
|-------|-----------------|-------|
| `/login` | **7,168** | Cold compile 712 modules |
| `/home` | **207,649** → **71,616** | Prisma P1001 pooler timeout in `getIntroductionSuggestions`; later 500 + Fast Refresh errors |
| `/discoveries` | **12,714** | Cold compile 2065 modules + client API waterfall |
| `/introductions` | **7,912** | Cold compile 2095 modules |
| `/messages` | **6,705** | Client-only shell |
| `/notifications` | **8,771** | |
| `/profile` | **12,838** | Cold compile 2206 modules |
| `/maindash` | **6,612** (307 redirect) | Non-admin redirect to login/home |

**Ranked slowest → fastest (first dev navigation):**

1. `/home` (blocked by DB + N+1 suggestions)
2. `/profile`
3. `/discoveries`
4. `/notifications`
5. `/introductions`
6. `/maindash` / `/messages`
7. `/login`

> Dev first-compile inflates all times 3–10× vs production. Treat absolute ms as directional; **relative ranking** is reliable.

---

## 2. API response times (observed)

| Endpoint | Time (ms) | Status | Issue |
|----------|-----------|--------|-------|
| `GET /api/trust/recommendations` | **7,462 / 7,257** | 200 | Called from 4 pages; graph/trust work |
| `GET /api/media?path=…` | **5,829 / 2,500 / 1,816** | 307 | Storage redirect chain + access checks |
| `GET /api/discoveries` | Not isolated | — | 15–80+ Prisma queries when graph enrichment on |
| `GET /api/health` | ~fast when DB up | — | Fails when pooler down |

### Slow requests (>500ms)

All authenticated API routes exceeded 500ms during this session due to **DB connection timeouts** and **cold Prisma client compilation**.

### Duplicate requests

| Pattern | Pages | Impact |
|---------|-------|--------|
| `/api/trust/recommendations` | home, discoveries, introductions, profile | 4× identical fetch per session navigation |
| Unread notifications | layout SSR count + realtime hook + bell dropdown | 3 sources of truth |
| Chat messages | SSR `getConversation` + `useRealtimeMessages` full fetch | Duplicate thread load (**fixed**) |

### Sequential waterfalls (could parallelize)

| Page | Waterfall |
|------|-----------|
| `/home` | auth → 4 parallel services (OK) → client recommendations |
| `/introductions` | categories → introductions tab → mark-seen POST |
| `/messages/[userId]` | block → access → user → trust → settings → gate → context → markRead → conversation → story |
| `/discoveries` | SSR auth → client `/api/discoveries` → recommendations |

### Missing caching

- `getAdminSettings()` — **fixed** with `React.cache()` per request
- `getCurrentUser()` — **fixed** with `React.cache()`
- No HTTP `Cache-Control` on feed/settings APIs
- No CDN edge cache for `/api/media` redirects

---

## 3. Browser console findings

| Type | Finding | Severity |
|------|---------|----------|
| **Error** | `Prisma P1001` — Can't reach database server at pooler | **Critical** |
| **Error** | `Invalid hook call` / `useContext` null during Fast Refresh full reload | **High** (dev-only) |
| **Warning** | `Fast Refresh had to perform a full reload due to a runtime error` on every main route | **High** (dev UX) |
| **Error** | `fetch failed` / `UND_ERR_CONNECT_TIMEOUT` (Supabase auth) | **Critical** |
| Hydration | Login Suspense shows perpetual `Loading…` on port 3000 broken server | **High** |

---

## 4. Network / bundle analysis

### Production First Load JS (from prior build)

| Route | First Load JS |
|-------|---------------|
| `/discoveries` | **221 kB** |
| `/create-story` | **215 kB** |
| `/introductions` | 113 kB |
| `/home` | 110 kB |

### Heavy client imports

- `framer-motion` on every Discoveries card
- `@supabase/supabase-js` on all main layout pages (NotificationBell realtime)
- `StoryUploader` ~1,289 lines — **now lazy-loaded** via `dynamic()`

### Zero code splitting (before fixes)

No `dynamic()` usage — **partially addressed** for create flow.

---

## 5. React re-render risks

| Component | Issue | Status |
|-----------|-------|--------|
| `TrustRecommendationsPanel` | Refetch on every mount | **Fixed** — module-level promise cache |
| `DiscoveriesFeed` | `updatePost` unstable | **Fixed** — `useCallback` |
| `NotificationBell` | Realtime unread bumps TopBar | Open — consider context split |
| `DiscoveriesPostCard` | No `React.memo` | Open |

---

## 6. Realtime / Supabase

| Hook | Issue | Status |
|------|-------|--------|
| `useRealtimeMessages` | Global INSERT fan-out; unbounded fetch | **Partial fix** — skip fetch when SSR bootstrap provided; add `.limit(200)` |
| `useRealtimeMessages` | Unfiltered subscription | **Open** — needs server-side filter or RLS-scoped channel |
| `useRealtimeNotifications` | UPDATE triggers full API refresh | **Fixed** — decrement unread locally |
| Notifications channel | Filtered by `user_id` | OK |

### Storage

- `/api/media` 307 redirects took **1.8–5.8s** — investigate Supabase storage latency + access-control chain

---

## 7. Prisma / database

### Critical (infra)

- **P1001** — pooler `aws-0-eu-west-1.pooler.supabase.com:6543` unreachable → all pages stall

### N+1 (application)

| Location | Pattern | Status |
|----------|---------|--------|
| `getIntroductionSuggestions` | O(n²) `count()` per pair | **Fixed** — batch `groupBy` |
| `getConnectionReasonsBulk` | Per-author `getConnectionReason` | **Fixed** — `user_connections` fast path |
| `getTrustNetworkStats` | Per-user `getMutualIntroducers` | **Fixed** when connections materialized |
| `getVisibleStories` | Per-story visibility gate | Open |
| `filterByCategoryVisibility` | Per-post category queries | Open |
| `trackRecentlyExpiredDiscoveries` | Up to 50× `findFirst` on GET | **Removed from hot path** |

### Missing indexes (recommended)

- `discoveries_posts(user_id, created_at DESC)`
- GIN/trigram on `users.name` for search
- `analytics_events(event_type, entity_id)` for expiry dedup

---

## 8. Next.js architecture notes

| Finding | Recommendation |
|---------|----------------|
| `(main)/layout` runs 4 DB queries every navigation | Consider collapsing badge counts into one query |
| `/discoveries`, `/introductions` are client-data shells | Server-fetch first page + stream |
| No `Suspense` boundaries on heavy home sections | Wrap `TrustNetworkDashboard`, feed in `<Suspense>` |
| Chat page 10+ sequential awaits | Parallelize independent checks |
| Port 3000 broken `npm start` | Use single dev server; rebuild `.next` before production start |

---

## 9. Issues by priority

### Critical

| Issue | Root cause | File | Fix | Est. improvement |
|-------|------------|------|-----|------------------|
| DB pooler timeouts | Network / Supabase pooler config / VPN | `.env` `DATABASE_URL` | Verify pooler URL, use direct URL for migrations, check Supabase status | Unblocks all pages |
| `/home` 200s+ loads | `getIntroductionSuggestions` N+1 during DB outage | `services/introduction-suggestions.ts` | Batch counts (**done**); add timeout fallback | 70–95% query reduction |
| Port 3000 broken prod | Stale `.next` + `npm start` conflict | — | Stop prod on 3000; `npm run build && npm run dev` | Restores testing |

### High priority

| Issue | Root cause | File | Fix | Est. improvement |
|-------|------------|------|-----|------------------|
| Duplicate trust recommendations fetch | Panel mounted on 4 routes | `TrustRecommendationsPanel.tsx` | Module cache (**done**) | −3 redundant API calls/session |
| Duplicate chat message fetch | Hook always refetched | `hooks/useRealtimeMessages.ts` | SSR bootstrap (**done**) | −1 full thread fetch |
| `/api/trust/recommendations` 7s+ | Graph + trust queries | `services/trust-recommendations.ts` | Cache 60s; server component fetch | −80% repeat latency |
| Global message realtime subscription | No Supabase filter | `hooks/useRealtimeMessages.ts` | Filter by participant pair | −90% realtime CPU |
| Discoveries API enrichment N+1 | Category + graph per post | `lib/category-visibility.ts`, `lib/introduction-graph.ts` | Batch category edges (**partial** — connections fast path done) | −60% discoveries API time |

### Medium priority

| Issue | Root cause | File | Fix | Est. improvement |
|-------|------------|------|-----|------------------|
| Introductions client waterfall | All data client-side | `IntroductionsList.tsx` | SSR first page + parallel fetches | −300–600ms TTI |
| Chat server waterfall | Sequential awaits | `app/(main)/messages/[userId]/page.tsx` | `Promise.all` independent steps | −30–50% TTFB |
| framer-motion on feed cards | Animation per card | `DiscoveriesFeed.tsx` | CSS transitions or lazy motion | Smoother scroll |
| Admin dashboard eager panels | Analytics + moderation on load | `maindash/page.tsx` | `dynamic()` below fold | −100kB initial JS |
| Notification UPDATE refetch | Full API on every read | `useRealtimeNotifications.ts` | Local decrement (**done**) | −N API calls |

### Quick wins (implemented this pass)

| Change | File | Impact |
|--------|------|--------|
| `React.cache()` on `getAdminSettings` | `services/admin.ts` | −1 query/request |
| `React.cache()` on `getCurrentUser` | `lib/auth.ts` | Halves auth DB reads on layout+page |
| Batch intro suggestion counts | `services/introduction-suggestions.ts`, `lib/shared-introducers.ts` | Up to 400 queries → 1 |
| `user_connections` fast path for bulk reasons | `lib/introduction-graph.ts` | −N graph traversals per discoveries page |
| Materialized mutual count on profile/home stats | `services/trust-network.ts` | −N `getMutualIntroducers` calls |
| Skip duplicate chat fetch | `hooks/useRealtimeMessages.ts`, `ChatWindow.tsx` | −1 Supabase query per chat open |
| Trust recommendations dedupe | `TrustRecommendationsPanel.tsx` | 1 fetch shared across routes |
| Lazy `StoryUploader` | `IntroductionCreator.tsx` | Smaller create-route initial bundle |
| Remove expiry tracking from discoveries GET | `services/discoveries.ts` | −up to 50 queries/request |
| `useCallback` on discoveries `updatePost` | `DiscoveriesFeed.tsx` | Fewer card re-renders |

---

## 10. Optimizations applied (this session)

```
lib/auth.ts                          — React.cache(getCurrentUser)
services/admin.ts                    — React.cache(getAdminSettings)
services/introduction-suggestions.ts — batch shared-introducer counts
lib/shared-introducers.ts            — getSharedIntroducerCountsBulk()
lib/introduction-graph.ts            — user_connections fast path in getConnectionReasonsBulk
services/trust-network.ts            — batch mutual stats via user_connections
services/discoveries.ts              — removed trackRecentlyExpiredDiscoveries from GET hot path
hooks/useRealtimeMessages.ts         — SSR bootstrap skip + query limit
hooks/useRealtimeNotifications.ts    — local unread decrement on UPDATE
components/messages/ChatWindow.tsx     — pass bootstrap to hook
components/trust/TrustRecommendationsPanel.tsx — module fetch cache
components/create/IntroductionCreator.tsx      — dynamic StoryUploader
components/discoveries/DiscoveriesFeed.tsx     — useCallback updatePost
scripts/live-performance-audit.ts    — new live timing script
package.json                         — audit:live script
```

---

## 11. Recommended next steps

1. **Fix Supabase connectivity** — verify `DATABASE_URL` / pooler settings; test with `npm run verify-database`
2. **Stop conflicting servers** — only one process on port 3000
3. **Add Supabase realtime filter** on messages channel
4. **Server-fetch** discoveries/introductions first page
5. **Run** `npm run audit:live -- --base=http://localhost:3000` after DB is healthy
6. **Add** `(event_type, entity_id)` index + move expiry analytics to job worker

---

## 12. How to re-run this audit

```bash
# Static analysis
npm run audit:performance

# Live HTTP timing (unauthenticated)
npm run audit:live -- --base=http://localhost:3000

# Full authenticated pass: log in via browser, open DevTools Network,
# navigate Home → Introductions → Discoveries → Messages → Notifications → Profile → Maindash
```

---

*Generated from live browser session on localhost:3001 and Next.js dev server logs. Re-test on localhost:3000 after resolving port conflict and database connectivity.*
