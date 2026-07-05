# Performance Remediation Plan

**Date:** 2026-06-20  
**Scope:** Production-readiness audit — remaining bottlenecks only (no code changes applied in this pass)  
**Prior work:** See [`docs/PERFORMANCE_AUDIT.md`](./PERFORMANCE_AUDIT.md) for live dev measurements and optimizations already merged.

---

## Executive summary

BuddyIntro’s remaining performance risk is **layered**: (1) **Supabase pooler latency and intermittent P1001 timeouts** inflate every query; (2) **full-table graph scans** (`storyTag`, `loadIntroductionEdges`) dominate when `user_connections` is not materialized; (3) **residual N+1 loops** in visibility and category filtering; (4) **no server-side cache** for trust recommendations or feed APIs.

This document ranks the 20 slowest service methods, lists Prisma queries observed **>200ms**, inventories N+1 patterns, verifies `DATABASE_URL` / `DIRECT_URL` usage, assesses Supabase pooling, and proposes Redis caching for trust recommendations. **Implementation is deferred** — this is the remediation backlog only.

---

## 1. DATABASE_URL and DIRECT_URL verification

### Schema (correct)

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

Prisma uses **`DATABASE_URL`** for runtime queries and **`DIRECT_URL`** for migrations/introspection (`prisma migrate`, `db push`).

### Documented convention (correct)

| Variable | Intended use | Port | Notes |
|----------|--------------|------|-------|
| `DATABASE_URL` | App runtime, serverless, Prisma Client | **6543** (pooler) | Must include `pgbouncer=true` |
| `DIRECT_URL` | Migrations, raw `psql`, audit scripts | **5432** (direct) | Session mode; no pgbouncer |

`.env.example` and `README.md` both document pooled runtime + direct migrations.

### Runtime usage audit

| Location | URL used | Verdict |
|----------|----------|---------|
| `lib/prisma.ts` | `DATABASE_URL` (implicit via schema) | Correct |
| `prisma/schema.prisma` | Both declared | Correct |
| `scripts/verify-database.ts` | `DIRECT_URL \|\| DATABASE_URL` | Correct for diagnostics |
| `scripts/audit-database.ts`, `audit-performance.ts`, `audit-graph.ts`, `run-orphan-check.ts`, `apply-policies.mjs` | `DIRECT_URL \|\| DATABASE_URL` | Correct for long-running / DDL-adjacent scripts |
| `package.json` `db:rls` | `$DATABASE_URL` | Acceptable for policy SQL; prefer `DIRECT_URL` if statements are not transaction-pooler-safe |
| Application services | Never read env directly; all via `prisma` | Correct |

### Live environment findings (2026-06-20 benchmark)

```
DATABASE_URL host: aws-0-eu-west-1.pooler.supabase.com:6543
DIRECT_URL host: aws-0-eu-west-1.pooler.supabase.com:5432
pgbouncer: true
connection_limit: not set   ← missing in live .env (present in .env.example)
```

**Issue:** Live `DATABASE_URL` is missing `connection_limit=1` documented in `.env.example`. On Vercel/serverless, unconstrained Prisma pools can exhaust Supabase pooler slots.

**Remediation:** Align production `.env` with `.env.example`; verify pooler reachability (`npm run verify-database`); treat P1001 as infra blocker before tuning app code.

---

## 2. Prisma queries measured >200ms

Benchmark: `npx tsx` one-off against live Supabase (same session as prior audit; high variance due to pooler latency).

| Query / operation | Time (ms) | Notes |
|-------------------|-----------|-------|
| `storyTag.findMany` (published, take 100) | **30,427** | Full scan pattern; no selective index path at scale |
| `story.findMany` (published, take 50) | **119,068** | Likely compounded by pooler queueing after prior slow query |
| `SELECT 1` (`$queryRaw`) | **6,057** | Connection establishment / pooler latency, not query cost |
| `adminSettings.findUnique` | **4,920** | Single-row; latency is infra |
| `discoveriesPost.findMany` (take 21) | **1,979** | Feed page baseline |
| `messages` count for user | **1,458** | OR on sender/receiver without covering index |
| `userConnection.findMany` (take 12) | **1,227** | Trust recommendations baseline |
| `GET /api/trust/recommendations` (prior live) | **7,257–7,462** | End-to-end API, not single query |
| `/home` SSR (prior live) | **207,649** | Dominated by DB timeout in suggestions path |

> **Interpretation:** With a healthy pooler, several of these drop below 200ms; **`storyTag` full scans** and **N+1 visibility loops** remain the dominant *application* cost regardless of infra.

