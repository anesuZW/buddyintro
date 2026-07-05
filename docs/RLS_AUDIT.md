# FriendIntro RLS Audit

**Date:** 2026-05-24  
**Sources reviewed:** `prisma/schema.prisma`, `prisma/policies.sql`, `prisma/migrations/202608_moderation_verification_realtime/migration.sql`, `prisma/migrations/202611_security_hardening/migration.sql`  
**Database modified:** No (report and SQL generation only)

---

## 1. Every Prisma model in `schema.prisma`

| # | Prisma model | Postgres table |
|---|---|---|
| 1 | `User` | `users` |
| 2 | `Story` | `stories` |
| 3 | `StoryTag` | `story_tags` |
| 4 | `Invitation` | `invitations` |
| 5 | `Message` | `messages` |
| 6 | `ConversationContext` | `conversation_contexts` |
| 7 | `Post` | `posts` |
| 8 | `DiscoveriesPost` | `discoveries_posts` |
| 9 | `DiscoveriesLike` | `discoveries_likes` |
| 10 | `DiscoveriesComment` | `discoveries_comments` |
| 11 | `DiscoveriesBookmark` | `discoveries_bookmarks` |
| 12 | `DiscoveriesShare` | `discoveries_shares` |
| 13 | `UserConsent` | `user_consents` |
| 14 | `AdminSettings` | `admin_settings` |
| 15 | `UserConnection` | `user_connections` |
| 16 | `IntroductionCategory` | `introduction_categories` |
| 17 | `SharedIntroducerRelationship` | `shared_introducer_relationships` |
| 18 | `Notification` | `notifications` |
| 19 | `NotificationPreferences` | `notification_preferences` |
| 20 | `PushSubscription` | `push_subscriptions` |
| 21 | `AnalyticsEvent` | `analytics_events` |
| 22 | `PhoneVerificationChallenge` | `phone_verification_challenges` |
| 23 | `UserBlock` | `user_blocks` |
| 24 | `ContentReport` | `content_reports` |
| 25 | `BackgroundJob` | `background_jobs` |

**Total:** 25 models / 25 application tables.

**Non-Prisma but policy-covered today:** `storage.objects` (Supabase Storage bucket `friendintro`).

---

## 2. Every table that currently has RLS enabled

Defined in `prisma/policies.sql`:

| Table | RLS enabled in |
|---|---|
| `users` | `policies.sql` line 14 |
| `stories` | `policies.sql` line 15 |
| `story_tags` | `policies.sql` line 16 |
| `invitations` | `policies.sql` line 17 |
| `messages` | `policies.sql` line 18 |
| `posts` | `policies.sql` line 19 |
| `admin_settings` | `policies.sql` line 20 |
| `conversation_contexts` | `policies.sql` line 196 |

Defined in migration `202608_moderation_verification_realtime`:

| Table | RLS enabled in |
|---|---|
| `notifications` | migration line 56 |

**Storage (not a Prisma table):** `storage.objects` has RLS policies but RLS is enabled by Supabase on the storage schema by default.

**Total application tables with RLS today:** 9 of 25 (36%).

---

## 3. Every table missing RLS

These 16 Prisma-mapped tables have **no** `ENABLE ROW LEVEL SECURITY` in `policies.sql` or checked migrations:

| Table | Primary exposure if PostgREST/anon key enabled |
|---|---|
| `discoveries_posts` | Full read/write of discovery feed data |
| `discoveries_likes` | Engagement manipulation |
| `discoveries_comments` | Comment spam / read private threads |
| `discoveries_bookmarks` | User preference leakage |
| `discoveries_shares` | Share record leakage |
| `user_consents` | GDPR consent record exposure |
| `user_connections` | Trust graph / network topology leak |
| `introduction_categories` | Category metadata (lower risk) |
| `shared_introducer_relationships` | Shared introducer graph leak |
| `notification_preferences` | Notification settings leak |
| `push_subscriptions` | Web push endpoint/key leak |
| `analytics_events` | Analytics data exfiltration / poisoning |
| `phone_verification_challenges` | OTP hash / phone enumeration |
| `user_blocks` | Block list leak |
| `content_reports` | Moderation queue leak |
| `background_jobs` | Job queue manipulation |

**Note:** The application uses **Prisma with server credentials**, which bypasses RLS unless `FORCE ROW LEVEL SECURITY` is set. Missing RLS is still a gap if Supabase Data API (PostgREST) is exposed to the anon/authenticated roles.

---

## 4. Every policy currently defined

### Helper functions (not policies, but authorization-related)

| Function | Purpose |
|---|---|
| `public.is_co_tagged(author_id, viewer_id)` | Co-tag visibility helper |
| `public.is_admin()` | True when JWT role is `service_role` |
| `public.try_publish_story(p_story_id)` | Auto-publish trigger helper (SECURITY DEFINER) |

