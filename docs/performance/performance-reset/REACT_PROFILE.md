# React Profile

**Sprint:** Performance Reset (READ-ONLY)  
**Generated:** 2026-07-31

---

## Architecture summary

| Surface | RSC pattern | Suspense | Blocking? |
| --- | --- | --- | --- |
| `/home` | Split loaders | 3 page + 2 layout | Shell streams; panels wait |
| `/discoveries` | Single page await | Layout only | **Yes** — full data before body |
| `/messages` | Thin RSC shell | Layout only | Shell fast; data client-side |
| `/profile` | `Promise.all` loaders | Layout only | **Yes** — full data before body |
| `/` | Static-ish landing | None | Middleware only |

No `loading.tsx` files under `app/`.

---

## `/home` component tree (perf-relevant)

```
LocaleLayout (providers — client boundary)
└── MainLayout
    ├── Suspense → TopBarWithBadges → TopBar (client)
    ├── HomePage
    │   ├── Suspense → HomeTrustDashboard → TrustNetworkDashboard (server UI)
    │   ├── Suspense → HomeSecondaryPanels
    │   │     ├── TrustRecommendationsPanel (client)
    │   │     └── IntroductionSuggestions (client)
    │   └── Suspense → HomeFeedPanels
    │         ├── StoryBar (client)
    │         └── FeedList (client)
    ├── InstallPrompt (client)
    └── Suspense → BottomNavWithBadge → BottomNav (client)
```

**Longest rendering subtree (by data wait, not VDOM cost):** Feed arm (`getMutualTagFeed` mutual-author Story up to ~4.9 s historically) and Secondary recommendations (`UserConnection` ~3.7 s).

**Largest interactive islands:** `StoryBar` + `FeedList` + recommendation panels — hydrate after stream.

---

## Suspense behaviour

| Boundary | Improves | Does not hide |
| --- | --- | --- |
| Layout badges | TopBar/BottomNav skeleton | Auth gate before any shell |
| Home stats / secondary / feed | Progressive paint | Shared `getHomeRequestBundle` cost paid by first waiter |
| Discoveries / profile | n/a | Entire page data |

**Repeated work risk:** Three home branches call into cached bundle — React `cache()` coalesces (Sprint 3/4). Layout badges are separate queries (justified for independent stream).

---

## Providers / layout cost

Locale layout hydrates: `NextIntlClientProvider`, `LanguageProvider`, `ThemeProvider`, `PwaProviders`, cookie banner, toaster.

Browser evidence on `/` (dev): layout chunk transfer **~352 KB** encoded / **~1.5 MB** decoded — significant hydrate surface even on empty landing.

---

## Blocking components

| Component / page | Why blocking |
| --- | --- |
| `MainLayout.requireUser` | Must resolve User before children |
| `DiscoveriesPage` await chain | No page Suspense |
| `ProfilePage` Promise.all | No page Suspense |
| `getHomeRequestBundle` first consumer | Gates all three Suspense arms' data |

---

## Render vs data

No React Profiler CPU flamegraph this session (authenticated UI 500). Prior sprints treat **DB wait** as dominant; RSC CPU is secondary.

| Metric | Evidence | Rank vs DB |
| --- | --- | --- |
| Warm `/home` TTFB 2.3 s | Sprint 3 | Mostly DB/auth RTT |
| Landing FCP 2.7 s | Live browser | TTFB 2.57 s → render ~140 ms after TTFB |
| Serialize headers | Often null / low | Not primary |

**Conclusion:** React/Suspense structure is **not** the top bottleneck for perceived authenticated slowness. Missing Suspense on discoveries/profile increases time-to-content vs `/home`. Client islands add hydrate cost after bytes arrive.
