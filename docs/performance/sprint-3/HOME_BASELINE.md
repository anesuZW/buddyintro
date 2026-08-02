# Home Baseline (Sprint 3 — Pre-optimization)

**Generated:** 2026-07-26T16:19:37.723Z  
**Page:** `/home`  
**Checkpoint:** `checkpoint/sprint-3-home-start`

---

## Query counts (static trace)

| Operation | Count |
| --- | --- |
| StoryTag.findMany | 10 |
| StoryTag.count | 2 |
| Story.findMany | 5 |
| Story.count | 1 |
| UserConnection.findMany | 1 |
| SharedIntroducerRelationship.groupBy | 1 |
| SharedIntroducerRelationship.findMany | 0 |
| Post.findMany | 1 |
| Notification.count | 1 |
| Message.count | 1 |
| User.findUnique | 1 |
| AdminSettings.findUnique | 1 |
| totalPrismaEstimate | 25 |

---

## HTTP (Sprint 2 warm dev capture)

| Metric | Value |
| --- | --- |
| TTFB | 6103ms |
| Total | 12591ms |
| Pooler p50 | 305ms |

---

## Hotspots

- `getHomeStoryContext`: 4× `StoryTag.findMany`
- `getTrustNetworkStats`: 2× count + 2× findMany StoryTag
- `filterStoriesByVisibilityGate`: 2× StoryTag.findMany
- Feed/story bar: 5× Story.findMany + layout badge Story.count
