# Story Pipeline Graph — GET /home (Post Sprint 3)

**Generated:** 2026-07-26T16:19:37.723Z

---

## Consolidated spine

```
middleware → layout requireUser [User.findUnique 1×]
├─ getLayoutBadges [Story.count, Message.count, Notification.count]
└─ home/page.tsx (3 parallel Suspense)
   ├─ loadHomeDashboardStats
   │   ├─ getHomeStoryContext [StoryTag.findMany ×2]  ← authoritative
   │   └─ getTrustNetworkStats(ctx)
   │        ├─ Story.findMany ×2 (recent sent/received)
   │        └─ UserConnection.findMany OR graph fallback
   ├─ loadHomeDashboardSecondary
   │   ├─ getHomeStoryContext [CACHE HIT]
   │   ├─ getIntroductionSuggestions(ctx) → SharedIntroducerRelationship.groupBy
   │   └─ getTrustRecommendations → UserConnection.findMany
   └─ loadHomeDashboardFeed
       ├─ getHomeStoryContext [CACHE HIT]
       ├─ getStoryBarForViewer(ctx.visibility)
       │   ├─ Story.findMany (visible pool)
       │   └─ filterStoriesByVisibilityGate(prefetch) [0 StoryTag DB]
       └─ getMutualTagFeed(ctx.feedCtx) → Story ×2 + Post ×1
```

---

## StoryTag.findMany inventory (after)

| # | Caller | Filters | Purpose |
| --- | --- | --- | --- |
| 1 | getHomeStoryContext | `story.userId = viewer` | Authored tags → feed IDs, suggestions, trust counts |
| 2 | getHomeStoryContext | `taggedUserId = viewer` | Co-tag authors, visibility sets, trust counts |

**Eliminated (were duplicate):**

| Caller | Was | Now |
| --- | --- | --- |
| getTrustNetworkStats | 2× count + 2× findMany | 0 (TrustNetworkStatsContext) |
| filterStoriesByVisibilityGate | 2× findMany | 0 (HomeVisibilityPrefetch) |
| getHomeStoryContext (old) | 4× findMany | merged into 2 |
