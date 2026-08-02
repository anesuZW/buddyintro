# Request Architecture Inventory

**Sprint:** Performance Reset (READ-ONLY)  
**Generated:** 2026-07-31  
**Locale note:** paths are logical (`localePrefix: as-needed`). On disk: `app/[locale]/…`.

---

## Shared stack

| Layer | Path | Role |
| --- | --- | --- |
| Middleware | `middleware.ts` → `lib/supabase/middleware.ts` | Origin/CSRF, intl, `updateSession` (`auth.getUser`), trusted auth headers, redirects |
| Root layout | `app/layout.tsx` | Metadata/viewport passthrough |
| Locale layout | `app/[locale]/layout.tsx` | `getMessages`, providers (i18n, theme, PWA, toaster) |
| Main layout | `app/[locale]/(main)/layout.tsx` | `requireUser()`, TopBar/BottomNav Suspense shells |
| Auth | `lib/auth.ts` | `getAuthUser` / `getCurrentUser` / `requireUser` (React `cache`) |
| Perf | `lib/perf/*`, `lib/profile/production-benchmark.ts` | `runWithPerf`, Prisma timing, `x-bench-*` headers |

---

## Middleware pipeline (all matched routes)

```
Request
  → request ID + origin validation
  → [pages] createIntlMiddleware(routing)
  → updateSession:
       createSupabaseSSR → auth.getUser()
       setTrustedAuthHeaders if user
       unauth + non-public → /login
       auth on /login|/signup → /home
  → security headers + metrics
```

**Public prefixes include:** `/`, `/login`, `/signup`, `/invite/`, legal, auth APIs.

---

## Route inventory

### `/` — Landing

| Item | Detail |
| --- | --- |
| Page | `app/[locale]/page.tsx` |
| Layouts | Root → Locale (**not** Main) |
| Auth | Middleware `getUser` only; no `requireUser` |
| Data | None |
| Suspense | None |
| Clients | Locale providers, cookie banner, legal footer links |

**Live 2026-07-31:** HTTP 200, HTML ~23 KB decoded.

---

### `/home` — primary authenticated surface

| Item | Detail |
| --- | --- |
| Page | `app/[locale]/(main)/home/page.tsx` |
| Layouts | Root → Locale → Main |
| Auth | Middleware + Main `requireUser` + page `getCurrentUser` (cached) |
| Perf wrapper | `runWithPerf({ label: "/home" })` |

**Suspense / streaming:**

```
MainLayout
├── Suspense → TopBarWithBadges (layout badges)
├── children → HomePage
│     ├── Suspense → HomeTrustDashboard → loadHomeDashboardStats
│     ├── Suspense → HomeSecondaryPanels → loadHomeDashboardSecondary
│     └── Suspense → HomeFeedPanels → loadHomeDashboardFeed
└── Suspense → BottomNavWithBadge
```

**Shared request bundle** (`services/home-dashboard.ts` → `getHomeRequestBundle`):

1. `getHomeStoryContext` — 2× `StoryTag.findMany`
2. Parallel: `getHomeUserConnections` (`UserConnection`) + `getHomeVisibleStoryRows` (`Story` + visibility)
3. Stats: `getTrustNetworkStats` — 2× recent `Story.findMany`
4. Secondary: suggestions + `getTrustRecommendations`
5. Feed: story bar (pool projection) + `getMutualTagFeed` (`Post` + mutual-author `Story`)

**Key models:** User, StoryTag, UserConnection, Story, Post, SharedIntroducerRelationship, Message, Notification, AdminSettings.

**Client hydrate:** `StoryBar`, `FeedList`, `TrustRecommendationsPanel`, `IntroductionSuggestions`, shell widgets.

---

### `/discoveries`

| Item | Detail |
| --- | --- |
| Page | `app/[locale]/(main)/discoveries/page.tsx` |
| Streaming | **None** on page — full await before HTML body |
| Sequence | `requireUser` → `getAdminSettings` → `getDiscoveriesViewerConnections` → parallel recommendations + `getDiscoveriesFeed` |
| Clients | `DiscoveriesComposer`, `DiscoveriesFeed`, `TrustRecommendationsPanel` |

---

### `/messages`

| Item | Detail |
| --- | --- |
| Page | `app/[locale]/(main)/messages/page.tsx` |
| RSC data | Thin shell only |
| Client path | `MessagesInboxClient` → `GET /api/messages` → `getConversationList` |
| Clients | Inbox + conversation list (hydration-heavy) |

---

### `/profile`

| Item | Detail |
| --- | --- |
| Page | `app/[locale]/(main)/profile/page.tsx` |
| Streaming | None on page |
| Parallel | `getProfileTrustNetwork`, `getTrustRecommendations`, `queryUserInsights`, `getPreferences` |
| Clients | Profile editors, insights, notification/privacy panels, recommendations |

---

## Cross-route comparison

| Route | Auth gate | RSC weight | Page Suspense | Primary bottleneck class |
| --- | --- | --- | --- | --- |
| `/` | Public | Empty | No | Middleware auth RTT + JS hydrate |
| `/home` | Full | Heavy | **Yes (3)** | DB round-trips × pooler RTT |
| `/discoveries` | Full | Heavy | No | Blocking SSR + discoveries graph |
| `/messages` | Full | Shell | No | Client API after shell |
| `/profile` | Full | Heavy | No | Blocking parallel loaders |

---

## Correction to sprint narrative

Sprint 5A **did not** ship a unified Story loader. Decision was **Option B** (architecture close to optimal; mega-loader not justified). Remaining `/home` Story.findMany ≈ **4** distinct pipelines after Sprint 4.

---

## Live blocker (2026-07-31)

Prisma schema expects `users.preferred_language`; remote DB column **missing**. All Main-layout routes fail in `getCurrentUser` with HTTP **500**. Architecture inventory above is from static analysis; timing for authenticated pages relies on prior successful captures (see `QUERY_TIMELINE.md`).
