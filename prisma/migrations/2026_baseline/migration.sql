-- FriendIntro baseline migration (idempotent)
-- Represents the application schema as of 2026-05-24 before alignment.
-- Safe on databases that already contain data — uses IF NOT EXISTS throughout.
-- Does NOT drop tables, columns, or data.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN CREATE TYPE "StoryStatus" AS ENUM ('draft', 'published', 'expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "MediaType" AS ENUM ('image', 'video');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "InviteMethod" AS ENUM ('email', 'whatsapp', 'sms', 'imessage');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "DiscoveriesVisibility" AS ENUM ('network', 'public');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE "ConversationOrigin" AS ENUM ('story', 'discoveries', 'direct');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Core tables (minimal create — existing installs skip)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  profile_picture TEXT,
  invites_sent INTEGER NOT NULL DEFAULT 0,
  invites_registered INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_introductions_seen_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  media_url TEXT NOT NULL,
  media_type "MediaType" NOT NULL,
  voice_note_url TEXT,
  text TEXT,
  status "StoryStatus" NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  published_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  invited_by UUID NOT NULL,
  invite_token TEXT NOT NULL,
  registered BOOLEAN NOT NULL DEFAULT false,
  registered_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  phone_number TEXT,
  invite_method "InviteMethod" NOT NULL DEFAULT 'email',
  invitation_opened_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS story_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL,
  tagged_user_id UUID,
  tagged_external_email TEXT,
  invitation_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tagged_external_phone TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL,
  receiver_id UUID NOT NULL,
  story_reference UUID,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ,
  conversation_origin "ConversationOrigin",
  discoveries_post_reference UUID
);

CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content TEXT,
  media TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS admin_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  invite_gate_enabled BOOLEAN NOT NULL DEFAULT false,
  required_invites INTEGER NOT NULL DEFAULT 2,
  story_expiry_hours INTEGER NOT NULL DEFAULT 24,
  post_expiry_hours INTEGER NOT NULL DEFAULT 48,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  discoveries_enabled BOOLEAN NOT NULL DEFAULT true,
  discoveries_expiry_hours INTEGER,
  discoveries_public_enabled BOOLEAN NOT NULL DEFAULT false,
  introductions_never_expire BOOLEAN NOT NULL DEFAULT false,
  discoveries_network_depth INTEGER NOT NULL DEFAULT 1,
  enable_introduction_graph BOOLEAN NOT NULL DEFAULT true,
  show_connection_reasons BOOLEAN NOT NULL DEFAULT true,
  allow_first_degree_discovery BOOLEAN NOT NULL DEFAULT true,
  allow_second_degree_discovery BOOLEAN NOT NULL DEFAULT true,
  allow_third_degree_discovery BOOLEAN NOT NULL DEFAULT false,
  allow_fourth_degree_discovery BOOLEAN NOT NULL DEFAULT false,
  max_discovery_depth INTEGER NOT NULL DEFAULT 2,
  show_connection_paths BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS discoveries_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  content TEXT,
  media_url TEXT,
  media_type "MediaType",
  visibility "DiscoveriesVisibility" NOT NULL DEFAULT 'network',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS discoveries_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discoveries_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discoveries_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS discoveries_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  privacy_version TEXT NOT NULL,
  terms_version TEXT NOT NULL,
  cookie_version TEXT,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address TEXT,
  country TEXT
);

CREATE TABLE IF NOT EXISTS conversation_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID NOT NULL,
  user_b_id UUID NOT NULL,
  origin "ConversationOrigin" NOT NULL DEFAULT 'direct',
  story_reference UUID,
  discoveries_post_reference UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Column backfills (legacy manual migrations consolidated)
-- ---------------------------------------------------------------------------
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS invite_method "InviteMethod" NOT NULL DEFAULT 'email';
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS invitation_opened_at TIMESTAMPTZ;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE story_tags ADD COLUMN IF NOT EXISTS tagged_external_phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_introductions_seen_at TIMESTAMPTZ;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS discoveries_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS discoveries_expiry_hours INTEGER;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS discoveries_public_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS introductions_never_expire BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS discoveries_network_depth INTEGER NOT NULL DEFAULT 1;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS enable_introduction_graph BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS show_connection_reasons BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS allow_first_degree_discovery BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS allow_second_degree_discovery BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS allow_third_degree_discovery BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS allow_fourth_degree_discovery BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS max_discovery_depth INTEGER NOT NULL DEFAULT 2;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS show_connection_paths BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS discoveries_post_reference UUID;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS conversation_origin "ConversationOrigin";

