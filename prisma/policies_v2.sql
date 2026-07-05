-- =====================================================================
-- FriendIntro - Row Level Security policies v2
-- Complete policy set for ALL tables in prisma/schema.prisma
--
-- Run manually after `prisma migrate deploy` (or `prisma db push`).
-- Does NOT run automatically. Review before applying to production.
--
-- Replaces: prisma/policies.sql + notification RLS from migration 202608
-- =====================================================================

-- ---------------------------------------------------------------------
-- Storage bucket (private; uploads scoped to auth.uid() path prefix)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('friendintro', 'friendintro', false)
on conflict (id) do update set public = excluded.public;

-- ---------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------

create or replace function public.is_authenticated()
returns boolean
language sql
stable
as $$
  select auth.uid() is not null;
$$;

-- Returns true if the calling user has been tagged in any story by author_id.
create or replace function public.is_co_tagged(author_id uuid, viewer_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.story_tags st
    join public.stories s on s.id = st.story_id
    where s.user_id = author_id
      and st.tagged_user_id = viewer_id
  );
$$;

-- True when viewer has blocked other_id (one direction).
create or replace function public.is_blocked(viewer_id uuid, other_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.user_blocks b
    where b.blocker_id = viewer_id
      and b.blocked_id = other_id
  );
$$;

-- Service role / backend only. Human admins are gated in the app via ADMIN_EMAILS.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() ->> 'role') = 'service_role', false);
$$;

-- Simplified discovery visibility for RLS (defense-in-depth).
-- Full rules (network depth, verification gates, category filters) live in the app layer.
create or replace function public.can_view_discovery_post(p_post_id uuid, p_viewer_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1
    from public.discoveries_posts p
    where p.id = p_post_id
      and (p.expires_at is null or p.expires_at > now())
      and not public.is_blocked(p_viewer_id, p.user_id)
      and (
        p.user_id = p_viewer_id
        or (
          p.visibility = 'public'
          and public.is_authenticated()
        )
        or (
          p.visibility = 'network'
          and (
            public.is_co_tagged(p.user_id, p_viewer_id)
            or exists (
              select 1
              from public.user_connections uc
              where uc.source_user_id = p_viewer_id
                and uc.target_user_id = p.user_id
            )
          )
        )
      )
  );
$$;

-- ---------------------------------------------------------------------
-- Enable RLS on every application table (25 tables)
-- ---------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.stories enable row level security;
alter table public.story_tags enable row level security;
alter table public.invitations enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_contexts enable row level security;
alter table public.posts enable row level security;
alter table public.discoveries_posts enable row level security;
alter table public.discoveries_likes enable row level security;
alter table public.discoveries_comments enable row level security;
alter table public.discoveries_bookmarks enable row level security;
alter table public.discoveries_shares enable row level security;
alter table public.user_consents enable row level security;
alter table public.admin_settings enable row level security;
alter table public.user_connections enable row level security;
alter table public.introduction_categories enable row level security;
alter table public.shared_introducer_relationships enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.analytics_events enable row level security;
alter table public.phone_verification_challenges enable row level security;
alter table public.user_blocks enable row level security;
alter table public.content_reports enable row level security;
alter table public.background_jobs enable row level security;

-- ---------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------
drop policy if exists users_select_self_or_visible on public.users;
create policy users_select_self_or_visible
  on public.users for select
  using (
    id = auth.uid()
    or public.is_co_tagged(id, auth.uid())
    or public.is_co_tagged(auth.uid(), id)
  );

drop policy if exists users_update_self on public.users;
create policy users_update_self
  on public.users for update
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists users_insert_self on public.users;
create policy users_insert_self
  on public.users for insert
  with check (id = auth.uid());

-- ---------------------------------------------------------------------
-- STORIES
-- ---------------------------------------------------------------------
drop policy if exists stories_select on public.stories;
create policy stories_select
  on public.stories for select
  using (
    user_id = auth.uid()
    or (
      status = 'published'
      and public.is_co_tagged(user_id, auth.uid())
    )
  );

drop policy if exists stories_insert on public.stories;
create policy stories_insert
  on public.stories for insert
  with check (user_id = auth.uid());

