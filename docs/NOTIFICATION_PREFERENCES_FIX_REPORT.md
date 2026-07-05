# Notification Preferences Race Condition Fix Report

Generated: 2026-06-23

## Problem

**P2002** — `Unique constraint failed on NotificationPreferences(user_id)` during concurrent story creation and notification delivery when multiple requests attempted to create preferences for the same user simultaneously.

## Root cause

Unsafe upsert-on-read pattern: concurrent `create` calls without idempotent retry allowed duplicate insert attempts against the unique `userId` index.

## Fix implemented

`services/notifications/notification-service.ts`:

1. **`getOrCreatePreferences`** — find → create → on `P2002`, re-fetch existing row (`findUniqueOrThrow`)
2. **`updatePreferences`** — find → update OR create → on `P2002`, update existing row
3. Uses shared **`isPrismaUniqueViolation()`** helper from `lib/prisma-errors.ts`

This pattern is idempotent: concurrent callers converge on a single row without surfacing errors to callers.

## All creation paths audited

| Path | File | Pattern |
| ---- | ---- | ------- |
| Notification delivery | `notification-service.ts` → `getOrCreatePreferences` | Fixed (find/create/retry) |
| Preference update API | `notification-service.ts` → `updatePreferences` | Fixed (find/create/retry) |
| Profile page SSR | `app/(main)/profile/page.tsx` | Reads via service (safe) |

No other direct `notificationPreferences.create` calls found in application code.

## Validation — 100 parallel requests

Script: `npm run test:notification-prefs-concurrency`

Result (`docs/.notification-prefs-concurrency.json`):

```json
{
  "parallel": 100,
  "failures": 0,
  "pass": true
}
```

Two waves of 100 concurrent creates each — **0 failures**, exactly **1 row** per user after each wave.

## Status

**PASS** — Race condition resolved; concurrent notification flows are safe.
