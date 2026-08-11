-- Bachelor Olympics — initial schema (Phase 1).
--
-- Mirrors the domain types in src/lib/*. The domain layer stays the source of
-- truth for RULES; these tables just persist state and let Realtime fan changes
-- out to every player's device.
--
-- DRAFT — Row Level Security is intentionally NOT configured yet. RLS depends on
-- the still-open auth decision (magic-link accounts vs. shared-link name picker;
-- see the Phase 1 handoff note). Do not run this against a shared project until
-- RLS policies are added — see the "RLS TODO" at the bottom.

-- ---------------------------------------------------------------------------
-- Players — exactly 8 competitors; one of them is the groom (competes + admin).
-- ---------------------------------------------------------------------------
create table if not exists players (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  nickname    text,
  state       text check (char_length(state) = 2),  -- US state code, e.g. 'TX'
  is_groom    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Events — mirrors src/lib/events/config.ts. Seeded from that config so the
-- app and DB agree; `status` drives multiplier locking and elimination math.
-- ---------------------------------------------------------------------------
create table if not exists events (
  id                text primary key,             -- e.g. 'golf'
  name              text not null,
  scoring_mode      text not null check (scoring_mode in ('placement', 'absolute')),
  lower_is_better   boolean not null default false,
  team_reshuffle    boolean not null default false,
  custom_placement  boolean not null default false,
  safety_check      boolean not null default false,
  notes             text,
  sort_order        integer not null default 0,
  status            text not null default 'planned'
                      check (status in ('planned', 'scoring', 'resolved', 'cancelled'))
);

-- ---------------------------------------------------------------------------
-- Event results — raw inputs per player per event. Placement events fill
-- `position`; absolute events fill `raw`. Points are DERIVED by the domain
-- layer, never stored, so the scoring curve stays single-sourced.
-- ---------------------------------------------------------------------------
create table if not exists event_results (
  event_id   text not null references events(id) on delete cascade,
  player_id  uuid not null references players(id) on delete cascade,
  position   integer,        -- placement events (ties share a position)
  raw        numeric,        -- absolute events (strokes, seconds, …)
  primary key (event_id, player_id)
);

-- ---------------------------------------------------------------------------
-- Multipliers — one per player per event. Zero-sum enforced in the domain
-- layer (src/lib/multipliers/budget.ts); `locked` mirrors event scoring start.
-- ---------------------------------------------------------------------------
create table if not exists multipliers (
  player_id  uuid not null references players(id) on delete cascade,
  event_id   text not null references events(id) on delete cascade,
  value      numeric not null default 1.0 check (value >= 0.5 and value <= 1.5),
  locked     boolean not null default false,
  primary key (player_id, event_id)
);

-- ---------------------------------------------------------------------------
-- Groom ranking — the single, upfront ranking that generates all odds.
-- ---------------------------------------------------------------------------
create table if not exists groom_ranking (
  player_id  uuid primary key references players(id) on delete cascade,
  rank       integer not null unique check (rank >= 1)
);

-- ---------------------------------------------------------------------------
-- Overall bets — 3 types, flat 100 payout, halved per switch.
-- ---------------------------------------------------------------------------
create table if not exists overall_bets (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null references players(id) on delete cascade,
  bet_type        text not null check (bet_type in ('win', 'top3', 'last')),
  pick_player_id  uuid not null references players(id) on delete cascade,
  switches        integer not null default 0 check (switches >= 0),
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Per-event bets — escrow a slice of an allocated multiplier; state machine
-- open -> won | lost | void (src/lib/betting/perEvent.ts).
-- ---------------------------------------------------------------------------
create table if not exists per_event_bets (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references players(id) on delete cascade,
  event_id    text not null references events(id) on delete cascade,
  target      text not null check (target in ('win', 'place')),
  wager       numeric not null check (wager > 0),
  status      text not null default 'open' check (status in ('open', 'won', 'lost', 'void')),
  payout      numeric,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Bonus events (isolated 50-pt winner-take-all) and peer-award votes.
-- ---------------------------------------------------------------------------
create table if not exists bonus_events (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  winner_player_id  uuid references players(id) on delete set null,
  points            numeric not null default 50,
  created_at        timestamptz not null default now()
);

create table if not exists peer_award_votes (
  id          uuid primary key default gen_random_uuid(),
  round       text not null default 'final',   -- 'final' or a day label
  voter_id    uuid not null references players(id) on delete cascade,
  choice_id   uuid not null references players(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (round, voter_id)                      -- one vote per player per round
);

-- ---------------------------------------------------------------------------
-- Power move — the groom's single one-off intervention. Single-row table.
-- ---------------------------------------------------------------------------
create table if not exists power_move (
  id       integer primary key default 1 check (id = 1),
  used     boolean not null default false,
  note     text,
  used_at  timestamptz
);
insert into power_move (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS TODO (blocked on the auth decision):
--   Once we choose magic-link accounts vs. shared-link name picker, enable RLS
--   and add policies: players write only their own multipliers / bets / votes;
--   the groom (players.is_groom) writes events, results, ranking, bonus events,
--   power move. Realtime should be enabled on the tables the medal table and
--   betting screens subscribe to.
-- ---------------------------------------------------------------------------
