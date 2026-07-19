-- Add preferred language for i18n user preference
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "preferred_language" TEXT NOT NULL DEFAULT 'en';

CREATE INDEX IF NOT EXISTS "users_preferred_language_idx" ON "users"("preferred_language");