---

## 3. Proposed timing instrumentation (not yet implemented)

Add structured timing **without changing business logic**. Recommended approach:

### A. Service-level wrappers (priority targets)

| Function | File | Sub-spans to log |
|----------|------|------------------|
| `getTrustRecommendations` | `services/trust-recommendations.ts` | `getAdminSettings`, `userConnection.findMany`, `getSharedIntroducersForPair` |
| `getDiscoveriesFeed` | `services/discoveries.ts` | `getDiscoveriesNetworkAuthorIds`, `discoveriesPost.findMany`, `filterByCategoryVisibility`, `getConnectionReasonsBulk`, `getTrustProfilesBulk` |
| `getIntroductionSuggestions` | `services/introduction-suggestions.ts` | both `storyTag.findMany`, `getSharedIntroducerCountsBulk`, pair assembly |
| `getConversationList` | `services/messages.ts` | raw SQL window, `user.findMany`, `message.groupBy`, `getTrustProfilesBulk` |
| `getConversation` | `services/messages.ts` | `message.findMany` + include hydration |

**Note:** There is no `getDiscoveries()` export; the feed entry point is **`getDiscoveriesFeed`**.

### B. Shared helper (suggested shape)

```ts
// lib/timing.ts (future)
export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T>
```

Log `{ label, ms, userId?, route? }` when `ms > 200` or `PERF_LOG=1`.

### C. Prisma middleware (optional second phase)

Extend `lib/prisma.ts` with `$extends` query logging:

- Log `model`, `action`, `durationMs`
- Aggregate per-request totals via `AsyncLocalStorage`
- **Do not** log full SQL in production (PII)

### D. API route correlation

Pass `x-request-id` from Next.js middleware; attach to all service logs for `/api/trust/recommendations`, `/api/discoveries`, `/api/messages`.

---

## 4. Ranked table — 20 slowest service methods

Combined ranking from: live dev TTFB/API times, 2026-06-20 query benchmark, static query-count analysis. Times are **observed or estimated end-to-end** under current infra stress.

| Rank | Service method | File | Est. latency | Primary bottleneck |
|------|----------------|------|--------------|-------------------|
| 1 | `getIntroductionSuggestions` | `services/introduction-suggestions.ts` | **60s–200s+** (timeout) / ~2–8s healthy | 2× `storyTag.findMany` + bulk counts; blocked home SSR on P1001 |
| 2 | `getVisibleStories` | `services/stories.ts` | **30s+** (N+1) | Per-story `storyPassesVisibilityGate` (1–2 queries each) |
| 3 | `getStoryBarForViewer` | `services/stories.ts` | **30s+** | Calls `getVisibleStories` |
| 4 | `loadIntroductionEdges` | `lib/introduction-graph.ts` | **30s+** | Full published `storyTag` scan; request-scoped `cache()` only |
| 5 | `buildGraphIndex` | `lib/introduction-graph.ts` | **30s+** | Depends on `loadIntroductionEdges` |
| 6 | `getNetworkUsers` (BFS fallback) | `lib/introduction-graph.ts` | **10–30s** | Used when `user_connections` not materialized |
| 7 | `getDiscoveriesFeed` | `services/discoveries.ts` | **12–15s** (live page) | Network author resolution + category N+1 + graph enrichment |
| 8 | `getDiscoveriesNetworkAuthorIds` | `lib/discoveries-network.ts` | **5–15s** | BFS fallback via `getNetworkUsers` |
| 9 | `getTrustRecommendations` | `services/trust-recommendations.ts` | **7.2s** (live API) | `userConnection` + optional `getSharedIntroducersForPair`; no server cache |
| 10 | `getTrustNetworkStats` | `services/trust-network.ts` | **3–10s** | N+1 `getMutualIntroducers` when connections not materialized |
| 11 | `getMutualTagFeed` | `services/feed.ts` | **2–8s** | 4 sequential Prisma round-trips |
| 12 | `getConversationList` | `services/messages.ts` | **2–6s** | Window over all user messages + `getTrustProfilesBulk` |
| 13 | `getTrustProfilesBulk` | `services/trust-profile.ts` | **1–5s** | Large `sharedIntroducerRelationship` OR query (up to 500 rows) |
| 14 | `getConnectionReasonsBulk` (slow path) | `lib/introduction-graph.ts` | **1–5s** | Per-missing-user `getConnectionReason` |
| 15 | `filterByCategoryVisibility` | `lib/category-visibility.ts` | **1–4s** | Per-post `viewerSharesCategoryWithAuthor` (2 counts each) |
| 16 | `getChatContextPayload` | `services/chat-context.ts` | **1–4s** | `getConversationGraphContext` + `getTrustProfile` chain |
| 17 | `getConversationGraphContext` | `lib/introduction-graph.ts` | **1–3s** | Graph paths + mutual introducers |
| 18 | `getProfileTrustNetwork` | `services/trust-network.ts` | **1–3s** | `getTrustNetworkStats` + `getMutualIntroducers` |
| 19 | `analyticsService.queryMetrics` | `services/analytics/analytics-service.ts` | **1–3s** | ~30 parallel aggregations (admin-only) |
| 20 | `getIntroductionsForViewer` | `services/introductions.ts` | **1–2s** | Over-fetch then filter groups in memory |

