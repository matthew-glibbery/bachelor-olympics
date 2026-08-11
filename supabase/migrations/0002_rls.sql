-- Row Level Security — shared-link "name picker" model (Phase 1).
--
-- Auth decision: no per-user accounts. Everyone opens the same shared link,
-- picks who they are, and acts as that player; the groom's admin tools are
-- gated in the APP by a PIN, not by the database. There is no auth.uid() to key
-- policies off, so DB-level per-row ownership isn't enforceable here.
--
-- This is a deliberate trusted-friends model: the only people with the link are
-- the 8 competitors, there are no spectators (PRODUCT_SPEC.md → Live
-- standings), and the anon key is the sole credential. We therefore enable RLS
-- and grant the anon role full read/write on the game tables — RLS is on so
-- access is explicit and auditable, but the trust boundary is the link itself.
--
-- If this ever needs real per-player enforcement, switch to the magic-link auth
-- model and rewrite these policies against auth.uid().

do $$
declare
  t text;
  game_tables text[] := array[
    'players', 'events', 'event_results', 'multipliers', 'groom_ranking',
    'overall_bets', 'per_event_bets', 'bonus_events', 'peer_award_votes',
    'power_move'
  ];
begin
  foreach t in array game_tables loop
    execute format('alter table %I enable row level security;', t);
    -- Single permissive policy per table for the anon role (trusted link model).
    execute format(
      'create policy %I on %I for all to anon using (true) with check (true);',
      t || '_anon_all', t
    );
  end loop;
end $$;
