# N+1 Verification — Home Request Pipeline

**Generated:** 2026-07-26T18:05:00.000Z  
**Evidence:** STATIC ANALYSIS + RUNTIME VERIFIED (partial)

DO NOT IMPLEMENT — documentation only.

---

## Issue 1 — Introduction suggestion pair scan

| Field | Value |
| --- | --- |
| **Location** | `services/introduction-suggestions.ts` |
| **Loop** | Nested `for (a of introducedByViewer) for (b of introducedByViewer)` |
| **Repeated Prisma call** | None inside loop — uses `getSharedIntroducerCountsBulk` (1 bulk query) |
| **Query count** | 1× `SharedIntroducerRelationship.groupBy` + bulk counts |
| **Est. latency** | 693ms groupBy (RUNTIME) + bulk map |
| **Future sprint** | Sprint 5 — optional pair index if candidate set grows |

**Verdict:** O(n²) **CPU loop**, not N+1 Prisma. Acceptable for n≤20.

---

## Issue 2 — Trust stats mutual fallback loop

| Field | Value |
| --- | --- |
| **Location** | `services/trust-network.ts` lines 88–91 |
| **Loop** | `for (const targetId of targetIds) { getMutualIntroducers(...) }` |
| **Repeated Prisma call** | `getMutualIntroducers` per target when connections not materialized |
| **Query count** | 0 on home when materialized (RUNTIME: `UserConnection.findMany` used) |
| **Est. latency** | 677ms bulk path observed |
| **Future sprint** | Pre-existing; materialized path active for test user |

**Verdict:** N+1 **possible** only when graph not materialized — not observed on runtime trace.

---

## Issue 3 — Trust recommendations loop

| Field | Value |
| --- | --- |
| **Location** | `services/trust-recommendations.ts` |
| **Loop** | `for (const conn of connections.slice(0, 5))` |
| **Repeated Prisma call** | None — single upfront `UserConnection.findMany` |
| **Est. latency** | 3,651ms for connection query (RUNTIME) |
| **Future sprint** | Cache warming / slimmer select |

---

## Issue 4 — Story bar grouping

| Field | Value |
| --- | --- |
| **Location** | `services/stories.ts` `getStoryBarForViewer` |
| **Loop** | `Map` iteration over visible stories |
| **Repeated Prisma call** | None — single `Story.findMany` |
| **Future sprint** | N/A |

---

## Issue 5 — Feed parallel loaders

| Field | Value |
| --- | --- |
| **Location** | `services/feed.ts` `getMutualTagFeed` |
| **Loop** | `Promise.all([posts, stories])` + author id sets |
| **Repeated Prisma call** | 3× Story.findMany + 1× Post.findMany (distinct purposes) |
| **Est. latency** | 624 + 1310 + 4898ms Story + 624ms Post |
| **Future sprint** | Sprint 4 — unified story loader |

---

## Issue 6 — Visibility gate filter

| Field | Value |
| --- | --- |
| **Location** | `lib/story-visibility.ts` |
| **Loop** | `stories.filter(...)` in-memory |
| **Repeated Prisma call** | **0** with prefetch (Sprint 3) |
| **Future sprint** | N/A — resolved on home |

---

## Summary

| Severity | Count | Sprint 3 impact |
| --- | --- | --- |
| Remaining N+1 Prisma loops | 1 (conditional mutual fallback) | Not triggered on runtime trace |
| O(n²) CPU without N+1 | 1 (suggestions) | Unchanged |
| Multi-query non-N+1 | 5× Story.findMany | Sprint 4 target |
