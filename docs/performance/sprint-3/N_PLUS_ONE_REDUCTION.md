# N+1 Reduction Report

**Generated:** 2026-07-26T16:19:37.723Z

---

## Addressed in Sprint 3

| Pattern | Location | Before | After |
| --- | --- | --- | --- |
| Parallel duplicate StoryTag scans | home-dashboard + trust-network + visibility | 10–12 findMany/count | 2 findMany |
| getMutualIntroducers loop | trust-network (non-materialized graph) | O(targets) graph lookups | Unchanged — graph path preserved |
| filterStoriesByVisibilityGate per author | stories | 2 bulk queries per bar load | 0 with prefetch |

---

## Not changed (out of scope)

- `getMutualIntroducers` loop when connections not materialized — same algorithm, fewer preceding StoryTag queries
- Trust recommendation in-memory TTL (pre-existing, not cross-request user cache violation for Sprint rules — was already present)

---

## Behaviour preservation

- `introducedByMe` count includes all tags on published stories (including null taggedUserId)
- `uniqueIntroducers` = unique author IDs from published introduction stories (not story ID count)
- Visibility `everIntroduced` includes `expired` story status
