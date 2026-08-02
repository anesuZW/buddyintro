# Page Optimization Estimates

**Sprint:** Performance Optimization Planning (READ-ONLY)  
**Generated:** 2026-07-26  
**Sources:** PAGE_BY_PAGE_QUERY_BREAKDOWN, DATABASE_QUERY_TRACE, DATABASE_PERFORMANCE_PROFILE, HTTP capture

---

## Assumptions

| Parameter | Current | Target |
|-----------|---------|--------|
| Pooler RTT | 455ms avg | 40ms |
| Auth segment | 660ms avg (warm) | 100ms (header trust path) |
| Server render (non-DB) | 500–800ms | 400–600ms |
| Dev compile | Excluded | N/A — measure production build |
| Parallel query batches | 3 Suspense boundaries on /home | Unchanged |

**Current DB time** = queries × 455ms (sequential estimate; parallel Suspense reduces wall time ~30%).

---

## Phase 1 — Request Graphs

### `/` (Landing)

```
Request
  ↓ Middleware (updateSession — no DB if unauthenticated)
  ↓ intlMiddleware
  ↓ app/[locale]/page.tsx (static RSC)
  ↓ No Prisma
```

**Queries:** 0 | **Branches:** 1 (authenticated users redirect elsewhere client-side)

---

### `/home`

```
Request
  ↓ Middleware (Supabase session refresh)
  ↓ intlMiddleware
  ↓ (main)/layout.tsx
  │   ↓ requireUser → getCurrentUser [cache]
  │   │   ↓ getAuthUser (Supabase JWT)
  │   │   ↓ User.findUnique
  │   ↓ Suspense: TopBarWithBadges
  │   │   ↓ getLayoutBadges [cache]
  │   │       ↓ getIntroductionExpiryFilter → AdminSettings [cache]
  │   │       ↓ Story.count (intro badge)
  │   │       ↓ Message.count (unread)
  │   │       ↓ Notification.count (unread)
  │   ↓ Suspense: BottomNavWithBadge
  │       ↓ getLayoutBadges [cache hit]
  ↓ home/page.tsx → runWithPerf
      ↓ Suspense: HomeTrustDashboard
      │   ↓ loadHomeDashboardStats [cache]
      │       ↓ getTrustNetworkStats
      │           ↓ StoryTag.count ×2
      │           ↓ Story.findMany ×2 (recent)
      │           ↓ StoryTag.findMany ×2 (introducers)
      │           ↓ UserConnection.findMany OR getMutualIntroducers loop
      ↓ Suspense: HomeSecondaryPanels
      │   ↓ loadHomeDashboardSecondary [cache]
      │       ↓ getHomeStoryContext [cache] → StoryTag.findMany ×4
      │       ↓ getIntroductionSuggestions (ctx)
      │       ↓ getTrustRecommendations [mem cache 5min]
      │           ↓ AdminSettings [cache]
      │           ↓ UserConnection.findMany
      │           ↓ getSharedIntroducersForPair (optional)
      ↓ Suspense: HomeFeedPanels
          ↓ loadHomeDashboardFeed [cache]
              ↓ getHomeStoryContext [cache hit]
              ↓ getStoryBarForViewer
              │   ↓ getVisibleStories → Story.findMany + filterStoriesByVisibilityGate
              ↓ getMutualTagFeed
                  ↓ Post.findMany + Story.findMany
```

---

### `/discoveries`

```
Request
  ↓ Middleware + layout (4 queries — same as above)
  ↓ discoveries/page.tsx → runWithPerf
      ↓ requireUser [cache hit]
      ↓ getAdminSettings [cache]
      ↓ Promise.all [
      │   getTrustRecommendations [mem cache],
      │   getDiscoveriesFeed(settingsOverride)
      │     ↓ getDiscoveriesNetworkAuthorIds → UserConnection.findMany
      │     ↓ User.findUnique (viewer verification)
      │     ↓ listBlockedUserIds → UserBlock.findMany
      │     ↓ filterDiscoveryAuthorIds
      │     ↓ DiscoveriesPost.findMany (includes)
      │     ↓ filterByCategoryVisibility → Story.findMany + SharedIntroducerRelationship
      │     ↓ getConnectionReasonsBulk + getTrustProfilesBulk
      │ ]
      ↓ Render DiscoveriesComposer + Feed (client hydration only)
```

---

### `/profile` (includes settings panels)

```
Request
  ↓ Middleware + layout (4 queries)
  ↓ profile/page.tsx → runWithPerf
      ↓ requireUser [cache hit]
      ↓ Promise.all [
          getProfileTrustNetwork → getTrustNetworkStats + getIntroductionEvidence + getMutualIntroducers,
          getTrustRecommendations [mem cache],
          analyticsService.queryUserInsights → AnalyticsEvent aggregations,
          notificationService.getPreferences → NotificationPreferences.findUnique
      ]
      ↓ Render settings panels (Privacy, Notifications, Language — no extra SSR queries)
```

---

### `/introductions`

```
Request (SSR)
  ↓ Middleware + layout (4 queries)
  ↓ introductions/page.tsx → runWithPerf
      ↓ requireUser [cache hit]
      ↓ Promise.all [
          getTrustRecommendations [mem cache],
          listIntroductionCategories [cache]
      ]
      ↓ IntroductionNetworkPanel (client links only — 0 queries)
      ↓ IntroductionsList (client)
          ↓ GET /api/introductions (after hydration)
          ↓ GET /api/introduction-categories (redundant if SSR passed)
```

---

### `/messages`

