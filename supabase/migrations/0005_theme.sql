-- Shared app theme (Phase 2 — groom tools theme picker).
--
-- One row, one value: the id of the currently-active theme from
-- src/lib/themes.ts. Same single-row pattern as power_move. Shared/global
-- (not a per-device preference) — matches every other groom tool, which all
-- act on shared game state, and this app's Realtime-first design means
-- everyone's screen updates the moment the groom picks a new one.

create table if not exists app_settings (
  id        integer primary key default 1 check (id = 1),
  theme_id  text not null default 'classic'
);
insert into app_settings (id) values (1) on conflict (id) do nothing;

alter table app_settings enable row level security;
create policy "app_settings_anon_all" on app_settings
  for all to anon using (true) with check (true);

alter publication supabase_realtime add table app_settings;
