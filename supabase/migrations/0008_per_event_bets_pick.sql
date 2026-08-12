-- Per-event bets get a pick, like overall bets — a real product change from
-- what 0001_init.sql originally modeled (a self-bet with no pick column).
-- The groom now sets a ranking per event, so per-event betting can price a
-- bet on ANY player's win/place outcome at that event, not just your own.
--
-- No real bets exist yet on the live project (the feature only just shipped
-- and hasn't been used), so this wipes the table rather than trying to
-- backfill a pick for rows that predate the concept.

delete from per_event_bets;

alter table per_event_bets add column pick_player_id uuid references players(id) on delete cascade;
alter table per_event_bets alter column pick_player_id set not null;
