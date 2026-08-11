-- Enable Realtime replication on the game tables (Phase 1).
--
-- By default a new Supabase table is NOT added to the `supabase_realtime`
-- publication, so postgres_changes subscriptions (used by src/store/gameStore.ts
-- to keep every device's medal table live) silently receive nothing even
-- though the subscription itself succeeds. Verified against the live project:
-- SUBSCRIBED status came back, but an insert produced no event until this ran.
--
-- Requires the postgres role (SQL Editor), not the anon key — run this the
-- same way as 0001/0002.

alter publication supabase_realtime add table players;
alter publication supabase_realtime add table events;
alter publication supabase_realtime add table event_results;
alter publication supabase_realtime add table multipliers;
alter publication supabase_realtime add table overall_bets;
alter publication supabase_realtime add table per_event_bets;
alter publication supabase_realtime add table bonus_events;
alter publication supabase_realtime add table peer_award_votes;
alter publication supabase_realtime add table power_move;
