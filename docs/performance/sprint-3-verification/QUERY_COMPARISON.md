# Query Comparison — Sprint 2 Baseline vs Sprint 3

**Generated:** 2026-07-26T18:05:00.000Z  
**Baseline:** `docs/performance/sprint-3/artifacts/baseline-static.json` (STATIC ANALYSIS)  
**Runtime:** Request `2afc354d` ACTUAL_PRISMA_TRACE.md (RUNTIME VERIFIED counts)  
**Timing:** Historical EXPLAIN + pooler latency from `docs/performance/.profile-data.json` (HISTORICAL DATA)

---

## StoryTag.findMany

| Metric | Before | After | Evidence |
| --- | --- | --- | --- |
| Query count | 10 | **2** | Runtime trace |
| Removed | — | **8** | Static + runtime |
| % reduction | — | **80%** | — |
| Total exec time (before) | ~10 × 564ms ≈ 5,640ms | — | HISTORICAL (pooler-dominated) |
| Total exec time (after) | — | 612 + 4,600 = **5,212ms** | RUNTIME VERIFIED |
| Avg execution time | ~564ms (p95 est.) | **2,606ms** | Runtime (2 queries) |
| Worst execution time | ~658ms (historical p95) | **4,600ms** | Runtime (full scan B) |
| Remaining duplicates | 4-way fan-out in context + downstream | **0 duplicates** | Runtime |

**Note:** Fewer queries but Scan B fetches all tagged rows (no `take:20`), increasing single-query latency — expected tradeoff.

---

## Story.findMany

| Metric | Before | After |
| --- | --- | --- |
| Query count | 5 | **5** |
| Removed | 0 | 0 |
| % reduction | 0% | — |
| Total exec time (before) | ~5 × 592ms ≈ 2,960ms | HISTORICAL |
| Total exec time (after) | 682+687+624+1310+4898 = **8,201ms** | RUNTIME |
| Avg execution time | ~592ms | **1,640ms** | Runtime |
| Worst execution time | — | **4,898ms** | Runtime |
| Remaining duplicates | 5 distinct purposes | Same — Sprint 4 scope |

---

## Story.count

| Metric | Before | After |
| --- | --- | --- |
| Query count | 1 | **1** |
| Removed | 0 | 0 |
| % reduction | 0% | — |
| Total exec time (before) | ~610ms | HISTORICAL |
| Total exec time (after) | **2,755ms** | RUNTIME |
| Avg / worst | ~610ms / ~610ms | 2,755ms | RUNTIME |
| Duplicates | None (layout badges) | None |

---

## StoryTag.count

| Metric | Before | After |
| --- | --- | --- |
| Query count | 2 | **0** |
| Removed | **2** | — |
| % reduction | **100%** | — |
| Exec time before | ~2 × 500ms | HISTORICAL |
| Exec time after | **0** | RUNTIME |
| Duplicates | trust stats path | Eliminated |

---

## UserConnection.findMany

| Metric | Before | After |
| --- | --- | --- |
| Query count | 1 (+ trust stats mutual) | **2** |
| Removed | 0 | 0 |
| % reduction | 0% | — |
| Total exec time (after) | 677 + 3,651 = **4,328ms** | RUNTIME |
| Worst | **3,651ms** (recommendations) | RUNTIME |
| Duplicates | Distinct callers | Necessary (trust stats + recommendations) |

---

## SharedIntroducerRelationship.findMany / groupBy

| Metric | Before | After |
| --- | --- | --- |
| findMany count | 0 | 0 |
| groupBy count | 1 | **1** |
| Removed | 0 | 0 |
| Exec time (groupBy) | ~693ms | RUNTIME |
| Duplicates | None | None |

---

## Post.findMany

| Metric | Before | After |
| --- | --- | --- |
| Query count | 1 | **1** |
| Removed | 0 | 0 |
| Exec time | **624ms** | RUNTIME |
| Duplicates | None | None |

---

## Notification.count

| Metric | Before | After |
| --- | --- | --- |
| Query count | 1 | **1** |
| Removed | 0 | 0 |
| Exec time (before) | ~643ms | HISTORICAL |
| Exec time (after) | **604ms** | RUNTIME |
| Duplicates | None (Sprint 2 cached) | None |

---

## Message.count

| Metric | Before | After |
| --- | --- | --- |
| Query count | 1 | **1** |
| Removed | 0 | 0 |
| Exec time (before) | ~716ms | HISTORICAL |
| Exec time (after) | **596ms** | RUNTIME |
| Duplicates | None | None |

---

## Total Prisma operations (/home)

| Metric | Before | After | Reduction |
| --- | --- | --- | --- |
| Total count | 25 | **17** (static) / **~16–18** (runtime) | **32%** |
| StoryTag ops | 12 (10 findMany + 2 count) | **2** findMany | **83%** |

**Dominant latency:** Pooler RTT (~300–600ms per round trip) — established Sprint 1 fact.
