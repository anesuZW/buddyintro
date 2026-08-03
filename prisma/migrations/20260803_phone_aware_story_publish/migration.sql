-- Fix premature publish when phone co-tags remain unresolved.
-- try_publish_story previously only counted tagged_external_email.

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
    and (
      tagged_external_email is not null
      or tagged_external_phone is not null
    );

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
           tagged_external_email = null,
           tagged_external_phone = null
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
