# Suspense Boundary Audit

**Generated:** 2026-07-26T16:19:37.723Z

---

## Current boundaries (unchanged)

| Boundary | Loader | Shared cache |
| --- | --- | --- |
| TopBarWithBadges | getLayoutBadges | userId key |
| BottomNavWithBadge | getLayoutBadges | same request cache |
| HomeTrustDashboard | loadHomeDashboardStats | getHomeStoryContext |
| HomeSecondaryPanels | loadHomeDashboardSecondary | getHomeStoryContext |
| HomeFeedPanels | loadHomeDashboardFeed | getHomeStoryContext |

## Finding

All three page Suspense branches call `getHomeStoryContext(userId)` — React `cache()` dedupes to **one** 2-query scan regardless of parallel Suspense.

## Not moved (preserve streaming UX)

Loaders remain inside Suspense so stats / secondary / feed still stream independently. Only DB duplication removed, not streaming structure.
