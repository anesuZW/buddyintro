-- Stability indexes for hot query paths
-- Idempotent — safe on live data

CREATE INDEX IF NOT EXISTS story_tags_tagged_user_story_idx
  ON story_tags(tagged_user_id, story_id);

CREATE INDEX IF NOT EXISTS stories_status_created_at_idx
  ON stories(status, created_at DESC);

CREATE INDEX IF NOT EXISTS messages_receiver_unread_idx
  ON messages(receiver_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS discoveries_posts_user_created_idx
  ON discoveries_posts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS analytics_events_user_created_idx
  ON analytics_events(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
