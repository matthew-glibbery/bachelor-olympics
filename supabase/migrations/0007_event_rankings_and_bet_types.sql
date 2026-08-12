-- Three product decisions from the groom, made after using the app for real:
--
-- 1. The groom ranks players PER EVENT, not once overall (PRODUCT_SPEC.md's
--    "ranks all 8 players across all 8 events" turned out ambiguous — this
--    resolves it as "one ranking per event," which also turns out to be
--    exactly what per-event betting odds need: a per-event bet's payout
--    should reflect how strong the bettor is predicted to be AT THAT EVENT,
--    not their overall strength). The old single `groom_ranking` table
--    (never populated on the live project — no ranking had been set yet) is
--    replaced outright rather than migrated.
--
-- 2. The overall bet drops its "last place" joke bet type — down to win/top3.
--
-- 3. No peer award vote. `peer_award_votes` (never used — no UI ever built
--    for it) is dropped rather than left as dead schema.

drop table if exists groom_ranking;
drop table if exists peer_award_votes;

create table if not exists event_rankings (
  event_id   text not null references events(id) on delete cascade,
  player_id  uuid not null references players(id) on delete cascade,
  rank       integer not null check (rank >= 1),
  primary key (event_id, player_id),
  unique (event_id, rank)
);

alter table event_rankings enable row level security;
create policy event_rankings_anon_all on event_rankings for all to anon using (true) with check (true);
alter publication supabase_realtime add table event_rankings;

delete from overall_bets where bet_type = 'last';
alter table overall_bets drop constraint if exists overall_bets_bet_type_check;
alter table overall_bets add constraint overall_bets_bet_type_check
  check (bet_type in ('win', 'top3'));
