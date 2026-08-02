-- Speed up unread message badge: WHERE receiver_id = ? AND read_at IS NULL
CREATE INDEX IF NOT EXISTS "messages_receiver_id_read_at_idx" ON "messages"("receiver_id", "read_at");
