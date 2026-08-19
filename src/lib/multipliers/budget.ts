/**
 * Multiplier budget + zero-sum constraint (PRODUCT_SPEC.md → Multipliers).
 *
 * Every player has one multiplier per event, adjustable before the weekend:
 *   - Range 0.5 to 1.5, in steps of 0.1.
 *   - Budget: every player starts with `eventCount × 1.0` total to spend
 *     across events. Raising one event's multiplier has to come from
 *     lowering others by the same amount — you can spend up to the full
 *     budget, but NOT over it. Originally a strict zero-sum (must land on
 *     exactly zero remaining to submit); relaxed to "must not go negative"
 *     once per-event betting needed somewhere to draw wagers from — leftover,
 *     unallocated budget is now a deliberate reserve, spendable on live
 *     per-event bets (src/lib/betting/reserve.ts) instead of only on event
 *     multipliers. See docs/PRODUCT_SPEC.md → Multipliers for the decision.
 *   - Locking: a multiplier is locked once its event starts being scored.
 *     Locked values can't move; the remaining budget must still not go
 *     negative across whatever events are still unlocked.
 *
 * All math is done in integer tenths internally so the 0.1 grid never suffers
 * floating-point drift (0.1 + 0.2 !== 0.3 in IEEE floats).
 */

export const MULTIPLIER_MIN = 0.5;
export const MULTIPLIER_MAX = 1.5;
export const MULTIPLIER_STEP = 0.1;
/** The nominal starting multiplier for every event; also the per-event budget. */
export const MULTIPLIER_DEFAULT = 1.0;

const toTenths = (v: number): number => Math.round(v * 10);
const MIN_T = toTenths(MULTIPLIER_MIN); // 5
const MAX_T = toTenths(MULTIPLIER_MAX); // 15
const DEFAULT_T = toTenths(MULTIPLIER_DEFAULT); // 10

/** One event's multiplier allocation for a player. */
export interface MultiplierAllocation {
  eventId: string;
  value: number;
  /** True once this event has started scoring — the value can no longer move. */
  locked: boolean;
}

/**
 * The total multiplier budget a player has to spend across `eventCount` events.
 * It's simply `eventCount × 1.0` — the sum every player starts with and must
 * preserve. Pass the live event count (never hardcode 8).
 */
export function budgetTotal(eventCount: number): number {
  return eventCount * MULTIPLIER_DEFAULT;
}

/**
 * A player's currently-SAVED multiplier total across `events` — the sum
 * `bettingReserve` (src/lib/betting/reserve.ts) needs for its
 * `allocatedToEvents` argument. An event with no saved row yet for this
 * player defaults to `MULTIPLIER_DEFAULT`, same fallback every other
 * multiplier read in this app already uses (a player who never touched an
 * event's slider is implicitly still at 1.0, not 0) — summing only the rows
 * that happen to exist would silently undercount, inflating "available to
 * wager" for anyone with unsaved-but-default events. Caught as a real bug:
 * the Odds tab and `/bets` were both doing the naive `.filter().reduce()`
 * sum and disagreeing with `/multipliers`' own (correctly-defaulted) budget
 * math for exactly this reason.
 */
export function allocatedMultiplierTotal(
  events: { id: string }[],
  multiplierRows: { player_id: string; event_id: string; value: number }[],
  playerId: string,
): number {
  return events.reduce((sum, e) => {
    const row = multiplierRows.find((m) => m.player_id === playerId && m.event_id === e.id);
    return sum + (row?.value ?? MULTIPLIER_DEFAULT);
  }, 0);
}

/** True if a value sits within range and lands exactly on the 0.1 grid. */
export function isValidMultiplierValue(value: number): boolean {
  const t = toTenths(value);
  return (
    Number.isFinite(value) &&
    Math.abs(t - value * 10) < 1e-9 &&
    t >= MIN_T &&
    t <= MAX_T
  );
}

export interface BudgetValidation {
  valid: boolean;
  /**
   * How far the allocation is from the full budget, in multiplier units.
   * Zero or positive is fine to submit — positive is unspent budget, held in
   * reserve for per-event betting (src/lib/betting/reserve.ts). Negative
   * means over-allocated across events, which is never valid.
   */
  budgetRemaining: number;
  errors: string[];
}

/**
 * Validate a player's full set of allocations against the total budget.
 *
 * `eventCount` is the number of events the budget is spread across (normally
 * `allocations.length`, but passable explicitly so a caller can reason about a
 * mid-change state). Locked allocations are included in the sum but flagged if
 * they carry an out-of-range value.
 *
 * `reservedForBets` is however much of this player's budget is currently
 * escrowed in open per-event bets (src/lib/betting/reserve.ts's `tiedUp`) —
 * money that's "unallocated" from the multiplier sliders' point of view but
 * NOT actually free to reallocate to an event, since PRODUCT_SPEC.md → Per-
 * event multiplier betting says a placed wager is "escrowed, not spendable
 * elsewhere while the bet is open." Without this, a player could leave 0.3
 * unspent, wager it on an event, then go back and allocate that same 0.3 to
 * a multiplier — double-spending it and pushing their betting reserve
 * negative. Defaults to 0 so existing callers that don't have a bet list
 * handy (or genuinely have none) are unaffected.
 */
export function validateAllocations(
  allocations: MultiplierAllocation[],
  eventCount: number = allocations.length,
  reservedForBets = 0,
): BudgetValidation {
  const errors: string[] = [];

  let sumTenths = 0;
  for (const alloc of allocations) {
    if (!isValidMultiplierValue(alloc.value)) {
      errors.push(
        `${alloc.eventId}: ${alloc.value} is out of range or off the 0.1 grid`,
      );
    }
    sumTenths += toTenths(alloc.value);
  }

  const totalTenths = eventCount * DEFAULT_T - toTenths(reservedForBets);
  const remainingTenths = totalTenths - sumTenths;
  if (remainingTenths < 0) {
    errors.push(
      reservedForBets > 0
        ? `over budget by ${(-remainingTenths / 10).toFixed(1)} — some of your budget is tied up in open bets, lower another event first`
        : `over budget by ${(-remainingTenths / 10).toFixed(1)} — lower another event first`,
    );
  }

  return {
    valid: errors.length === 0,
    budgetRemaining: remainingTenths / 10,
    errors,
  };
}

/**
 * The amount of budget still free to spend across the *unlocked* events, given
 * the locked events already consume part of the total. Feeds the UI's "budget
 * remaining" indicator — must not go negative; anything left at zero-or-above
 * is fine (unspent budget becomes the per-event betting reserve).
 */
export function unlockedBudgetRemaining(
  allocations: MultiplierAllocation[],
  eventCount: number = allocations.length,
): number {
  const totalTenths = eventCount * DEFAULT_T;
  const spentTenths = allocations.reduce((sum, a) => sum + toTenths(a.value), 0);
  return (totalTenths - spentTenths) / 10;
}
