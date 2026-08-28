-- Best-of-rounds event format — a third way to arrive at an event's final
-- `position` (alongside the existing "standard" single drag-order and the
-- bracket/round-robin formats from 0014-0016): the groom ranks the field
-- once per round (same drag-order + tie-toggle UI as a standard placement
-- event), can add more rounds one at a time without disturbing earlier
-- ones, and each player's final placement is derived from their BEST
-- (lowest) position across every round they've been ranked in.
alter table events drop constraint if exists events_format_check;
alter table events add constraint events_format_check
  check (format in ('standard', 'bracket', 'round_robin', 'best_of_rounds'));

create table if not exists placement_rounds (
  event_id   text not null references events(id) on delete cascade,
  round      integer not null,
  player_id  uuid not null references players(id) on delete cascade,
  position   integer not null,
  primary key (event_id, round, player_id)
);

alter table placement_rounds enable row level security;
create policy placement_rounds_anon_all on placement_rounds for all to anon using (true) with check (true);
alter publication supabase_realtime add table placement_rounds;
