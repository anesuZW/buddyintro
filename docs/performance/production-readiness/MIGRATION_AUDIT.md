# MIGRATION_AUDIT

**Phase:** Production Readiness — Phase 2  
**Generated:** 2026-07-31  
**Mode:** READ-ONLY  
**Evidence:** `npx prisma migrate status`, `artifacts/schema-migration-audit.json`, `artifacts/prisma-migrate-diff.sql`, `artifacts/push-media-cols.json`

---

## Filesystem migrations (repo)

| ID | Exists | Role |
| --- | --- | --- |
| 0001_baseline | Yes | Core identity, stories, messages, admin |
| 0002_discoveries | Yes | Discoveries feed |
| 0003_trust_graph | Yes | Connections, categories, shared introducers |
| 0004_notifications | Yes | Notifications, push base, analytics |
| 0005_moderation | Yes | Blocks, reports, phone challenges |
| 0006_platform | Yes | Background jobs |
| 0007_security_rbac | Yes | Roles/permissions/audit |
| 0008_media_platform | Yes | `media_objects` |
| 0009_i18n | Yes | `users.preferred_language` |
| 0010_pwa_push | Yes | Push subscription metadata |
| 0011_message_unread_index | Yes | Unread message index |

---

## Prisma migration history (remote)

| Check | Result | Label |
| --- | --- | --- |
| `_prisma_migrations` table | **Missing** | Runtime Evidence |
| Applied rows | **None** | Runtime Evidence |
| `prisma migrate status` | All **11** listed as **not yet applied** | Runtime Evidence |
| `check:migration-sync` | Fails — `DIRECT_URL` DNS `ENOTFOUND` | Runtime Evidence |

---

## Per-migration status (inferred)

Because history is empty, status is inferred from **schema markers** vs SQL intent.

| Migration | Prisma history | Schema objects | Classification |
| --- | --- | --- | --- |
| 0001_baseline | Not recorded | Core tables present (users, stories, …) | **Applied out-of-band** (schema yes / history no) |
| 0002_discoveries | Not recorded | discoveries_* present | **Applied out-of-band** |
| 0003_trust_graph | Not recorded | user_connections, etc. present | **Applied out-of-band** |
| 0004_notifications | Not recorded | notifications, push_subscriptions base present | **Applied out-of-band** |
| 0005_moderation | Not recorded | user_blocks, etc. present | **Applied out-of-band** |
| 0006_platform | Not recorded | background_jobs present | **Applied out-of-band** |
| 0007_security_rbac | Not recorded | roles, permissions present | **Applied out-of-band** |
| 0008_media_platform | Not recorded | `media_objects` **absent**; enum absent | **Pending** (not applied) |
| 0009_i18n | Not recorded | `preferred_language` **absent** | **Pending** |
| 0010_pwa_push | Not recorded | push columns only base set (no enabled/browser/…) | **Pending** |
| 0011_message_unread_index | Not recorded | `messages_receiver_id_read_at_idx` **absent** | **Pending** |

**Failed:** none recorded (no history rows with `rolled_back_at` / failed logs).  
**Partially applied:**  
- **0001–0007:** schema present, history absent → **partial relative to Prisma process** (dangerous for `migrate deploy`).  
- **0004 vs 0010:** base `push_subscriptions` exists; 0010 columns missing → **partial push feature surface**.

Label for inference of 0001–0007: **Runtime Evidence** (tables exist) + **Static Analysis** (migration SQL would create them). Exact original apply method **Unverified**.

---

## Production history vs repo

| Statement | Verdict |
| --- | --- |
| Repo and DB migration history in sync | **No** |
| Safe to run bare `prisma migrate deploy` | **No** — would attempt 0001+ on populated DB |
| Documented baseline procedure exists | **Yes** — `docs/PRODUCTION_OPERATIONS.md` |
| Baseline safe as written for 0008 | **Needs amendment** — procedure assumed `has_media_platform = t`; live marker is **false** |

---

## DIRECT_URL blocker

`DIRECT_URL` host `db.drzpgydqpryrwobtqbkg.supabase.co` does not resolve from this workstation (`ENOTFOUND`).

Impact:

- Official baseline scripts using `DIRECT_URL` cannot run here.
- Pooler URL works for introspection and app queries.
- Prisma docs recommend direct connection for migrate; pooler may still run DDL but is not the documented path.

---

## Risk summary

| Risk | Severity |
| --- | --- |
| App schema ahead of DB (0009) → 500s | **Critical** |
| No `_prisma_migrations` → deploy tooling blind | **Critical** |
| 0008 media table missing | **High** (media platform features) |
| 0010/0011 pending | **Medium** |
| Blind resolve of 0008 as applied | **Critical mistake** if done while table missing |

---

## Phase 2 verification checklist

- [x] Every migration file inspected  
- [x] Applied/pending/failed/partial classified (with evidence labels)  
- [x] History compared to production/runtime DB  
- [ ] Drift resolved — **not in this read-only phase**
