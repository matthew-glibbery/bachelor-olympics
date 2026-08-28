# Bachelor Olympics — Product Spec

This is the source of truth for how the competition actually works. If you're
an agent picking up this codebase cold, read this whole file before writing
any scoring, betting, or multiplier logic — the rules here are specific and
were arrived at deliberately; don't infer or simplify them.

The groom is one of the competitors — he plays and scores points like everyone
else — and he *also* officiates: he sets the odds and enters scores. This means
he sets odds on a field that includes himself; that conflict of interest is a
deliberate, accepted trade-off (the players trust him, and no one else knows
all the competitors well enough to set odds credibly).

## Events

The roster is 7 players. Eight pre-planned events, decided in advance
(the event count and the player count are independent — don't assume they
match; `src/lib/events/config.ts` and the live roster are the source of
truth for each, never hardcode either):

1. Beach volleyball (4v4, multiple games, teams reshuffled between games)
2. Spikeball
3. Mölkky (a.k.a. "Skittle Scatter")
4. Super Smash Bros. (N64)
5. Settlers of Catan (8-player, using two combined board sets — see note below)
6. Nine holes of golf
7. 3v3 soccer
8. Beer pong
9. Stump (hammering nails into a stump)

(Yes, that's 9 listed — the roster may still get trimmed to a clean 8; don't
hardcode the count, read it from event config.)

The list above is the initial seed, not a hard ceiling — the groom can add,
edit (name, photo, description, scoring type), delete, and reorder events
from the app itself (Setup → Manage events), not just via
`src/lib/events/config.ts`. Reordering is what every screen's event order
follows. Scoring type is only editable while an event is still "planned" —
switching placement↔absolute after results exist would corrupt them (the
two modes store a result differently). This is distinct from on-the-fly
BONUS events (below), which are a separate, deliberately isolated concept.

### Event-specific structure

- **Beach volleyball / 3v3 soccer** (team, reshuffled): no true individual
  score exists — these use the **round-robin** event format (see Event
  formats below): a generated schedule of rotating teams, win/loss per
  match, placement derived from each player's win count across the whole
  schedule.
- **Settlers of Catan**: one single 8-player game using two combined sets
  (the "peanut" board layout), not two separate 4-player games. Placement
  scoring applies normally once the game resolves.
- **Super Smash Bros.**: two groups of four, round-robin free-for-all within
  each group, top two from each group advance to a four-player final. Final
  standings come from combining group performance + final result — this is
  the one event where the "placement" isn't a single race, so worked out
  case-by-case, not derived from a formula.
- **Stump**: standard placement scoring, no special handling.
- **On-the-fly bonus events** (added spontaneously during the weekend, not
  pre-planned): these are **out of the main scoring and betting system
  entirely**. Flat points straight onto one player (default 50), no odds, no
  multiplier interaction, no effect on elimination math. Keep this as its own
  isolated code path — don't let it touch the core event/scoring model.
  Points can also be **negative** — the same mechanism doubles as a flat
  point deduction (e.g. a groom-assessed penalty), not a separate concept.
  Editable/deletable after the fact (groom tools), same as everything else
  the groom manages.

## Scoring

Two scoring modes, chosen per event:

- **Placement-based** (used for judged or head-to-head events): points follow
  an exponential decay curve so first place is worth meaningfully more than a
  close second, but last place still isn't zero, and every value on it is a
  round number:

  | Place | 1   | 2  | 3  | 4  | 5  | 6  | 7  | 8  |
  |-------|-----|----|----|----|----|----|----|----|
  | Points| 100 | 70 | 50 | 35 | 25 | 20 | 15 | 10 |

  Formula: `points = round_to_nearest_5(100 * 0.72^(place - 1))`, with a floor
  of 5 so a very deep field never awards zero. Keep this as a formula, not a
  hardcoded table, in case the event or player count changes.

  The snap to multiples of 5 is a deliberate decision (2026-08-24, direct
  product feedback: "I'd prefer the scores for each position to be a round
  number like 50 rather than 52"). The curve itself is unchanged — these are
  its own values rounded — so the shape, the 1st-place premium and the
  relative gaps all still hold; a scoreboard of 100/70/50 is simply legible in
  a way that 100/72/52 is not. **With 7 players, last place is worth 15.**
  The rerun in `simulation-notes.md` confirms this did not move the overall-bet
  payout: the finishing gaps this curve produces are within a point or two of
  the old one's.

  Ties are the one place a non-multiple-of-5 can appear: the pooled places are
  split evenly and then rounded to a whole number (see Ties below), because
  forcing a tie share onto a multiple of 5 would distort the split rather than
  just present it. Fractional points are never awarded.

- **Absolute-score-based** (used where there's a real measurable result, e.g.
  golf strokes, a timed event): scale the field onto **the same range a
  placement event spans**. The best raw result is worth 100; the worst raw
  result is worth exactly what last place is worth on the placement curve for
  a field that size (15 with 7 players); everyone else lands proportionally to
  where their raw result fell between those two. A blowout still looks like a
  blowout, because the spacing follows the raw numbers rather than the
  ranking. **Rounded to the nearest whole number**, same as placement scoring
  — an earlier version of this spec argued against rounding here to preserve
  close-result detail, but the product decision is now that no scoring
  currency in this app ever shows a fraction, full stop.

  This replaced a "ratio to the best result" rule (2026-08-24, direct product
  feedback), under which everyone scored `100 × raw / best`. That version left
  the bottom of the range undefined and metric-dependent, and it made absolute
  events quietly worth more than placement ones: a golf field of 40-60 strokes
  compressed into 100-67, so *last place at golf outscored 3rd place at
  everything else*. Pegging both ends puts every event on the same scale.

  Edge cases follow from that framing: a field where every raw result is
  identical is a tie for every place at once, so it resolves like any other
  tie (pool all the places, split evenly) rather than paying everyone 100; a
  single scored player is simply the best result there was, and gets 100.

- **Ties**: if two or more players tie a placement, sum the point values for
  all the places they're tying across (e.g. 2nd + 3rd) and split evenly
  between them, then round.

## Event formats

Every event still resolves to exactly one placement or absolute score per
player in the end — these are two additional ways to *arrive* at that
placement, alongside the default (a single groom-entered final order).
Selected per event as `format`: `standard` (default), `bracket`, or
`round_robin`. Bracket and round-robin events are always placement-scored —
neither format produces a measured "absolute" result. Once the final
placement is written, everything else (the points formula above, the
catch-up bonus, per-event bet resolution, overall-bet elimination math) is
completely unaffected by which format produced it.

### Bracket

Single-elimination, with byes for a field that isn't a power of two.

- **Seeding**: starts as a copy of the groom's per-event ranking (the same
  ranking that drives betting odds — see Odds source below), but lives in
  its own independent ordering that the groom can freely adjust afterward.
  Adjusting bracket seeding never changes betting odds, and vice versa.
- **Byes**: the top seed(s) get the bye(s), using standard tournament
  seeding (seed 1 can only meet seed 2 in the final, etc.) generalized to
  any field size. A bye is a normal advance — no scoring bonus or penalty.
- **Consolation matches**: two are optional, off by default:
  - A real **3rd-place match** between the two semifinal losers. If not
    played, they simply tie for 3rd (pooled points split per the placement
    tie rule above).
  - A real **5th-place match**, but only ever between the top two *seeds*
    of the round-before-semis losers — a deliberate scoping simplification,
    not a full mini-bracket for that whole band. Any other players in that
    band still tie with each other one place below the match's loser. If
    not played, the whole band ties together.
  - Every band further back than that (quarterfinal-round losers and
    earlier, when no 5th-place match covers them) always just ties as one
    group — no consolation option offered past 5th.
- **Entry**: the groom enters the actual match tree (each round, who played
  whom, who won) — placements are derived automatically from it, not typed
  in directly. Editing an earlier match's result correctly recomputes every
  later round that depended on it. The derived placement can still be
  manually fine-tuned (drag-reorder, same editor every other placement
  event uses) before finalizing.

