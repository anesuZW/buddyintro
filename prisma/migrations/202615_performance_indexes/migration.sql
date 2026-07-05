-- Performance indexes for hot query paths (visibility, category, media lookup)
-- Idempotent — safe on live data

CREATE INDEX IF NOT EXISTS stories_user_id_status_idx
  ON stories(user_id, status);

CREATE INDEX IF NOT EXISTS stories_status_category_idx
  ON stories(status, introduction_category_id)
  WHERE introduction_category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS story_tags_tagged_user_id_idx
  ON story_tags(tagged_user_id)
  WHERE tagged_user_id IS NOT NULL;
