# Story Consolidation

**Generated:** 2026-07-27

---

## Design

### `getHomeVisibleStoryRows` (React `cache()`)

Single `Story.findMany` + visibility gate — replaces separate story bar and feed co-tag queries.

### `pickCoTagFeedStories`

In-memory projection matching prior feed query:

- `userId in coTagAuthorIds`
- `status === published`
- `expiresAt > now`
- `orderBy createdAt desc`, `take pageSize`

### `getHomeRequestBundle`

Request-scoped bundle shared across Suspense branches:

```
getHomeStoryContext (2× StoryTag)
  → getHomeUserConnections (1× UserConnection)
  → getHomeVisibleStoryRows (1× Story)
```

---

## Behaviour preservation

| Concern | Mitigation |
| --- | --- |
| Story bar ordering | Same pool, same `projectHomeStoryBarStories` grouping |
| Feed story set | `pickCoTagFeedStories` mirrors DB filters |
| Visibility | Same `filterStoriesByVisibilityGate` with prefetch |
| Trust recent lists | Unchanged separate queries (take 5) |

---

## Query impact

| Path | Before | After |
| --- | --- | --- |
| Story bar | 1 Story.findMany | Shared pool |
| Feed co-tag | 1 Story.findMany | **0** (projection) |
| **Total Story.findMany** | **5** | **4** |

---

## Files

- `lib/home-story-loader.ts`
- `lib/home-projection.ts`
- `services/home-dashboard.ts`
- `services/stories.ts`
- `services/feed.ts`
