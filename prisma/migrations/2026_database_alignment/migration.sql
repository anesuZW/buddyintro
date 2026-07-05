-- FriendIntro database alignment migration (idempotent)
-- Fixes Prisma vs PostgreSQL drift identified in database-audit.md
-- Safe for live data: no DROP TABLE, no DELETE, no TRUNCATE
--
-- PRE-FLIGHT: Run npm run orphan-check or reports/orphan-report.sql
-- Foreign keys are added only when orphan_total = 0 (see PART 4).

-- ---------------------------------------------------------------------------
-- PART 1: Admin settings default alignment
-- ---------------------------------------------------------------------------
ALTER TABLE admin_settings
  ALTER COLUMN discoveries_network_depth SET DEFAULT 2;

-- ---------------------------------------------------------------------------
-- PART 2: story_tags unique constraint (partial -> full, Prisma-aligned)
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS story_tags_story_id_tagged_external_phone_key;

CREATE UNIQUE INDEX IF NOT EXISTS story_tags_story_id_tagged_external_phone_key
  ON story_tags (story_id, tagged_external_phone);

-- ---------------------------------------------------------------------------
-- PART 3: user_connections materialized introduction graph
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_user_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  degree INTEGER NOT NULL,
  introduced_via_story_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_connections_degree_check CHECK (degree >= 1 AND degree <= 4)
);

CREATE INDEX IF NOT EXISTS user_connections_source_user_id_idx
  ON user_connections (source_user_id);

CREATE INDEX IF NOT EXISTS user_connections_target_user_id_idx
  ON user_connections (target_user_id);

CREATE INDEX IF NOT EXISTS user_connections_degree_idx
  ON user_connections (degree);

CREATE UNIQUE INDEX IF NOT EXISTS user_connections_source_user_id_target_user_id_key
  ON user_connections (source_user_id, target_user_id);

CREATE INDEX IF NOT EXISTS user_connections_source_degree_idx
  ON user_connections (source_user_id, degree);

