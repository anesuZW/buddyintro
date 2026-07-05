-- Orphan pre-flight checks before adding foreign keys
-- Run: psql $DIRECT_URL -f scripts/check-orphans.sql
-- Or:  npx tsx scripts/run-orphan-check.ts
--
-- Each query should return 0. Do NOT add FKs until all counts are zero.

\echo '=== messages.discoveries_post_reference -> discoveries_posts ==='
SELECT COUNT(*) AS orphan_count FROM messages m
WHERE m.discoveries_post_reference IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = m.discoveries_post_reference);

\echo '=== conversation_contexts.user_a_id -> users ==='
SELECT COUNT(*) AS orphan_count FROM conversation_contexts c
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.user_a_id);

\echo '=== conversation_contexts.user_b_id -> users ==='
SELECT COUNT(*) AS orphan_count FROM conversation_contexts c
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.user_b_id);

\echo '=== conversation_contexts.story_reference -> stories ==='
SELECT COUNT(*) AS orphan_count FROM conversation_contexts c
WHERE c.story_reference IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM stories s WHERE s.id = c.story_reference);

\echo '=== conversation_contexts.discoveries_post_reference -> discoveries_posts ==='
SELECT COUNT(*) AS orphan_count FROM conversation_contexts c
WHERE c.discoveries_post_reference IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = c.discoveries_post_reference);

\echo '=== discoveries_posts.user_id -> users ==='
SELECT COUNT(*) AS orphan_count FROM discoveries_posts dp
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = dp.user_id);

\echo '=== discoveries_likes.post_id -> discoveries_posts ==='
SELECT COUNT(*) AS orphan_count FROM discoveries_likes dl
WHERE NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = dl.post_id);

\echo '=== discoveries_likes.user_id -> users ==='
SELECT COUNT(*) AS orphan_count FROM discoveries_likes dl
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = dl.user_id);

\echo '=== discoveries_comments.post_id -> discoveries_posts ==='
SELECT COUNT(*) AS orphan_count FROM discoveries_comments dc
WHERE NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = dc.post_id);

\echo '=== discoveries_comments.user_id -> users ==='
SELECT COUNT(*) AS orphan_count FROM discoveries_comments dc
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = dc.user_id);

\echo '=== discoveries_bookmarks.post_id -> discoveries_posts ==='
SELECT COUNT(*) AS orphan_count FROM discoveries_bookmarks db
WHERE NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = db.post_id);

\echo '=== discoveries_bookmarks.user_id -> users ==='
SELECT COUNT(*) AS orphan_count FROM discoveries_bookmarks db
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = db.user_id);

\echo '=== discoveries_shares.post_id -> discoveries_posts ==='
SELECT COUNT(*) AS orphan_count FROM discoveries_shares ds
WHERE NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = ds.post_id);

\echo '=== discoveries_shares.user_id -> users ==='
SELECT COUNT(*) AS orphan_count FROM discoveries_shares ds
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ds.user_id);

\echo '=== user_consents.user_id -> users ==='
SELECT COUNT(*) AS orphan_count FROM user_consents uc
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = uc.user_id);
