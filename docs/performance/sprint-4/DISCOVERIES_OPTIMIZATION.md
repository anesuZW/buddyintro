# Discoveries Optimization

**Generated:** 2026-07-27

---

## Problem (Sprint 3 evidence)

`/discoveries` loaded UserConnection graph **three times**:

1. Network author discovery (`getDiscoveriesNetworkAuthorIds`)
2. Trust recommendations panel (`getTrustRecommendations`)
3. Trust profile enrichment (`getTrustProfilesBulk`)

---

## Solution

### `getDiscoveriesViewerConnections` (React `cache()`)

Single outgoing-connection load on page entry.

### Wiring

```text
discoveries/page.tsx
  → getDiscoveriesViewerConnections(userId)
  → getTrustRecommendations(userId, { connectionRows })
  → getDiscoveriesFeed({ connectionRows })
       → networkAuthorIdsFromConnectionRows
       → getTrustProfilesBulk(..., preloadedConnections)
```

---

## Preserved behaviour

| Area | Status |
| --- | --- |
| Discoveries ranking | Unchanged sort in `getDiscoveriesFeed` |
| Network depth filter | Same `getEffectiveDiscoveryDepth` logic |
| Trust profile scores | Same `getTrustProfilesBulk` computation |
| Visibility / verification | Unchanged gates |

---

## Query impact (static)

| Metric | Before | After |
| --- | --- | --- |
| UserConnection.findMany | ~3 | **1** |
| DiscoveriesPost.findMany | 1 | 1 |
| SharedIntroducerRelationship.findMany | 1 | 1 |

---

## Files

- `lib/discoveries-graph-context.ts`
- `app/[locale]/(main)/discoveries/page.tsx`
- `services/discoveries.ts`
- `services/trust-profile.ts`
