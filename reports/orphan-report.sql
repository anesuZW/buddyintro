-- Orphan report — human-readable summary for migration review
-- Run: psql $DIRECT_URL -f reports/orphan-report.sql

SELECT 'messages.discoveries_post_reference' AS check_name,
  COUNT(*)::bigint AS orphan_count
FROM messages m
WHERE m.discoveries_post_reference IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = m.discoveries_post_reference)

UNION ALL

SELECT 'conversation_contexts.user_a_id',
  COUNT(*)::bigint
FROM conversation_contexts c
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.user_a_id)

UNION ALL

SELECT 'conversation_contexts.user_b_id',
  COUNT(*)::bigint
FROM conversation_contexts c
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.user_b_id)

UNION ALL

SELECT 'conversation_contexts.story_reference',
  COUNT(*)::bigint
FROM conversation_contexts c
WHERE c.story_reference IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM stories s WHERE s.id = c.story_reference)

UNION ALL

SELECT 'conversation_contexts.discoveries_post_reference',
  COUNT(*)::bigint
FROM conversation_contexts c
WHERE c.discoveries_post_reference IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = c.discoveries_post_reference)

UNION ALL

SELECT 'discoveries_posts.user_id',
  COUNT(*)::bigint
FROM discoveries_posts dp
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = dp.user_id)

UNION ALL

SELECT 'discoveries_likes.post_id',
  COUNT(*)::bigint
FROM discoveries_likes dl
WHERE NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = dl.post_id)

UNION ALL

SELECT 'discoveries_likes.user_id',
  COUNT(*)::bigint
FROM discoveries_likes dl
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = dl.user_id)

UNION ALL

SELECT 'discoveries_comments.post_id',
  COUNT(*)::bigint
FROM discoveries_comments dc
WHERE NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = dc.post_id)

UNION ALL

SELECT 'discoveries_comments.user_id',
  COUNT(*)::bigint
FROM discoveries_comments dc
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = dc.user_id)

UNION ALL

SELECT 'discoveries_bookmarks.post_id',
  COUNT(*)::bigint
FROM discoveries_bookmarks db
WHERE NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = db.post_id)

UNION ALL

SELECT 'discoveries_bookmarks.user_id',
  COUNT(*)::bigint
FROM discoveries_bookmarks db
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = db.user_id)

UNION ALL

SELECT 'discoveries_shares.post_id',
  COUNT(*)::bigint
FROM discoveries_shares ds
WHERE NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = ds.post_id)

UNION ALL

SELECT 'discoveries_shares.user_id',
  COUNT(*)::bigint
FROM discoveries_shares ds
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ds.user_id)

UNION ALL

SELECT 'user_consents.user_id',
  COUNT(*)::bigint
FROM user_consents uc
WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = uc.user_id)

ORDER BY check_name;

-- Summary row
SELECT 'TOTAL' AS check_name, SUM(orphan_count)::bigint AS orphan_count
FROM (
  SELECT COUNT(*)::bigint AS orphan_count FROM messages m
  WHERE m.discoveries_post_reference IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = m.discoveries_post_reference)
  UNION ALL SELECT COUNT(*)::bigint FROM conversation_contexts c
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.user_a_id)
  UNION ALL SELECT COUNT(*)::bigint FROM conversation_contexts c
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.user_b_id)
  UNION ALL SELECT COUNT(*)::bigint FROM conversation_contexts c
    WHERE c.story_reference IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM stories s WHERE s.id = c.story_reference)
  UNION ALL SELECT COUNT(*)::bigint FROM conversation_contexts c
    WHERE c.discoveries_post_reference IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = c.discoveries_post_reference)
  UNION ALL SELECT COUNT(*)::bigint FROM discoveries_posts dp
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = dp.user_id)
  UNION ALL SELECT COUNT(*)::bigint FROM discoveries_likes dl
    WHERE NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = dl.post_id)
  UNION ALL SELECT COUNT(*)::bigint FROM discoveries_likes dl
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = dl.user_id)
  UNION ALL SELECT COUNT(*)::bigint FROM discoveries_comments dc
    WHERE NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = dc.post_id)
  UNION ALL SELECT COUNT(*)::bigint FROM discoveries_comments dc
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = dc.user_id)
  UNION ALL SELECT COUNT(*)::bigint FROM discoveries_bookmarks db
    WHERE NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = db.post_id)
  UNION ALL SELECT COUNT(*)::bigint FROM discoveries_bookmarks db
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = db.user_id)
  UNION ALL SELECT COUNT(*)::bigint FROM discoveries_shares ds
    WHERE NOT EXISTS (SELECT 1 FROM discoveries_posts p WHERE p.id = ds.post_id)
  UNION ALL SELECT COUNT(*)::bigint FROM discoveries_shares ds
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = ds.user_id)
  UNION ALL SELECT COUNT(*)::bigint FROM user_consents uc
    WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = uc.user_id)
) s;
