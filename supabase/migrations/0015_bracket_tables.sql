-- Bracket event format — see 0014_event_format.sql for the `events.format`
-- column this supports.
--
-- `bracket_seeds` is deliberately its own table, not a re-read of
-- `event_rankings` (the groom's private per-event strength ranking that
-- drives betting odds — see 0007_event_rankings_and_bet_types.sql). The
-- bracket seed order starts as a one-time copy of that ranking but the
-- groom must be able to adjust it afterward without that edit silently
-- changing betting odds.
create table if not exists bracket_seeds (
  event_id   text not null references events(id) on delete cascade,
  player_id  uuid not null references players(id) on delete cascade,
  seed       integer not null check (seed >= 1),
  primary key (event_id, player_id),
  unique (event_id, seed)
);

-- The match tree itself. `bracket_track` distinguishes the main elimination
-- tree from the two optional consolation matches (PRODUCT_SPEC.md-pending —
-- see docs update): a `third_place` match between the two semifinal losers,
-- and a `fifth_place` match between the top two seeds of the round-before
-- losers. Existence of a row on those tracks IS the "opted in" flag — no
-- separate boolean. `player_b_id` null + `is_bye` true means a bye, which
-- auto-resolves `winner_id = player_a_id` at creation with no groom input.
create table if not exists bracket_matches (
  id             uuid primary key default gen_random_uuid(),
  event_id       text not null references events(id) on delete cascade,
  round          integer not null,
  slot           integer not null,
  bracket_track  text not null default 'main' check (bracket_track in ('main', 'third_place', 'fifth_place')),
  player_a_id    uuid references players(id) on delete set null,
  player_b_id    uuid references players(id) on delete set null,
  winner_id      uuid references players(id) on delete set null,
  is_bye         boolean not null default false,
  created_at     timestamptz not null default now(),
  unique (event_id, bracket_track, round, slot)
);

alter table bracket_seeds enable row level security;
create policy bracket_seeds_anon_all on bracket_seeds for all to anon using (true) with check (true);
alter publication supabase_realtime add table bracket_seeds;

alter table bracket_matches enable row level security;
create policy bracket_matches_anon_all on bracket_matches for all to anon using (true) with check (true);
alter publication supabase_realtime add table bracket_matches;
