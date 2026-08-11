-- Player + event photos (Phase 2).
--
-- Adds a `photo_url` column to players/events (plain public URLs, not
-- managed by the config-driven event sync — see seedEvents in
-- src/lib/data/queries.ts, which deliberately omits this column so an
-- uploaded photo is never clobbered by re-running the seed) and a Storage
-- bucket to hold the actual files.
--
-- Same trusted-friends model as 0002_rls.sql: the shared link is the trust
-- boundary, so the anon role gets full read/write on this bucket's objects.

alter table players add column if not exists photo_url text;
alter table events add column if not exists photo_url text;

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

create policy "photos_anon_select" on storage.objects
  for select to anon
  using (bucket_id = 'photos');

create policy "photos_anon_insert" on storage.objects
  for insert to anon
  with check (bucket_id = 'photos');

create policy "photos_anon_update" on storage.objects
  for update to anon
  using (bucket_id = 'photos');

create policy "photos_anon_delete" on storage.objects
  for delete to anon
  using (bucket_id = 'photos');