### Round-robin

Rotating 2- or 4-person teams playing a full generated schedule, win/loss
only (no margin) — this is what beach volleyball and 3v3 soccer actually
use, replacing an earlier, never-implemented idea of tracking win/loss by
hand.

- **Schedule**: the app auto-generates the round-by-round team pairings (a
  full cyclic rotation each round, with a rotating sit-out set spread
  fairly across players when the roster doesn't divide evenly into full
  teams) — the groom doesn't hand-assign teams each round. Team size is a
  target, not a strict requirement: if the roster can't field even one
  full-size match (e.g. 4-person teams with 7 players), everyone still
  plays in one uneven match instead (4 vs 3) rather than benching most of
  the roster.
- **Recording**: the groom records each match's winning team as games are
  actually played; the full schedule and every match result are tracked,
  not just an end-of-event tally. More rounds can be added one at a time
  without disturbing any round already played.
- **Placement**: ranked by each player's win count across the whole
  schedule; equal win counts tie, split per the placement tie rule above.
  As with bracket, the derived placement can be manually adjusted before
  finalizing.

### Best of rounds

For events played as several full rounds rather than one race (e.g.
Mölkky) — the groom ranks the whole field once per round (the same
drag-order + tie-toggle entry as a standard placement event, just scoped
to one round at a time), can add more rounds one at a time without
disturbing rounds already recorded, and each player's final placement is
their BEST (lowest) position across every round they've been ranked in —
not an average, and not their most recent round.

- A player only ranked in some rounds is judged on those rounds alone.
- Ties in the final placement fall out naturally: if two players' best
  results are the same position (whether from the same round or
  different rounds), they tie for that place, split per the placement tie
  rule above — same as any other tie.
- As with bracket and round-robin, the derived placement can still be
  manually adjusted (drag-reorder) before finalizing.

## Multipliers

Every player has one multiplier per event, adjustable before the weekend
starts.

- **Range**: 0.5 to 1.5 per event, in steps of 0.1.
- **Budget, not a strict zero-sum**: every player starts with a total budget
  of `eventCount × 1.0` to spend across events. Raising one event's
  multiplier has to come from lowering others by the same amount — you can
  spend up to the full budget, but never over it. Originally a hard
  zero-sum (had to land on exactly zero remaining to submit); relaxed once
  per-event betting needed somewhere to draw wagers from — unspent budget is
  now a deliberate reserve, spendable on live per-event bets instead of only
  on event multipliers (see below). Enforce "not negative" as the hard
  constraint in the UI, not "exactly zero."
- **Final event score = placement/absolute points × multiplier.**
- **Locking**: a player's multiplier for an event is locked once that event
  starts being scored. Before that, they can freely re-adjust it, subject to
  the budget constraint across whatever events are still unlocked.

### Catch-up bonus

An automatic bonus for whoever's trailing, on top of the multiplier sliders
above — separate from the budget/reserve system, not something a player
allocates.

- Based on the multiplier-adjusted standings (the same total the medal
  table shows) as they stood right before the event — i.e. after whichever
  event most recently resolved.
- Applies to **the very next event only**, not every remaining event.
- Tiered by how far behind: last place +30%, 2nd-last +20%, 3rd-last +10%.
  Kept as a tiered list, not hardcoded to "8/7/6," so it survives a change
  in player count — with fewer players, the lower tiers simply don't apply
  (e.g. with only 2 players, only last place gets a bonus; the runner-up
  isn't "2nd-last" in any meaningful sense, they're just not first).
