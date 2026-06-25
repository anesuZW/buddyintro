# FriendIntro Database Audit

**Date:** 2026-05-24  
**Source of truth:** `prisma/schema.prisma`  
**Live database:** PostgreSQL on Supabase (via `DIRECT_URL` / `DATABASE_URL`)  
**Method:** `prisma db pull`, `prisma migrate diff`, `information_schema` introspection, orphan pre-flight queries

---

## Executive summary

The live database is **operational** and contains **all 14 application tables** and **all Prisma-mapped columns**. Enums match. Drift is limited to **foreign keys**, **one unique-index shape**, **one column default**, **missing Prisma Migrate history**, and **no precomputed graph table** (`user_connections`).

This audit informed:

- `prisma/migrations/2026_baseline/migration.sql` — idempotent baseline
- `prisma/migrations/2026_database_alignment/migration.sql` — alignment + `user_connections`
- `scripts/check-orphans.sql` / `reports/orphan-report.sql`

---

## Missing columns (PostgreSQL lacks, Prisma expects)

**None.** All scalar fields in `schema.prisma` exist on mapped tables.

---

## Missing tables (PostgreSQL lacks, Prisma expects)

| Table | Status |
|-------|--------|
| `user_connections` | **Missing** — added in `2026_database_alignment` migration |

All other Prisma models (`users`, `stories`, `story_tags`, `invitations`, `messages`, `conversation_contexts`, `posts`, `discoveries_*`, `user_consents`, `admin_settings`) exist.

---

## Extra columns (PostgreSQL has, Prisma lacks)

**None.**

---

## Extra tables (PostgreSQL has, Prisma lacks)

**None** (application tables only).

---

## Missing enums

**None.**

| Prisma enum | PostgreSQL type | Values |
|-------------|-----------------|--------|
| `StoryStatus` | `StoryStatus` | draft, published, expired |
| `MediaType` | `MediaType` | image, video |
| `InviteMethod` | `InviteMethod` | email, whatsapp, sms, imessage |
| `DiscoveriesVisibility` | `DiscoveriesVisibility` | network, public |
| `ConversationOrigin` | `ConversationOrigin` | story, discoveries, direct |

---

## Missing enum values

**None.**

---

## Missing indexes

| Table | Expected | Live DB status |
|-------|----------|----------------|
| `story_tags` | Full unique on `(story_id, tagged_external_phone)` | **Partial** unique index with `WHERE tagged_external_phone IS NOT NULL` |

All other Prisma `@@index` / `@@unique` definitions are present (including discoveries uniques, conversation_contexts pair unique, etc.).

---

## Missing foreign keys

PostgreSQL has **9** FK constraints; Prisma expects **23**. **14 missing:**

| Table | Column | References |
|-------|--------|------------|
| `messages` | `discoveries_post_reference` | `discoveries_posts(id)` SET NULL |
| `conversation_contexts` | `user_a_id` | `users(id)` CASCADE |
| `conversation_contexts` | `user_b_id` | `users(id)` CASCADE |
| `conversation_contexts` | `story_reference` | `stories(id)` SET NULL |
| `conversation_contexts` | `discoveries_post_reference` | `discoveries_posts(id)` SET NULL |
| `discoveries_posts` | `user_id` | `users(id)` CASCADE |
| `discoveries_likes` | `post_id`, `user_id` | `discoveries_posts`, `users` |
| `discoveries_comments` | `post_id`, `user_id` | `discoveries_posts`, `users` |
| `discoveries_bookmarks` | `post_id`, `user_id` | `discoveries_posts`, `users` |
| `discoveries_shares` | `post_id`, `user_id` | `discoveries_posts`, `users` |
| `user_consents` | `user_id` | `users(id)` CASCADE |

**Orphan pre-flight:** run `npm run orphan-check` — all counts **0** as of 2026-05-24 (safe to add FKs).

**Post-migration status (2026-05-24):** `npm run verify-database` reports **63/63 checks passed** including `user_connections`, all 17 alignment FKs, and `_prisma_migrations`.

---

## Default value drift

| Table | Column | Prisma default | PostgreSQL default |
|-------|--------|----------------|---------------------|
| `admin_settings` | `discoveries_network_depth` | `2` | `1` |

All other defaults align. Admin network columns (`introductionsNeverExpire`, `enableIntroductionGraph`, `allowFirstDegreeDiscovery`, etc.) **exist** in both schema and database.

---

## Constraint drift

1. **`story_tags` phone unique** — partial vs full unique (see Missing indexes).
2. **FK enforcement** — manual SQL declared references but live DB lacks constraints on discoveries / conversation / consent tables (likely `CREATE TABLE IF NOT EXISTS` skipped recreation).

---

## Migration drift

| Issue | Detail |
|-------|--------|
| `_prisma_migrations` | **Table did not exist** before baseline adoption |
| Legacy SQL files | 5 standalone scripts in `prisma/migrations/*.sql` (not Prisma Migrate format) |
| Tracking | Schema changes applied manually over time |

### Legacy manual scripts (pre-baseline)

1. `add_invitation_expires_at.sql`
2. `platform_extension.sql`
3. `introduction_graph_and_context.sql`
4. `introductions_never_expire.sql`
5. `introduction_network_controls.sql`

These are superseded by `2026_baseline` + `2026_database_alignment` for new environments. **Do not delete** until production is confirmed on Prisma Migrate.

---

## Prisma vs PostgreSQL differences (summary)

| Category | Count |
|----------|-------|
| Missing columns | 0 |
| Missing tables | 1 (`user_connections`) |
| Missing enums / values | 0 |
| Index drift | 1 |
| Missing FKs | 14 |
| Default drift | 1 |
| Migration history | Not initialized |

---

## Recommended apply order

See project README / Part 10 output in the implementation PR:

1. Review `reports/orphan-report.sql` output
2. `npx prisma migrate deploy`
3. `npx prisma generate`
4. `npm run verify-database`
5. `npx tsx scripts/rebuild-connections.ts` (optional one-time graph backfill)
