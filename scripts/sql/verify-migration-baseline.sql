-- Lightweight marker checks only. For full baseline proof before migrate resolve,
-- use the comprehensive script:
--   psql "$DIRECT_URL" -f scripts/sql/verify-migrations-0001-0008.sql
--
-- Run against production using DIRECT_URL (not the pooler):
--   psql "$DIRECT_URL" -f scripts/sql/verify-migration-baseline.sql

\echo '=== _prisma_migrations table ==='
SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
) AS has_prisma_migrations_table;

\echo '=== Applied migrations ==='
SELECT migration_name, finished_at, rolled_back_at
FROM _prisma_migrations
ORDER BY finished_at;

\echo '=== Core schema markers (0001–0008) ==='
SELECT
  to_regclass('public.users') IS NOT NULL AS has_users,
  to_regclass('public.discoveries_posts') IS NOT NULL AS has_discoveries,
  to_regclass('public.user_connections') IS NOT NULL AS has_trust_graph,
  to_regclass('public.notifications') IS NOT NULL AS has_notifications,
  to_regclass('public.user_blocks') IS NOT NULL AS has_moderation,
  to_regclass('public.background_jobs') IS NOT NULL AS has_platform_jobs,
  to_regclass('public.roles') IS NOT NULL AS has_rbac,
  to_regclass('public.media_objects') IS NOT NULL AS has_media_platform;

\echo '=== Pending i18n migration marker (0009) ==='
SELECT EXISTS (
  SELECT 1
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'users'
    AND column_name = 'preferred_language'
) AS has_preferred_language_column;
