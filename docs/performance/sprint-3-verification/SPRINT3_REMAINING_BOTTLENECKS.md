# Sprint 3 Remaining Bottlenecks — GET /home

**Generated:** 2026-07-26T18:05:00.000Z  
**Evidence:** RUNTIME VERIFIED (request `2afc354d`) + established Sprint 1 facts

Ranked by estimated latency contribution. DO NOT FIX — documentation only.

---

## 1. Pooler RTT (dominant)

| Metric | Estimate |
| --- | --- |
| Latency contribution | ~300–3,100 ms **per query** |
| Query count multiplier | ~16–18 queries |
| Potential savings | Connection pooling tuning, edge DB, session mode — infra sprint |

**Evidence:** `check-db-latency` SELECT 1 p95=3,109ms; established Sprint 1 fact.

---

## 2. Story.findMany — mutual authors (feed)

| Metric | Estimate |
| --- | --- |
| Latency | **4,898 ms** (single query, runtime) |
| Query count | 1 of 5 Story.findMany |
| Potential savings | Unified loader + slimmer select — Sprint 4 |

---

## 3. StoryTag.findMany — scan B (full tagged history)

| Metric | Estimate |
| --- | --- |
| Latency | **4,600 ms** |
| Query count | 1 of 2 StoryTag |
| Potential savings | Indexed partial scan or materialized tag summary — future sprint |

---

## 4. UserConnection.findMany — trust recommendations

| Metric | Estimate |
| --- | --- |
| Latency | **3,651 ms** |
| Query count | 1 |
| Potential savings | Lighter include, lower `take`, or cache — Sprint 5 |

---

## 5. Story.count — layout badge

| Metric | Estimate |
| --- | --- |
| Latency | **2,755 ms** |
| Query count | 1 |
| Potential savings | Badge denormalization or cached count |

---

## 6. User.findUnique — auth Prisma segment

| Metric | Estimate |
| --- | --- |
| Latency | **6,639 ms** (worst of 2) |
| Query count | 2 |
| Potential savings | Single user lookup per request — pre-existing |

---

## 7. Parallel Story.findMany cluster

| Metric | Estimate |
| --- | --- |
| Latency | 682 + 687 + 624 + 1,310 = **3,303 ms** combined |
| Query count | 4 |
| Potential savings | Sprint 4 unified loader (−2 to −4 round trips) |

---

## 8. Suspense branch overlap

| Metric | Estimate |
| --- | --- |
| Latency | Overlap reduces wall time vs sum |
| Query count | 0 duplicate StoryTag (Sprint 3 fixed) |
| Potential savings | Already optimized via React `cache()` |

---

## 9. Visibility / recommendation pipelines

| Metric | Estimate |
| --- | --- |
| StoryTag visibility | **0 ms** — eliminated Sprint 3 |
| Suggestion groupBy | **693 ms** |
| Potential savings | Precomputed suggestion candidates |

---

## Summary

| Rank | Bottleneck | ~Latency | Queries |
| --- | --- | --- | --- |
| 1 | Pooler RTT | ×16–18 | All |
| 2 | Story.findMany mutual | 4,898 ms | 1 |
| 3 | StoryTag scan B | 4,600 ms | 1 |
| 4 | UserConnection recs | 3,651 ms | 1 |
| 5 | Story.count badge | 2,755 ms | 1 |

Sprint 3 removed **8 StoryTag round trips**; remaining wall time is dominated by **pooler RTT × remaining queries** and **five Story.findMany** paths.
