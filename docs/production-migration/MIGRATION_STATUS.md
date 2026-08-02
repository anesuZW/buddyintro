# MIGRATION_STATUS — `_prisma_migrations` vs repo

**Audit time:** 2026-08-02T11:52:12.553Z  
**Mode:** READ ONLY

## History table

| Check | Result |
|-------|--------|
| `public._prisma_migrations` exists | **Yes** |
| Failed / rolled-back rows | **None** |
| Partially applied (unfinished) | **None** |

## Repo migrations vs recorded

| Migration | File in repo | Recorded finished_at | applied_steps_count | Object hint |
|-----------|--------------|----------------------|---------------------|-------------|
| 0001_baseline | Yes | 2026-07-31T14:20:36.441Z | 0 | — |
| 0002_discoveries | Yes | 2026-07-31T14:20:50.669Z | 0 | — |
| 0003_trust_graph | Yes | 2026-07-31T14:21:05.521Z | 0 | — |
| 0004_notifications | Yes | 2026-07-31T14:21:20.261Z | 0 | — |
| 0005_moderation | Yes | 2026-07-31T14:21:34.905Z | 0 | — |
| 0006_platform | Yes | 2026-07-31T14:21:49.451Z | 0 | — |
| 0007_security_rbac | Yes | 2026-07-31T14:22:07.058Z | 0 | — |
| 0008_media_platform | Yes | 2026-07-31T14:22:24.677Z | 1 | `media_objects` present |
| 0009_i18n | Yes | 2026-07-31T14:22:26.811Z | 1 | `preferred_language` present |
| 0010_pwa_push | Yes | 2026-07-31T14:22:29.585Z | 1 | push columns present |
| 0011_message_unread_index | Yes | 2026-07-31T14:22:31.837Z | 1 | index present |
| 0012_push_updated_at_no_default | Yes | 2026-07-31T14:31:12.945Z | 1 | `updated_at` has no default |

All **12** repo migrations are recorded as finished. None missing from history.

## Notes on `applied_steps_count = 0` (0001–0007)

Those rows were likely marked applied via baseline / `migrate resolve` (steps not executed by Prisma at mark time). Live tables for those domains **exist**, and `prisma migrate diff` against `schema.prisma` is **empty**, so the physical schema matches the datamodel despite step counts of 0.

## Pending migrations

**None** for the audited database.

## Failed migrations

**None** (`rolled_back_at` null for all rows; no unfinished `finished_at`).

## Relation to `0009_i18n`

Migration that adds `users.preferred_language`:

```sql
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferred_language" TEXT NOT NULL DEFAULT 'en';
CREATE INDEX IF NOT EXISTS "users_preferred_language_idx" ON "users"("preferred_language");
```

**Status on audited DB:** applied 2026-07-31T14:22:26.811Z; column + index verified present.
