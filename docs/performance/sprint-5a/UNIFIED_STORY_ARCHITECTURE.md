# Unified Story Architecture (Design — Not Implemented)

**Generated:** 2026-07-27  
**Status:** DESIGN ONLY — Sprint 5A did not implement

This document describes a **narrow** unified loader should Sprint 5B proceed with trust-query merge only.

---

## Scope (recommended Sprint 5B)

Merge **Q1 + Q2 only** — not full 4-query unification.

```
getHomeTrustRecentStories(userId)  [React cache()]
  └─ Story.findMany OR [
       { userId, status: published },
       { tags: { some: { taggedUserId: userId } }, status: published }
     ]
     orderBy: createdAt desc
     select: narrow trust fields
  └─ in-memory split:
       sent = filter userId===viewer, take 5
       received = filter tagged, take 5
```

---

## Layer architecture

```text
┌─────────────────────────────────────────────────────────┐
│ getHomeRequestBundle (existing)                          │
├─────────────────────────────────────────────────────────┤
│ StoryTag scan (2 queries) — unchanged                    │
│ UserConnection scan (1 query) — unchanged                │
│ getHomeVisibleStoryRows (1 query) — unchanged            │
│ getHomeTrustRecentStories (1 query) — NEW Sprint 5B      │
│ getMutualAuthorIds (1 query or derived) — unchanged    │
└─────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   Trust dashboard      Story bar + feed      Feed posts
   (projection)         (projection)          (Post query)
```

---

## Projection layer

| Function | Input | Output |
| --- | --- | --- |
| `projectTrustSent` | unified rows | 5 sent cards |
| `projectTrustReceived` | unified rows | 5 received cards |
| `projectHomeStoryBarStories` | visible pool | Story bar groups |
| `pickCoTagFeedStories` | visible pool | Feed stories |

---

## Visibility layer

Unchanged — `filterStoriesByVisibilityGate` on visible pool only. Trust recent stories intentionally **bypass** visibility gate (viewer's own / received published).

---

## Recommendation integration

No Story data in recommendation pipeline — no change.

---

## Suspense integration

`getHomeRequestBundle` remains single React `cache()` entry; trust loader nested inside or parallel to visible pool load.

---

## Memory footprint (est.)

| Loader | Rows (demo user est.) | Payload |
| --- | --- | --- |
| Visible pool | 20–100 | Full includes (~2–10 KB/row) |
| Trust unified | 10–200 published | Narrow select (~200 B/row) |
| **Combined** | — | Lower than mega-loader with full includes on all |

---

## Complexity

| Approach | Files touched | Test surface |
| --- | --- | --- |
| Trust merge only | 2–3 | Unit tests for split semantics |
| Full mega-loader | 8+ | High — all consumers |

---

## Trade-offs

| Pro | Con |
| --- | --- |
| −1 round trip (maybe) | Parallel Q1/Q2 may already overlap — limited wall-time gain |
| Single trust data source | OR query may scan more rows than 5+5 |
| Request-scoped cache | Split logic must mirror DB take:5 exactly |

---

## NOT recommended

Single loader replacing Q3 + Q4 + Q1 + Q2 — see `UNIFIED_STORY_LOADER_FEASIBILITY.md`.
