-- Bracket and round-robin event formats.
--
-- Every event still resolves to a `position` per player in `event_results`
-- (unchanged) — this just adds two new ways to ARRIVE at that position,
-- alongside the existing "groom drags a single final order" flow. `format`
-- is orthogonal to `scoring_mode`: bracket/round-robin events are always
-- placement-scored (enforced below), since neither format produces a
-- measured "absolute" result.
--
-- `team_reshuffle` is retired: PRODUCT_SPEC.md always described deriving
-- placement from a win/loss record for reshuffled-team events (beach
-- volleyball, 3v3 soccer), but no such derivation was ever implemented — the
-- flag was schema/config-only. `round_robin` format now IS that
-- implementation, so any event using the old flag is carried forward to the
-- new format rather than left behind.

alter table events add column if not exists format text not null default 'standard'
  check (format in ('standard', 'bracket', 'round_robin'));

update events set format = 'round_robin' where team_reshuffle;

alter table events add constraint events_format_scoring_mode_check
  check (format = 'standard' or scoring_mode = 'placement');

alter table events drop column if exists team_reshuffle;
