# Sprint 4 Summary

**Generated:** 2026-07-27  
**Checkpoint:** `checkpoint/sprint-4-start` @ `87edda0`

---

## Objective

Eliminate remaining Story, UserConnection, and graph duplication on `/home` and `/discoveries` while preserving identical behaviour.

---

## Implemented

| Optimization | Impact |
| --- | --- |
| `getHomeRequestBundle` | Shared context across Suspense branches |
| `getHomeVisibleStoryRows` | −1 Story.findMany (bar + feed) |
| `getHomeUserConnections` | −1 UserConnection.findMany on /home |
| `getDiscoveriesViewerConnections` | −2 UserConnection.findMany on /discoveries |
| `getSharedIntroducersForPairCached` | Request dedupe for pair lookup |
| `isUserConnectionsMaterializedCached` | Request dedupe for probe |

---

## Query totals

| Page | Sprint 3 | Sprint 4 |
| --- | --- | --- |
| `/home` Prisma (est.) | 17 | **~15** |
| `/home` Story.findMany | 5 | **4** |
| `/discoveries` UserConnection | ~3 | **1** |

---

## Tests

**6/6 unit tests PASS**

---

## Remaining bottlenecks (Sprint 5)

1. Pooler RTT × remaining ~15 queries
2. Trust recent 2× Story.findMany
3. Mutual author distinct Story.findMany
4. Discoveries SharedIntroducerRelationship.findMany OR batch
5. Live HTTP/RC verification

---

## Deliverables

All docs under `docs/performance/sprint-4/`

---

## Recommended Sprint 5

- Unified home story loader (4 → 2–3 Story.findMany)
- Discoveries shared introducer batch index
- Production `profile:http-capture` A/B vs Sprint 3
- RC1/RC2 full pass
