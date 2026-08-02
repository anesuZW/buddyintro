# Index Audit

**Generated:** 2026-07-26T06:37:26.870Z  
**Method:** pg_indexes + pg_stat_user_tables (read-only)

---

## Table Statistics

| Table | Rows (est) | Seq scans | Idx scans | Size | Note |
| --- | --- | --- | --- | --- | --- |
| users | 11 | 300 | 7589 | 0.1 MB | OK |
| stories | 70 | 1122 | 6217 | 0.1 MB | OK |
| story_tags | 71 | 1434 | 2728 | 0.2 MB | OK |
| invitations | 4 | 479 | 46 | 0.1 MB | OK |
| messages | 14 | 265 | 624 | 0.1 MB | OK |
| admin_settings | 1 | 1 | 450 | 0 MB | OK |
| discoveries_posts | 13 | 15 | 277 | 0.1 MB | OK |
| user_connections | 30 | 729 | 847 | 0.2 MB | OK |
| shared_introducer_relationships | 106 | 90 | 2456 | 0.2 MB | OK |
| notifications | 172 | 65 | 469 | 0.3 MB | OK |
| analytics_events | 355 | 13 | 219 | 0.4 MB | OK |

---

## Composite Index Opportunities (Recommendations Only)

| Table | Suggested columns | Reason |
| --- | --- | --- |
| messages | (receiver_id, read_at) | Unread badge count in layout |
| messages | (sender_id, receiver_id, created_at) | Conversation list latest message |
| story_tags | (tagged_user_id, story_id) | Home feed + intro badge |
| discoveries_posts | (visibility, created_at) | Feed ordering + filter |
| user_connections | (source_user_id, degree) | Network depth filtering |
| shared_introducer_relationships | (user_a_id, user_b_id) | Trust enrichment bulk lookup |
| notifications | (user_id, read_at) | Unread notification count |

---

## Duplicate Indexes

None detected in audited tables.

---

## Unused Indexes (idx_scan = 0)

| Table | Index | Scans | Size |
| --- | --- | --- | --- |
| analytics_events | analytics_events_pkey | 0 | 0 MB |
| discoveries_posts | discoveries_posts_expires_at_idx | 0 | 0 MB |
| invitations | invitations_invite_token_key | 0 | 0 MB |
| invitations | invitations_phone_number_idx | 0 | 0 MB |
| invitations | invitations_invite_token_idx | 0 | 0 MB |
| messages | messages_pkey | 0 | 0 MB |
| messages | messages_discoveries_post_reference_idx | 0 | 0 MB |
| notifications | notifications_is_read_idx | 0 | 0 MB |
| notifications | notifications_created_at_idx | 0 | 0 MB |
| shared_introducer_relationships | shared_introducer_relationships_user_a_id_user_b_id_idx | 0 | 0 MB |
| shared_introducer_relationships | shared_introducer_relationships_shared_introducer_id_idx | 0 | 0 MB |
| stories | stories_introduction_category_id_idx | 0 | 0 MB |
| story_tags | story_tags_pkey | 0 | 0 MB |
| story_tags | story_tags_invitation_id_key | 0 | 0 MB |
| story_tags | story_tags_story_id_idx | 0 | 0 MB |
| story_tags | story_tags_tagged_external_email_idx | 0 | 0 MB |
| story_tags | story_tags_tagged_external_phone_idx | 0 | 0 MB |
| story_tags | story_tags_story_id_tagged_user_id_key | 0 | 0 MB |
| story_tags | story_tags_story_id_tagged_external_email_key | 0 | 0 MB |
| user_connections | user_connections_source_user_id_idx | 0 | 0 MB |

---

## Major Tables — Index Inventory

### users

- `users_email_idx`: CREATE INDEX users_email_idx ON public.users USING btree (email)
- `users_email_key`: CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email)
- `users_phone_idx`: CREATE INDEX users_phone_idx ON public.users USING btree (phone)
- `users_pkey`: CREATE UNIQUE INDEX users_pkey ON public.users USING btree (id)
- `users_preferred_language_idx`: CREATE INDEX users_preferred_language_idx ON public.users USING btree (preferred_language)
- `users_trusted_user_idx`: CREATE INDEX users_trusted_user_idx ON public.users USING btree (trusted_user)
- `users_verification_level_idx`: CREATE INDEX users_verification_level_idx ON public.users USING btree (verification_level)

