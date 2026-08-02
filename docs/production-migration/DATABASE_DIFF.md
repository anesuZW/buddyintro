# DATABASE_DIFF — Production vs Prisma (READ ONLY)

**Audit time:** 2026-08-02T11:52:12.553Z  
**Mode:** Read-only introspection + `prisma migrate diff`  
**No DDL executed. No migrations applied.**

## Sources compared

| Source | Identity |
|--------|----------|
| `prisma/schema.prisma` | Repo datamodel (incl. `User.preferredLanguage` → `users.preferred_language`) |
| `prisma/migrations/` | `0001_baseline` … `0012_push_updated_at_no_default` (12 migrations) |
| Production PostgreSQL | Via `DATABASE_URL` pooler → `aws-1-us-east-1.pooler.supabase.com` / project `drzpgydqpryrwobtqbkg` |

Artifact: `artifacts/audit.json`, `artifacts/prisma-migrate-diff.sql`

## Authoritative schema diff

```text
npx prisma migrate diff \
  --from-url <DATABASE_URL> \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

**Result:**

```sql
-- This is an empty migration.
```

**Interpretation:** The live database reachable from this environment’s `DATABASE_URL` already matches `schema.prisma`. There is **no schema drift** on that database relative to the Prisma datamodel.

## Reported symptom vs evidence

| Claim | Evidence on audited DB |
|-------|------------------------|
| `users.preferred_language` does not exist | **FALSE** — column present (`text`, `NOT NULL`, default `'en'::text`) |
| Index missing | **FALSE** — `users_preferred_language_idx` present |
| `SELECT preferred_language FROM users` | **OK** (`preferredLanguageSelect.ok: true`) |

## Object inventory (live `public`)

### Tables present (selected)

`_prisma_migrations`, `users`, `stories`, `story_tags`, `invitations`, `messages`, `posts`, `discoveries_*`, `conversation_contexts`, `user_connections`, `introduction_categories`, `shared_introducer_relationships`, `notifications`, `notification_preferences`, `push_subscriptions`, `analytics_events`, `phone_verification_challenges`, `user_blocks`, `content_reports`, `media_objects`, `background_jobs`, `roles`, `permissions`, `role_permissions`, `user_roles`, `admin_audit_logs`, `security_events`, `admin_settings`, `user_consents`

### Missing tables

**None** relative to Prisma `@@map` tables (empty `prisma migrate diff`).

### Missing columns

**None** relative to Prisma scalars (empty diff).

`users` columns include: `id`, `name`, `email`, `profile_picture`, invite counters, verification fields, trust-risk fields, `created_at`, **`preferred_language`**.

### Missing indexes

**None** required by schema (empty diff). Confirmed present:

- `users_preferred_language_idx`
- `messages_receiver_id_read_at_idx`
- `media_objects_*` indexes
- push subscription indexes from `0010_pwa_push`

### Missing enums

**None** (empty diff). Live includes app enums such as `VerificationLevel`, `TrustRiskLevel`, `MediaProcessingStatus`, etc.

### Missing defaults / constraints

| Object | Live | Schema expectation |
|--------|------|--------------------|
| `users.preferred_language` default | `'en'::text` | `@default("en")` — match |
| `push_subscriptions.updated_at` default | **NULL** (no default) | `@updatedAt` / migration `0012` dropped DB default — match |

### Parser false positives (ignore)

Heuristic compare in `read-only-audit.mjs` wrongly flagged relation fields / unmapped model names (`notificationPreferences`, `AnalyticsEvent`, etc.). **`prisma migrate diff` overrides these** — empty script means no real missing objects.

## Implication for the production error

If the deployed app still throws `P2022` / “column `users.preferred_language` does not exist”, that error **cannot** be explained by schema drift on **this** Supabase database. Likely causes to check on the VPS (ops, out of scope for this READ-ONLY SQL audit):

1. App `DATABASE_URL` on the server points to a **different** database than the audited URL  
2. Stale error / old process before migrations (migrations finished **2026-07-31**)  
3. Wrong env file loaded by PM2  

**This audit did not SSH into the VPS or read server-side `.env`.**
