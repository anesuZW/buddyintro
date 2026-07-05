-- Platform extension migration: phone invites, discoveries, consent

-- Enums
DO $$ BEGIN
  CREATE TYPE "InviteMethod" AS ENUM ('email', 'whatsapp', 'sms', 'imessage');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DiscoveriesVisibility" AS ENUM ('network', 'public');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Invitations: phone + analytics
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS invite_method "InviteMethod" NOT NULL DEFAULT 'email';
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS invitation_opened_at TIMESTAMPTZ;
ALTER TABLE invitations ALTER COLUMN email DROP NOT NULL;

CREATE INDEX IF NOT EXISTS invitations_phone_number_idx ON invitations(phone_number);

-- Story tags: phone
ALTER TABLE story_tags ADD COLUMN IF NOT EXISTS tagged_external_phone TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS story_tags_story_id_tagged_external_phone_key
  ON story_tags(story_id, tagged_external_phone) WHERE tagged_external_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS story_tags_tagged_external_phone_idx ON story_tags(tagged_external_phone);

-- Users: introductions seen
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_introductions_seen_at TIMESTAMPTZ;

-- Admin settings: discoveries
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS discoveries_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS discoveries_expiry_hours INT;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS discoveries_public_enabled BOOLEAN NOT NULL DEFAULT false;

-- Discoveries tables
CREATE TABLE IF NOT EXISTS discoveries_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type "MediaType",
  visibility "DiscoveriesVisibility" NOT NULL DEFAULT 'network',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS discoveries_posts_user_id_idx ON discoveries_posts(user_id);
CREATE INDEX IF NOT EXISTS discoveries_posts_visibility_created_at_idx ON discoveries_posts(visibility, created_at DESC);
CREATE INDEX IF NOT EXISTS discoveries_posts_expires_at_idx ON discoveries_posts(expires_at);

CREATE TABLE IF NOT EXISTS discoveries_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES discoveries_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS discoveries_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES discoveries_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS discoveries_comments_post_id_created_at_idx ON discoveries_comments(post_id, created_at);

CREATE TABLE IF NOT EXISTS discoveries_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES discoveries_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

CREATE TABLE IF NOT EXISTS discoveries_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES discoveries_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS discoveries_shares_post_id_idx ON discoveries_shares(post_id);

-- User consent
CREATE TABLE IF NOT EXISTS user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  privacy_version TEXT NOT NULL,
  terms_version TEXT NOT NULL,
  cookie_version TEXT,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  country TEXT
);
CREATE INDEX IF NOT EXISTS user_consents_user_id_idx ON user_consents(user_id);
