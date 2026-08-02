# Duplicate Query Matrix

**Generated:** 2026-07-26T06:37:26.870Z  
**Scope:** Within single request — static analysis

---

| Query | First execution | Repeated execution | Reason | Caller | Call sites |
| --- | --- | --- | --- | --- | --- |
| AdminSettings.findUnique | First getAdminSettings() in request | Subsequent getAdminSettings() via React cache() — same row | Multiple services read admin flags independently | getAdminSettings (cache dedupes within request) | 15 |
| User.findUnique | getCurrentUser in layout requireUser | requireUser/getCurrentUser in page (cache dedupes) | Layout + page both call requireUser | lib/auth.ts cache() | 2 |
| StoryTag.findMany | getHomeStoryContext (4 variants) | getStoryBarForViewer + getMutualTagFeed may rescan tags | Overlapping home feed loaders | services/home-dashboard.ts, services/stories.ts, services/feed.ts | 6 |
| Notification.count | getLayoutBadges → getUnreadNotificationCount | Notifications page / API may recount | Badge + inbox use separate code paths | services/layout-badges.ts | 2 |
| Message.count | getLayoutBadges unread badge | Messages API list may load messages differently | Count vs full findMany for inbox | services/layout-badges.ts vs services/messages.ts | 2 |

---

## Auth / Settings Duplication Summary

{
  "perAuthenticatedRequest": {
    "middleware": "Supabase getUser via middleware (x-auth-profile-middleware-ms header)",
    "layout": "requireUser → getCurrentUser → getAuthUser + User.findUnique (1× cached)",
    "page": "requireUser again (cache hit) or getCurrentUser in API routes",
    "estimatedUserFindUnique": "1 effective (React cache)",
    "estimatedSupabaseGetUser": "1–2 (middleware + fallback if headers missing)",
    "estimatedAdminSettings": "1 effective (React cache)",
    "estimatedNotificationPreferences": "0 on most pages; 1 on /profile"
  },
  "note": "AUTH_PROFILE=1 logs [AUTH-PROFILE] lines with getCurrentUser, prismaUserLookup, supabaseGetUser"
}
