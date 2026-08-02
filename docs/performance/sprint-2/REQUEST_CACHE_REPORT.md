# Request Cache Report

**Generated:** 2026-07-26T15:46:50.801Z  
**Scope:** Request-scoped deduplication only — no cross-request caches introduced

---

## Changes Applied

- `lib/auth.ts — getAuthUser wrapped in React cache()`
- `lib/introductions-settings.ts — getIntroductionExpiryFilter + introductionsNeverExpire cached`
- `services/layout-badges.ts — cache key primitives (userId, lastIntroductionsSeenAt)`
- `services/notifications/notification-service.ts — NotificationPreferences + getUnreadNotificationCount cached`

---

## React cache() Registry (Auth-Related)

| Export | File | Args | Cross-request? |
| --- | --- | --- | --- |
| getAuthUser | lib/auth.ts | none | No |
| getCurrentUser | lib/auth.ts | none | No |
| getAdminSettings | services/admin.ts | none | **Yes — 60s module TTL (pre-existing)** |
| getLayoutBadges | services/layout-badges.ts | userId, lastIntroductionsSeenAt | No |
| getIntroductionExpiryFilter | lib/introductions-settings.ts | none | No |
| introductionsNeverExpire | lib/introductions-settings.ts | none | No |
| getNotificationPreferencesCached | notification-service.ts | userId | No (internal) |
| getUnreadNotificationCount | notification-service.ts | userId | No |

---

## Explicitly NOT Used

- `unstable_cache`
- Redis / global user caches
- Middleware changes
- API payload changes

---

## Impossible / Deferred Targets

| Target | Status | Reason |
| --- | --- | --- |
| Zero middleware getUser | Not changed | Required for session refresh — Sprint rules |
| Zero Supabase on API routes | Partial | Trusted headers eliminate route fallback on page SSR |
| UserConnection.findMany dedupe | Deferred | Sprint 3 — home/discoveries feed scope |
| StoryTag.findMany dedupe | Deferred | Sprint 3 — home feed scope |
