# Sprint 4 N+1 Verification

**Generated:** 2026-07-27

---

## Resolved

| Pattern | Location | Sprint 4 fix |
| --- | --- | --- |
| Duplicate UserConnection on home | trust stats + recs | `getHomeUserConnections` |
| Duplicate UserConnection on discoveries | network + recs + profiles | `getDiscoveriesViewerConnections` |
| Duplicate Story bar + feed co-tag | home feed | `getHomeVisibleStoryRows` |

---

## Remaining (unchanged — not N+1)

| Pattern | Location | Notes |
| --- | --- | --- |
| O(n²) suggestion pairs | `introduction-suggestions.ts` | CPU loop; bulk groupBy |
| Trust stats 2× Story.findMany | `trust-network.ts` | Distinct filters; merge risks behaviour |
| Mutual author distinct | `getMutualTagFeed` | Requires tag join filter |
| Mutual fallback loop | `getMutualIntroducers` | Only when graph not materialized |

---

## Future Sprint 5

- Unified trust recent story loader (if profiling proves material)
- Discoveries SharedIntroducer OR batch optimization
- Materialized graph warm path for mutual fallback

---

## DO NOT IMPLEMENT (this sprint)

Further Story.findMany merges below 4 without behaviour proof.
