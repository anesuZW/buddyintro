# SharedIntroducerRelationship Optimization

**Generated:** 2026-07-27

---

## Current usage on `/home`

| Operation | Caller | Count |
| --- | --- | --- |
| groupBy | `getSharedIntroducerCountsBulk` → introduction suggestions | 1 |
| findMany | `getSharedIntroducersForPair` → trust recs (top pair, if shared ≥ 5) | 0–1 |

---

## Sprint 4 changes

| Change | Detail |
| --- | --- |
| `getSharedIntroducersForPairCached` | Request-scoped React `cache()` — dedupes repeated pair lookup |
| Introduction suggestions groupBy | **Unchanged** — already bulk |

---

## Why not merge groupBy + findMany?

Different purposes:

- **groupBy:** counts for O(n²) suggestion pair filter (many pairs)
- **findMany:** introducer names for single top recommendation

Merging would require loading all pair relationships — heavier than targeted queries.

---

## `/discoveries`

`getTrustProfilesBulk` still uses one `SharedIntroducerRelationship.findMany` with OR clause per author batch — unchanged (author-specific includes).

Future Sprint 5: index or materialized pair cache if profiling shows this as dominant.

---

## Behaviour

Recommendation ordering, suggestion filtering, and introducer name display **unchanged**.
