# Auth Duplicate Query Matrix

**Generated:** 2026-07-26T15:46:50.801Z

---

## Within-Request Duplicates (Before Sprint 2)

| Query / Call | Callers | Executions (before) | Reason | After |
| --- | --- | --- | --- | --- |
| getAuthUser → Supabase | getCurrentUser, route profiler | 1–2 | getAuthUser was not cached | 1 effective (cache + headers) |
| getLayoutBadges | TopBarWithBadges, BottomNavWithBadge | 1–2 | Separate Suspense boundaries; object reference cache key | 1 (primitive userId key) |
| NotificationPreferences.findUnique | getPreferences, shouldDeliver, unreadCount | 0–2 on profile | Independent getOrCreatePreferences calls | 1 (getNotificationPreferencesCached) |
| getUnreadNotificationCount | layout + potential page overlap | 1–2 | No request cache on exported helper | 1 (React cache) |
| getIntroductionExpiryFilter | layout-badges, introductions/* | 2+ function calls | Function not cached (AdminSettings still deduped) | 1 function eval (cached) |
| AdminSettings.findUnique | 15+ call sites | 1 effective | Already React cache + TTL | Unchanged — 1 |
| User.findUnique | layout + page requireUser | 1 effective | Already React cache | Unchanged — 1 |

---

## Layout Badge Queries

| Badge | Query | Before (per layout) | After |
| --- | --- | --- | --- |
| Unread messages | Message.count | 1–2 if badges duplicated | 1 |
| Unread notifications | Notification.count | 1–2 | 1 |
| Story / intro badge | Story.count | 1–2 | 1 |

TopBar and BottomNav share `getLayoutBadges` via React `cache(userId, lastIntroductionsSeenAt)`.
