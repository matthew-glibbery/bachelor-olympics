# Session handoff

Rolling handoff note (per CLAUDE.md). Newest section on top.

## Current state (as of 2026-08-11, end of session)

Start here if you're picking this up cold — the detailed log below has the
blow-by-blow if you need it, but this is the map.

**Live and working**, verified against the real Supabase project + a real
GitHub repo + Vercel deploy (not just typechecked), except the newest
session's work — see the caveat in that log entry below. Migrations
0001–0008 ARE confirmed run against the live project; **0009 (this session)
is NOT confirmed run yet**:
- **Repo**: `github.com/matthew-glibbery/bachelor-olympics` (private), `main`
  branch, CI green on every push (`.github/workflows/ci.yml`: pnpm, Node 22).
  Deployed on Vercel, auto-deploys from `main`.
- **Package manager is pnpm, not npm** — a real, hard-won fix (see the
  "Switch from npm to pnpm" log entry). Don't reintroduce npm/package-lock.json.
- **8 real players** already set up in the live DB, one groom, real states,
  some photos uploaded. **Beach Volleyball** is the one resolved event so far.
- **Five core screens**, all `max-w-2xl`:
  - `/` — live cumulative progress chart (player photos as markers,
    flag-inspired colors, dataviz-skill-validated) + Medal Table. Total now
    includes bonus-event points AND (this session) settled overall-bet
    winnings.
  - `/events` — groom-gated event board. Each event card is now **tabbed:
    Results / Odds / Bets** (this session). Results tab has the existing
    flow: start scoring → drag-to-reorder placement results (or numeric for
    absolute events) → finalize → resolved, ties via "tied with row above,"
    vertical results list, Cancel (hard delete) / Reset (clear + reopen).
    Odds tab: read-only win/place payout table from that event's own
    ranking. Bets tab: every bet placed on that event, revealed only once
    it's left "planned" (bets stay secret until placement closes).
    Finalizing a placement event auto-settles any open per-event bets on it.
  - `/multipliers` — per-player sliders. Budget is no longer a strict
    zero-sum (this session) — you can leave some unspent as a reserve for
    per-event bets; a new "Betting reserve" card shows what's available to
    wager vs. tied up in open wagers.
  - `/bets` — overall betting (win/top3 only, win=100pts/top3=20pts) with
    odds shown inline next to each pick; new bet placement locks once the
    first event starts, existing bets can still switch if eliminated,
    "everyone's bets" only reveals once locked. **Now settles automatically**
    (this session) once every event has resolved — a bet's badge switches
    from live Alive/Eliminated to a final Won/Lost, and a won bet's points
    show up on the medal table. Per-event betting: pick ANY player to
    win/place in an upcoming ("planned") event, wager drawn from your
    unallocated multiplier reserve (not that event's own multiplier),
    payout scaled by that event's own odds. Closes once the event starts —
    the reveal moves to that event's Bets tab on `/events`.
  - `/setup` — player picker, groom PIN gate, add/edit/remove players +
    photos, theme picker, "Set the odds" card (groom ranks players **per
    event**, one event at a time, ✓/○ progress indicator), a "Power move"
    card (**new**: one-time freeform groom action, note + a single
    irreversible button), and "Danger zone": full weekend reset.
  - `/events` also gained a **"Bonus events" card** (**new**, below the
    planned-event list): groom names a spontaneous event and picks a
    winner on the spot, flat points (default 50) land straight on the
    medal table — no odds, no multiplier, no elimination-math effect, per
    spec's explicit isolation.
- **10 Supabase migrations exist. 0009 (this session) needs to run** — adds
  `status`/`payout` columns to `overall_bets` so a settled bet's outcome can
  be recorded. 0001–0008 already confirmed run.
- Domain/scoring logic (`src/lib/scoring/*`, `src/lib/multipliers/*`,
  `src/lib/betting/*`, `src/lib/odds/*`, `src/lib/bonus/*`) is pure, unit-
  tested (138 tests), and matches `docs/PRODUCT_SPEC.md` — placement
  scoring rounds to whole numbers (100/72/52/37/27/19/14/10), per an
  explicit product decision from an earlier session.

**Not built yet**: nothing — every mechanic in `docs/PRODUCT_SPEC.md` now has
code behind it, including the overall-bet settlement gap flagged across the
last three sessions (closed this session, see the log entry below). What's
left is verification against live data and the open questions below, not
missing features.

**Environment quirk worth knowing**: this dev machine sits behind corporate
TLS interception (Zscaler) and a corporate npm registry mirror. Both are
worked around already (`.npmrc` pins the public registry;
`NODE_EXTRA_CA_CERTS` needed for any Node-side script that calls Supabase
directly, not needed for `next dev`/`next build` themselves). See the
relevant log entries below if this bites again.

**Open questions for next session**:
- **Migration 0009 has not been run against the live project yet** —
  overall-bet settlement (this session) is dead on arrival against live
  data until it runs (SQL Editor, same as every prior migration). Also
  still needs a live click-through: award a bonus event and confirm it
  lands on the medal table; use the power move and confirm it shows as used
  everywhere (both from last session, also not yet verified live).
- **Settlement only fires from the event-finalize path** — there's no
  standalone "end the weekend" button. If every event happens to already be
  resolved and something else changes afterward (e.g. a groom edits an
  already-resolved event's results via "Edit results"), open overall bets
  from a *newly-added* player or a late per-event bet wouldn't re-trigger
  settlement, since nothing calls `settleOverallBetsIfWeekendOver` outside
  the finalize flow. Unlikely in practice (all 8 events finalizing is the
  natural end state) but worth a manual "re-settle" trigger if it ever
  comes up.
- Rank ties in settlement use standard competition ranking (1,2,2,4 — a
  tie for 2nd doesn't consume rank 3), tested in
  `src/lib/betting/settleOverallBets.test.ts`. Worth a sanity check against
  real data if the final standings end up close.
- The per-event ranking editor, the multiplier sliders, and per-event bet
  placement all lock UI-side once an event leaves "planned" — no DB-level
  enforcement. Same judgment call as prior sessions, still judged fine given
  this app's app-level trust model (`0002_rls.sql`).
- **Per-event betting is placement-events-only** — resolution keys off the
  `position` field, which absolute-scored events (golf, etc.) never set.
  Extending this needs a definition of "win"/"place" in terms of `raw`
  values first.
- The odds decay (`ODDS_DECAY` in `src/lib/odds/ranking.ts`) was retuned
  this session from 0.72 to 0.9 to bring an 8-player field's longshot win
  payout down from ~33x to ~11-12x — a documented, tunable judgment call
  (see that file's header), not derived from a formula. Worth a gut-check
  once real per-event bets get placed and resolved at the actual event.
- The elimination bounds in `src/lib/betting/fromRows.ts` (used for the
  overall bet's alive/eliminated status) still use the placement curve's
  last-place value as the floor for every remaining event, even ones that
  turn out absolute-scored. Still a documented, conservative-direction
  judgment call, unchanged across sessions.
- Resetting a single event (`EventCard`'s Reset, on the Results tab) doesn't
  touch any open per-event bet that was riding on it — the event reverting
  to "planned" re-opens it for betting again rather than voiding whatever
  was already wagered. Minor, but noted.

## 2026-08-11 — Overall-bet settlement: the last open gap in the spec

Continuing autonomously per "continue with the next phases of work while
I'm away." This closes the payout-crediting gap flagged as an open question
across the previous two sessions — the last piece of `docs/PRODUCT_SPEC.md`
with no code behind it. 138 tests (8 new, `src/lib/betting/
settleOverallBets.test.ts`), lint/typecheck/test/build all green,
dev-server smoke test of `/`, `/bets`, `/events` (clean compile, 200s).
**Needs migration 0009 run against the live project — not yet confirmed.**

- **New migration 0009**: `overall_bets` gets `status` ('open'/'won'/'lost',
  default 'open') and `payout` (numeric) columns — the table only ever
  tracked the live pick before, nowhere to record whether it ultimately
  landed.
- **New pure `settleOverallBets`** (`src/lib/betting/
  settleOverallBets.ts`, +test): compares each open bet's CURRENT pick
  (switch history already baked into `pick_player_id`/`switches` by
  `switchOverallBetPick`) against final standings, using standard
  competition ranking so ties resolve the way a real podium would (a tie
  for 2nd doesn't consume rank 3 — tested explicitly, since this is exactly
  the kind of edge case that's easy to get subtly wrong).
- **New `settleOverallBetsIfWeekendOver`** mutation
  (`src/lib/data/mutations.ts`): reads all events, no-ops unless every
  single one has resolved (cancelled events don't linger — they're hard-
  deleted per spec, so "every event resolved" is the only state to check
  for). If the weekend's over, computes final standings the same way the
  medal table does — `deriveScoreLines` → `standings` → `applyBonusAwards`,
  so a bet's outcome reflects the SAME total a player would see on `/`, not
  a separate parallel calculation — then settles every open bet and writes
  the outcomes back. Wired into `EventCard`'s finalize flow right after the
  existing per-event-bet resolution call, for every event (not just
  placement ones, since checking "is the weekend over" doesn't care about
  scoring mode). No separate "end the weekend" step needed: since the
  function no-ops until the LAST event resolves, calling it after every
  finalize is both correct and idempotent — once bets are settled, a later
  call finds zero still-open bets and does nothing.
- **Medal table now credits won overall bets**: `src/app/page.tsx` maps
  `overallBets` with `status === "won"` into the same `BonusAward` shape
  `applyBonusAwards` already accepts, crediting the payout to the BETTOR
  (not their pick) alongside bonus-event points — no new plumbing needed,
  reused the extension point from last session.
- **`/bets` now shows a bet's final outcome once resolved**: the live
  Alive/Eliminated badge and switch-pick control only apply while
  `status === "open"`; a settled bet shows a plain Won/Lost badge with the
  payout instead (both in the per-type card and in "Everyone's overall
  bets").
- `docs/PRODUCT_SPEC.md` gained a "Settlement" bullet under Overall betting
  documenting when/how this fires — this behavior was previously implied
  but never actually written down.
- **Not independently screenshot-verified** — same standing limitation (no
  browser driver, no live Supabase creds in this worktree), compounded by
  this feature only being observable at the very end of a full weekend of
  play, which obviously hasn't happened yet on the live project. The
  reasonable proxy check (unit tests covering tie-breaking, halving, and
  the no-op-until-weekend-over gate) is done; the real end-to-end check
  will only be possible once the actual event's 8+ events are all finalized
  for real.

## 2026-08-11 — Power move + bonus events: the last two Phase 3-4 features

Migrations 0007 and 0008 (previous two sessions) confirmed run against the
live project by the user at the start of this session. Continuing
autonomously per "continue with the next phases of work" — these were the
last two unbuilt items in `docs/PRODUCT_SPEC.md`'s core rules. 130 tests (4
new, all in `src/lib/bonus/bonus.test.ts` — `applyBonusAwards`),
lint/typecheck/test/build all green, dev-server smoke test of `/`,
`/events`, `/setup` (clean compile, 200s). **No new migration needed** —
both `bonus_events` and `power_move` have existed with RLS + Realtime since
Phase 1, just never had a UI.

- **Bonus events** (`src/components/bonus-events-card.tsx`, new card on
  `/events` below the planned-event list): groom names what happened and
  picks a winner on the spot — no separate "create, then resolve" step,
  matching how spontaneous the spec says these are meant to be. Flat points
  (default 50, editable). Deliberately its own card, not folded into the
  tabbed per-event UI, since the spec is explicit these live entirely
  outside the core event/scoring/betting system.
  - **New: `applyBonusAwards`** (`src/lib/bonus/bonusEvent.ts`, +test) —
    folds bonus points straight onto a `PlayerTotal`, added equally to
    `raw` and `adjusted` (no multiplier applies to a flat bonus), then
    re-sorted with the same tie-break `standings()` uses. `total.ts`'s
    `PlayerTotal` docstring already anticipated this exact extension point
    ("Bonuses ... are added on top elsewhere"). Kept as a one-way
    dependency (bonus imports scoring's `PlayerTotal` type; scoring still
    never imports bonus) to preserve the module's stated isolation.
    `MedalTable` now takes an optional `bonusAwards` prop; the home page
    passes `bonusEvents` from the store, mapped to awards.
- **Power move** (`src/components/power-move-card.tsx`, new card on
  `/setup`, groom-gated): a note field (optional — "what did you do?") plus
  one big irreversible button, matching the spec's explicit "the mechanic
  is deliberately undefined, the fun is in the surprise and timing" — this
  isn't a picker of specific effects, just a record that it happened, when,
  and what. Visible to everyone once used (no groom-only gate on viewing),
  since the whole point is the reveal. Named the mutation `spendPowerMove`,
  not `usePowerMove` — the obvious name collided with the `react-hooks/
  rules-of-hooks` ESLint rule, which flags any non-component function
  starting with `use` as a suspected hook.
- **Not independently screenshot-verified** — same standing limitation
  (no browser driver, no live Supabase creds in this worktree). Dev-server
  smoke test only. Both features are additive and low-risk (no schema
  change, no altered validation rules) compared to the last two sessions —
  still worth the real click-through noted in the open question above.

## 2026-08-11 — Real-use feedback: tabbed events, pick-based bets, budget reserve, tuning

Feedback after the previous rework actually got clicked around. Several
entangled changes landed together. 126 tests (5 net new —
`src/lib/betting/reserve.test.ts` new, `src/lib/betting/
resolvePerEventBets.test.ts` reworked in place, `overall.test.ts` lost its
"last" describe block), lint/typecheck/test/build all green, dev-server
smoke test of all 5 routes (clean compile, 200s). **Not verified against
live data — migrations 0007 AND 0008 both still need to run, see the open
question above.**

- **Setup's ranking picker now shows progress**: `✓`/`○` prefix per event in
  the dropdown, plus an "N of M events ranked" line
  (`src/components/event-odds-editor.tsx`) — the ask was simply "make it
  clearer which events I've done."
- **Odds retuned down**: `ODDS_DECAY` in `src/lib/odds/ranking.ts` split out
  from the placement-scoring decay it used to borrow (0.72 → its own 0.9).
  An 8-player field's win-bet longshot payout was hitting ~33x, which read
  as absurd against a per-player budget of only ~8.0 total multiplier
  points to wager with; 0.9 brings that down to roughly 11-12x. Documented
  as a tunable judgment call in the file header, same as the original 0.72
  choice was.
- **Overall bet payouts split by type**: win stays 100, top3 drops to 20
  (`OVERALL_BASE_PAYOUT` in `src/lib/betting/overall.ts`) — top3 lands
  roughly 3x more often than win in an 8-player field (3 slots vs. 1 every
  event), so a payout cut well past that ratio keeps it a genuinely
  lower-reward bet. `overallPayoutValue` now takes the bet type as a
  parameter. Also fully removed the vestigial "last" bet type from this
  pure module (`isPickAlive`'s third case, the type union, its tests) —
  last session only stripped it from the DB/UI layer and left this dead
  code behind; cleaned up now while already in the area.
- **Overall betting now locks at weekend start**: new placements close and
  "everyone's bets" only becomes visible once any event leaves "planned"
  (`weekendStarted` in `src/app/bets/page.tsx`) — previously bets were
  visible to everyone immediately, which undercut the "no suspense until
  it's locked in" framing the groom wanted. Switching an eliminated pick is
  still allowed post-lock (spec's only deterrent is the halving).
- **Multiplier budget is no longer a strict zero-sum**
  (`src/lib/multipliers/budget.ts`): `validateAllocations` used to require
  landing on exactly zero remaining to save; now it only rejects going
  *negative*. This was necessary, not cosmetic — per-event bets need
  somewhere to draw a wager from that isn't a specific event's own
  multiplier, and "leftover budget you chose not to allocate" is that
  source. `/multipliers` has a new "Betting reserve" card showing what's
  available vs. tied up.
- **New reserve ledger** (`src/lib/betting/reserve.ts`, +test):
  `bettingReserve(eventCount, allocatedToEvents, bets)` computes a player's
  spendable reserve as a live recomputation, not a stored balance —
  `total − allocated − openWagers + Σ(payout − wager)` over every resolved
  bet. That net-per-bet term is what makes a void bet exactly cancel out, a
  lost bet permanently shrink the reserve, and a won bet add its actual
  profit — got this wrong on the first pass (a test caught it: a void bet
  was coming out *ahead* of never having bet at all) and fixed it before
  it shipped.
- **Per-event betting redesigned around a pick** (schema change, migration
  0008): the original build had bettors wagering on their OWN finish,
  inferred from `per_event_bets` having no pick column. That was wrong —
  the ask was "pick someone to win or place," same shape as an overall bet
  but scoped to one event. `pick_player_id` added to the table;
  `resolveOpenPerEventBets` (`src/lib/betting/resolvePerEventBets.ts`) now
  checks the PICK's finishing position, not the bettor's. Wager currency
  changed too: draws from the new unallocated reserve instead of that
  event's own multiplier value (see above), and the betting window moved
  from "while the event is in progress" to "only before it starts" — you
  size up the odds and lock in a pick, you don't bet live mid-event.
- **Events page is now tabbed per event** (`src/components/event-card.tsx`,
  using a hand-written `src/components/ui/tabs.tsx` — `npx shadcn add tabs`
  failed in this sandboxed environment same as every prior shadcn attempt,
  hand-matched the New York style from the existing `badge.tsx`/`card.tsx`
  shape; `@radix-ui/react-tabs` was already an installed dependency).
  Results / Odds / Bets. Odds tab is read-only
  (`src/components/event-odds-table.tsx`) — ranking editing stays on Setup,
  per the groom's explicit "keep editing on Setup" answer. Bets tab
  (`src/components/event-bets-list.tsx`) only renders once the event has
  left "planned," revealing what was wagered on it — this is also where
  "everyone's per-event bets" now lives, replacing the card of the same
  name that used to sit on `/bets` (removed — redundant with this reveal,
  and showing it pre-lock would have spoiled the suspense the groom wanted).
- **Not independently screenshot-verified** — same standing limitation
  (no browser driver, no live Supabase creds in this worktree). This
  session's changes are the most structurally different from prior
  sessions' builds (a real pick-column schema change, a relaxed budget
  invariant, tab-based navigation) — **recommend the most thorough
  real-project click-through yet** once both migrations run: rank an
  event, place an overall bet, place a per-event bet on someone else,
  finalize that event, and confirm the reserve, the bet's resolved status,
  and the Bets-tab reveal all agree with each other.

## 2026-08-11 — Odds move to Setup, per-event ranking, per-event betting, cuts

Four user-driven changes after using the app for real, all landed together
since they're entangled (per-event ranking is *why* per-event betting's odds
finally make sense). 121 tests (10 net new — 13 added across
`src/lib/betting/fromRows.test.ts` (prior session), `src/lib/odds/
aggregate.test.ts`, `src/lib/betting/resolvePerEventBets.test.ts`, minus 3
removed peer-award tests), lint/typecheck/test/build all green, dev-server
smoke test of all 5 remaining routes (clean compile, 200s). **Not verified
against live data — see the open question above about migration 0007.**

- **Per-event ranking, not one overall ranking.** The spec's "the groom
  ranks all 8 players... across all 8 events" turned out ambiguous — this
  session resolves it as one ranking PER EVENT. This wasn't just a UI
  preference: it's what per-event betting's odds actually need (a bet on
  your own finish in golf should be priced off how strong you're predicted
  to be AT GOLF, not overall). `event_rankings (event_id, player_id, rank)`
  replaces the old single `groom_ranking` table (migration 0007 — see the
  open question above, not yet run live). `src/lib/odds/ranking.ts`'s pure
  Plackett-Luce math is unchanged (it already operated on one ranking at a
  time); only its docstring and callers changed.
- **Ranking editor moved from its own `/odds` page to Setup → Groom tools**
  (`src/components/event-odds-editor.tsx`, new: event picker + the existing
  `GroomRankingEditor` drag list, reused as-is). `/odds` as a page is gone —
  odds now show up inline on `/bets`, next to the bet they inform, per the
  user's explicit direction ("you want to see the odds and make your bet").
- **Overall win/top3 odds now come from `src/lib/odds/aggregate.ts`** (new,
  +test): averages each player's rank across every event the groom has
  completely ranked so far (only *complete* rankings count — a partial one
  would skew the average) and re-derives a synthetic 1..N order from those
  averages, then feeds that into the existing `impliedProbabilities`/
  `payoutMultipliers`. Updates automatically as the groom ranks more events;
  no separate input. A documented policy choice (simple mean, not a
  weighted/Plackett-Luce combination) — see the file header for why.
- **Overall betting drops the "last place" joke bet** — down to win/top3,
  per explicit instruction. Enforced in three places: the DB check
  constraint (migration 0007), `OverallBetRow.bet_type`'s TypeScript type,
  and the `/bets` UI (which never rendered a third option to begin with).
  `docs/PRODUCT_SPEC.md` updated to record this as a decision, not silently
  dropped.
- **Per-event multiplier betting, built for the first time** (was
  previously only pure math, `src/lib/betting/perEvent.ts`, with no data
  layer or UI). Lives on `/bets` under "Per-event bets," one card per event
  currently `"scoring"` (**placement events only** — see the open question
  above): shows that event's own win/place odds for the current player,
  and a wager form capped at their currently-locked multiplier for that
  event. `per_event_bets` had no `pick_player_id` column — it turns out
  these are self-bets (you wager on your OWN finish), which is what makes
  "that event's own odds" the right price. New pure resolver
  `src/lib/betting/resolvePerEventBets.ts` (+test) checks the bettor's
  actual finishing position against their target and settles via the
  existing `resolveWon`/`resolveLost` state machine; a thin
  `resolvePerEventBets` mutation wraps the fetch/resolve/write. Wired into
  `EventCard`'s finalize flow — resolving happens automatically the moment
  the groom finalizes a placement event's results, no separate step.
- **No peer award vote** — cut outright, not deferred. Removed
  `src/lib/bonus/peerAward.ts` and its tests (kept `bonusEvent.ts`, which is
  a different, still-planned feature), dropped `peer_award_votes` from the
  schema (migration 0007) and from `resetWeekend`'s wipe list, removed
  `PeerAwardVoteRow`, and moved the spec bullet to "Explicitly out of
  scope" rather than deleting it outright — keeps the paper trail of what
  was considered and cut.
- **Page widths normalized to `max-w-2xl` everywhere.** `/` and `/events`
  had drifted to `max-w-3xl` (probably from being built in an earlier
  session before the convention settled); every other page was already
  `max-w-2xl`. Picked the majority width rather than widening everything
  else to match the two outliers.

## 2026-08-11 — Overall betting: place, switch, live elimination

114 tests (3 new — `src/lib/betting/fromRows.test.ts`), lint/typecheck/
test/build all green, dev-server smoke test of `/bets` and `/` (clean
compile, 200s).

Picked as the next Phase 3–4 slice, continuing on from the odds screen
(explicit go-ahead: "continue with the next plan item"). No new migration —
`overall_bets` already had RLS (`0002_rls.sql`) and Realtime
(`0003_realtime.sql`) from Phase 1, unlike `groom_ranking` last session.

- **`src/lib/betting/fromRows.ts`** (new, +test): bridges DB rows to the
  `EliminationInput[]` that `isPickAlive` (already existed, Phase 0) needs.
  Computes each player's current multiplier-adjusted total via the existing
  `deriveScoreLines` + `playerTotals`, and shared max/min remaining-points
  bounds via the existing `remainingBounds`, using the placement curve's
  last-place value (rounded, matching how placement scores are stored) as
  the pessimistic per-event floor — see the open-question note above for why
  that's a documented approximation, not an exact derivation.
- **Data layer**: `fetchOverallBets` (queries.ts) + `placeOverallBet` /
  `switchOverallBetPick` (mutations.ts). One row per (player, bet_type) by
  convention — there's no DB unique constraint enforcing that (schema
  predates this session), so the UI is what prevents a duplicate placement
  by switching to "switch" mode once a bet exists for that type.
  `switchOverallBetPick` reads the current `switches` count and increments
  server-side in the same call, rather than trusting a client-supplied
  count, to avoid a stale-read race.
- **Store**: `gameStore.ts` now fetches + realtime-subscribes to
  `overall_bets` alongside everything else.
- **UI**: `src/app/bets/page.tsx` — one card per bet type (win/top3/last).
  Shows the current player's pick, live Alive/Eliminated badge, and the
  payout value at their current switch count if they have one; a plain
  picker + "Place bet" if they don't. Switching is **only offered once the
  pick reads eliminated** (per spec: "if a player's pick becomes
  mathematically eliminated... they get the option to switch"), and the
  switch-to picker is filtered to still-alive players only. Below that, an
  "Everyone's bets" card lists every bet with its live alive/eliminated
  status — consistent with this app's "no suspense, visible to everyone"
  design used everywhere else (medal table, odds).
  - Deliberately did **not** gate bet placement on the groom having set a
    ranking — the payout is flat regardless of pick (spec: "the odds already
    reflect difficulty... the reward doesn't need to scale on top of that"),
    so nothing about betting mechanically depends on odds existing, even
    though the odds screen is what makes an *informed* pick possible.
  - Also didn't restrict betting on yourself — the spec doesn't forbid it
    and it's a harmless edge case (the "last place" joke bet on yourself is
    arguably in the spirit of the thing).
  - Added `/bets` to `app-nav.tsx` (Coins icon) — six links now in the
    mobile floating nav; still fits, each item just gets a little tighter.
- **Not independently screenshot-verified** — same standing limitation
  (no browser driver, no live Supabase creds in this worktree). Dev-server
  smoke test only. **Recommend an actual click-through** once deployed:
  place a bet, resolve enough events to eliminate a pick, confirm the badge
  flips and the switch picker appears with the right candidates.

## 2026-08-11 — Event results list, odds screen relabel, weekend/event reset

Follow-up polish requested after the odds screen shipped and got a real
look. 111 tests (unchanged — no new domain logic, all UI/data-layer),
lint/typecheck/test/build green, dev-server smoke test of `/`, `/events`,
`/odds`, `/setup` (clean compile, 200s).

- **Event results now a vertical list** (`src/components/event-card.tsx`):
  was a `flex-wrap` row that packed every player's name+score onto as few
  lines as possible — hard to scan, especially on a phone with 8 players.
  Now one player per row, name left / value right.
- **Odds screen's ranking editor now sits under a "Groom tools" card**
  (`src/app/odds/page.tsx`) — same title/icon convention as the Setup
  page's groom section, instead of its own "Set the ranking" heading. The
  payout-odds table above it is unchanged and still visible to everyone.
- **Reset an event** (`resetEvent` in `mutations.ts`, button on
  `EventCard`): deletes that event's results and sets it back to
  `"planned"`. Deliberately narrower than cancel — the event, its photo, and
  any multiplier values allocated to it are untouched; going back to
  `"planned"` just re-unlocks its multiplier (locking is derived from
  `status !== "planned"`, not a stored flag, so no separate unlock step was
  needed). Same two-step confirm pattern as "Cancel event," right next to it.
- **Reset the whole weekend** (`resetWeekend` in `mutations.ts`, "Danger
  zone" card on `/setup`, groom-gated): wipes every table of weekend
  *activity* — event results, multiplier allocations, all three bet/vote
  tables, bonus events, the power move (back to unused), and the groom's
  ranking — and puts every event back to `"planned"`. **Deliberately keeps
  players and the theme** — this restarts the competition, not the guest
  list or the look, per the user's explicit choice when asked (they also
  chose to include the ranking in the wipe, unlike the narrower option
  offered). Two-step confirm, same as the other destructive actions in this
  app. Implemented as a loop of per-table deletes (`.delete().not(col, "is",
  null)`, the same "wipe all rows" trick used for `setGroomRanking`'s
  clear-then-insert) rather than a single transaction — no way to run a
  multi-statement transaction through the anon-key REST API this app uses
  everywhere else, and a partial reset from a mid-loop failure is an
  acceptable risk for a rare, groom-only admin action (re-running it is
  idempotent — deleting already-empty tables is a no-op).
- **Not independently screenshot-verified** — same standing limitation as
  every session so far (no browser driver, and this worktree has no
  `.env.local` so there's no live data to exercise interactively). Ran a
  dev-server smoke test only. **The two reset actions are the highest-risk
  code in this session** — recommend the user actually click through both
  confirm flows against the live project once deployed, since a wrong
  table/column name here would silently no-op rather than error loudly
  (Postgres doesn't complain about deleting zero rows).

## 2026-08-11 — Groom's odds-ranking screen

111 tests, unchanged — no new tests added, since this session's new code is
UI/data-layer wiring around `src/lib/odds/ranking.ts`, which was already
fully tested from Phase 0. lint/typecheck/test/build all green, dev-server
smoke test of `/odds` and `/` (clean compile, 200s).

Read `PRODUCT_SPEC.md` → Overall betting → Odds source before starting, per
CLAUDE.md. Picked this as the first Phase 3–4 slice (user's explicit choice
among four options) because it's the prerequisite for every other betting
feature — nothing else in that phase can go live without odds existing first.

- **New migration** `supabase/migrations/0006_groom_ranking_realtime.sql` —
  found a real gap: `groom_ranking` has existed since `0001_init.sql` and
  already has RLS from `0002_rls.sql`, but `0003_realtime.sql` never added it
  to the `supabase_realtime` publication. Without this fix the odds screen
  would need a manual refresh to see a new ranking instead of updating live
  like everything else. **Needs to be run in the SQL Editor**, same pattern
  as 0002-0005. (Unlike `app_settings` in the theme work, this table already
  existed on the live project, so nothing else was blocked by it being
  unrun — only Realtime sync on this one table is affected until it runs.)
- **Data layer**: `fetchGroomRanking` (queries.ts, sorted by rank) +
  `setGroomRanking` (mutations.ts) — the ranking is always saved as a full
  1..N replace (delete-all then insert), not a partial edit, since the odds
  screen always submits a complete ordering. Two round-trips, not atomic,
  but judged fine for a single-groom, low-concurrency admin action — same
  risk profile as other groom-only writes in this app.
- **Store**: `gameStore.ts` now fetches + realtime-subscribes to
  `groom_ranking` alongside the other tables. Included directly in the main
  `Promise.all` (not fetched separately with a `.catch`) because — unlike
  `app_settings` — this table isn't new, so there's no pre-migration project
  state where fetching it would throw and block everything else.
- **UI**: `src/components/groom-ranking-editor.tsx` — drag-to-reorder list,
  reusing the same `@dnd-kit` PointerSensor pattern as
  `ranked-results-editor.tsx`, but deliberately **no tie toggle** — the
  groom's ranking must be a strict 1..N ordering (`assertValidRanking` in
  `src/lib/odds/ranking.ts` enforces unique ranks), unlike event results
  which allow ties.
  `src/app/odds/page.tsx`: everyone sees the win/top3/last payout
  multipliers (computed via `impliedProbabilities` + `payoutMultipliers`,
  both already existed and were already tested); only the groom (PIN-gated,
  same pattern as every other groom tool) sees the ranking editor, and only
  while every event is still `planned` — locks the same way multiplier
  sliders do, matching the spec's "set once, upfront, no live updates"
  design intent even though it isn't DB-enforced (see the open question
  above). Added `/odds` to `app-nav.tsx` (Percent icon).
  - Handles player-list drift: if a player is added after a ranking was
    already saved, the editor appends them at the bottom of the existing
    order rather than discarding the ranking and starting over.
  - Odds only render once the saved ranking covers every current player —
    otherwise shows "the groom hasn't set a ranking yet" rather than a
    partial/misleading table.
- **Not independently screenshot-verified** — same standing limitation as
  every prior session (no browser driver in this environment). Ran a
  dev-server smoke test instead (clean compile, `/odds` and `/` both 200)
  from a git worktree with no `.env.local`, so this only proves the page
  renders and doesn't crash without live data — not a check against the real
  Supabase project's actual player/ranking rows. **Recommend a manual look
  at the deployed app** (or `localhost:3000` with real creds) as the next
  concrete check, same as the progress-chart caveat from the prior session.

## 2026-08-11 — Shared tweakcn theme picker under groom tools

111 tests, all gates green. Shared (not per-device) — matches every other
groom tool, which all act on shared game state; live for everyone via the
same Realtime pattern as the rest of the app.

- `src/lib/themes.ts`: "Classic" (this app's original default, transcribed
  verbatim from `globals.css`) + 6 **real** tweakcn presets — Modern Minimal,
  Twitter, Bubblegum, Doom 64, Tangerine, Catppuccin — fetched directly from
  `tweakcn.com/r/themes/<slug>.json` on 2026-08-11, not invented/approximated.
  Only the CSS vars this app's `globals.css` actually declares are kept.
- `supabase/migrations/0005_theme.sql`: single-row `app_settings` table
  (same pattern as `power_move`), trusted-friends RLS, added to the realtime
  publication. **Needs to be run in the SQL Editor** before the picker
  actually changes anything live — same pattern as 0002-0004.
- `src/components/theme-applier.tsx` (mounted once in `layout.tsx`): writes
  the active theme's tokens as inline styles on `<html>` — wins over the
  static `:root` values in `globals.css`, updates instantly since
  `gameStore` already Realtime-subscribes to `app_settings`. Only the light
  token set is live (this app still has no dark-mode toggle wired up, so
  `theme.dark` is captured for completeness but unused — same call as the
  progress-chart work).
- `src/components/theme-picker.tsx`: swatch grid on `/setup`'s groom tools,
  gated the same way as the other admin actions.
- **Caught a real regression before it shipped**: `app_settings` didn't
  exist yet (migration not run), and `fetchAppSettings` was originally
  inside the same `Promise.all` as the core game data in `gameStore` — that
  would have thrown and blocked players/events/everything from ever loading
  on any device until the migration ran. Fixed: `appSettings` now fetches
  separately with a `.catch(() => null)`, and `ThemeApplier` already treats
  `null` as "use Classic." **Verified live against the actual pre-migration
  project**: core data (8 players, 9 events) loads fine, `appSettings`
  degrades to `null` exactly as intended, nothing else breaks.

## 2026-08-11 — Live progress chart + tie fix + mobile nav + player settings

105 tests, all gates green (lint/typecheck/test/build), plus a dev-server
smoke test of all four routes (200s, clean compile log) against the live
Supabase project (8 real players already set up, Beach Volleyball resolved).

- **Progress chart** (`src/components/progress-chart.tsx`, homepage, above
  the Medal Table): live line chart of cumulative multiplier-adjusted points
  per player across the weekend, via `recharts`. Loaded the **dataviz skill**
  before writing any chart code (mandatory trigger) and followed it
  end-to-end:
  - **Color** (`src/lib/chartColors.ts`): "flag-inspired, auto-disambiguated"
    per the user's explicit choice after I flagged that most US state flags
    are blue-field-plus-seal, so literal flag colors would collide. Uses the
    dataviz skill's validated 8-slot categorical palette (re-validated
    against this app's *actual* surfaces — light `#ffffff`, dark `#241e1a`,
    converted from the real oklch tokens — not just the skill's generic
    defaults; `node scripts/validate_palette.js`, all checks pass). A small,
    deliberately non-exhaustive table maps a handful of genuinely
    well-known, distinctive state flags (AZ copper-orange, NM Zia
    yellow/gold, CA bear-flag red, MD Calvert gold, OH/FL/AL red saltire,
    TX/SC blue field) to their nearest slot; two-pass assignment lets
    preference-holders claim first, then fills everyone else from the
    remaining slots in fixed order — guarantees every player a distinct,
    validated color regardless of how many flags I actually know.
    **Found and fixed a real bug via live-data testing**: single-pass
    assignment let a no-preference player steal a preferred slot ahead of
    its rightful claimant depending on processing order; two-pass fixed it
    (verified against the live project's real 8 players — AZ→orange,
    TX→blue, CA→red, all landed correctly, all 8 still distinct).
  - **Data** (`src/lib/scoring/cumulativeSeries.ts`, pure + tested): a
    leading synthetic "Start" point at zero, then one equally-spaced x
    position per event regardless of status; a player's cumulative total is
    only set once that event resolves, otherwise null — the line stops at
    the live frontier instead of implying false continuation. Verified
    against live data: 10 points (start + 9 events), Beach Volleyball's
    resolved totals correct, the other 8 events correctly null.
  - **Marks**: player photo as the dot marker (SVG `<image>`, circular clip,
    2px surface ring per the skill's spec so overlapping markers stay
    legible), native `<title>` for per-marker hover, fallback for players
    without a photo.
  - **Interaction**: crosshair + one tooltip listing every player's value at
    that event (avatar+flag+name, value bold), per `interaction.md`.
  - **Legend**: always visible with line-key swatches (not boxes) — required
    relief for the light-mode contrast WARN the validator flagged on 3 of
    the 8 slots.
  - X-axis ticks are the event's number, not its full name — long names
    ("Super Smash Bros. (N64)") would collide on a phone-width chart (per
    the skill's "measure first, don't clip" rule); full names live in the
    tooltip.
  - **Not independently screenshot-verified** — no browser driver available
    in this environment (same limitation as earlier in this project). Ran
    the actual data pipeline (`cumulativeSeries` + `assignPlayerColors`)
    against live data instead, and a dev-server smoke test confirmed clean
    compiles and 200s on every route. A manual look at `localhost:3000` (or
    the deployed app) is the one remaining check.
- **Tie fix** (`src/components/ranked-results-editor.tsx`): the visible rank
  badge was showing raw list index instead of the actual computed position,
  so checking "tied with row above" didn't visibly change anything — now
  reads from `positionsFromOrder()`. Also added the tie toggle to every row
  (including 1st, disabled/inert there — nothing above it to tie with) for
  visual consistency, per the ask.
- **Floating bottom mobile nav** (`src/components/app-nav.tsx`): single
  responsive component — fixed floating pill bar on mobile widths, reverts
  to the original inline row at `sm:` and up. Added matching bottom padding
  to every page's `<main>` so the floating bar doesn't cover content.
- **Setup → Player Settings**: person icon, nav label shows the selected
  player's name once picked on this device (falls back to "Player Settings"
  otherwise), page heading updated to match.

## 2026-08-11 — Groom-requested polish batch

Six asks in one batch, all shipped. 93 tests, all gates green.

- **Stump**: dropped the sobriety-check flag/language from
  `src/lib/events/config.ts` + `PRODUCT_SPEC.md`. Also fixed a real bug found
  along the way: `seedEvents()` used `ignoreDuplicates: true`, so it could
  never actually propagate a config edit to an existing live row. Now it
  upserts every config-owned column except `status` and `photo_url` (both
  live app state), verified against the real `stump` row — content updated,
  status (`scoring`, from the user's own live testing) correctly preserved.
- **Placement scoring rounded to whole numbers** (`src/lib/scoring/placement.ts`):
  rounds the final tie-split share, not the underlying 0.72 decay curve, so
  ties still split fairly in continuous space first. Table now reads
  100/72/52/37/27/19/14/10. Total-points-awarded invariant can drift by ~1-2
  points from rounding — judged negligible against `simulation-notes.md`'s
  70-130 point finisher gaps; did not rerun the simulation.
  `src/lib/scoring/absolute.ts` is untouched (proportional scaling is the
  point there, rounding would blur close results) — scoped to placement only,
  as asked.
- **Groom: edit/remove players**: `updatePlayer` mutation +
  `src/components/manage-player-row.tsx`, wired into a new "Manage players"
  card on `/setup`. Verified live (add → update → confirm → clean up).
- **Drag-and-reorder placement results**: added `@dnd-kit` (PointerSensor, so
  it works on touch — this runs on phones at the actual event, native HTML5
  drag-and-drop doesn't). Split the tricky bit into pure, unit-tested helpers
  (`src/lib/scoring/rankedOrder.ts`: order+tie-set ↔ position numbers) from the
  UI (`src/components/ranked-results-editor.tsx`). Ties are a "tied with row
  above" toggle rather than a drag gesture — precise tie ordering via drag
  alone is fiddly, a toggle isn't. Absolute-mode events (golf, etc.) keep the
  plain numeric input — dragging doesn't make sense for strokes/time.
- **Player + event photos**: `photo_url` columns, a `photos` Storage bucket
  (public read, trusted-friends anon write policy — same model as
  `0002_rls.sql`), `src/lib/supabase/storage.ts` upload helper, groom-gated
  upload controls on `/setup` and each event card, displayed as a circular
  avatar next to `PlayerName` everywhere and a thumbnail on `EventCard`. Used
  `next/image` (not a plain `<img>`) — `next.config.ts` now derives the
  allowed remote host straight from `NEXT_PUBLIC_SUPABASE_URL`, no per-env
  config needed.

**Needs `supabase/migrations/0004_photos.sql` run in the SQL Editor before
uploads work** (same pattern as 0002/0003) — adds the columns + bucket +
storage.objects policies. Everything else in this batch works against the
live project as-is; only the photo feature is blocked pending that migration.

## 2026-08-11 — Realtime confirmed working (migration 0003 run)

User ran `supabase/migrations/0003_realtime.sql`. Re-ran the probe: inserted a
row, updated it, both `INSERT` and `UPDATE` `postgres_changes` events fired
correctly, probe row cleaned up. `src/store/gameStore.ts` subscribes with the
identical client/channel pattern against the same now-published tables, so
Phase 1's live-sync goal is met. **Phase 1 is functionally done** — schema,
RLS, auth model, data layer, store, and Realtime are all built and verified
against the real project.

Not independently confirmed: a rendered browser actually reflecting a change
live (no browser driver available in this environment — see prior session's
`claude-in-chrome` note). The underlying mechanism is proven at the client
level; a manual check with two browser tabs open to `localhost:3000` would be
the natural next confirmation, cheap to do by hand.

## 2026-08-11 — Live Supabase project wired up, data layer + store built

User created a real Supabase project and ran migrations 0001 + 0002. Branch
`matthew/phase-1-data-store`, on the stack tip. 84 tests; all gates green;
**verified against the live project**, not just typechecked:

- `src/app/api/groom/unlock/route.ts` — checks the PIN server-side against
  `process.env.GROOM_PIN` (no `NEXT_PUBLIC_` prefix), so it never ships in the
  client bundle. Verified live: wrong PIN → `{ok:false}`, correct PIN → `{ok:true}`.
- `src/lib/data/queries.ts` + `mutations.ts` — thin Supabase wrappers
  (fetch/add/remove players, fetch events/results/multipliers, idempotent
  `seedEvents`). Verified live: add → fetch → remove round-tripped correctly
  and left the DB exactly as before (no orphaned test rows).
- `src/lib/scoring/fromRows.ts` (+test) — pure bridge from DB rows to
  `EventScoreLine[]` (only `resolved` events score; `cancelled` excluded per
  spec). DB-agnostic and unit-tested.
- `src/store/gameStore.ts` — zustand store: fetches players/events/results/
  multipliers once, then a single Realtime channel refetches everything on any
  change to those tables (simple + cheap at 8-player scale).
- `src/store/sessionStore.ts` — zustand wrapper over `src/lib/session/identity.ts`,
  wired to `/api/groom/unlock`.
- `src/app/setup/page.tsx` — real screen: pick which player you are; groom-PIN
  gated "add player" form (name, nickname, US state, is-groom checkbox).
- `src/app/page.tsx` — Medal Table now reads live store data instead of demo
  seed data (`src/lib/demo.ts` deleted).
- `scripts/seed-events.ts` (`npm run seed:events`) — ran live: all 9 events
  from `src/lib/events/config.ts` seeded into the real `events` table, verified
  by direct query.
- Hand-wrote `ui/input.tsx` + `ui/label.tsx` (shadcn registry unreachable
  in-sandbox, same reason as `ui/table.tsx` earlier).

**Found and fixed via live testing:** Realtime subscriptions returned
`SUBSCRIBED` but produced zero `postgres_changes` events on a real insert — new
Supabase projects don't auto-add tables to the `supabase_realtime` publication.
Added `supabase/migrations/0003_realtime.sql` (`alter publication
supabase_realtime add table ...` for every game table). **User needs to run
this one too** (SQL Editor, same as 0001/0002) before Realtime actually works;
re-verify with the probe script below once it's run.

Local dev note: this machine sits behind corporate TLS interception (Zscaler).
`curl`/browsers trust it via the macOS keychain; Node's `fetch` doesn't by
default. Fix: export the "Zscaler Root CA" cert from Keychain Access and set
`NODE_EXTRA_CA_CERTS` to its path before running `npm run dev` / any script
that calls Supabase from Node. Not needed for the browser itself. Cert file
intentionally not committed (kept in a scratch dir).

Realtime re-verify probe (self-terminating, cleans up its own test row):
```
NODE_EXTRA_CA_CERTS=<path> npx tsx -e "
import { createClient } from '@supabase/supabase-js';
process.loadEnvFile?.('.env.local');
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const ch = client.channel('probe').on('postgres_changes', {event:'*',schema:'public',table:'players'}, (p) => console.log('EVENT', p.eventType));
ch.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') {
    const { data } = await client.from('players').insert({ name: '__probe__', state: 'CA' }).select().single();
    setTimeout(async () => { await client.from('players').delete().eq('id', data.id); process.exit(0); }, 3000);
  }
});
"
```

**Remaining for full Phase 2:** event board, groom score entry, multiplier
sliders with the zero-sum gate — all straightforward once Realtime is
confirmed, following the same store pattern as the medal table.

## 2026-08-11 — Auth decided + session/identity + RLS

**Decision:** shared-link **name picker** (no accounts). Branch
`matthew/phase-1-auth-session`, on the stack tip. 79 tests; all gates green.

- `supabase/migrations/0002_rls.sql` — RLS for the trusted-friends model:
  enable RLS on all game tables, permissive anon read/write. The trust boundary
  is the link; the groom gate is app-level (PIN), not DB. Documented how to swap
  to `auth.uid()` policies if we ever move to magic-link auth.
- `src/lib/session/identity.ts` (+test) — pure player-picker + groom-PIN gate
  behind a `KeyValueStorage` interface. Blank PIN never unlocks.
- `src/lib/session/browserStorage.ts` — SSR-safe localStorage adapter.

**Still deferred (needs a live Supabase project — can't provision in-sandbox):**
the data-access query/Realtime layer (`src/lib/data/*`) and the zustand store
(`src/store`). Design is settled now, though: store hydrates from Supabase +
subscribes to Realtime; identity comes from the session module; groom writes
gated by `isGroomUnlocked`. The `GROOM_PIN` needs an env var (add to
`.env.example` when the store lands).

**Next once a project exists:** create Supabase project → paste creds into
`.env.local` → run both migrations → build `src/lib/data/*` + `src/store` →
swap the medal table off `src/lib/demo.ts` onto the store → then the remaining
Phase 2 screens (player setup/state picker, event board, score entry,
multiplier sliders with the zero-sum gate).

## 2026-08-10 — Phase 2 flags + medal table (decision-independent slice)

Branch `matthew/phase-2-flags-medal-table`, stacked on Phase 1. Built the
flags-next-to-names feature and the live medal table — the parts of Phase 2 that
need neither auth nor Supabase, so they're fully verifiable now. 71 tests; all
gates green; **verified rendering in the real dev server** (server-rendered
standings, correct sort, flag `aria-label`s, podium medals).

- `src/lib/states.ts` (+test) — USPS code ↔ name, picker options.
- `src/components/flag.tsx` — the `Flag` chip. **Single swap seam** (`FlagGlyph`):
  today an abbreviation chip; replace only that function with `<svg>`/`<img>` to
  move to real state-flag assets. Every `<Flag state="TX" />` call site is stable.
- `src/components/player-name.tsx` — flag + name + optional nickname, the
  standard way to show a competitor anywhere.
- `src/components/medal-table.tsx` — pure presentation over the Phase-0
  `standings()`; feed it live data from the store later, no change needed.
- `src/components/ui/table.tsx` — hand-written shadcn `table` (registry was
  unreachable in-sandbox; matches the new-york shape of the other ui/ files).
- `src/lib/demo.ts` — **placeholder** seed data (real scoring math, made-up
  players). Delete once the store feeds live data.
- `src/app/page.tsx` — now renders the Medal Table instead of the scaffold.

Still open for full Phase 2: player setup / state picker, event board, groom
score entry, multiplier sliders with the zero-sum gate. These want the Phase-1
store, so they come after the auth decision.

## 2026-08-10 — Phase 0 complete, Phase 1 started

### Done & verified

**Phase 0 — domain core** (branch `matthew/phase-0-scoring-core`, committed).
The whole rulebook from `docs/PRODUCT_SPEC.md` as pure, unit-tested TypeScript
under `src/lib/` (no React, no Supabase). 64 tests; lint/typecheck/build green.
Modules: `events/config`, `scoring/{placement,absolute,total}`,
`multipliers/budget`, `odds/ranking`, `betting/{overall,perEvent}`, `bonus/`.
Tooling added: **Vitest** (`npm run test`) and the **Next flat ESLint config**
the scaffold was missing. Spec corrected (user-authorized): groom is one of the
8 competitors and also officiates.

**Phase 1 — backend groundwork** (branch `matthew/phase-1-supabase`, stacked on
Phase 0). Decision-independent pieces only, all compiling (67 tests, gates
green):
- `supabase/migrations/0001_init.sql` — full schema mirroring the domain
  (players, events, event_results, multipliers, groom_ranking, overall_bets,
  per_event_bets, bonus_events, peer_award_votes, power_move). **DRAFT: RLS not
  configured yet** (see below).
- `src/lib/data/database.types.ts` — row types matching the migration.
- `src/lib/data/events.ts` (+test) — seeds the `events` table from
  `src/lib/events/config.ts` so app and DB share one source of truth.
- `src/lib/supabase/client.ts` — lazy browser client from env.
- `.env.example` — Supabase vars uncommented with guidance.

### Blocked — needs a decision + a live project

Two things gate the rest of Phase 1, so I stopped rather than guess:

1. **Auth mechanism (open decision).** Magic-link accounts vs. shared-link name
   picker. This drives the **RLS policies** (left as a TODO at the bottom of the
   migration) and the shape of "who am I" in the data layer. Not built yet:
   auth flow, RLS, the data-access query/Realtime layer (`src/lib/data/*`), and
   the zustand store (`src/store`).
2. **No Supabase project/credentials** in this environment, so Realtime sync is
   unverifiable here. Someone needs to create the project, paste URL + anon key
   into `.env.local`, and run the migration.

### Suggested next steps

- Decide the auth model → finish RLS in `0001_init.sql` → build
  `src/lib/data/*` (queries + Realtime subscriptions) → `src/store`.
- Or, in parallel and decision-independent: start **Phase 2 UI** — the `Flag`
  component (US states) + a medal-table view driven by the Phase-0 domain layer
  with seed data, wiring it to the store once Phase 1 lands.

### Branch/merge note

Phase 0 and Phase 1 branches are stacked and **unpushed**. Phase 0 should merge
to `main` first; Phase 1 rebases onto it. Nothing pushed to `main`.
