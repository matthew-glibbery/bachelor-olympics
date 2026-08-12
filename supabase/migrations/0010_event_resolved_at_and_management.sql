-- Two changes:
--
-- 1. `resolved_at` on events — the progress chart needs to know the actual
--    order points were awarded in (planned events interleaved with
--    spontaneous bonus events), not just the pre-planned sort order.
--    Backfill: any event already resolved gets "now" as a one-time
--    approximation (we have no real record of exactly when it resolved) —
--    every future resolve stamps the real time going forward.
--
-- 2. Events become fully groom-managed (create/edit/delete/reorder) rather
--    than just seeded from src/lib/events/config.ts — `sort_order` needs to
--    be freely reassignable, which it already is (no constraint change
--    needed there), so this migration is really just #1.

alter table events add column resolved_at timestamptz;
update events set resolved_at = now() where status = 'resolved';
