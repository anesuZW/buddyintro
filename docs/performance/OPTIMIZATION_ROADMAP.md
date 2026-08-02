# BuddyIntro Optimization Roadmap

**Sprint:** Performance Optimization Planning (READ-ONLY)  
**Generated:** 2026-07-26  
**Inputs:** All Database Performance Profiling Sprint reports (`docs/performance/*.md`)  
**Constraint:** No behaviour, UI, business-logic, or feature changes in implementation sprints

---

## Executive Summary

BuddyIntro page latency is dominated by **Supabase pooler round-trip time (RTT)** multiplied by **Prisma query count per request**. SQL execution cost is negligible at current scale (0.05–0.18ms per query on EXPLAIN ANALYZE). Optimizing without changing behaviour requires two parallel tracks:

1. **Infrastructure** — Reduce pooler RTT from ~455ms avg to ~40ms (regional co-location, connection config, selective direct connections).
2. **Application** — Reduce Prisma round-trips from 14–18/query on `/home` to ~8–10 via consolidation, request-scoped caching, and deferred non-critical work.

**Combined estimated outcome:** 70–85% reduction in server-side page time on hot paths; 60–75% reduction in Supabase query billing units.

---

## Evidence Base (Profiling Sprint)

| Source | Key finding |
|--------|-------------|
| [DATABASE_PERFORMANCE_PROFILE.md](./DATABASE_PERFORMANCE_PROFILE.md) | SELECT 1 p95 **603ms**; home est. **18 queries × 455ms ≈ 8.2s DB time** |
| [EXECUTION_PLAN_SUMMARY.md](./EXECUTION_PLAN_SUMMARY.md) | SQL execution **<1ms** — slowness is RTT not planner |
| [DATABASE_QUERY_TRACE.md](./DATABASE_QUERY_TRACE.md) | Full page → service → Prisma trees |
| [N_PLUS_ONE_REPORT.md](./N_PLUS_ONE_REPORT.md) | Architectural duplication > loop N+1 |
| [DUPLICATE_QUERY_MATRIX.md](./DUPLICATE_QUERY_MATRIX.md) | React cache() already dedupes auth/settings/badges |
| [PAGE_BY_PAGE_QUERY_BREAKDOWN.md](./PAGE_BY_PAGE_QUERY_BREAKDOWN.md) | Wall-clock + query estimates per page |
| [CONNECTION_AUDIT.md](./CONNECTION_AUDIT.md) | DIRECT_URL = pooler; 10× parallel SELECT 1 p95 **2733ms** |
| [INDEX_AUDIT.md](./INDEX_AUDIT.md) | Indexes adequate at dev scale; seq scans acceptable now |
| [PRISMA_QUERY_HEATMAP.md](./PRISMA_QUERY_HEATMAP.md) | StoryTag, DiscoveriesPost highest heat |

---

## Document Map

| Document | Phases covered |
|----------|----------------|
| [QUERY_REDUCTION_PLAN.md](./QUERY_REDUCTION_PLAN.md) | Phase 3 — exact eliminable queries per model |
| [CACHE_STRATEGY.md](./CACHE_STRATEGY.md) | Phase 4 — React cache / unstable_cache recommendations |
| [SUPABASE_OPTIMIZATION.md](./SUPABASE_OPTIMIZATION.md) | Phase 6 — pooler vs direct, latency attribution |
| [PAGE_OPTIMIZATION_ESTIMATES.md](./PAGE_OPTIMIZATION_ESTIMATES.md) | Phases 1–2, 7 — request graphs + before/after per page |
| [ENGINEERING_PRIORITY_MATRIX.md](./ENGINEERING_PRIORITY_MATRIX.md) | Phase 8 — P0–P3 × effort × impact |
| [IMPLEMENTATION_SPRINTS.md](./IMPLEMENTATION_SPRINTS.md) | Phase 9 — sprint order with rationale |
| [PERFORMANCE_TARGETS.md](./PERFORMANCE_TARGETS.md) | Phase 10 — fleet-wide targets |

---

## Phase 1 — Request Pipeline (Summary)

Every authenticated page follows:

