-- Introduction graph admin settings, conversation context, message origin fields

DO $$ BEGIN
  CREATE TYPE conversation_origin AS ENUM ('story', 'discoveries', 'direct');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE admin_settings
ADD COLUMN IF NOT EXISTS discoveries_network_depth INT NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS show_connection_reasons BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS enable_introduction_graph BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS discoveries_post_reference UUID REFERENCES discoveries_posts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS conversation_origin conversation_origin;

CREATE INDEX IF NOT EXISTS messages_discoveries_post_reference_idx
ON messages(discoveries_post_reference);

CREATE TABLE IF NOT EXISTS conversation_contexts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  origin conversation_origin NOT NULL DEFAULT 'direct',
  story_reference UUID REFERENCES stories(id) ON DELETE SET NULL,
  discoveries_post_reference UUID REFERENCES discoveries_posts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_a_id, user_b_id)
);

CREATE INDEX IF NOT EXISTS conversation_contexts_user_a_idx ON conversation_contexts(user_a_id);
CREATE INDEX IF NOT EXISTS conversation_contexts_user_b_idx ON conversation_contexts(user_b_id);
