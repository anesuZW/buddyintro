# Sprint 5A Engineering Summary

**Generated:** 2026-07-27  
**Type:** Discovery sprint — no application code modified

---

## Current bottlenecks (ranked)

| Rank | Bottleneck | Est. impact | Removable? |
| --- | --- | --- | --- |
| 1 | Pooler RTT × ~15 queries | Dominant | Infra / connection |
| 2 | Visible story pool (Q3) row payload | 624–4,600 ms | Partially — pagination risky |
| 3 | Mutual author distinct (Q4) | Up to 4,898 ms | No — distinct predicate |
| 4 | Trust recent parallel pair (Q1+Q2) | ~700 ms each | Optional merge (5B) |
| 5 | UserConnection / graph (Sprint 4 done) | Reduced | Done |

---

## Queries removed (historical)

| Sprint | Story.findMany Δ | Total Δ |
| --- | --- | --- |
| Sprint 3 | StoryTag −8 | −8 |
| Sprint 4 | Story −1, UC −1 | −2 |
| Sprint 5A | 0 | 0 |

---

## Queries that should remain

| Query | Justification |
| --- | --- |
| Q1 Trust sent | Independent take:5 authored |
| Q2 Trust received | Independent take:5 tag predicate |
| Q3 Visible pool | Story bar + feed projection source |
| Q4 Mutual authors | Tag-overlap author discovery outside visibility |

---

## Architectural risks (if ignoring Option B)

| Risk | Severity |
| --- | --- |
| Behaviour drift from merged take:5 semantics | High |
| Memory spike from mega-loader | Medium |
| Visibility gate applied to wrong consumer | High |
| Q4 elimination breaks feed author expansion | High |
| Maintenance cost of projection layer | Medium |

---

## Expected future gains

| Initiative | Est. query Δ | Est. latency Δ | Confidence |
| --- | --- | --- | --- |
| Sprint 5B trust merge | −1 Story | 0–600 ms | Low |
| Pooler / infra | — | High | Medium (out of app scope) |
| Visible pool pagination | 0 | Variable | Low — UX impact |
| Full unified loader | −3 Story | Unknown | **Not recommended** |

---

## Recommended Sprint 5B scope

**Narrow trust-recent loader merge OR skip Story consolidation entirely.**

Priority alternatives if Story consolidation stopped:

1. Production profiling gate (TTFB p95 budget)
2. Discoveries SharedIntroducer batch tuning
3. Infrastructure pooler/session mode investigation

---

## Deliverables

All docs under `docs/performance/sprint-5a/`

---

## Checkpoint

`checkpoint/sprint-5a-start` @ `87edda0`