### stories

- `stories_expires_at_idx`: CREATE INDEX stories_expires_at_idx ON public.stories USING btree (expires_at)
- `stories_introduction_category_id_idx`: CREATE INDEX stories_introduction_category_id_idx ON public.stories USING btree (introduction_category_id)
- `stories_pkey`: CREATE UNIQUE INDEX stories_pkey ON public.stories USING btree (id)
- `stories_status_idx`: CREATE INDEX stories_status_idx ON public.stories USING btree (status)
- `stories_user_id_idx`: CREATE INDEX stories_user_id_idx ON public.stories USING btree (user_id)

### story_tags

- `story_tags_invitation_id_key`: CREATE UNIQUE INDEX story_tags_invitation_id_key ON public.story_tags USING btree (invitation_id)
- `story_tags_pkey`: CREATE UNIQUE INDEX story_tags_pkey ON public.story_tags USING btree (id)
- `story_tags_story_id_idx`: CREATE INDEX story_tags_story_id_idx ON public.story_tags USING btree (story_id)
- `story_tags_story_id_tagged_external_email_key`: CREATE UNIQUE INDEX story_tags_story_id_tagged_external_email_key ON public.story_tags USING btree (story_id, tagged_external_email)
- `story_tags_story_id_tagged_external_phone_key`: CREATE UNIQUE INDEX story_tags_story_id_tagged_external_phone_key ON public.story_tags USING btree (story_id, tagged_external_phone)
- `story_tags_story_id_tagged_user_id_key`: CREATE UNIQUE INDEX story_tags_story_id_tagged_user_id_key ON public.story_tags USING btree (story_id, tagged_user_id)
- `story_tags_tagged_external_email_idx`: CREATE INDEX story_tags_tagged_external_email_idx ON public.story_tags USING btree (tagged_external_email)
- `story_tags_tagged_external_phone_idx`: CREATE INDEX story_tags_tagged_external_phone_idx ON public.story_tags USING btree (tagged_external_phone)
- `story_tags_tagged_user_id_idx`: CREATE INDEX story_tags_tagged_user_id_idx ON public.story_tags USING btree (tagged_user_id)

### discoveries_posts

- `discoveries_posts_expires_at_idx`: CREATE INDEX discoveries_posts_expires_at_idx ON public.discoveries_posts USING btree (expires_at)
- `discoveries_posts_pkey`: CREATE UNIQUE INDEX discoveries_posts_pkey ON public.discoveries_posts USING btree (id)
- `discoveries_posts_user_id_idx`: CREATE INDEX discoveries_posts_user_id_idx ON public.discoveries_posts USING btree (user_id)
- `discoveries_posts_visibility_created_at_idx`: CREATE INDEX discoveries_posts_visibility_created_at_idx ON public.discoveries_posts USING btree (visibility, created_at)

### messages

- `messages_discoveries_post_reference_idx`: CREATE INDEX messages_discoveries_post_reference_idx ON public.messages USING btree (discoveries_post_reference)
- `messages_pkey`: CREATE UNIQUE INDEX messages_pkey ON public.messages USING btree (id)
- `messages_receiver_id_sender_id_created_at_idx`: CREATE INDEX messages_receiver_id_sender_id_created_at_idx ON public.messages USING btree (receiver_id, sender_id, created_at)
- `messages_sender_id_receiver_id_created_at_idx`: CREATE INDEX messages_sender_id_receiver_id_created_at_idx ON public.messages USING btree (sender_id, receiver_id, created_at)
- `messages_story_reference_idx`: CREATE INDEX messages_story_reference_idx ON public.messages USING btree (story_reference)

### notifications

- `notifications_created_at_idx`: CREATE INDEX notifications_created_at_idx ON public.notifications USING btree (created_at)
- `notifications_is_read_idx`: CREATE INDEX notifications_is_read_idx ON public.notifications USING btree (is_read)
- `notifications_pkey`: CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id)
- `notifications_user_id_created_at_idx`: CREATE INDEX notifications_user_id_created_at_idx ON public.notifications USING btree (user_id, created_at)
- `notifications_user_id_idx`: CREATE INDEX notifications_user_id_idx ON public.notifications USING btree (user_id)
- `notifications_user_id_is_read_created_at_idx`: CREATE INDEX notifications_user_id_is_read_created_at_idx ON public.notifications USING btree (user_id, is_read, created_at)

