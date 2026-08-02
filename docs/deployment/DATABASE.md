# Database Audit — Production

**Date:** 2026-07-26  
**ORM:** Prisma 5.22  
**Migrations:** 11 (`0001_baseline` → `0011_message_unread_index`)

---

## Migration history

| # | Name | Purpose |
|---|------|---------|
| 0001 | baseline | Core schema |
| 0002 | discoveries | Discovery posts |
| 0003 | trust_graph | Trust connections |
| 0004 | notifications | Notification system |
| 0005 | moderation | Blocks, reports |
| 0006 | platform | Platform settings |
| 0007 | security_rbac | Admin RBAC |
| 0008 | media_platform | Media objects |
| 0009 | i18n | User language prefs |
| 0010 | pwa_push | Push subscriptions |
| 0011 | message_unread_index | Unread badge counts |

**Deploy:** `npm run prisma:deploy` on VPS (uses `DIRECT_URL`).

---

## Indexes (verified adequate)

| Table | Index | Query pattern |
|-------|-------|---------------|
| `messages` | `(receiver_id, read_at)` | Unread badge — **added 0011** |
| `messages` | `(receiver_id, sender_id, created_at)` | Thread listing |
| `notifications` | `(user_id, is_read, created_at)` | Notification feed |
| `discoveries_posts` | `(visibility, created_at)` | Feed |
| `user_connections` | `(source_user_id, trust_score)` | Trust graph |
| `background_jobs` | `(status, run_at)` | Job worker |

**No speculative indexes added** — existing coverage matches query paths from performance sprint.

---

## Foreign keys & cascades

Prisma relations use explicit `onDelete` where defined. Story tags cascade from stories; user deletion flows through application layer (`/api/account`).

Run orphan check pre-launch: `npm run orphan-check`

---

## Connection pooling

| URL | Use |
|-----|-----|
| `DATABASE_URL` | App runtime (Supabase pooler, `pgbouncer=true`) |
| `DIRECT_URL` | Migrations, long interactive transactions |

**Known issue (QA-008):** Pooler connection reset on heavy story transactions. Mitigation: 20s transaction timeout in `services/stories.ts`; retry on client; consider direct URL for write-heavy batch jobs only.

---

## Transaction timeouts

| Operation | Timeout |
|-----------|---------|
| `createStoryWithTags` | 20s (Prisma interactive transaction) |
| Default Prisma | 5s |

---

## Slow queries

Dominant latency is **network RTT to Supabase pooler**, not missing indexes (verified in performance recovery sprint).

Monitor on VPS: enable Supabase query insights; watch `[prisma:slow]` only when `PROFILE_*` enabled.

---

## RLS

Supabase Row Level Security policies in `prisma/policies.sql`. Apply: `npm run db:rls`

Prior audit: `docs/RLS_AUDIT_REPORT.md` — verify unchanged before launch.

---

## Pre-launch database checklist

- [ ] `npm run prisma:deploy` on production `DIRECT_URL`
- [ ] `npm run verify-database`
- [ ] `npm run validate:migrations`
- [ ] Confirm migration 0011 applied
- [ ] Backup before first production migration
