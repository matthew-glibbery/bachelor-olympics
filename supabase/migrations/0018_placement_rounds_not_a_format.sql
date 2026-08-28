-- Reverses 0017's framing: multiple ranking rounds turned out NOT to be a
-- separate event format (direct product feedback) — every standard
-- placement event should just have the option to add another round if
-- there's time, not require picking a distinct "best_of_rounds" format
-- upfront. `placement_rounds` itself is unchanged and still used, just no
-- longer gated behind its own `format` value.
--
-- Also: the aggregation is SUM across rounds (lower total wins, like
-- stroke-play golf), not each player's best single round as 0017 first
-- shipped — also direct product feedback.
update events set format = 'standard' where format = 'best_of_rounds';

alter table events drop constraint if exists events_format_check;
alter table events add constraint events_format_check
  check (format in ('standard', 'bracket', 'round_robin'));
