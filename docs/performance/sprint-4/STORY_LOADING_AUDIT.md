# Story Loading Audit — GET /home

**Generated:** 2026-07-27  
**Evidence:** Source inspection + Sprint 3 runtime trace

---

## Story.findMany inventory (pre-Sprint 4)

| # | Caller | Purpose | Filters | Includes | orderBy | Consumer |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `getTrustNetworkStats` | Recent sent | `userId`, `published` | Narrow select | `createdAt desc`, take 5 | Trust cards |
| 2 | `getTrustNetworkStats` | Recent received | `tags.taggedUserId`, `published` | Narrow select | `createdAt desc`, take 5 | Trust cards |
| 3 | `getVisibleStories` | Story bar pool | viewer OR published introducers, `expiresAt` | Full `storyInclude` | `createdAt desc` | StoryBar |
| 4 | `getMutualTagFeed` | Mutual authors | tags overlap `myTaggedUserIds` | `userId` only | distinct | Feed author set |
| 5 | `getMutualTagFeed` | Co-tag stories | `coTagAuthorIds`, published, not expired | user + tags | `createdAt desc`, take N | Feed items |

---

## Overlap analysis

| Queries | Overlap | Safe to merge? |
| --- | --- | --- |
| #3 + #5 | Both need co-tag author published stories with tags | **Yes** — #5 is subset of #3 after visibility filter |
| #1 + #2 | Different filters (authored vs tagged) | **No** without full scan + split |
| #4 + #3 | Different shapes (distinct userId vs full stories) | **No** |

---

## Sprint 4 action

Consolidate **#3 + #5** via `getHomeVisibleStoryRows` + `pickCoTagFeedStories`.

**Remaining Story.findMany on /home: 4**

---

## Rows returned (Sprint 3 runtime)

Trust queries: take 5 each. Visible pool: unbounded (filtered in memory). Feed co-tag: pageSize (default 20).