-- ---------------------------------------------------------------------------
-- PART 4: Foreign key repair (orphan-safe — skips if any orphan rows exist)
-- Pre-flight: npm run orphan-check  |  reports/orphan-report.sql
-- Cleanup reference: scripts/fix-orphans.sql (manual review only)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  orphan_total bigint;
BEGIN
  SELECT (
    (SELECT COUNT(*) FROM messages m
      WHERE m.discoveries_post_reference IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = m.discoveries_post_reference))
    + (SELECT COUNT(*) FROM conversation_contexts c
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.user_a_id))
    + (SELECT COUNT(*) FROM conversation_contexts c
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.user_b_id))
    + (SELECT COUNT(*) FROM conversation_contexts c
        WHERE c.story_reference IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM stories s WHERE s.id = c.story_reference))
    + (SELECT COUNT(*) FROM conversation_contexts c
        WHERE c.discoveries_post_reference IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = c.discoveries_post_reference))
    + (SELECT COUNT(*) FROM discoveries_posts dp
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = dp.user_id))
    + (SELECT COUNT(*) FROM discoveries_likes dl
        WHERE NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = dl.post_id))
    + (SELECT COUNT(*) FROM discoveries_likes dl
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = dl.user_id))
    + (SELECT COUNT(*) FROM discoveries_comments dc
        WHERE NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = dc.post_id))
    + (SELECT COUNT(*) FROM discoveries_comments dc
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = dc.user_id))
    + (SELECT COUNT(*) FROM discoveries_bookmarks db
        WHERE NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = db.post_id))
    + (SELECT COUNT(*) FROM discoveries_bookmarks db
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = db.user_id))
    + (SELECT COUNT(*) FROM discoveries_shares ds
        WHERE NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = ds.post_id))
    + (SELECT COUNT(*) FROM discoveries_shares ds
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ds.user_id))
    + (SELECT COUNT(*) FROM user_consents uc
        WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = uc.user_id))
  ) INTO orphan_total;

  IF orphan_total > 0 THEN
    RAISE NOTICE 'FriendIntro: skipping foreign key repair — % orphan row(s). Run npm run orphan-check and review scripts/fix-orphans.sql before re-applying.', orphan_total;
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_discoveries_post_reference_fkey') THEN
    ALTER TABLE messages ADD CONSTRAINT messages_discoveries_post_reference_fkey
      FOREIGN KEY (discoveries_post_reference) REFERENCES discoveries_posts(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversation_contexts_user_a_id_fkey') THEN
    ALTER TABLE conversation_contexts ADD CONSTRAINT conversation_contexts_user_a_id_fkey
      FOREIGN KEY (user_a_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversation_contexts_user_b_id_fkey') THEN
    ALTER TABLE conversation_contexts ADD CONSTRAINT conversation_contexts_user_b_id_fkey
      FOREIGN KEY (user_b_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversation_contexts_story_reference_fkey') THEN
    ALTER TABLE conversation_contexts ADD CONSTRAINT conversation_contexts_story_reference_fkey
      FOREIGN KEY (story_reference) REFERENCES stories(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'conversation_contexts_discoveries_post_reference_fkey') THEN
    ALTER TABLE conversation_contexts ADD CONSTRAINT conversation_contexts_discoveries_post_reference_fkey
      FOREIGN KEY (discoveries_post_reference) REFERENCES discoveries_posts(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discoveries_posts_user_id_fkey') THEN
    ALTER TABLE discoveries_posts ADD CONSTRAINT discoveries_posts_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discoveries_likes_post_id_fkey') THEN
    ALTER TABLE discoveries_likes ADD CONSTRAINT discoveries_likes_post_id_fkey
      FOREIGN KEY (post_id) REFERENCES discoveries_posts(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discoveries_likes_user_id_fkey') THEN
    ALTER TABLE discoveries_likes ADD CONSTRAINT discoveries_likes_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discoveries_comments_post_id_fkey') THEN
    ALTER TABLE discoveries_comments ADD CONSTRAINT discoveries_comments_post_id_fkey
      FOREIGN KEY (post_id) REFERENCES discoveries_posts(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discoveries_comments_user_id_fkey') THEN
    ALTER TABLE discoveries_comments ADD CONSTRAINT discoveries_comments_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discoveries_bookmarks_post_id_fkey') THEN
    ALTER TABLE discoveries_bookmarks ADD CONSTRAINT discoveries_bookmarks_post_id_fkey
      FOREIGN KEY (post_id) REFERENCES discoveries_posts(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discoveries_bookmarks_user_id_fkey') THEN
    ALTER TABLE discoveries_bookmarks ADD CONSTRAINT discoveries_bookmarks_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discoveries_shares_post_id_fkey') THEN
    ALTER TABLE discoveries_shares ADD CONSTRAINT discoveries_shares_post_id_fkey
      FOREIGN KEY (post_id) REFERENCES discoveries_posts(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'discoveries_shares_user_id_fkey') THEN
    ALTER TABLE discoveries_shares ADD CONSTRAINT discoveries_shares_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_consents_user_id_fkey') THEN
    ALTER TABLE user_consents ADD CONSTRAINT user_consents_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_connections_source_user_id_fkey') THEN
    ALTER TABLE user_connections ADD CONSTRAINT user_connections_source_user_id_fkey
      FOREIGN KEY (source_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_connections_target_user_id_fkey') THEN
    ALTER TABLE user_connections ADD CONSTRAINT user_connections_target_user_id_fkey
      FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_connections_introduced_via_story_id_fkey') THEN
    ALTER TABLE user_connections ADD CONSTRAINT user_connections_introduced_via_story_id_fkey
      FOREIGN KEY (introduced_via_story_id) REFERENCES stories(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  RAISE NOTICE 'FriendIntro: foreign key repair applied (orphan_total = 0).';
END $$;
