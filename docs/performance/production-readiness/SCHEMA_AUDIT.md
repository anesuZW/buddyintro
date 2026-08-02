# SCHEMA_AUDIT

**Phase:** Production Readiness — Phase 1  
**Generated:** 2026-07-31  
**Mode:** READ-ONLY  
**Evidence:** `artifacts/schema-migration-audit.json`, `artifacts/prisma-migrate-diff.sql`

---

## Environment map

| URL | Role | Connect result |
| --- | --- | --- |
| `DATABASE_URL` | App runtime (Supabase **pooler** `aws-1-us-east-1`) | **OK** (connect ~2.4 s) |
| `DIRECT_URL` | Direct DB host `db.*.supabase.co` | **FAIL** — `ENOTFOUND` from this workstation |
| `LOCAL_DATABASE_URL` | Local Postgres | **Not configured** |

**There is no separate local development database in this environment.**  
“Local vs production” comparison is therefore:

- **Local = Prisma schema + migration files in the repo**
- **Remote/runtime = the Supabase database behind `DATABASE_URL`**

Label: **Runtime Evidence** (introspection via pooler).

---

## `users.preferred_language` — root cause

| Check | Result | Label |
| --- | --- | --- |
| Present in `prisma/schema.prisma` | **Yes** (`preferredLanguage` → `preferred_language`) | Static Analysis |
| Defined in migration `0009_i18n` | **Yes** (`ADD COLUMN IF NOT EXISTS`) | Static Analysis |
| Present on remote `users` table | **No** | **Runtime Evidence** |
| Index `users_preferred_language_idx` | **Missing** | **Runtime Evidence** |
| Recorded in `_prisma_migrations` | Table **does not exist** | **Runtime Evidence** |

### Why production reports the column missing

1. Application Prisma Client is generated from schema that **requires** `preferred_language`.
2. Remote DB was evolved **outside** Prisma Migrate history (no `_prisma_migrations` table).
3. Migration `0009_i18n` SQL was **never executed** against this database.
4. On authenticated routes, `getCurrentUser()` → `prisma.user.findUnique()` selects all scalar fields including `preferred_language` → Prisma **P2022** → HTTP **500**.

This is **schema/migration drift**, not a Prisma bug and not a pooler bug.

**Documented previously** in `docs/PRODUCTION_OPERATIONS.md` as expected pre-baseline state (`has_preferred_language_column = f`).

---

## Full drift vs Prisma schema

`prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel prisma/schema.prisma`  
(**Runtime Evidence**, 62-line script):

| Missing object | Source migration | Impact |
| --- | --- | --- |
| Enum `MediaProcessingStatus` | `0008_media_platform` | Media platform incomplete |
| Table `media_objects` (+ FKs/indexes) | `0008_media_platform` | Media registry unavailable |
| Column `users.preferred_language` + index | `0009_i18n` | **Auth/pages 500** |
| Columns on `push_subscriptions` (browser, device_type, enabled, expiration_time, last_used_at, platform, updated_at) + indexes | `0010_pwa_push` | PWA push metadata incomplete |
| Index `messages_receiver_id_read_at_idx` | `0011_message_unread_index` | Unread badge query less optimal |

**No other tables/columns** appeared in the diff. Core tables from 0001–0007 markers are present.

---

## Tables

| Category | Count / notes |
| --- | --- |
| Remote public tables | **31** |
| Prisma `@@map` tables | **32** (includes `media_objects`) |
| Missing table | **`media_objects` only** |

Baseline markers present: users, discoveries_posts, user_connections, notifications, user_blocks, background_jobs, roles.  
Missing marker: media_objects.

---

## Indexes / constraints / FKs (summary)

| Metric (remote) | Value |
| --- | --- |
| Indexes | 119 |
| Foreign keys | 52 |
| Table constraints | 332 |

Missing indexes from pending migrations listed above. No evidence of broken FK graph among existing tables (**Runtime Evidence** for counts; integrity of every FK **Unverified** beyond existence listing).

---

## Failed migrations

Cannot classify rows as failed/rolled-back: **`_prisma_migrations` does not exist**.  
Prisma reports all 11 filesystem migrations as “not yet been applied” even though most schema objects already exist.

---

## Consistency verdict

| Question | Answer |
| --- | --- |
| Schema drift present? | **Yes** |
| Drift fully understood? | **Yes** — pending 0008–0011 objects; 0001–0007 objects largely present without migration history |
| Drift resolved? | **No** (read-only phase; no `migrate deploy`) |
| Production ready on schema? | **No** |

---

## Recommended remediation (documentation only — not executed)

Follow `docs/PRODUCTION_OPERATIONS.md` baseline procedure:

1. Fix `DIRECT_URL` connectivity (DNS / network) for safe migrate operations.
2. Verify markers 0001–0008 (note: `media_objects` currently **false** — may need real apply of 0008, not only `resolve --applied`).
3. Establish `_prisma_migrations` history carefully.
4. Apply pending SQL for 0008–0011 (or `migrate deploy` after correct resolve).

**Caution:** Blind `migrate deploy` of `0001_baseline` against a populated DB would attempt to recreate existing objects and **fail or destroy data**. Baseline/`resolve` procedure is mandatory.