drop policy if exists stories_update_owner on public.stories;
create policy stories_update_owner
  on public.stories for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists stories_delete_owner on public.stories;
create policy stories_delete_owner
  on public.stories for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- STORY TAGS
-- ---------------------------------------------------------------------
drop policy if exists story_tags_select on public.story_tags;
create policy story_tags_select
  on public.story_tags for select
  using (
    tagged_user_id = auth.uid()
    or exists (
      select 1 from public.stories s
      where s.id = story_tags.story_id and s.user_id = auth.uid()
    )
    or exists (
      select 1 from public.stories s
      where s.id = story_tags.story_id
        and s.status = 'published'
        and public.is_co_tagged(s.user_id, auth.uid())
    )
  );

drop policy if exists story_tags_insert on public.story_tags;
create policy story_tags_insert
  on public.story_tags for insert
  with check (
    exists (
      select 1 from public.stories s
      where s.id = story_id and s.user_id = auth.uid()
    )
  );

drop policy if exists story_tags_delete on public.story_tags;
create policy story_tags_delete
  on public.story_tags for delete
  using (
    exists (
      select 1 from public.stories s
      where s.id = story_id and s.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- INVITATIONS
-- ---------------------------------------------------------------------
drop policy if exists invitations_select on public.invitations;
create policy invitations_select
  on public.invitations for select
  using (invited_by = auth.uid() or registered_user_id = auth.uid());

drop policy if exists invitations_insert on public.invitations;
create policy invitations_insert
  on public.invitations for insert
  with check (invited_by = auth.uid());

drop policy if exists invitations_update_owner on public.invitations;
create policy invitations_update_owner
  on public.invitations for update
  using (invited_by = auth.uid())
  with check (invited_by = auth.uid());

drop policy if exists invitations_delete_owner on public.invitations;
create policy invitations_delete_owner
  on public.invitations for delete
  using (invited_by = auth.uid());

-- ---------------------------------------------------------------------
-- MESSAGES
-- ---------------------------------------------------------------------
drop policy if exists messages_select on public.messages;
create policy messages_select
  on public.messages for select
  using (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists messages_insert on public.messages;
create policy messages_insert
  on public.messages for insert
  with check (sender_id = auth.uid());

drop policy if exists messages_update_recipient on public.messages;
create policy messages_update_recipient
  on public.messages for update
  using (receiver_id = auth.uid())
  with check (receiver_id = auth.uid());

-- ---------------------------------------------------------------------
-- CONVERSATION CONTEXTS
-- ---------------------------------------------------------------------
drop policy if exists conversation_contexts_select on public.conversation_contexts;
create policy conversation_contexts_select
  on public.conversation_contexts for select
  using (user_a_id = auth.uid() or user_b_id = auth.uid());

drop policy if exists conversation_contexts_insert on public.conversation_contexts;
create policy conversation_contexts_insert
  on public.conversation_contexts for insert
  with check (user_a_id = auth.uid() or user_b_id = auth.uid());

drop policy if exists conversation_contexts_update_participant on public.conversation_contexts;
create policy conversation_contexts_update_participant
  on public.conversation_contexts for update
  using (user_a_id = auth.uid() or user_b_id = auth.uid())
  with check (user_a_id = auth.uid() or user_b_id = auth.uid());

-- ---------------------------------------------------------------------
-- POSTS (mutual-tag feed)
-- ---------------------------------------------------------------------
drop policy if exists posts_select on public.posts;
create policy posts_select
  on public.posts for select
  using (
    user_id = auth.uid()
    or public.is_co_tagged(user_id, auth.uid())
  );

drop policy if exists posts_insert on public.posts;
create policy posts_insert
  on public.posts for insert
  with check (user_id = auth.uid());

drop policy if exists posts_update_owner on public.posts;
create policy posts_update_owner
  on public.posts for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists posts_delete_owner on public.posts;
create policy posts_delete_owner
  on public.posts for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- DISCOVERIES POSTS
-- ---------------------------------------------------------------------
drop policy if exists discoveries_posts_select on public.discoveries_posts;
create policy discoveries_posts_select
  on public.discoveries_posts for select
  using (public.can_view_discovery_post(id, auth.uid()));

drop policy if exists discoveries_posts_insert on public.discoveries_posts;
create policy discoveries_posts_insert
  on public.discoveries_posts for insert
  with check (user_id = auth.uid());

drop policy if exists discoveries_posts_update_owner on public.discoveries_posts;
create policy discoveries_posts_update_owner
  on public.discoveries_posts for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists discoveries_posts_delete_owner on public.discoveries_posts;
create policy discoveries_posts_delete_owner
  on public.discoveries_posts for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- DISCOVERIES LIKES
-- ---------------------------------------------------------------------
drop policy if exists discoveries_likes_select on public.discoveries_likes;
create policy discoveries_likes_select
  on public.discoveries_likes for select
  using (
    user_id = auth.uid()
    or public.can_view_discovery_post(post_id, auth.uid())
  );

drop policy if exists discoveries_likes_insert on public.discoveries_likes;
create policy discoveries_likes_insert
  on public.discoveries_likes for insert
  with check (
    user_id = auth.uid()
    and public.can_view_discovery_post(post_id, auth.uid())
  );

drop policy if exists discoveries_likes_delete on public.discoveries_likes;
create policy discoveries_likes_delete
  on public.discoveries_likes for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- DISCOVERIES COMMENTS
-- ---------------------------------------------------------------------
drop policy if exists discoveries_comments_select on public.discoveries_comments;
create policy discoveries_comments_select
  on public.discoveries_comments for select
  using (public.can_view_discovery_post(post_id, auth.uid()));

drop policy if exists discoveries_comments_insert on public.discoveries_comments;
create policy discoveries_comments_insert
  on public.discoveries_comments for insert
  with check (
    user_id = auth.uid()
    and public.can_view_discovery_post(post_id, auth.uid())
  );

drop policy if exists discoveries_comments_delete on public.discoveries_comments;
create policy discoveries_comments_delete
  on public.discoveries_comments for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- DISCOVERIES BOOKMARKS
-- ---------------------------------------------------------------------
drop policy if exists discoveries_bookmarks_select on public.discoveries_bookmarks;
create policy discoveries_bookmarks_select
  on public.discoveries_bookmarks for select
  using (user_id = auth.uid());

drop policy if exists discoveries_bookmarks_insert on public.discoveries_bookmarks;
create policy discoveries_bookmarks_insert
  on public.discoveries_bookmarks for insert
  with check (
    user_id = auth.uid()
    and public.can_view_discovery_post(post_id, auth.uid())
  );

drop policy if exists discoveries_bookmarks_delete on public.discoveries_bookmarks;
create policy discoveries_bookmarks_delete
  on public.discoveries_bookmarks for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- DISCOVERIES SHARES
-- ---------------------------------------------------------------------
drop policy if exists discoveries_shares_select on public.discoveries_shares;
create policy discoveries_shares_select
  on public.discoveries_shares for select
  using (
    user_id = auth.uid()
    or public.can_view_discovery_post(post_id, auth.uid())
  );

drop policy if exists discoveries_shares_insert on public.discoveries_shares;
create policy discoveries_shares_insert
  on public.discoveries_shares for insert
  with check (
    user_id = auth.uid()
    and public.can_view_discovery_post(post_id, auth.uid())
  );

-- ---------------------------------------------------------------------
-- USER CONSENTS
-- ---------------------------------------------------------------------
drop policy if exists user_consents_select on public.user_consents;
create policy user_consents_select
  on public.user_consents for select
  using (user_id = auth.uid());

drop policy if exists user_consents_insert on public.user_consents;
create policy user_consents_insert
  on public.user_consents for insert
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- ADMIN SETTINGS
-- ---------------------------------------------------------------------
drop policy if exists admin_settings_select on public.admin_settings;
create policy admin_settings_select
  on public.admin_settings for select
  using (public.is_authenticated());

drop policy if exists admin_settings_update on public.admin_settings;
create policy admin_settings_update
  on public.admin_settings for update
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists admin_settings_insert on public.admin_settings;
create policy admin_settings_insert
  on public.admin_settings for insert
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- USER CONNECTIONS (materialized graph; server writes)
-- ---------------------------------------------------------------------
drop policy if exists user_connections_select_participant on public.user_connections;
create policy user_connections_select_participant
  on public.user_connections for select
  using (source_user_id = auth.uid() or target_user_id = auth.uid());

drop policy if exists user_connections_service_write on public.user_connections;
create policy user_connections_service_write
  on public.user_connections for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- INTRODUCTION CATEGORIES
-- ---------------------------------------------------------------------
drop policy if exists introduction_categories_select_active on public.introduction_categories;
create policy introduction_categories_select_active
  on public.introduction_categories for select
  using (is_active = true or public.is_admin());

drop policy if exists introduction_categories_mutate_admin on public.introduction_categories;
create policy introduction_categories_mutate_admin
  on public.introduction_categories for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- SHARED INTRODUCER RELATIONSHIPS
-- ---------------------------------------------------------------------
drop policy if exists shared_introducer_relationships_select_participant on public.shared_introducer_relationships;
create policy shared_introducer_relationships_select_participant
  on public.shared_introducer_relationships for select
  using (
    user_a_id = auth.uid()
    or user_b_id = auth.uid()
    or shared_introducer_id = auth.uid()
  );

drop policy if exists shared_introducer_relationships_service_write on public.shared_introducer_relationships;
create policy shared_introducer_relationships_service_write
  on public.shared_introducer_relationships for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- NOTIFICATIONS (Realtime + in-app)
-- ---------------------------------------------------------------------
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications for select
  using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own
  on public.notifications for delete
  using (user_id = auth.uid());

drop policy if exists notifications_insert_service on public.notifications;
create policy notifications_insert_service
  on public.notifications for insert
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- NOTIFICATION PREFERENCES
-- ---------------------------------------------------------------------
drop policy if exists notification_preferences_select on public.notification_preferences;
create policy notification_preferences_select
  on public.notification_preferences for select
  using (user_id = auth.uid());

drop policy if exists notification_preferences_insert on public.notification_preferences;
create policy notification_preferences_insert
  on public.notification_preferences for insert
  with check (user_id = auth.uid());

drop policy if exists notification_preferences_update on public.notification_preferences;
create policy notification_preferences_update
  on public.notification_preferences for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- PUSH SUBSCRIPTIONS
-- ---------------------------------------------------------------------
drop policy if exists push_subscriptions_select on public.push_subscriptions;
create policy push_subscriptions_select
  on public.push_subscriptions for select
  using (user_id = auth.uid());

drop policy if exists push_subscriptions_insert on public.push_subscriptions;
create policy push_subscriptions_insert
  on public.push_subscriptions for insert
  with check (user_id = auth.uid());

drop policy if exists push_subscriptions_update on public.push_subscriptions;
create policy push_subscriptions_update
  on public.push_subscriptions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists push_subscriptions_delete on public.push_subscriptions;
create policy push_subscriptions_delete
  on public.push_subscriptions for delete
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- ANALYTICS EVENTS
-- ---------------------------------------------------------------------
drop policy if exists analytics_events_insert_own on public.analytics_events;
create policy analytics_events_insert_own
  on public.analytics_events for insert
  with check (user_id = auth.uid());

drop policy if exists analytics_events_select_own on public.analytics_events;
create policy analytics_events_select_own
  on public.analytics_events for select
  using (user_id = auth.uid());

drop policy if exists analytics_events_service on public.analytics_events;
create policy analytics_events_service
  on public.analytics_events for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- PHONE VERIFICATION CHALLENGES
-- ---------------------------------------------------------------------
drop policy if exists phone_verification_challenges_own on public.phone_verification_challenges;
create policy phone_verification_challenges_own
  on public.phone_verification_challenges for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- USER BLOCKS
-- ---------------------------------------------------------------------
drop policy if exists user_blocks_select on public.user_blocks;
create policy user_blocks_select
  on public.user_blocks for select
  using (blocker_id = auth.uid());

drop policy if exists user_blocks_insert on public.user_blocks;
create policy user_blocks_insert
  on public.user_blocks for insert
  with check (blocker_id = auth.uid());

drop policy if exists user_blocks_delete on public.user_blocks;
create policy user_blocks_delete
  on public.user_blocks for delete
  using (blocker_id = auth.uid());

-- ---------------------------------------------------------------------
-- CONTENT REPORTS
-- ---------------------------------------------------------------------
drop policy if exists content_reports_select on public.content_reports;
create policy content_reports_select
  on public.content_reports for select
  using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists content_reports_insert on public.content_reports;
create policy content_reports_insert
  on public.content_reports for insert
  with check (reporter_id = auth.uid());

drop policy if exists content_reports_update_admin on public.content_reports;
create policy content_reports_update_admin
  on public.content_reports for update
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- BACKGROUND JOBS (server queue only)
-- ---------------------------------------------------------------------
drop policy if exists background_jobs_service_only on public.background_jobs;
create policy background_jobs_service_only
  on public.background_jobs for all
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Auto-publish trigger helpers (unchanged behavior from policies.sql)
-- ---------------------------------------------------------------------
create or replace function public.try_publish_story(p_story_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  pending int;
begin
  select count(*) into pending
  from public.story_tags
  where story_id = p_story_id
    and tagged_user_id is null
    and tagged_external_email is not null;

  if pending = 0 then
    update public.stories
       set status = 'published',
           published_at = coalesce(published_at, now())
     where id = p_story_id and status = 'draft';
  end if;
end;
$$;

create or replace function public.on_invitation_registered()
returns trigger
language plpgsql
as $$
declare
  r record;
begin
  if new.registered = true and (old.registered is distinct from true) then
    update public.story_tags
       set tagged_user_id = new.registered_user_id,
           tagged_external_email = null
     where invitation_id = new.id;

    for r in
      select distinct st.story_id
      from public.story_tags st
      where st.invitation_id = new.id
    loop
      perform public.try_publish_story(r.story_id);
    end loop;

    update public.users
       set invites_registered = invites_registered + 1
     where id = new.invited_by;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_on_invitation_registered on public.invitations;
create trigger trg_on_invitation_registered
  after update on public.invitations
  for each row execute function public.on_invitation_registered();

create or replace function public.on_invitation_created()
returns trigger
language plpgsql
as $$
begin
  update public.users
     set invites_sent = invites_sent + 1
   where id = new.invited_by;
  return new;
end;
$$;

drop trigger if exists trg_on_invitation_created on public.invitations;
create trigger trg_on_invitation_created
  after insert on public.invitations
  for each row execute function public.on_invitation_created();

create or replace function public.on_story_tag_change()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT') then
    perform public.try_publish_story(new.story_id);
  elsif (tg_op = 'UPDATE') then
    perform public.try_publish_story(new.story_id);
  end if;
  return null;
end;
$$;

drop trigger if exists trg_on_story_tag_change on public.story_tags;
create trigger trg_on_story_tag_change
  after insert or update on public.story_tags
  for each row execute function public.on_story_tag_change();

-- ---------------------------------------------------------------------
-- Realtime publication (idempotent)
-- ---------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.stories;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.story_tags;
exception when duplicate_object then null; when others then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null; when others then null; end $$;

-- ---------------------------------------------------------------------
-- Storage policies for the 'friendintro' bucket
-- ---------------------------------------------------------------------
drop policy if exists "friendintro insert" on storage.objects;
create policy "friendintro insert"
  on storage.objects for insert
  with check (
    bucket_id = 'friendintro'
    and auth.role() = 'authenticated'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists "friendintro select" on storage.objects;
create policy "friendintro select"
  on storage.objects for select
  using (
    bucket_id = 'friendintro'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists "friendintro delete" on storage.objects;
create policy "friendintro delete"
  on storage.objects for delete
  using (
    bucket_id = 'friendintro'
    and auth.uid()::text = split_part(name, '/', 1)
  );

-- ---------------------------------------------------------------------
-- Seed singleton admin settings row
-- ---------------------------------------------------------------------
insert into public.admin_settings (id, updated_at)
values (1, now())
on conflict (id) do nothing;
