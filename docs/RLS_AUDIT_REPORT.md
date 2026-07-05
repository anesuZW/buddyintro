# RLS Audit Report

Generated as part of the **Platform Hardening & Scale-Up** phase.  
Policy source of truth: `prisma/policies.sql` (applied via `npm run db:rls`).

## Summary

| Metric | Value |
|--------|-------|
| Application tables with RLS enabled | 31 |
| Storage bucket policies | 3 (insert, select, delete) |
| Helper functions | `is_authenticated`, `is_co_tagged`, `is_blocked`, `is_admin`, `user_has_admin_role`, `can_view_discovery_post` |
| Realtime tables | `messages`, `stories`, `story_tags`, `notifications` |

## Access model

| Role | Capabilities |
|------|----------------|
| **Authenticated user** | Read/update/insert own rows where policies allow; read discovery content via `can_view_discovery_post`; read own notifications, preferences, push subscriptions, analytics inserts |
| **Authenticated user (denied)** | Write `user_connections`, `shared_introducer_relationships`, `background_jobs`, `admin_audit_logs`, `security_events`; update others' notifications |
| **RBAC admin** (via `user_roles`) | Same as service role for RLS-gated admin tables (`is_admin()` includes assigned roles) |
| **Service role** | Full access where `is_admin()` is used; used by Prisma server-side (RLS bypassed by DB owner) |

> **Note:** The Next.js app uses Prisma with the database owner role, so RLS is defense-in-depth for Supabase client access, Realtime subscriptions, and direct PostgREST usage.

---

## Table-by-table policy matrix

### Core social graph

| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| `users` | Self or co-tagged | Self | Self | — | Profile visibility via co-tag |
| `stories` | Owner or published+co-tagged | Owner | Owner | Owner | |
| `story_tags` | Taggee, author, or published co-tag | Story author | — | Story author | |
| `invitations` | Inviter or registered user | Inviter | Inviter | Inviter | |
| `messages` | Sender or receiver | Sender | Receiver (read state) | — | Realtime enabled |
| `conversation_contexts` | Participant | Participant | Participant | — | |
| `posts` | Owner or co-tagged | Owner | Owner | Owner | |
| `user_consents` | Self | Self | — | — | |
| `user_blocks` | Blocker | Blocker | — | Blocker | |
| `introduction_categories` | Active or admin | Admin | Admin | Admin | |
| `shared_introducer_relationships` | Participant | Service/admin | Service/admin | Service/admin | Server materialized |
| `user_connections` | Participant (source/target) | Service/admin only | Service/admin only | Service/admin only | **Trust graph — users cannot mutate** |
| `phone_verification_challenges` | Self | Self | Self | Self | All ops own row |
| `content_reports` | Reporter or admin | Reporter | Admin | — | |

### Discoveries

| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| `discoveries_posts` | `can_view_discovery_post` | Owner | Owner | Owner | App enforces depth/verification |
| `discoveries_likes` | Self or visible post | Self + visible post | — | Self | |
| `discoveries_comments` | Visible post | Self + visible post | — | Self | |
| `discoveries_bookmarks` | Self | Self + visible post | — | Self | |
| `discoveries_shares` | Self or visible post | Self + visible post | — | — | |

### Notifications & analytics

| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| `notifications` | Own | Service/admin | Own | Own | **Cannot modify others' notifications**; Realtime |
| `notification_preferences` | Own | Own | Own | — | |
| `push_subscriptions` | Own | Own | Own | Own | |
| `analytics_events` | Own | Own | Service/admin all | Service/admin | **System analytics via service role** |

### Admin & operations

| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| `admin_settings` | Authenticated | Admin | Admin | — | Feature flags |
| `background_jobs` | Admin | Admin | Admin | Admin | **Queue — service only in practice** |
| `roles` | Authenticated | Admin | Admin | Admin | RBAC seed data |
| `permissions` | Authenticated | Admin | Admin | Admin | |
| `role_permissions` | Authenticated | Admin | Admin | Admin | |
| `user_roles` | Own or admin | Admin | Admin | Admin | Role assignments |
| `admin_audit_logs` | Admin | Admin | — | — | Append-only audit trail |
| `security_events` | Admin or own user_id | Admin | — | — | Security monitoring |

### Storage (`friendintro` bucket)

| Operation | Policy | Rule |
|-----------|--------|------|
| INSERT | `friendintro insert` | Path prefix must match `auth.uid()` |
| SELECT | `friendintro select` | Path prefix must match `auth.uid()` |
| DELETE | `friendintro delete` | Path prefix must match `auth.uid()` |

---

## Priority-1 tables (explicit requirement)

All tables listed in the hardening spec are covered:

- ✅ `discoveries_posts`, `discoveries_comments`, `discoveries_likes`, `discoveries_bookmarks`, `discoveries_shares`
- ✅ `notifications`, `notification_preferences`, `push_subscriptions`
- ✅ `analytics_events`
- ✅ `conversation_contexts`
- ✅ `user_connections`
- ✅ `background_jobs`
- ✅ `admin_audit_logs`
- ✅ `security_events`

---

## Applying policies

```bash
# After migrations
npm run prisma:deploy
npm run db:rls   # psql $DATABASE_URL -f prisma/policies.sql
```

Verify RLS is enabled:

```sql
SELECT relname, relrowsecurity
FROM pg_class
JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
WHERE nspname = 'public' AND relkind = 'r'
ORDER BY relname;
```

---

## Migration reference

Schema DDL for RBAC, audit, security, and trust-risk columns:  
`prisma/migrations/202612_rls_completion/migration.sql`

RLS policies are maintained separately in `prisma/policies.sql` (not auto-applied by Prisma migrate).