-- ---------------------------------------------------------------------------
-- Indexes (IF NOT EXISTS)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users(email);
CREATE INDEX IF NOT EXISTS users_email_idx ON users(email);
CREATE INDEX IF NOT EXISTS stories_user_id_idx ON stories(user_id);
CREATE INDEX IF NOT EXISTS stories_status_idx ON stories(status);
CREATE INDEX IF NOT EXISTS stories_expires_at_idx ON stories(expires_at);
CREATE INDEX IF NOT EXISTS story_tags_story_id_idx ON story_tags(story_id);
CREATE INDEX IF NOT EXISTS story_tags_tagged_user_id_idx ON story_tags(tagged_user_id);
CREATE INDEX IF NOT EXISTS story_tags_tagged_external_email_idx ON story_tags(tagged_external_email);
CREATE INDEX IF NOT EXISTS story_tags_tagged_external_phone_idx ON story_tags(tagged_external_phone);
CREATE UNIQUE INDEX IF NOT EXISTS story_tags_story_id_tagged_user_id_key ON story_tags(story_id, tagged_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS story_tags_story_id_tagged_external_email_key ON story_tags(story_id, tagged_external_email);
CREATE UNIQUE INDEX IF NOT EXISTS story_tags_invitation_id_key ON story_tags(invitation_id);
CREATE INDEX IF NOT EXISTS invitations_email_idx ON invitations(email);
CREATE INDEX IF NOT EXISTS invitations_phone_number_idx ON invitations(phone_number);
CREATE INDEX IF NOT EXISTS invitations_invited_by_idx ON invitations(invited_by);
CREATE UNIQUE INDEX IF NOT EXISTS invitations_invite_token_key ON invitations(invite_token);
CREATE INDEX IF NOT EXISTS invitations_invite_token_idx ON invitations(invite_token);
CREATE INDEX IF NOT EXISTS messages_sender_id_receiver_id_created_at_idx ON messages(sender_id, receiver_id, created_at);
CREATE INDEX IF NOT EXISTS messages_receiver_id_sender_id_created_at_idx ON messages(receiver_id, sender_id, created_at);
CREATE INDEX IF NOT EXISTS messages_story_reference_idx ON messages(story_reference);
CREATE INDEX IF NOT EXISTS messages_discoveries_post_reference_idx ON messages(discoveries_post_reference);
CREATE INDEX IF NOT EXISTS posts_user_id_idx ON posts(user_id);
CREATE INDEX IF NOT EXISTS posts_expires_at_idx ON posts(expires_at);
CREATE INDEX IF NOT EXISTS discoveries_posts_user_id_idx ON discoveries_posts(user_id);
CREATE INDEX IF NOT EXISTS discoveries_posts_visibility_created_at_idx ON discoveries_posts(visibility, created_at DESC);
CREATE INDEX IF NOT EXISTS discoveries_posts_expires_at_idx ON discoveries_posts(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS discoveries_likes_post_id_user_id_key ON discoveries_likes(post_id, user_id);
CREATE INDEX IF NOT EXISTS discoveries_comments_post_id_created_at_idx ON discoveries_comments(post_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS discoveries_bookmarks_post_id_user_id_key ON discoveries_bookmarks(post_id, user_id);
CREATE INDEX IF NOT EXISTS discoveries_shares_post_id_idx ON discoveries_shares(post_id);
CREATE INDEX IF NOT EXISTS user_consents_user_id_idx ON user_consents(user_id);
CREATE INDEX IF NOT EXISTS conversation_contexts_user_a_id_idx ON conversation_contexts(user_a_id);
CREATE INDEX IF NOT EXISTS conversation_contexts_user_b_id_idx ON conversation_contexts(user_b_id);
CREATE UNIQUE INDEX IF NOT EXISTS conversation_contexts_user_a_id_user_b_id_key ON conversation_contexts(user_a_id, user_b_id);

-- Partial unique (legacy) — replaced in database_alignment if safe
CREATE UNIQUE INDEX IF NOT EXISTS story_tags_story_id_tagged_external_phone_key
  ON story_tags(story_id, tagged_external_phone)
  WHERE tagged_external_phone IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Core FKs present in original schema (idempotent)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'stories_user_id_fkey') THEN
    ALTER TABLE stories ADD CONSTRAINT stories_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'invitations_invited_by_fkey') THEN
    ALTER TABLE invitations ADD CONSTRAINT invitations_invited_by_fkey
      FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'story_tags_story_id_fkey') THEN
    ALTER TABLE story_tags ADD CONSTRAINT story_tags_story_id_fkey
      FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'story_tags_tagged_user_id_fkey') THEN
    ALTER TABLE story_tags ADD CONSTRAINT story_tags_tagged_user_id_fkey
      FOREIGN KEY (tagged_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'story_tags_invitation_id_fkey') THEN
    ALTER TABLE story_tags ADD CONSTRAINT story_tags_invitation_id_fkey
      FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_sender_id_fkey') THEN
    ALTER TABLE messages ADD CONSTRAINT messages_sender_id_fkey
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_receiver_id_fkey') THEN
    ALTER TABLE messages ADD CONSTRAINT messages_receiver_id_fkey
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_story_reference_fkey') THEN
    ALTER TABLE messages ADD CONSTRAINT messages_story_reference_fkey
      FOREIGN KEY (story_reference) REFERENCES stories(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'posts_user_id_fkey') THEN
    ALTER TABLE posts ADD CONSTRAINT posts_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Seed admin row if missing
INSERT INTO admin_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
