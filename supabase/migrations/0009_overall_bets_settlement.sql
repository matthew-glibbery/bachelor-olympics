-- Overall bets need somewhere to record their outcome once the weekend
-- ends (PRODUCT_SPEC.md → Overall betting → Payout) — the table only ever
-- tracked the live pick, not whether it ultimately landed.

alter table overall_bets add column status text not null default 'open'
  check (status in ('open', 'won', 'lost'));
alter table overall_bets add column payout numeric;