### analytics_events

- `analytics_events_created_at_idx`: CREATE INDEX analytics_events_created_at_idx ON public.analytics_events USING btree (created_at)
- `analytics_events_event_type_created_at_idx`: CREATE INDEX analytics_events_event_type_created_at_idx ON public.analytics_events USING btree (event_type, created_at)
- `analytics_events_event_type_idx`: CREATE INDEX analytics_events_event_type_idx ON public.analytics_events USING btree (event_type)
- `analytics_events_pkey`: CREATE UNIQUE INDEX analytics_events_pkey ON public.analytics_events USING btree (id)
- `analytics_events_user_id_idx`: CREATE INDEX analytics_events_user_id_idx ON public.analytics_events USING btree (user_id)

### invitations

- `invitations_email_idx`: CREATE INDEX invitations_email_idx ON public.invitations USING btree (email)
- `invitations_invite_token_idx`: CREATE INDEX invitations_invite_token_idx ON public.invitations USING btree (invite_token)
- `invitations_invite_token_key`: CREATE UNIQUE INDEX invitations_invite_token_key ON public.invitations USING btree (invite_token)
- `invitations_invited_by_idx`: CREATE INDEX invitations_invited_by_idx ON public.invitations USING btree (invited_by)
- `invitations_phone_number_idx`: CREATE INDEX invitations_phone_number_idx ON public.invitations USING btree (phone_number)
- `invitations_pkey`: CREATE UNIQUE INDEX invitations_pkey ON public.invitations USING btree (id)

### user_connections

- `user_connections_degree_idx`: CREATE INDEX user_connections_degree_idx ON public.user_connections USING btree (degree)
- `user_connections_pkey`: CREATE UNIQUE INDEX user_connections_pkey ON public.user_connections USING btree (id)
- `user_connections_source_user_id_degree_idx`: CREATE INDEX user_connections_source_user_id_degree_idx ON public.user_connections USING btree (source_user_id, degree)
- `user_connections_source_user_id_idx`: CREATE INDEX user_connections_source_user_id_idx ON public.user_connections USING btree (source_user_id)
- `user_connections_source_user_id_shared_introducer_count_idx`: CREATE INDEX user_connections_source_user_id_shared_introducer_count_idx ON public.user_connections USING btree (source_user_id, shared_introducer_count)
- `user_connections_source_user_id_target_user_id_key`: CREATE UNIQUE INDEX user_connections_source_user_id_target_user_id_key ON public.user_connections USING btree (source_user_id, target_user_id)
- `user_connections_source_user_id_trust_score_idx`: CREATE INDEX user_connections_source_user_id_trust_score_idx ON public.user_connections USING btree (source_user_id, trust_score)
- `user_connections_target_user_id_idx`: CREATE INDEX user_connections_target_user_id_idx ON public.user_connections USING btree (target_user_id)

### shared_introducer_relationships

- `shared_introducer_relationships_pkey`: CREATE UNIQUE INDEX shared_introducer_relationships_pkey ON public.shared_introducer_relationships USING btree (id)
- `shared_introducer_relationships_shared_introducer_id_idx`: CREATE INDEX shared_introducer_relationships_shared_introducer_id_idx ON public.shared_introducer_relationships USING btree (shared_introducer_id)
- `shared_introducer_relationships_user_a_id_user_b_id_idx`: CREATE INDEX shared_introducer_relationships_user_a_id_user_b_id_idx ON public.shared_introducer_relationships USING btree (user_a_id, user_b_id)
- `shared_introducer_relationships_user_a_id_user_b_id_shared__key`: CREATE UNIQUE INDEX shared_introducer_relationships_user_a_id_user_b_id_shared__key ON public.shared_introducer_relationships USING btree (user_a_id, user_b_id, shared_introducer_id)

### admin_settings

- `admin_settings_pkey`: CREATE UNIQUE INDEX admin_settings_pkey ON public.admin_settings USING btree (id)
