-- Trust network: verification levels, discovery controls, job queue, trust rankings
-- Idempotent — safe on live data

DO $$ BEGIN
  CREATE TYPE "VerificationLevel" AS ENUM ('none', 'phone', 'email', 'identity', 'trusted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "BackgroundJobStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'dead');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TrustRankTier" AS ENUM ('bronze', 'silver', 'gold', 'platinum', 'diamond');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_level "VerificationLevel" NOT NULL DEFAULT 'none';
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS trusted_user BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS users_verification_level_idx ON users(verification_level);
CREATE INDEX IF NOT EXISTS users_trusted_user_idx ON users(trusted_user);

ALTER TABLE user_connections ADD COLUMN IF NOT EXISTS trust_rank INT NOT NULL DEFAULT 0;
ALTER TABLE user_connections ADD COLUMN IF NOT EXISTS trust_rank_tier "TrustRankTier" NOT NULL DEFAULT 'bronze';
CREATE INDEX IF NOT EXISTS user_connections_trust_rank_idx ON user_connections(trust_rank);

ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS enable_discovery_controls BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS enable_granular_verification_gates BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS enable_background_jobs BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS enable_trust_rankings BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS enable_trust_recommendations BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS allow_cross_category_discovery BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS allow_discovery_messaging BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS require_shared_introducer_for_discovery BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS require_shared_introducer_for_messaging BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS hide_discovery_from_unverified_users BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS require_email_verification BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS messaging_require_phone BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS messaging_require_email BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS messaging_require_identity BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS discoveries_require_phone BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS discoveries_require_email BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS discoveries_require_identity BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS introductions_require_phone BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS introductions_require_email BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS introductions_require_identity BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue TEXT NOT NULL,
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status "BackgroundJobStatus" NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 3,
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS background_jobs_status_run_at_idx ON background_jobs(status, run_at);
CREATE INDEX IF NOT EXISTS background_jobs_queue_status_idx ON background_jobs(queue, status);
CREATE INDEX IF NOT EXISTS background_jobs_job_type_created_idx ON background_jobs(job_type, created_at);

-- Backfill verification_level from existing booleans
UPDATE users SET verification_level = 'trusted'
WHERE trusted_user = true AND verification_level = 'none';

UPDATE users SET verification_level = 'identity'
WHERE identity_verified = true AND verification_level IN ('none', 'phone', 'email');

UPDATE users SET verification_level = 'email'
WHERE email_verified = true AND verification_level IN ('none', 'phone');

UPDATE users SET verification_level = 'phone'
WHERE phone_verified = true AND verification_level = 'none';