### Table policies in `policies.sql`

| Policy name | Table | Command | Summary |
|---|---|---|---|
| `users_select_self_or_visible` | `users` | SELECT | Self or co-tagged users |
| `users_update_self` | `users` | UPDATE | Own row only |
| `users_insert_self` | `users` | INSERT | `id = auth.uid()` |
| `stories_select` | `stories` | SELECT | Author or co-tagged published |
| `stories_insert` | `stories` | INSERT | Author only |
| `stories_update_owner` | `stories` | UPDATE | Author only |
| `stories_delete_owner` | `stories` | DELETE | Author only |
| `story_tags_select` | `story_tags` | SELECT | Tagged user, author, or co-tagged viewer |
| `story_tags_insert` | `story_tags` | INSERT | Story author only |
| `story_tags_delete` | `story_tags` | DELETE | Story author only |
| `invitations_select` | `invitations` | SELECT | Inviter or registered user |
| `invitations_insert` | `invitations` | INSERT | Inviter only |
| `invitations_update_owner` | `invitations` | UPDATE | Inviter only |
| `messages_select` | `messages` | SELECT | Sender or receiver |
| `messages_insert` | `messages` | INSERT | Sender only |
| `messages_update_recipient` | `messages` | UPDATE | Receiver only (read receipts) |
| `conversation_contexts_select` | `conversation_contexts` | SELECT | Either participant |
| `conversation_contexts_insert` | `conversation_contexts` | INSERT | Either participant |
| `posts_select` | `posts` | SELECT | Author or co-tagged |
| `posts_insert` | `posts` | INSERT | Author only |
| `posts_update_owner` | `posts` | UPDATE | Author only |
| `posts_delete_owner` | `posts` | DELETE | Author only |
| `admin_settings_select` | `admin_settings` | SELECT | **All rows, all roles** (`using (true)`) |
| `admin_settings_update` | `admin_settings` | UPDATE | `is_admin()` (service role) |
| `admin_settings_insert` | `admin_settings` | INSERT | `is_admin()` (service role) |

### Storage policies in `policies.sql`

| Policy name | Table | Command | Summary |
|---|---|---|---|
| `friendintro insert` | `storage.objects` | INSERT | Authenticated; path prefix = `auth.uid()` |
| `friendintro select` | `storage.objects` | SELECT | Own path prefix only |
| `friendintro delete` | `storage.objects` | DELETE | Own path prefix only |

### Policies in migration `202608_moderation_verification_realtime` (not in `policies.sql`)

| Policy name | Table | Command | Summary |
|---|---|---|---|
| `notifications_select_own` | `notifications` | SELECT | `user_id = auth.uid()` |
| `notifications_update_own` | `notifications` | UPDATE | `user_id = auth.uid()` |

**Total policies today:** 30 (27 in `policies.sql` + 2 notifications + 3 storage; notifications overlap comment in `policies.sql` but policies live only in migration).

---

## 5. Policies referencing columns that no longer exist

**Result: None found.**

All column references in current policies map to existing schema columns:

| Policy | Columns referenced | Schema status |
|---|---|---|
| `users_*` | `id` | ✓ `users.id` |
| `stories_*` | `user_id`, `status` | ✓ |
| `story_tags_*` | `story_id`, `tagged_user_id` | ✓ |
| `invitations_*` | `invited_by`, `registered_user_id` | ✓ |
| `messages_*` | `sender_id`, `receiver_id` | ✓ |
| `conversation_contexts_*` | `user_a_id`, `user_b_id` | ✓ |
| `posts_*` | `user_id` | ✓ |
| `notifications_*` | `user_id` | ✓ |
| Storage policies | `bucket_id`, `name` (storage schema) | ✓ |

Trigger functions reference `story_tags.tagged_user_id`, `tagged_external_email`, `invitations.registered`, `invited_by`, `users.invites_registered`, `users.invites_sent` — all present in schema.

---

## 6. Policies referencing tables that no longer exist

**Result: None found.**

All policy `ON` targets and subquery joins reference tables that exist in `schema.prisma`. No references to dropped/renamed tables (e.g. no legacy table names).

---

## 7. Policies redundant because authorization moved to the application layer

The app uses **Prisma server-side** as the primary authorization boundary (`lib/access-control.ts`, `lib/verification-gates.ts`, `lib/category-visibility.ts`, route-level guards). Implications:

### A. Bypassed entirely when using service-role / direct Prisma

All 30 current policies are **inactive for normal API traffic** because Prisma connects with credentials that bypass RLS. They remain relevant only for:

- Supabase **Realtime** subscriptions (user JWT): `messages`, `stories`, `story_tags`, `notifications`
- Direct **Supabase JS client** DB access (if enabled)
- **PostgREST** exposure via anon/authenticated keys