```
HTTP Request
  ↓
Middleware (updateSession → Supabase JWT refresh, no Prisma)
  ↓
intlMiddleware (locale routing)
  ↓
app/[locale]/(main)/layout.tsx
  ↓ requireUser → getCurrentUser [cache] → getAuthUser (Supabase) + User.findUnique
  ↓ Suspense: TopBarWithBadges → getLayoutBadges [cache] → Story.count + Message.count + Notification.count
  ↓ Suspense: BottomNavWithBadge → getLayoutBadges [cache hit]
  ↓
Page Server Component (runWithPerf)
  ↓ Service layer
  ↓ Prisma extension (trackPrismaQuery)
  ↓ Supabase pooler → PostgreSQL
```

Full per-page graphs with branch detail: [PAGE_OPTIMIZATION_ESTIMATES.md](./PAGE_OPTIMIZATION_ESTIMATES.md).

---

## Phase 2 — Query Accounting Summary

| Page | Prisma queries (current) | Cached (effective) | Duplicated (eliminable) | Uncached |
|------|--------------------------|--------------------|-------------------------|----------|
| `/` | 0 | 0 | 0 | 0 |
| `/home` | 18 | 5 (auth, settings, badges, homeStoryCtx) | 6 | 7 |
| `/discoveries` | 12 | 4 | 2 | 6 |
| `/profile` | 10 | 3 | 1 | 6 |
| `/introductions` | 8 SSR + ~4 API | 3 | 1 | 4+ |
| `/messages` | 4 layout + ~5 API | 3 | 1 | 5 |
| `/create-story` | 4 layout + ~3 API | 3 | 0 | 1+ |
| Story viewer | 10 | 3 | 2 | 5 |

---

## Phase 3 — Total Eliminable Queries (Fleet)

| Model / area | Current max/request | Target | Savings/request |
|--------------|---------------------|--------|-----------------|
| StoryTag.findMany | 6 (/home) | 1–2 | **4–5** |
| Story.findMany | 5 (/home) | 2–3 | **2–3** |
| UserConnection.findMany | 3 | 1–2 | **1–2** |
| AdminSettings.findUnique | 1 (cached) | 1 | 0 |
| User.findUnique | 1 (cached) | 1 | 0 |
| Notification.count | 1 | 1 | 0 |
| Message.count + inbox | 2 | 1 | **1** |
| AnalyticsEvent.create | 0–2 blocking | 0 blocking | **0–2** (defer) |
| Discoveries pipeline | 8 | 5–6 | **2–3** |
| SharedIntroducerRelationship | 1 bulk | 1 bulk | 0 (optimize shape) |

**Fleet-wide:** ~12–18 eliminable round-trips on worst page (`/home`); ~6–10 on `/discoveries`.

Detail: [QUERY_REDUCTION_PLAN.md](./QUERY_REDUCTION_PLAN.md).

---

## Phase 4 — Caching (Summary)

Already implemented: `getAdminSettings`, `getCurrentUser`, `getLayoutBadges`, `getHomeStoryContext`, `listIntroductionCategoriesCached`, in-memory trust recommendations.

Recommended next: `getDiscoveriesNetworkAuthorIds`, `listBlockedUserIds`, `NotificationPreferences`, `unstable_cache` for trust enrichment.

Detail: [CACHE_STRATEGY.md](./CACHE_STRATEGY.md) — each tagged SAFE / MEDIUM / RISKY.

---

## Phase 5 — Prisma Opportunities (Summary)

| Pattern | Location | Current cost | Future cost | Query Δ |
|---------|----------|--------------|-------------|---------|
| 4× StoryTag.findMany | `home-dashboard.ts` | 4 × 455ms | 1 × 455ms | **−3** |
| 2× Story.findMany stats | `trust-network.ts` | 2 × 455ms | 1 × 455ms | **−1** |
| getVisibleStories include | `stories.ts` | 1 heavy findMany | same rows, lighter select | 0 RTT, −serialize |
| filterStoriesByVisibilityGate | per-story checks | 0–N | batched | **−0 to −N** |
| getConversationList | `messages.ts` | 4 queries (raw SQL ✓) | 3 with shared badge data | **−1** |
| getTrustProfilesBulk OR array | `trust-profile.ts` | 1 bulk | 1 JOIN-based | 0 RTT at scale |
| analyticsService.track sync | story viewer | 1–2 × 455ms | 0 blocking | **−1 to −2** |

