-- Trust relationship graph: shared introducers, categories, verification, trust scores
-- Idempotent — safe on live data

DO $$ BEGIN
  CREATE TYPE "IntroductionVisibilityMode" AS ENUM ('all_mutual', 'same_category');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- User verification
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN NOT NULL DEFAULT false;

-- Introduction categories
CREATE TABLE IF NOT EXISTS introduction_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name)
);
CREATE INDEX IF NOT EXISTS introduction_categories_is_active_idx ON introduction_categories(is_active);

-- Story / discoveries category + visibility
ALTER TABLE stories ADD COLUMN IF NOT EXISTS introduction_category_id UUID REFERENCES introduction_categories(id) ON DELETE SET NULL;
ALTER TABLE stories ADD COLUMN IF NOT EXISTS visibility_mode "IntroductionVisibilityMode" NOT NULL DEFAULT 'all_mutual';
CREATE INDEX IF NOT EXISTS stories_introduction_category_id_idx ON stories(introduction_category_id);

ALTER TABLE discoveries_posts ADD COLUMN IF NOT EXISTS introduction_category_id UUID REFERENCES introduction_categories(id) ON DELETE SET NULL;
ALTER TABLE discoveries_posts ADD COLUMN IF NOT EXISTS visibility_mode "IntroductionVisibilityMode" NOT NULL DEFAULT 'all_mutual';

-- Shared introducer relationships
CREATE TABLE IF NOT EXISTS shared_introducer_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shared_introducer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_introduction_story_id UUID REFERENCES stories(id) ON DELETE SET NULL,
  second_introduction_story_id UUID REFERENCES stories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_a_id, user_b_id, shared_introducer_id)
);
CREATE INDEX IF NOT EXISTS shared_introducer_relationships_user_pair_idx
  ON shared_introducer_relationships(user_a_id, user_b_id);
CREATE INDEX IF NOT EXISTS shared_introducer_relationships_introducer_idx
  ON shared_introducer_relationships(shared_introducer_id);

-- UserConnection trust materialization
ALTER TABLE user_connections ADD COLUMN IF NOT EXISTS shared_introducer_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_connections ADD COLUMN IF NOT EXISTS trust_score INTEGER NOT NULL DEFAULT 10;
ALTER TABLE user_connections ADD COLUMN IF NOT EXISTS highest_trust_path BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS user_connections_source_shared_count_idx
  ON user_connections(source_user_id, shared_introducer_count);
CREATE INDEX IF NOT EXISTS user_connections_source_trust_score_idx
  ON user_connections(source_user_id, trust_score);

-- Admin settings
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS enable_trust_scores BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS enable_verification_layer BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS enable_introduction_categories BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS allow_user_created_categories BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS allow_category_editing BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS require_phone_verification BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS require_identity_verification BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS show_trust_scores BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS show_shared_introducers BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS enable_shared_introducer_trust BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS show_shared_introducer_counts BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS shared_introducer_weight INTEGER NOT NULL DEFAULT 70;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS minimum_shared_introducers_for_messaging INTEGER NOT NULL DEFAULT 0;
ALTER TABLE admin_settings ADD COLUMN IF NOT EXISTS minimum_shared_introducers_for_discovery INTEGER NOT NULL DEFAULT 0;

-- Seed system introduction categories
INSERT INTO introduction_categories (name, description, icon, color, is_system, is_active)
VALUES
  ('Friend', 'Close friends and companions', 'users', '#2563EB', true, true),
  ('Family', 'Relatives and family members', 'heart', '#EC4899', true, true),
  ('Church', 'Faith community connections', 'church', '#8B5CF6', true, true),
  ('Business', 'Professional and business contacts', 'briefcase', '#0EA5E9', true, true),
  ('Mentorship', 'Mentors and mentees', 'graduation-cap', '#14B8A6', true, true),
  ('Neighbour', 'Neighbours and local community', 'home', '#F59E0B', true, true),
  ('School', 'School friends and classmates', 'book-open', '#6366F1', true, true),
  ('University', 'University and alumni network', 'landmark', '#7C3AED', true, true),
  ('Sports', 'Teammates and sports community', 'trophy', '#22C55E', true, true),
  ('Community', 'Community groups and clubs', 'users-round', '#06B6D4', true, true),
  ('Entrepreneur', 'Founders and startup circles', 'rocket', '#F97316', true, true),
  ('Professional', 'Colleagues and industry peers', 'building-2', '#64748B', true, true),
  ('Creative', 'Artists and creative collaborators', 'palette', '#D946EF', true, true),
  ('Volunteer', 'Volunteer and service connections', 'hand-heart', '#10B981', true, true),
  ('Dating', 'Romantic introductions', 'sparkles', '#FB7185', true, true)
ON CONFLICT (name) DO NOTHING;