### B. Superseded by stronger application rules (RLS still active but weaker)

These policies still run for Realtime/PostgREST but **do not match** the app’s richer rules:

| Policy | App-layer superset |
|---|---|
| `stories_select` | `getStoryForViewer()` adds conversation-reference access, draft rules, and `storyPassesCategoryGate()` |
| `posts_select` | Feed service may apply additional filtering |
| `conversation_contexts_*` | `canAccessChatContext()` requires messaging eligibility or existing thread |
| `users_select_self_or_visible` | Profile API removed email; block checks added in app |
| `messages_select` | App adds verification gates, shared-introducer gates, blocks on **new** sends (historical read unchanged) |
| *(missing discovery policies)* | `canViewDiscoveryPost()` enforces network depth, blocks, verification, category filters |

### C. Overly permissive / low value at RLS layer

| Policy | Issue |
|---|---|
| `admin_settings_select` (`using (true)`) | Any authenticated Supabase client can read all feature flags; app restricts **writes** via `requireAdminApi()` but not reads at RLS |
| `is_admin()` | Only checks `service_role` JWT, not `ADMIN_EMAILS` — admin human users are **not** admins at the Postgres layer |

### D. Not redundant — still required

| Policy / area | Why keep |
|---|---|
| `notifications_*` | Required for Realtime notification bell (`useRealtimeNotifications`) |
| `messages_*`, `stories_*`, `story_tags_*` | Required for Realtime message/story subscriptions |
| Storage `friendintro *` | Required for client-side upload via Supabase browser client (`useUpload`) |
| Trigger functions | Server-side story publish / invite counters (not authorization, but coupled to `policies.sql`) |

### E. Recommended stance

- **Do not remove** Realtime-critical policies.
- **Treat RLS as defense-in-depth**, not the primary authz layer, until PostgREST is disabled or policies are brought to parity with `lib/access-control.ts`.
- **`policies_v2.sql`** closes the 16-table gap and adds helpers for discoveries/network visibility within Postgres limits.

---

## Generated artifact

Complete replacement policy set: **`prisma/policies_v2.sql`**

Apply manually after review:

```bash
# Example (do not run unless intended):
# psql $DATABASE_URL -f prisma/policies_v2.sql
```

---

## Summary tables (requested)

### A. Tables protected (after `policies_v2.sql`)

All 25 Prisma tables + `storage.objects`:

`users`, `stories`, `story_tags`, `invitations`, `messages`, `conversation_contexts`, `posts`, `discoveries_posts`, `discoveries_likes`, `discoveries_comments`, `discoveries_bookmarks`, `discoveries_shares`, `user_consents`, `admin_settings`, `user_connections`, `introduction_categories`, `shared_introducer_relationships`, `notifications`, `notification_preferences`, `push_subscriptions`, `analytics_events`, `phone_verification_challenges`, `user_blocks`, `content_reports`, `background_jobs`, `storage.objects`

### B. Tables not protected (current `policies.sql` only)

The 16 tables listed in section 3.

### C. New policies added (in `policies_v2.sql` vs current)

| Area | New policies |
|---|---|
| Discoveries | `discoveries_posts_*`, `discoveries_likes_*`, `discoveries_comments_*`, `discoveries_bookmarks_*`, `discoveries_shares_*` |
| Trust graph | `user_connections_select_participant`, `shared_introducer_relationships_select_participant` |
| Categories | `introduction_categories_select_active`, `introduction_categories_mutate_admin` |
| Notifications | `notifications_delete_own`, `notification_preferences_*`, `push_subscriptions_*` |
| Privacy / moderation | `user_consents_*`, `user_blocks_*`, `content_reports_*`, `phone_verification_challenges_*` |
| Ops | `analytics_events_*`, `background_jobs_service_only` |
| Helpers | `is_blocked()`, `can_view_discovery_post()`, `is_authenticated()` |
| Conversation contexts | `conversation_contexts_update_participant` |
| Invitations | `invitations_delete_owner` |
| Notifications (consolidated) | Policies moved from migration into main file with `public.` schema prefix |

### D. Policies removed (in `policies_v2.sql` vs current)

| Removed / replaced | Reason |
|---|---|
| *(none outright removed)* | All v1 policy names are dropped with `DROP POLICY IF EXISTS` and recreated |
| `admin_settings_select` using `(true)` | **Replaced** with `authenticated only` — no longer world-readable including anon |
| Migration-only `notifications_*` without `public.` prefix | **Consolidated** into `policies_v2.sql` (same logic, consistent naming) |

**Behavior changes (not removals):**

- `admin_settings_select`: `using (true)` → `auth.uid() IS NOT NULL`
- Discoveries and 14 other tables: no policy → explicit policies added
- `background_jobs`: no RLS → service-role-only policy
