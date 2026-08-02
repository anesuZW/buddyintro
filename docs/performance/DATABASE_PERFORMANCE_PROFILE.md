# Database Performance Profile

**Sprint:** Database Performance Profiling (READ-ONLY)  
**Generated:** 2026-07-26T06:37:26.870Z  
**Branch:** performance-recovery-sprint  
**User:** `user1@friendintro.com`

---

## Executive Summary

BuddyIntro slow Prisma logs on localhost are **primarily driven by Supabase pooler round-trip latency**, not slow SQL execution plans. Measured `SELECT 1` p95 **603ms** (target <100ms). Individual ORM operations reporting 900–4300ms correlate with **~455ms baseline RTT × query count per request**, with secondary contribution from **multi-query page composition** (14–25 Prisma calls on `/home`).

**No optimizations were applied in this sprint.**

---

## Profiling Configuration Verified

| Setting | Status |
|---------|--------|
| Prisma query timing extension | ❌ Disabled |
| Slow query log (>200ms) | disabled unless NODE_ENV=development |
| Phase 2 profiler | Set PROFILE_PHASE2=1 |
| Auth profiler | Set AUTH_PROFILE=1 for caller trace |
| Request aggregation | `runWithPerf` + `trackPrismaQuery` in `lib/perf/context.ts` |

**Recommended dev measurement command:**

```bash
PROFILE_PRODUCTION=1 PROFILE_PHASE2=1 AUTH_PROFILE=1 npm run dev
```

---

## Infrastructure Baseline

| Metric | Value |
|--------|-------|
| DATABASE_URL | postgresql://postgres.***:***@aws-1-us-east-1.pooler.supabase.com:5432/postgres |
| DIRECT_URL | postgresql://postgres.***:***@aws-1-us-east-1.pooler.supabase.com:5432/postgres |
| SELECT 1 avg | 455ms |
| SELECT 1 p95 | 603ms |
| Pooler bottleneck | **YES** |

| Query | Avg (ms) | P95 (ms) | Max (ms) | Dominant factor |
| --- | --- | --- | --- | --- |
| SELECT 1 | 455 | 603 | 603 | Mostly pooler RTT |
| AdminSettings.findUnique | 455 | 615 | 615 | Mostly pooler RTT |
| User.findUnique | 469 | 625 | 625 | Mostly pooler RTT |
| Story.count | 459 | 610 | 610 | Mostly pooler RTT |
| Story.findMany (published, take 20) | 439 | 592 | 592 | Mostly pooler RTT |
| StoryTag.findMany (tagged user) | 485 | 658 | 658 | Mostly pooler RTT |
| DiscoveriesPost.findMany (network feed) | 510 | 713 | 713 | Mostly pooler RTT |
| SharedIntroducerRelationship.findMany | 447 | 614 | 614 | Mostly pooler RTT |
| Notification.count (unread) | 476 | 643 | 643 | Mostly pooler RTT |
| Message.count (unread inbox) | 499 | 716 | 716 | Mostly pooler RTT |
| AnalyticsEvent.count (24h) | 459 | 641 | 641 | Mostly pooler RTT |
| UserConnection.findMany (1st degree) | 528 | 649 | 649 | Mostly pooler RTT |

### Observed vs Measured

User-reported slow logs vs this session's isolated benchmarks:

| Query | Reported (ms) | Measured p95 (ms) | Explanation |
| --- | --- | --- | --- |
| Story.findMany | 3328 | 610 | Pooler RTT + occasional spike (p95 outlier on SELECT 1: 3074ms) |
| StoryTag.findMany | 4341 | 610 | Pooler RTT + occasional spike (p95 outlier on SELECT 1: 3074ms) |
| User.findUnique | 2567 | 625 | Pooler RTT + occasional spike (p95 outlier on SELECT 1: 3074ms) |
| DiscoveriesPost.findMany | 2450 | 713 | Pooler RTT + occasional spike (p95 outlier on SELECT 1: 3074ms) |
| SharedIntroducerRelationship.findMany | 2956 | 614 | Pooler RTT + occasional spike (p95 outlier on SELECT 1: 3074ms) |
| AdminSettings.findUnique | 2768 | 615 | Pooler RTT + occasional spike (p95 outlier on SELECT 1: 3074ms) |
| Notification.count | 1140 | 643 | Pooler RTT + occasional spike (p95 outlier on SELECT 1: 3074ms) |
| Message.count | 953 | 716 | Pooler RTT + occasional spike (p95 outlier on SELECT 1: 3074ms) |

---

## Root Cause Hierarchy

1. **Supabase pooler latency** — Each Prisma call pays full network RTT (~280–700ms typical, spikes to 3s+).
2. **Query multiplication** — Home page composes 14–25 sequential/parallel round-trips across layout + Suspense boundaries.
3. **Unbounded reads** — Messages inbox loads all messages (not N+1, but scales with history).
4. **SQL cost is low** — EXPLAIN ANALYZE shows index scans with <5ms execution time on direct connection.

---

## Phase Coverage

| Phase | Document |
|-------|----------|
| Page profiling | [PAGE_BY_PAGE_QUERY_BREAKDOWN.md](./PAGE_BY_PAGE_QUERY_BREAKDOWN.md) |
| Prisma trace | [DATABASE_QUERY_TRACE.md](./DATABASE_QUERY_TRACE.md) |
| N+1 detection | [N_PLUS_ONE_REPORT.md](./N_PLUS_ONE_REPORT.md) |
| Duplicate queries | [DUPLICATE_QUERY_MATRIX.md](./DUPLICATE_QUERY_MATRIX.md) |
| Cache audit (recommendations only) | Section in [PRIORITIZED_OPTIMIZATION_PLAN.md](./PRIORITIZED_OPTIMIZATION_PLAN.md) |
| SQL execution | [EXECUTION_PLAN_SUMMARY.md](./EXECUTION_PLAN_SUMMARY.md) |
| Index audit | [INDEX_AUDIT.md](./INDEX_AUDIT.md) |
| Connection pool | [CONNECTION_AUDIT.md](./CONNECTION_AUDIT.md) |
| Hotspot ranking | [TOP_50_SLOW_QUERIES.md](./TOP_50_SLOW_QUERIES.md) |
| Heatmap | [PRISMA_QUERY_HEATMAP.md](./PRISMA_QUERY_HEATMAP.md) |

---

## Estimated Optimization Potential (No Changes Made)

{
  "currentState": {
    "avgPoolerRttMs": 455,
    "estimatedQueriesHome": 18,
    "estimatedPrismaTimeHomeMs": 8190
  },
  "ifPoolerFixed": {
    "expectedAvgRttMs": 50,
    "estimatedPrismaTimeHomeMs": 900,
    "pageLatencyReductionPercent": 89
  },
  "ifQueryCountHalved": {
    "queriesPerHome": 9,
    "estimatedPrismaTimeHomeMs": 4095,
    "pageLatencyReductionPercent": 50
  },
  "ifBoth": {
    "queriesPerHome": 14,
    "expectedAvgRttMs": 50,
    "estimatedPrismaTimeHomeMs": 700,
    "pageLatencyReductionPercent": 91
  },
  "supabaseCost": "Pooler round-trips scale with query count × concurrent users — largest cost lever is query multiplication",
  "note": "Estimates only — no changes made in this sprint"
}

See [PRIORITIZED_OPTIMIZATION_PLAN.md](./PRIORITIZED_OPTIMIZATION_PLAN.md) for ranked future work.
