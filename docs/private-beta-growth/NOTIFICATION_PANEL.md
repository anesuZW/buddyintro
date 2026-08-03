# Notification Panel Polish

## Scope

Spacing / alignment only — no redesign of navigation or notification types.

## Changes

### Dropdown (`NotificationBell.tsx`)

- Anchor `top-full mt-2` under the bell (was `top-11`)
- `max-w-[min(20rem,calc(100vw-1.5rem))]` to avoid edge clipping
- Avatar / title / unread dot aligned on a shared row
- Clearer empty state copy
- Slightly larger unread badge

### Top bar (`TopBar.tsx`)

- `pt-[env(safe-area-inset-top)]` for notched PWAs
- `gap-2` between icon actions (was `gap-1`)
- Message badge alignment matched to notification badge

### Full page (`NotificationsPageClient.tsx`)

- Filter chip padding / spacing
- Card rows: avatar column, title + unread dot, timestamp, larger action labels
- Empty state card when list is empty

## Non-goals

- No new notification types  
- No algorithm / preference changes  
