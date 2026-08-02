# UserConnection Optimization

**Generated:** 2026-07-27

---

## `/home` — before

| Call site | Query |
| --- | --- |
| `getTrustNetworkStats` | findMany `targetUserId in targetIds` |
| `computeTrustRecommendations` | findMany `degree lte 2`, take 12 |
| `isUserConnectionsMaterialized` | findFirst (global) |

Sprint 3 runtime: 677ms + 3,651ms on two findMany calls.

---

## `/home` — after

| Call site | Query |
| --- | --- |
| `getHomeUserConnections` | **Single findMany** (all outgoing connections) |
| Trust stats | In-memory filter + sum |
| Trust recs | In-memory filter + sort + slice(12) |
| Materialization | `isUserConnectionsMaterializedCached` (request dedupe) |

**Net: −1 UserConnection.findMany per /home request**

---

## `/discoveries` — before

| Call site | Query |
| --- | --- |
| `getDiscoveriesNetworkAuthorIds` | findMany (degree filter) |
| `getTrustRecommendations` | findMany |
| `getTrustProfilesBulk` | findMany (author subset) |

---

## `/discoveries` — after

| Call site | Query |
| --- | --- |
| `getDiscoveriesViewerConnections` | **Single findMany** |
| Network author IDs | `networkAuthorIdsFromConnectionRows` |
| Trust recs | Reuses same rows |
| Trust profiles | `preloadedConnections` subset |

**Net: −2 UserConnection.findMany per /discoveries request**

---

## Files

- `lib/home-graph-context.ts`
- `lib/discoveries-graph-context.ts`
- `services/discoveries.ts`
- `app/[locale]/(main)/discoveries/page.tsx`
- `services/trust-profile.ts`
