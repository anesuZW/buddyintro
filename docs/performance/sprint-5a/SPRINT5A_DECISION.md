# Sprint 5A Decision

**Generated:** 2026-07-27

---

## Conclusion: **OPTION B**

**Current architecture is already close to optimal for `/home`.**

Further query consolidation would increase complexity more than it improves measured performance, except for one **optional narrow scope** in Sprint 5B.

---

## Evidence summary

| Finding | Source |
| --- | --- |
| 4 Story.findMany serve distinct predicates | `COMPLETE_STORY_PIPELINE.md` |
| Only co-tag ⊂ visible pool overlap was mergeable | Sprint 4 implemented |
| Q4 mutual authors not derivable from visible pool | `STORY_OVERLAP_ANALYSIS.md` |
| Pooler RTT dominates; −1 query saves ~300–600 ms max | Sprint 1 + feasibility math |
| Q1∥Q2 already parallel — merge saves little wall time | Suspense architecture |
| Mega-loader increases row payload + CPU | Feasibility study |

---

## Measurements supporting Option B

| Metric | Value |
| --- | --- |
| Cumulative query reduction S1→S4 | 25 → ~15 (**40%**) |
| Story.findMany reduction S3→S4 | 5 → 4 |
| Remaining Story queries justified | 4/4 distinct pipelines |
| Unified 1-query loader latency win | **Uncertain / negative** for mega-fetch |
| Trust-only merge latency win | **~0–600 ms** best case |

---

## OPTION A conditions (NOT met)

A full Unified Story Loader would be worthwhile only if:

- [ ] Profiling shows Story.findMany is wall-time bottleneck after parallel Suspense (not pooler wait overlap)
- [ ] A single fetch with proven **lower total transfer time** than 4 targeted queries
- [ ] All consumers pass identical-output regression suite
- [ ] Memory footprint acceptable for p99 user story counts

**None demonstrated in Sprint 5A.**

---

## Recommended Sprint 5B scope (optional, narrow)

If proceeding:

1. **Implement trust recent unified loader only** (Q1+Q2 → 1 query)
2. **Do NOT** merge Q3 visible pool or Q4 mutual authors
3. Require live `/home` trace showing wall-time improvement
4. RC1 + RC2 pass before merge

If Sprint 5B trust merge shows **<200 ms TTFB improvement**, stop Story consolidation permanently.

---

## What should NOT be built

- Single mega `Story.findMany` for all home consumers
- Eliminating Q4 without behaviour proof
- Query-count optimization without latency measurement

---

## Sign-off

**Sprint 5B Unified Story Loader: CONDITIONALLY DEFERRED**  
Proceed only with narrow trust-merge scope and measurement gate.
