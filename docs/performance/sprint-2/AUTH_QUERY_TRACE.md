# Authentication Query Trace

**Sprint:** 2 — Authentication & Shared Request Optimization  
**Generated:** 2026-07-26T15:46:50.801Z  
**Checkpoint:** `checkpoint/sprint-2-auth-start` @ 87edda0

---

## Call Graph (Authenticated Page Request)

```
middleware.ts
  └─ updateSession (lib/supabase/middleware.ts)
       └─ supabase.auth.getUser()  [1× per request — unavoidable]
       └─ setTrustedAuthHeaders → x-auth-user-* headers

app/[locale]/(main)/layout.tsx
  └─ requireUser()
       └─ getCurrentUser() [React cache — 1× DB User.findUnique]
            └─ getAuthUser() [React cache — 0× Supabase if headers trusted]
                 └─ getAuthUserFromTrustedHeaders() OR supabase.auth.getUser()

TopBarWithBadges / BottomNavWithBadge (parallel Suspense)
  └─ getLayoutBadges(userId, lastIntroductionsSeenAt) [React cache — 1×]
       ├─ getIntroductionExpiryFilter() [React cache]
       │    └─ getAdminSettings() [React cache + 60s module TTL]
       ├─ prisma.story.count (intro badge)
       ├─ prisma.message.count (unread messages)
       └─ getUnreadNotificationCount(userId) [React cache]
            └─ notificationService.unreadCount
                 └─ getNotificationPreferencesCached(userId) [React cache]
                 └─ prisma.notification.count

Page-specific (examples)
  /discoveries → getAdminSettings (cache hit), getDiscoveriesFeed, trust bulk loaders
  /profile → notificationService.getPreferences → getNotificationPreferencesCached (cache hit)
  /messages → client → GET /api/messages → getCurrentUser (cache hit)
```

---

## Query Inventory

| Query | Component | Per request (before) | Per request (after) | Mechanism |
| --- | --- | --- | --- | --- |
| User.findUnique | getCurrentUser | 1 | 1 | React cache() — already present; preserved |
| AdminSettings.findUnique | getAdminSettings | 1 | 1 | React cache() + 60s TTL — pre-existing |
| NotificationPreferences.findUnique | notification-service | 0–2 | 1 | getNotificationPreferencesCached — **new** |
| Supabase getUser (route) | getAuthUser fallback | 1–2 | 0–1 | Trusted headers from middleware; getAuthUser cached — **new** |
| Notification.count | layout badges | 1 | 1 | getUnreadNotificationCount cached |
| Message.count | layout badges | 1 | 1 | inside getLayoutBadges (single invocation) |
| Story.count | layout badges | 1 | 1 | inside getLayoutBadges (single invocation) |

---

## Session / Permission Checks

| Check | Location | DB? |
| --- | --- | --- |
| Session validation | middleware `updateSession` | Supabase only |
| Role sync | `syncLegacyAdminRole` in getCurrentUser | Conditional write |
| RBAC permissions | `hasPermission` | Cached 60s in-memory Map |
| Admin gate | `requireAdmin` | Uses cached user + permission cache |

**Middleware audit:** No middleware changes made. Middleware performs exactly one `getUser()` per request; route handlers reuse trusted headers via `getAuthUserFromTrustedHeaders()`.