---

## 5. Remaining N+1 query patterns

| # | Location | Pattern | Queries per request (worst case) | Status |
|---|----------|---------|----------------------------------|--------|
| 1 | `services/stories.ts` → `getVisibleStories` | `for (story) await storyPassesVisibilityGate(...)` | **O(stories × 1–2)** | **Open** |
| 2 | `lib/story-visibility.ts` → `storyPassesVisibilityGate` | `storyTag.findFirst` / `message.findFirst` per call | 1–2 each | **Open** |
| 3 | `lib/category-visibility.ts` → `filterByCategoryVisibility` | `for (item) await viewerSharesCategoryWithAuthor(...)` | **O(posts × 2)** | **Open** |
| 4 | `lib/category-visibility.ts` → `viewerSharesCategoryWithAuthor` | `story.count` + `sharedIntroducerRelationship.count` | 2 per pair | **Open** |
| 5 | `lib/introduction-graph.ts` → `getConnectionReasonsBulk` slow path | `Promise.all(slowPath.map(getConnectionReason))` | **O(missing connections)** | **Partially mitigated** (fast path via `user_connections`) |
| 6 | `services/trust-network.ts` → `getTrustNetworkStats` fallback | `for (t) await getMutualIntroducers(...)` | **O(introduced users)** | **Partially mitigated** when materialized |
| 7 | `services/discoveries.ts` → `trackRecentlyExpiredDiscoveries` | `for (post) await analyticsEvent.findFirst` | **O(expired posts)** | **Removed from GET path**; still N+1 if invoked elsewhere |
| 8 | `services/trust-recommendations.ts` | Sequential `getSharedIntroducersForPair` after connections query | +1 heavy query | **Open** (not N+1, but serial) |
| 9 | `lib/introduction-graph.ts` → `getMutualIntroducerCount` / evidence helpers | Single-pair graph walks | 1 per call | **Open** on profile/API single-user paths |

### Previously fixed (not in backlog)

- `getIntroductionSuggestions` — was O(n²) `getSharedIntroducerCount`; now **`getSharedIntroducerCountsBulk`**
- Chat duplicate fetch — **`useRealtimeMessages` bootstrap skip**
- Client trust recommendations — **module-level promise dedupe** (same tab only)

---

## 6. Supabase Prisma connection pooling assessment

| Check | Expected | Actual | Verdict |
|-------|----------|--------|---------|
| Runtime uses pooler URL | Port 6543 + `pgbouncer=true` | Yes | **Pass** |
| Migrations use direct URL | Port 5432, `directUrl` in schema | Yes | **Pass** |
| `connection_limit=1` in serverless | Documented in `.env.example` | **Missing in live env** | **Fail — fix env** |
| Prisma singleton | One client per Node process | `lib/prisma.ts` global in dev | **Pass** |
| Transaction mode | Prisma + Supabase pooler = transaction mode | Implicit | **Pass** (avoid interactive transactions spanning requests) |
| Prepared statements | Can break with PgBouncer | Prisma handles via pgbouncer flag | **Pass** if URL correct |
| Pooler reachability | Stable sub-200ms `SELECT 1` | **6s+ / P1001** in audit | **Fail — infra** |

**Recommendations:**

1. Set `DATABASE_URL` exactly as Supabase **Transaction pooler** string with `?pgbouncer=true&connection_limit=1`.
2. Keep `DIRECT_URL` on port **5432** for migrations only; never point runtime at 5432 on serverless.
3. On Vercel, use **Supabase connection pooler** (not direct) for all `PrismaClient` traffic.
4. Add health check that fails fast when pooler is unreachable (avoid 200s SSR hangs).
5. Consider **Prisma Accelerate** or **PgBouncer on Supavisor** only if pool exhaustion persists after `connection_limit=1`.

---

## 7. Trust recommendations caching

### Current state

