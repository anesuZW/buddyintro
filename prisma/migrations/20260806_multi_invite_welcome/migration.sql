-- Additive: one-time multi-invite welcome card eligibility flag.
-- Default false — existing users never see the card; set only on first
-- association of 2+ invitations at signup/activation.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "multi_invite_welcome_pending" BOOLEAN NOT NULL DEFAULT false;
