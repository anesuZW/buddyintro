# Complete Story Pipeline Inventory

**Generated:** 2026-07-27  
**Evidence:** Source inspection (STATIC ANALYSIS)

---

## `/home` consumers

### 1. Trust Dashboard — recent sent

| Field | Value |
| --- | --- |
| **Entry** | `loadHomeDashboardStats` → `getTrustNetworkStats` |
| **Query** | `Story.findMany` #1 |
| **Fields** | `id`, `text`, `mediaUrl`, `mediaType`, `createdAt`, `user` |
| **Relations** | `user` (narrow select) |
| **Filters** | `userId = viewer`, `status = published` |
| **Visibility** | None (own published stories) |
| **orderBy** | `createdAt desc` |
| **Pagination** | `take: 5` |
| **Sort after fetch** | None |
| **UI** | `HomeTrustDashboard` recent sent cards |

### 2. Trust Dashboard — recent received

| Field | Value |
| --- | --- |
| **Entry** | `getTrustNetworkStats` |
| **Query** | `Story.findMany` #2 |
| **Fields** | Same narrow select as #1 |
| **Relations** | `user` |
| **Filters** | `tags.some.taggedUserId = viewer`, `status = published` |
| **Visibility** | None |
| **orderBy** | `createdAt desc` |
| **Pagination** | `take: 5` |
| **UI** | Trust dashboard received cards |

### 3. Story Bar

| Field | Value |
| --- | --- |
| **Entry** | `loadHomeDashboardFeed` → `getStoryBarForViewer` → `getHomeVisibleStoryRows` |
| **Query** | `Story.findMany` #3 (visible pool) |
| **Fields** | Full story + `user` + `tags.taggedUser` |
| **Relations** | `storyInclude` |
| **Filters** | `expiresAt > now`, OR `[viewer stories, published introducer authors]` |
| **Visibility** | `filterStoriesByVisibilityGate` + prefetch |
| **orderBy** | `createdAt desc` (DB), then group by author |
| **Pagination** | None (all visible non-expired) |
| **Sort after fetch** | Story bar groups by author; viewer first; newest group first |
| **UI** | `StoryBar` component |

### 4. Mutual Feed — co-tag stories

| Field | Value |
| --- | --- |
| **Entry** | `getMutualTagFeed` with `homeVisibleStoryRows` |
| **Query** | **0** (Sprint 4 projection from pool #3) |
| **Fields** | Same as pool |
| **Filters** | `coTagAuthorIds`, published, not expired |
| **orderBy** | `createdAt desc`, `take pageSize` |
| **UI** | Home feed story items |

### 5. Mutual Feed — mutual author discovery

| Field | Value |
| --- | --- |
| **Entry** | `getMutualTagFeed` |
| **Query** | `Story.findMany` #4 |
| **Fields** | `userId` only |
| **Relations** | None |
| **Filters** | `userId != viewer`, `tags.some.taggedUserId in myTaggedUserIds` |
| **Visibility** | **None** — no status/expires/visibility filter |
| **orderBy** | `distinct: [userId]` |
| **Pagination** | Unbounded distinct authors |
| **Purpose** | Expand `allAuthorIds` for Post.findMany |

---

## Other page consumers (not on `/home`)

### Introductions inbox

| Field | Value |
| --- | --- |
| **File** | `services/introductions.ts` |
| **Filters** | `taggedUserId = viewer`, expiry filter, published/draft/expired |
| **Includes** | user, category, tags |
| **Pagination** | cursor + limit |

### Introductions sent

| Field | Value |
| --- | --- |
| **File** | `getSentIntroductionsForUser` |
| **Filters** | `userId = viewer`, status in published/expired/draft |

### Stories pages

| Field | Value |
| --- | --- |
| **Files** | `stories/page.tsx`, `stories/[userId]/page.tsx` |
| **Entry** | `getStoryBarForViewer` / `getVisibleStories` (non-home path) |

### Story viewer

| Field | Value |
| --- | --- |
| **Entry** | `getStoryForViewer` → `findUnique` + gate checks |
| **Not findMany** | Single story |

### Discoveries category gate

| Field | Value |
| --- | --- |
| **File** | `lib/category-visibility.ts` |
| **Query** | Batched `Story.findMany` for category overlap |
| **Scope** | Discoveries post authors only |

### API routes

| Route | Consumer |
| --- | --- |
| `/api/stories` | `getVisibleStories` |
| `/api/feed` | `getMutualTagFeed` (no home pool) |

---

## Non-user-facing

| File | Purpose |
| --- | --- |
| `lib/introduction-graph.ts` | Graph rebuild metadata |
| `lib/conversation-graph-fast.ts` | Message context |
| `services/media/media-cleanup.ts` | Media URLs |
| `services/consent.ts` | User data export |

---

## Recommendations pipeline

**Does not load Story rows directly on `/home`.** Uses `UserConnection` + `SharedIntroducerRelationship.groupBy` only.

---

## Notifications / Messages

Messages may load single story via `getStoryForViewer(searchParams.story)` — not a list pipeline on `/home`.