| Layer | Cached? | Mechanism |
|-------|---------|-----------|
| Server (`getTrustRecommendations`) | **No** | Fresh DB every API call |
| API route (`app/api/trust/recommendations/route.ts`) | **No** | No `Cache-Control`, no Redis |
| Client (`TrustRecommendationsPanel.tsx`) | **Partial** | Module-level `fetch` promise — dedupes within one JS context only |

`getTrustRecommendations` work per request:

1. `getAdminSettings()` (cached per request via `React.cache()` on SSR only)
2. `userConnection.findMany` (12 rows)
3. Optional `getSharedIntroducersForPair` (1 heavy join query)

Called from **4+ pages** via client fetch → repeated server work across navigations and users.

### Recommended: Upstash Redis cache

```
Key:    trust:recs:{userId}
TTL:    300–900 seconds (5–15 min)
Value:  JSON TrustRecommendation[]
```

**Invalidation triggers:**

- `user_connections` rebuild for user
- New published story tagging user
- Admin toggles `enableTrustRecommendations`

**Implementation sketch (future):**

```ts
// lib/cache/trust-recommendations.ts
import { Redis } from "@upstash/redis";
const redis = Redis.fromEnv();

export async function getCachedTrustRecommendations(userId: string) {
  const key = `trust:recs:${userId}`;
  const hit = await redis.get<TrustRecommendation[]>(key);
  if (hit) return hit;
  const fresh = await computeTrustRecommendations(userId);
  await redis.set(key, fresh, { ex: 600 });
  return fresh;
}
```

**Env vars:** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

**Fallback:** If Redis miss/error, compute directly (current behavior).

**Estimated improvement:** 7s → **<50ms** on cache hit; reduces pooler load for high-traffic panel.

---

## 8. Remediation backlog

Each item: **issue → root cause → estimated improvement → complexity**

### Critical

#### C1 — Supabase pooler unreachable / high connect latency

| | |
|---|---|
| **Issue** | P1001 errors; `SELECT 1` at 6s; `/home` SSR 200s+ |
| **Root cause** | Pooler network timeout, missing `connection_limit`, possible VPN/firewall or Supabase incident |
| **Estimated improvement** | Unblocks all routes; 10–100× faster when fixed |
| **Complexity** | **Low** (ops/env) — verify URL, add `connection_limit=1`, test `verify-database` |

#### C2 — Full-table `storyTag` scans for introduction graph

| | |
|---|---|
| **Issue** | `loadIntroductionEdges` loads all published tags every cold request |
| **Root cause** | Graph built from live tags instead of `user_connections` / materialized edges |
| **Estimated improvement** | 30s → **<500ms** when materialized path used |
| **Complexity** | **High** — ensure `user_connections` always populated; cron rebuild; remove BFS fallback in hot paths |

#### C3 — N+1 story visibility gate

| | |
|---|---|
| **Issue** | `getVisibleStories` awaits visibility per story |
| **Root cause** | `storyPassesVisibilityGate` issues per-story Prisma lookups |
| **Estimated improvement** | 30s → **<1s** for 50 stories |
| **Complexity** | **Medium** — batch prefetch tags/messages; single SQL visibility filter |

### High

#### H1 — Discoveries category visibility N+1

| | |
|---|---|
| **Issue** | `filterByCategoryVisibility` loops posts with 2 counts each |
| **Root cause** | No bulk category overlap query |
| **Estimated improvement** | 4s → **<300ms** on 20-post page |
| **Complexity** | **Medium** — one query for viewer category edges + in-memory filter |

#### H2 — Trust recommendations uncached on server

| | |
|---|---|
| **Issue** | 7s API; repeated across pages |
| **Root cause** | No Redis; client dedupe only |
| **Estimated improvement** | 7s → **<50ms** hit / ~1s miss |
| **Complexity** | **Low–Medium** — Upstash + invalidation hooks |

#### H3 — `getConversationList` scans all messages

| | |
|---|---|
| **Issue** | Raw SQL window over full message history per user |
| **Root cause** | No `conversation_summaries` table or partial index |
| **Estimated improvement** | 6s → **<200ms** |
| **Complexity** | **Medium–High** — materialized last-message table or indexed denormalization |

#### H4 — `getConnectionReasonsBulk` slow path

| | |
|---|---|
| **Issue** | Falls back to per-user `getConnectionReason` |
| **Root cause** | Missing `user_connections` rows for some pairs |
| **Estimated improvement** | 5s → **<100ms** when fully materialized |
| **Complexity** | **Medium** — backfill connections; drop slow path in feed |

#### H5 — `getTrustNetworkStats` mutual count fallback

