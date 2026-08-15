-- Stylized character media (Visual Spec — N64-style boot/select/victory
-- pipeline, see docs/VISUAL_SPEC.md).
--
-- Distinct from the existing `photo_url` on players/events (a real photo,
-- shown in PlayerName/medal table/event cards throughout the app):
-- these four columns hold the generated N64-style character assets used
-- only by the boot/select/victory flow.
--
--   character_portrait_url       — small bust, roster strip (select screen)
--   character_select_video_url   — short looped clip, plays in place on
--                                   hover/tap in the roster strip
--   character_fullbody_video_url — full-body clip for the centered/chosen
--                                   character on the select + multiplier
--                                   screens
--   character_victory_video_url  — 12-15s clip played when this player
--                                   wins an event (one clip per player, not
--                                   per matchup — see VISUAL_SPEC.md)
--
-- `boot_video_url` on app_settings is the single global start-screen video
-- (one asset for the whole app, not per-player), same single-row pattern as
-- theme_id (0005_theme.sql).
--
-- Same trusted-friends storage model as 0004_photos.sql: a separate
-- `videos` bucket (kept apart from `photos` since these files are much
-- larger) with full anon read/write on its objects.

alter table players add column if not exists character_portrait_url text;
alter table players add column if not exists character_select_video_url text;
alter table players add column if not exists character_fullbody_video_url text;
alter table players add column if not exists character_victory_video_url text;

alter table app_settings add column if not exists boot_video_url text;

insert into storage.buckets (id, name, public)
values ('videos', 'videos', true)
on conflict (id) do nothing;

create policy "videos_anon_select" on storage.objects
  for select to anon
  using (bucket_id = 'videos');

create policy "videos_anon_insert" on storage.objects
  for insert to anon
  with check (bucket_id = 'videos');

create policy "videos_anon_update" on storage.objects
  for update to anon
  using (bucket_id = 'videos');

create policy "videos_anon_delete" on storage.objects
  for delete to anon
  using (bucket_id = 'videos');
