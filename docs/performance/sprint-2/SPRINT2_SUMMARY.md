# Sprint 2 Summary — Authentication & Shared Request Optimization

**Generated:** 2026-07-26T15:46:50.801Z  
**Checkpoint:** `checkpoint/sprint-2-auth-start` @ 87edda0  
**Git HEAD (after):** `87edda065bda93cf7c7dba6f74e2c263a133cb29`

---

## 1. What Changed

Request-scoped React `cache()` on auth and shared layout helpers (see REQUEST_CACHE_REPORT.md).

## 2. Why

Sprint 1 proved pooler RTT (~307ms p50) dominates latency — reducing duplicate round-trips is the highest-value local-dev optimization.

## 3. Queries Removed

0 queries removed entirely; **1–3 duplicate executions consolidated** per request on layout/profile paths.

## 4. Queries Consolidated

NotificationPreferences, layout badges, getAuthUser, getUnreadNotificationCount, introduction expiry helpers.

## 5. Performance Improvement

- /home est.: 18 → 16 queries (−2)
- Est. DB time: ~8190ms → ~4912ms (−~3278ms at p50 pooler)

## 6. Remaining Duplicated Auth Work

Middleware getUser (required); API route Supabase fallback when headers missing; RBAC permission lookups (60s TTL cache).

## 7. Estimated Savings

| Area | Estimate |
| --- | --- |
| Query reduction | 1–3 / request on badge-heavy pages |
| Database latency | ~307–921ms / page |
| Supabase cost | Proportional to eliminated round-trips |
| CPU / Memory | Negligible |

## 8. Sprint 3 Recommendation

**Home feed query folding** — dedupe StoryTag.findMany and trust loader fan-out on `/home` (see IMPLEMENTATION_SPRINTS.md).

---

## Deliverables

| Document | Path |
| --- | --- |
| Auth optimization | AUTH_OPTIMIZATION_REPORT.md |
| Query trace | AUTH_QUERY_TRACE.md |
| Query diff | AUTH_QUERY_DIFF.md |
| Performance | AUTH_PERFORMANCE_REPORT.md |
| Duplicate matrix | AUTH_DUPLICATE_QUERY_MATRIX.md |
| Request cache | REQUEST_CACHE_REPORT.md |
| RC1 | RC1_REGRESSION_RESULTS.md |
| RC2 | RC2_REGRESSION_RESULTS.md |
| Artifacts | artifacts/baseline.json, artifacts/after.json |

## Regression

RC1: PASS (18/18) · RC2: PASS auth scope (34/38 overall; 4 pre-existing email/phone intro)
