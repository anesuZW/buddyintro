# Auth Optimization Report

**Sprint:** 2  
**Generated:** 2026-07-26T15:46:50.801Z

---

## Summary

Sprint 2 reduced **duplicate authentication and shared layout work** within a single request using React `cache()` only. No behaviour, UI, authorization, or API changes.

---

## What Changed

1. **getAuthUser** — request-scoped cache prevents duplicate Supabase `getUser()` when trusted headers are absent (API routes, profiler).
2. **getLayoutBadges** — cache key changed from `user` object to `(userId, lastIntroductionsSeenAt)` primitives so TopBar + BottomNav always share one badge query batch.
3. **NotificationPreferences** — `getNotificationPreferencesCached` dedupes findUnique/create across preferences UI and unread count logic.
4. **getUnreadNotificationCount** — exported helper cached per userId per request.
5. **getIntroductionExpiryFilter / introductionsNeverExpire** — cached to avoid redundant async evaluation (AdminSettings already deduped at DB layer).

---

## Queries Consolidated

| Query | Before (effective) | After | Saved per request |
| --- | --- | --- | --- |
| User.findUnique | 1 | 1 | 0 |
| AdminSettings.findUnique | 1 | 1 | 0 |
| NotificationPreferences.findUnique | 0–2 | 1 | 0–1 |
| Supabase getUser (route-level) | 0–1 extra | 0 | 0–1 |
| Layout badge batch | 1–2 | 1 | 0–1 |
| Notification.count (duplicate paths) | 1–2 | 1 | 0–1 |

---

## Remaining Duplicate Work

- Middleware `getUser()` + potential route fallback on API routes without trusted-header propagation
- Per-author `User.findUnique` in trust-profile bulk loaders (discoveries — Sprint 4)
- StoryTag / home feed overlapping scans (Sprint 3)

---

## Sprint 3 Recommendation

Focus on **home feed query folding** (`getHomeStoryContext`, `StoryTag.findMany`, trust recommendations) — largest non-auth query multiplication on `/home`.
