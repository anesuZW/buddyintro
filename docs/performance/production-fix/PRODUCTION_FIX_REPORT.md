# PRODUCTION_FIX_REPORT

**Phase:** Production Stabilization — Phase 1  
**Generated:** 2026-07-31  
**Scope:** Schema drift + Prisma migration history only (no performance/UI changes)

---

## Summary

Production/runtime database schema is **aligned with Prisma**. Migration history is **repaired**. Authenticated pages `/home`, `/discoveries`, `/messages`, `/profile` load with **HTTP 200** and **no P2022** schema errors.

| Check | Result |
| --- | --- |
| `prisma migrate status` | **Database schema is up to date!** |
| `prisma migrate diff` (DB → schema) | **Empty** (no drift) |
| P2022 `preferred_language` | **Resolved** |
| Authenticated pages | **200** (verified on `http://127.0.0.1:3020`) |

---

## Migrations repaired

### History baseline (`migrate resolve --applied`)

Schema for these already existed out-of-band; SQL was **not** re-executed:

| Migration | Action |
| --- | --- |
| `0001_baseline` | Marked applied |
| `0002_discoveries` | Marked applied |
| `0003_trust_graph` | Marked applied |
| `0004_notifications` | Marked applied |
| `0005_moderation` | Marked applied |
| `0006_platform` | Marked applied |
| `0007_security_rbac` | Marked applied |

**Not** resolved as applied (objects were missing — SQL had to run):

- `0008_media_platform`
- `0009_i18n`
- `0010_pwa_push`
- `0011_message_unread_index`

### Deployed (`prisma migrate deploy`)

| Migration | Objects applied |
| --- | --- |
| `0008_media_platform` | `MediaProcessingStatus` enum, `media_objects` table + indexes + FK |
| `0009_i18n` | `users.preferred_language` + `users_preferred_language_idx` |
| `0010_pwa_push` | Push metadata columns + indexes |
| `0011_message_unread_index` | `messages_receiver_id_read_at_idx` |
| `0012_push_updated_at_no_default` | `DROP DEFAULT` on `push_subscriptions.updated_at` (align `@updatedAt`) |

`0012` was added because after 0008–0011, the only remaining diff vs Prisma was a DB default on `updated_at` that Prisma `@updatedAt` does not declare.

### Procedure note

`DIRECT_URL` host (`db.*.supabase.co`) does **not** resolve from this workstation. Migrate commands used `DIRECT_URL=DATABASE_URL` (Supabase pooler `:5432`) for this repair. Prefer a working direct connection for future production deploys when available.

Artifacts: `artifacts/apply-migration-repair.log.json`, `artifacts/deploy-0012.mjs`, `artifacts/preflight-markers.json`.

---

## Schema drift resolved

| Missing before | After |
| --- | --- |
| `_prisma_migrations` table | Present with 12 finished rows |
| `users.preferred_language` | Present (`text`, default `'en'`) |
| `users_preferred_language_idx` | Present |
| `media_objects` + enum | Present |
| Push columns (`enabled`, `browser`, …) | Present |
| `messages_receiver_id_read_at_idx` | Present |
| `push_subscriptions.updated_at` DEFAULT | Removed (matches Prisma) |

Final diff output: `-- This is an empty migration.`

---

## Page verification

Base: `http://127.0.0.1:3020` (dev), user `user1@friendintro.com`.

| Page | Status | Schema error | Total (warm retry) |
| --- | --- | --- | --- |
| `/home` | **200** | No | 7,445 ms |
| `/discoveries` | **200** | No | 3,877 ms |
| `/messages` | **200** | No | 2,109 ms |
| `/profile` | **200** | No | 4,259 ms |

First `/profile` attempt returned 500 due to **transient pooler connectivity** (`Can't reach database server…`) during analytics counts — **not** schema drift. Retry succeeded.

Artifact: `artifacts/verify-pages.json`.

---

## Remaining issues (non-blocking for schema success)

| Issue | Severity | Notes |
| --- | --- | --- |
| `DIRECT_URL` DNS `ENOTFOUND` from this machine | Ops | Fix for canonical migrate path |
| Supabase pooler RTT / occasional unreachable | Infra | Causes slow pages / rare 500s under load — **not** schema |
| Dev cold compile inflates first TTFB | Dev only | Expected with `next dev` |
| No separate local DB (`LOCAL_DATABASE_URL`) | Dev ergonomics | App uses remote pooler |
| Latency still high when healthy | Performance | Out of scope for this phase |

---

## Repo files touched (stabilization only)

| Path | Change |
| --- | --- |
| `prisma/migrations/0012_push_updated_at_no_default/migration.sql` | New migration |
| `prisma/migrations/README.md` | Document 0010–0012 |
| `scripts/lib/migration-audit.js` | Include `0012` in order list |
| `docs/performance/production-fix/**` | This report + artifacts |

No UI, UX, loader, recommendation, or Story query changes.

---

## Success criteria

| Criterion | Status |
| --- | --- |
| No P2022 errors | **Pass** |
| No schema drift (`migrate diff` empty) | **Pass** |
| `migrate status` healthy | **Pass** |
| Authenticated pages load | **Pass** |
| No application behaviour changes | **Pass** (schema/history only) |
