# SAFETY_REPORT — Can production be upgraded with additive SQL only?

**Audit time:** 2026-08-02  
**Constraint:** No DROP / DELETE / TRUNCATE / RESET / migrate reset.

## Verdict

# SAFE TO APPLY

## Why (database evidence)

1. **`prisma migrate diff` is empty**  
   Live DB (`DATABASE_URL` → Supabase project `drzpgydqpryrwobtqbkg`) already matches `prisma/schema.prisma`. No additive or destructive changes are required for that database.

2. **`0009_i18n` already applied**  
   `_prisma_migrations` records finished `0009_i18n`. Live column `users.preferred_language` exists with default `'en'`. Index `users_preferred_language_idx` exists. `SELECT preferred_language FROM users LIMIT 0` succeeds.

3. **No failed / partial migrations**  
   All 12 migrations finished; none rolled back.

4. **Contingency SQL is additive only**  
   `SAFE_MIGRATION.sql` contains only `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and comments. No DROP/DELETE/RESET. Safe if re-run against an already-synced DB (no-op).

## What “SAFE TO APPLY” does **not** mean

- It does **not** prove the VPS process uses this same `DATABASE_URL`.  
  If production still errors with missing `preferred_language`, verify the **server** env host/project matches `aws-1-us-east-1.pooler.supabase.com` / `drzpgydqpryrwobtqbkg` before assuming more SQL is needed.

- It does **not** authorize running `SAFE_MIGRATION.sql` in this phase — this phase is READ ONLY. The file is generated for a later ops step only.

## Destructive-risk scan of repo migrations

| Migration | DROP / DELETE / TRUNCATE in file |
|-----------|----------------------------------|
| 0001–0011 | None (audit scan) |
| 0012 | `ALTER … DROP DEFAULT` only (already applied; not in contingency file) |

## Upgrade path (for a later phase — not executed now)

If and only if a **different** database is confirmed missing objects:

1. Apply `SAFE_MIGRATION.sql` (additive, idempotent).  
2. Or run `npx prisma migrate deploy` against that DB (not done here).  
3. Re-run `prisma migrate diff` until empty.

Against the **audited** database: **no upgrade SQL is necessary.**