---

## Phase 6 — Supabase (Summary)

| Component | Share of perceived latency |
|-----------|----------------------------|
| Pooler RTT | **~95%** of Prisma-reported time |
| PostgreSQL execution | **<1%** |
| Supabase Auth (getUser) | **~5–15%** of page (450–2300ms observed) |
| Prisma ORM overhead | **<2%** |
| Network (app ↔ pooler) | Included in pooler RTT |

At **40ms pooler RTT**, `/home` DB time drops from **~8.2s → ~720ms** (18 queries) or **~400ms** (10 queries).

Detail: [SUPABASE_OPTIMIZATION.md](./SUPABASE_OPTIMIZATION.md).

---

## Phase 7 — Page Targets (Summary)

| Page | Current (warm DB est.) | Target | Reduction |
|------|------------------------|--------|-----------|
| `/home` | ~8.6s | ~2.3s | **73%** |
| `/discoveries` | ~5.5s | ~1.8s | **67%** |
| `/profile` | ~4.6s | ~1.5s | **67%** |
| `/introductions` | ~3.6s | ~1.2s | **67%** |
| `/messages` | ~3.6s | ~1.0s | **72%** |
| `/create-story` | ~1.8s | ~0.6s | **67%** |
| Story viewer | ~4.5s | ~1.2s | **73%** |

Assumes pooler RTT **455ms → 40ms** plus query reductions in [QUERY_REDUCTION_PLAN.md](./QUERY_REDUCTION_PLAN.md).

Detail: [PAGE_OPTIMIZATION_ESTIMATES.md](./PAGE_OPTIMIZATION_ESTIMATES.md).

---

## Phase 8 — Priority Matrix (Summary)

| Priority | Items | Impact |
|----------|-------|--------|
| **P0** | Fix pooler RTT / DIRECT_URL separation | Very High |
| **P0** | Consolidate home StoryTag queries | Very High |
| **P1** | Defer AnalyticsEvent.create on SSR | High |
| **P1** | Cache discoveries network + blocks | High |
| **P1** | Consolidate home Story.findMany | High |
| **P2** | Auth header trust path (skip fallback getUser) | Medium |
| **P2** | Profile insights async load | Medium |
| **P3** | Index additions at scale | Low (now) |

Detail: [ENGINEERING_PRIORITY_MATRIX.md](./ENGINEERING_PRIORITY_MATRIX.md).

---

## Phase 9 — Implementation Order

| Sprint | Focus | Why first |
|--------|-------|-----------|
| **Sprint 1** | Supabase connection config + measurement harness | Unblocks all before/after metrics |
| **Sprint 2** | Home query consolidation | Highest query count page |
| **Sprint 3** | Discoveries + trust enrichment caching | Second hottest page |
| **Sprint 4** | Analytics deferral + messages/badge unification | Removes blocking + scale risk |

Detail: [IMPLEMENTATION_SPRINTS.md](./IMPLEMENTATION_SPRINTS.md).

---

## Phase 10 — Fleet Targets (Summary)

| Metric | Current | Target | Δ |
|--------|---------|--------|---|
| Avg queries/page (auth) | 12 | 7 | **−42%** |
| Avg pooler RTT | 455ms | 40ms | **−91%** |
| Avg page DB time | 5.5s | 0.8s | **−85%** |
| Avg warm page time | 6.5s | 1.8s | **−72%** |

Detail: [PERFORMANCE_TARGETS.md](./PERFORMANCE_TARGETS.md).

---

## Measurement Protocol (Next Sprint)

Every optimization PR must include:

1. `PROFILE_PRODUCTION=1` before/after on production build
2. Query count from `x-bench-*` headers or `[PROFILE]` logs
3. `npm run check-db-latency` pooler baseline
4. No change to API response shapes or UI output (snapshot diff)

---

## Out of Scope (This Planning Sprint)

- No code changes
- No index creation
- No caching implementation
- No Prisma query edits
- No UI/UX changes
