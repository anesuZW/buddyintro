# Recommendation Graph Consolidation

**Generated:** 2026-07-27

---

## Overlap identified (Sprint 3 evidence)

| Loader | UserConnection | SharedIntroducer |
| --- | --- | --- |
| `getTrustNetworkStats` | findMany (targetIds subset) | — |
| `getTrustRecommendations` | findMany (degree ≤ 2, take 12) | findMany (top pair) |
| `getIntroductionSuggestions` | — | groupBy (pair bulk) |

---

## Sprint 4 solution — `/home`

### `getHomeUserConnections` (React `cache()`)

One `UserConnection.findMany` where `sourceUserId = viewer`.

### In-memory projection

| Consumer | Function |
| --- | --- |
| Trust stats mutual sum | `sumMutualConnectionsForTargets(rows, targetIds)` |
| Trust recommendations | `pickTrustRecommendationConnections(rows)` |

Sort/filter logic matches Prisma `orderBy` + `take: 12`.

### Shared introducer pair lookup

`getSharedIntroducersForPairCached` — React `cache()` wrapper (request-scoped dedupe).

Introduction suggestion `groupBy` unchanged (already bulk).

---

## Query impact `/home`

| Before | After |
| --- | --- |
| 2× UserConnection.findMany | **1×** |
| 1× groupBy (suggestions) | 1× (unchanged) |
| 0–1× SharedIntroducer findMany (recs) | 0–1× (cached) |

---

## Files

- `lib/home-graph-context.ts`
- `lib/home-projection.ts`
- `services/trust-network.ts`
- `services/trust-recommendations.ts`
- `lib/shared-introducers.ts`
