# NotificationPreferences Race Fix

Generated: 2026-06-23

---

## Problem

`getOrCreatePreferences()` used `upsert({ update: {} })` on **every read**:

- Writes `updated_at` on each GET (preferences page, every notification delivery).
- Under concurrent first access (signup + notification + profile load), two `upsert` create branches could race before Postgres unique index on `user_id` settled.

Related: `POST /api/auth/bootstrap` used check-then-create for `User` without handling concurrent duplicate signup.

---

## Upsert call sites (before fix)

| File | Line | Function | Concurrent paths |
| ---- | ---- | -------- | ---------------- |
| `services/notifications/notification-service.ts` | 25 | `getOrCreatePreferences` | `shouldDeliver` on every notification; `getPreferences` on profile SSR + API GET |
| `services/notifications/notification-service.ts` | 230 | `updatePreferences` | PATCH `/api/notifications/preferences` |
| `scripts/profile-api-routes.ts` | 185 | profiling only | N/A |

---

## Fix applied

### `getOrCreatePreferences` — read-first, create-once

```typescript
const existing = await prisma.notificationPreferences.findUnique({ where: { userId } });
if (existing) return existing;
try {
  return await prisma.notificationPreferences.create({ data: { userId } });
} catch (error) {
  if (isPrismaUniqueViolation(error)) {
    return prisma.notificationPreferences.findUniqueOrThrow({ where: { userId } });
  }
  throw error;
}
```

- **No write on read** when row exists.
- Concurrent creates: one wins, loser catches `P2002` and re-reads.

### `updatePreferences` — update or create with same pattern

Avoids redundant upsert write amplification; handles concurrent first PATCH + notification create.

### `POST /api/auth/bootstrap` — user create race

Wraps `prisma.user.create` in try/catch for `P2002` (duplicate Supabase id from parallel bootstrap tabs).

### Helper

`lib/prisma-errors.ts` — `isPrismaUniqueViolation()` for `P2002`.

---

## Files changed

- `services/notifications/notification-service.ts`
- `app/api/auth/bootstrap/route.ts`
- `lib/prisma-errors.ts` (new)

---

## Verification

- Schema: `notification_preferences.user_id` is `@unique` — required for safe create-or-read pattern.
- Existing tests: `tests/notifications.test.ts` (run with `npm test`).

---

## Launch impact

**Fixed** — eliminates duplicate-key 500s on first notification/preferences access during concurrent signup for first 100 users.
