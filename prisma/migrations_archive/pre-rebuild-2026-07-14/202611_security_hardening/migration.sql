-- Security hardening: storage upload ownership + private bucket

update storage.buckets
set public = false
where id = 'friendintro';

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