- **Stacks multiplicatively with the player's own event-multiplier slider**,
  it doesn't replace it: `final = points × their multiplier × (1 +
  catch-up%)`. A 7th-place player who'd already set a 1.2 multiplier on the
  next event effectively plays it at 1.2 × 1.2 = 1.44.
- **Ties**: a tie for last (or 2nd-/3rd-last) shares the average of the
  tiers its group spans — same "sum across the tied positions and split
  evenly" philosophy as placement-scoring ties, just applied to a rate
  instead of a points pool (e.g. two players tied for last get (30%+20%)/2
  = 25% each, not 30% each).
- No bonus at all before the first event has resolved — there's no
  meaningful "who's behind" yet.
- Shown as a badge on the leaderboard standings once an event actually
  starts scoring or resolves — that's the applied badge for whoever
  benefited. Before that (event still planned), the live preview of who'd
  get it next also shows on the leaderboard standings, not on the events
  screen — "who currently has the multiplier" is a fact about the whole
  field, not about whichever event card happens to be open. Once an event
  starts, the same badges also show next to the affected players in that
  event's own results table.
- Implementation: `src/lib/scoring/catchUp.ts` (the tier/tie math, pure and
  unit-tested) + `src/lib/scoring/fromRows.ts` (walks resolved events in the
  order they actually happened, not `sort_order`, computing each one's
  bonus from the running standings before it — the same "actual award
  order" principle cumulativeSeries.ts already uses for the progress
  chart).

## Per-event multiplier betting

Separate from the multiplier sliders themselves, players can wager a portion
of their **unallocated multiplier reserve** (the leftover budget described
above — not any specific event's own multiplier) on a chosen PLAYER'S
win/place outcome in a specific upcoming event.

**A player can't bet on themselves.** This reverses an earlier version of
this doc, which explicitly allowed it ("the bettor and the pick can be
different players, or the same one") on the reasoning that a per-event bet
is a side wager, not a competitive conflict-of-interest the way ranking your
own event would be. Direct product feedback overrode that: it should match
overall betting's own no-self-pick rule rather than being the one betting
mechanic in the app with a different answer to "can I pick myself."

- Betting on an event closes once that event starts — wagers can only be
  placed while it's still "planned."
- Wagering, say, 0.3 **removes that 0.3 from the reserve immediately** — it's
  escrowed, not spendable elsewhere while the bet is open.
- When the event resolves: if the pick actually won/placed as bet, the
  wagered amount pays out **scaled by how much of an underdog the pick
  was** (same odds logic as the overall bet below, but priced off that
  event's own ranking — favorites pay out close to 1:1, longshots pay out
  much more) and returns to the player's reserve, reallocatable to any
  still-unlocked event or another bet.
- If the bet lost, the wagered amount is simply gone.
- This needs its own small state machine per bet: `open → won/lost →
  resolved`, since a bet can be placed then the event can be delayed or
  cancelled (see Cancelled Events below).

## Overall betting (the "who wins it all" bet)

This is separate from per-event betting and uses **points**, not multiplier,
as its currency.

- **Odds source**: before each event, the groom privately ranks every
  player (himself included) for THAT event specifically — one ranking per
  event, not one overall ranking. Players do not set odds themselves, and
  they aren't expected to know enough about each other to do so credibly.
  Each event's own ranking generates that event's own odds (used by
  per-event betting below); the overall win/top3 odds are derived by
  averaging a player's rank across every event ranked so far and re-deriving
  a single composite order from that (src/lib/odds/aggregate.ts) — it
  updates automatically as the groom ranks more events, with no separate
  input of its own.
- **Placement window**: new overall bets can only be placed before the
  weekend starts — once the first event leaves "planned," placement locks
  and every player's picks become visible to everyone (no suspense once
  it's locked in). Switching an already-placed, now-eliminated pick is still
  allowed after lock — the halving is deterrent enough.
- **No self-picks**: a player can't bet on themselves to win or place —
  standard for any pick-the-winner pool. Per-event betting's own no-self-pick
  rule (above) was made to match this one, not the other way around.
- **Bet types** (deliberately kept to exactly two, do not add more without
  revisiting this decision — the whole design intent here was "simple, not a
  spreadsheet"; a third "pick who finishes last" joke bet was considered and
  dropped):
  1. Pick a player to win outright
  2. Pick a player to place top 3
- **Payout**: flat if correct, regardless of who was picked (the odds
  already reflect difficulty — a longshot pick is simply harder to land, so
  the reward doesn't need to scale on top of that) — but **different by bet
  type**, not a single flat number:
  - **Win: 100 points.** Derived from simulation, not picked arbitrarily —
    see `simulation-notes.md` in this folder. The typical gap between
    adjacent final placements across 8 events runs roughly 70–130 points,
    so 100 points is enough to plausibly flip 2nd/3rd but not enough to
    single-handedly overturn a dominant win. Don't change this number
    without re-running that simulation.
  - **Top 3: 20 points.** In a field this size, every event guarantees
    exactly 3 "top3" slots against 1 "win" slot, so an average pick is
    roughly 3x likelier to land top3 than win outright — a payout cut well
    past that 3x (100→20, a 5x cut) keeps top3 clearly the
    lower-conviction, lower-reward bet without making it worthless.
- **Switching picks**: if a player's pick becomes mathematically eliminated
  from the category they bet on, they get the option to switch to a
  still-alive player — but each switch halves that bet type's own payout
  value, rounded to the nearest whole point each time (100 → 50 → 25 → 13 →
  6… for win; 20 → 10 → 5 → 3… for top3 — no fractional points, ever). No
  limit on number of switches, the halving is the
  only deterrent.
- **Mathematical elimination**: computed live, after each event resolves,
  based on whether a player could still reach the bet's target position even
  with a maximum-points run in all remaining events. This needs to be
  recalculated any time an event is cancelled (see below), since that changes
  how many points are left on the table. This is genuinely load-bearing app
  logic, not just a display — it's what triggers the switch-pick option.
- **Settlement**: once every event has resolved (the weekend is over), every
  still-open overall bet settles against the actual final standings
  (multiplier-adjusted totals, including bonus-event points) — won bets pay
  out onto the bettor's medal-table total, lost bets pay nothing. This
  happens automatically the moment the last event finalizes, not as a
  separate manual step.

## Live standings

- Visible to everyone throughout the weekend (no suspense-until-the-end
  design). There are no spectators, only the competitors themselves, so this is a
  players-only view.
- Standings should show, per player: raw event points earned so far,
  multiplier-adjusted total, and (for anyone who placed the overall bet)
  whether their pick is still mathematically alive.

## Cancelled events

If a pre-planned event gets cancelled (weather, logistics, whatever):

- The event is deleted from the competition entirely — not marked
  "postponed" or given a placeholder score.
- Any multiplier a player had allocated to that event is freed back into
  their pool, ready to reallocate to remaining events. If a per-event bet was
  open on that event, it's void — no win, no loss, multiplier is just
  returned.
- The elimination math for the overall bet needs to recompute the total
  remaining points available, since one fewer event means less room for a
  trailing player to catch up.

## Extras (not core scoring, but part of the weekend)

- **Theming**: opening ceremony with player intros/nicknames, a real medal
  podium for top 3 at the end, and "leaderboard" as the label for the
  standings screen. (Reversed from an earlier decision recorded here as
  "medal table," not "leaderboard" — noted for anyone who finds the old label
  in an older commit or comment.) These are presentation-layer choices, not
  scoring logic — keep them out of the scoring code, they belong in copy/UI
  only.

## Explicitly out of scope

Decided against, don't reintroduce without asking:

- Betting on other players' predicted rankings (too hard for anyone but the
  groom to do credibly, since no one else knows every competitor well).
- Combo/parlay bets, or more than 2 overall bet categories.
- A "pick who finishes last" overall bet category — considered, cut.
- Peer award vote ("funniest moment," etc.) — considered, cut.
- Detailed individual stat tracking for team sports (volleyball, soccer) —
  win/loss record per player is enough, no kills/assists/etc.
- MVP voting for team events — considered and explicitly rejected in favor of
  keeping team scoring to win/loss record only.
- Live, ongoing bookmaker-style odds updates throughout the weekend — the
  groom sets odds once, upfront, from his single ranking session.
