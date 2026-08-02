-- ============================================================
-- BuddyIntro — SAFE_MIGRATION.sql
-- Generated: 2026-08-02 (READ-ONLY audit)
-- ============================================================
--
-- IMPORTANT
-- --------
-- Against the database audited via DATABASE_URL
-- (project drzpgydqpryrwobtqbkg / aws-1-us-east-1 pooler):
--
--   prisma migrate diff --from-url <DATABASE_URL> \
--     --to-schema-datamodel prisma/schema.prisma --script
--
-- returned:
--
--   -- This is an empty migration.
--
-- Therefore NO statements are required for that database.
-- users.preferred_language and users_preferred_language_idx
-- already exist; migration 0009_i18n is recorded applied.
--
-- This file is NOT executed by the audit.
-- No DROP / DELETE / TRUNCATE / RESET statements are included.
--
-- ============================================================
-- CONTINGENCY (idempotent) — only if a DIFFERENT database is
-- proven to lack preferred_language (e.g. VPS points elsewhere).
-- Safe to re-run: IF NOT EXISTS → no-op when already present.
-- ============================================================

-- From prisma/migrations/0009_i18n/migration.sql
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferred_language" TEXT NOT NULL DEFAULT 'en';

CREATE INDEX IF NOT EXISTS "users_preferred_language_idx" ON "users"("preferred_language");

-- End of required contingency for the reported P2022 symptom.
-- Further schema objects for this project are already present
-- on the audited database (empty prisma migrate diff).