| | |
|---|---|
| **Issue** | N+1 `getMutualIntroducers` when not materialized |
| **Root cause** | Same as H4 — graph fallback |
| **Estimated improvement** | 10s → **<500ms** |
| **Complexity** | **Medium** — rely on `sharedIntroducerCount` column only |

### Medium

#### M1 — `getMutualTagFeed` sequential queries

| | |
|---|---|
| **Issue** | 4 round-trips before parallel posts/stories |
| **Root cause** | Feed algorithm not expressed as single SQL/CTE |
| **Estimated improvement** | 8s → **<1s** |
| **Complexity** | **Medium** |

#### M2 — `getTrustProfilesBulk` heavy OR query

| | |
|---|---|
| **Issue** | Up to 500 shared introducer rows with includes |
| **Root cause** | Enriching every conversation/feed author with full introducer detail |
| **Estimated improvement** | 5s → **<800ms** with slimmer select + pagination |
| **Complexity** | **Low–Medium** |

#### M3 — Introductions over-fetch + in-memory group filter

| | |
|---|---|
| **Issue** | Fetches all stories then filters `group` in JS |
| **Root cause** | Group derived from dates, not indexed |
| **Estimated improvement** | 2s → **<500ms** |
| **Complexity** | **Medium** |

#### M4 — No Prisma query timing in production

| | |
|---|---|
| **Issue** | Cannot identify >200ms queries in prod |
| **Root cause** | No middleware / structured logging |
| **Estimated improvement** | Operational visibility (enables targeted fixes) |
| **Complexity** | **Low** — see §3 |

#### M5 — `/api/media` redirect chain

| | |
|---|---|
| **Issue** | 1.8–5.8s per asset |
| **Root cause** | Storage signed URL + access checks per request |
| **Estimated improvement** | 5s → **<200ms** with longer-lived signed URLs + CDN |
| **Complexity** | **Medium** |

### Quick wins

| # | Issue | Root cause | Est. improvement | Complexity |
|---|-------|------------|------------------|------------|
| Q1 | Missing `connection_limit=1` | Env drift from `.env.example` | Prevents pool exhaustion | **Low** |
| Q2 | Trust recs fetched on every page mount | Client component on 4 routes | 4× → 1× server calls with SSR pass-through | **Low** |
| Q3 | `getAdminSettings` on every subgraph | Needed but repeated in same request | Already `React.cache()` — extend to trust/discoveries subcalls logging | **Low** |
| Q4 | Index on `messages(sender_id, receiver_id, created_at)` | Window query sort | 1.5s → **<100ms** | **Low** (migration) |
| Q5 | Index on `story_tags(story_id)` + `stories(status)` | Slow tag joins | 30s scan → **<1s** at moderate scale | **Low** (migration) |

---

## 9. Suggested implementation order

1. **Fix pooler / env** (C1, Q1) — required before meaningful benchmarks  
2. **Add timing instrumentation** (§3, M4) — validate fixes  
3. **Materialize graph / connections** (C2, H4, H5) — largest app-level win  
4. **Batch visibility & category filters** (C3, H1)  
5. **Redis trust recommendations** (H2)  
6. **Conversation list denormalization** (H3)  
7. **Indexes + feed SQL** (Q4, Q5, M1)  
8. **Media/CDN** (M5)  

---

## 10. Verification checklist (post-remediation)

- [ ] `npm run verify-database` passes in <2s  
- [ ] No Prisma query logged >200ms on `/home`, `/discoveries`, `/messages` happy path  
- [ ] `getTrustRecommendations` p95 <500ms (miss) / <50ms (hit)  
- [ ] `getDiscoveriesFeed` p95 <800ms  
- [ ] `getConversationList` p95 <300ms  
- [ ] Zero N+1 patterns in §5 marked **Open**  
- [ ] Load test: 50 concurrent users, pooler connections stable  

---

## Appendix — files referenced

| Area | Path |
|------|------|
| Prisma client | `lib/prisma.ts` |
| Schema | `prisma/schema.prisma` |
| Trust recommendations | `services/trust-recommendations.ts`, `app/api/trust/recommendations/route.ts` |
| Discoveries feed | `services/discoveries.ts` |
| Messages | `services/messages.ts` |
| Introduction suggestions | `services/introduction-suggestions.ts` |
| Graph / N+1 | `lib/introduction-graph.ts`, `lib/category-visibility.ts`, `lib/story-visibility.ts` |
| Client cache (partial) | `components/trust/TrustRecommendationsPanel.tsx` |
| Prior audit | `docs/PERFORMANCE_AUDIT.md` |
