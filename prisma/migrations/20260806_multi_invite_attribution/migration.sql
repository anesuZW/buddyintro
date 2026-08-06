-- Additive multi-invite attribution columns (backwards compatible).
-- Does not delete or rewrite historical invitation rows.

ALTER TABLE "invitations"
  ADD COLUMN IF NOT EXISTS "last_opened_at" TIMESTAMPTZ;

ALTER TABLE "invitations"
  ADD COLUMN IF NOT EXISTS "activated_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "invitations_registered_user_id_idx"
  ON "invitations" ("registered_user_id");