```
Request (SSR shell)
  ↓ Middleware + layout (4 queries)
  ↓ messages/page.tsx (static shell — 0 page queries)
  ↓ MessagesInboxClient (client)
      ↓ GET /api/messages
          ↓ getCurrentUser
          ↓ getConversationList
              ↓ $queryRaw (ROW_NUMBER latest per pair)
              ↓ User.findMany
              ↓ Message.groupBy (unread)
              ↓ getTrustProfilesBulk
```

---

### `/create-story`

```
Request (SSR)
  ↓ Middleware + layout (4 queries)
  ↓ create-story/page.tsx
      ↓ requireUser [cache hit]
      ↓ IntroductionCreator (client)
          ↓ GET /api/introduction-categories (likely)
          ↓ GET /api/introduction-visibility (settings)
```

---

### Story viewer (`/stories/view/[storyId]`)

```
Request
  ↓ Middleware + layout (4 queries)
  ↓ stories/view/[storyId]/page.tsx
      ↓ requireUser [cache hit]
      ↓ getStoryForViewer
      │   ↓ Story.findUnique (full include)
      │   ↓ storyPassesVisibilityGate → up to 4 StoryTag/Message queries
      │   ↓ storyPassesCategoryGate → AdminSettings + Story.count + SharedIntroducerRelationship.count
      ↓ analyticsService.track ×1–2 (AnalyticsEvent.create — blocking)
      ↓ StoryViewer render
```

---

## Phase 2 — Query Accounting

| Page | Prisma | SQL≈Prisma | Duplicated | Cached effective | Uncached | Auth queries | Settings | Notifications |
|------|--------|--------------|------------|------------------|----------|--------------|----------|---------------|
| `/` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| `/home` | 18 | 18 | 6 | 5 | 7 | 1 (+1 Supabase) | 1 | 1 count |
| `/discoveries` | 12 | 12 | 2 | 4 | 6 | 1 | 1 | 1 count |
| `/profile` | 10 | 10 | 1 | 3 | 6 | 1 | 1 | 1 count + 1 prefs |
| `/introductions` | 8+4 API | 12 | 1 | 3 | 5+4 | 1 | 1 | 1 count |
| `/messages` | 4+5 API | 9 | 1 | 3 | 5+2 | 1+1 API | 0–1 | 1 count |
| `/create-story` | 4+3 API | 7 | 0 | 3 | 1+3 | 1 | 1 API | 1 count |
| Story viewer | 10 | 10 | 2 | 3 | 5 | 1 | 1–2 | 1 count |

---

## Phase 7 — Before / After Estimates

### `/home`

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Prisma queries | 18 | 10 | **−44%** |
| Est. DB time (455ms) | 8,190ms | 4,550ms → **400ms** @40ms | **−95%** |
| Auth time | 660ms | 100ms | **−85%** |
| Server render | 700ms | 550ms | **−21%** |
| **Total warm page** | **~8.6s** | **~2.3s** | **−73%** |

### `/discoveries`

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Queries | 12 | 8 | **−33%** |
| DB time | 5,460ms | **320ms** @40ms | **−94%** |
| **Total warm page** | **~5.5s** | **~1.8s** | **−67%** |

### `/profile`

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Queries | 10 | 7 | **−30%** |
| DB time | 4,550ms | **280ms** @40ms | **−94%** |
| **Total warm page** | **~4.6s** | **~1.5s** | **−67%** |

### `/introductions`

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Queries (SSR+API) | 12 | 9 | **−25%** |
| DB time | 3,640ms | **360ms** @40ms | **−90%** |
| **Total warm page** | **~3.6s** | **~1.2s** | **−67%** |

### `/messages`

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Queries | 9 | 8 | **−11%** |
| DB time | 3,640ms | **320ms** @40ms | **−91%** |
| **Total warm page** | **~3.6s** | **~1.0s** | **−72%** |

### `/create-story`

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Queries | 7 | 6 | **−14%** |
| DB time | 1,820ms | **240ms** @40ms | **−87%** |
| **Total warm page** | **~1.8s** | **~0.6s** | **−67%** |

### Story viewer

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Queries | 10 | 7 | **−30%** |
| DB time | 4,550ms | **280ms** @40ms | **−94%** |
| **Total warm page** | **~4.5s** | **~1.2s** | **−73%** |

---

## HTTP Capture Reference (Dev, First Compile)

| Page | TTFB | Total | Note |
|------|------|-------|------|
| /home | 29,890ms | 34,418ms | Compile-inflated |
| /discoveries | 16,637ms | 16,670ms | |
| /messages | 5,664ms | 6,041ms | Lower query count |
| /profile | 16,017ms | 16,029ms | Auth 2,303ms outlier |

**Use production build + warm runs for implementation verification.**

---

## Suspense Parallelism Note

`/home` runs 3 Suspense boundaries concurrently. Wall-clock DB time ≈ `max(batch1, batch2, batch3) + layout`, not `sum(all queries)`.

| Batch | Queries | Sequential est. | Parallel wall est. |
|-------|---------|-----------------|-------------------|
| Layout | 4 | 1,820ms | 1,820ms |
| Stats | 8 | 3,640ms | 3,640ms |
| Secondary | 5 | 2,275ms | ∥ with feed |
| Feed | 4 | 1,820ms | ∥ with secondary |

**Parallel warm wall (455ms RTT):** ~1,820 + max(3,640, 2,275+1,820) ≈ **5.5s** DB-dominated — closer to observed warm behaviour than 8.2s sum.

Target parallel wall @40ms: ~160 + max(320, 200+160) ≈ **640ms** DB + auth + render ≈ **1.2–2.3s** total.
