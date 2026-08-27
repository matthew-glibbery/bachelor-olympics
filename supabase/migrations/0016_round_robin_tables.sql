-- Round-robin event format — see 0014_event_format.sql for the
-- `events.format` column this supports. Replaces the never-implemented
-- `team_reshuffle` win/loss-record concept with a real one: a full
-- generated schedule of rotating 2- or 4-person teams, win/loss per match,
-- placement derived from win count.
--
-- Teams are stored as plain player-id arrays rather than a normalized join
-- table — a team here is ephemeral (regenerated whenever the schedule is
-- (re)built) and never referenced from anywhere else, so this is an
-- accepted simplification for this app's single-groom, low-concurrency
-- scale.
create table if not exists round_robin_matches (
  id          uuid primary key default gen_random_uuid(),
  event_id    text not null references events(id) on delete cascade,
  round       integer not null,
  team_a      uuid[] not null,
  team_b      uuid[] not null,
  winner      text check (winner in ('a', 'b')),
  created_at  timestamptz not null default now()
);

alter table round_robin_matches enable row level security;
create policy round_robin_matches_anon_all on round_robin_matches for all to anon using (true) with check (true);
alter publication supabase_realtime add table round_robin_matches;
