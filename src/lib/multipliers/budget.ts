/**
 * Multiplier budget + zero-sum constraint (PRODUCT_SPEC.md → Multipliers).
 *
 * Every player has one multiplier per event, adjustable before the weekend:
 *   - Range 0.5 to 1.5, in steps of 0.1.
 *   - Zero-sum: the SUM of a player's multipliers across all events is
 *     constant. Raising one event has to lower others by the same total. This
 *     is the core strategic tension — it's a hard constraint, enforced via a
 *     "budget remaining" that must hit exactly zero to submit.
 *   - Locking: a multiplier is locked once its event starts being scored.
 *     Locked values can't move; the zero-sum must balance across whatever
 *     events are still unlocked.
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
   * How far the allocation is from balancing, in multiplier units. Must be
   * exactly 0 to submit. Positive means the player has budget left to spend;
   * negative means they've over-allocated.
   */
  budgetRemaining: number;
  errors: string[];
}

/**
 * Validate a player's full set of allocations against the zero-sum constraint.
 *
 * `eventCount` is the number of events the budget is spread across (normally
 * `allocations.length`, but passable explicitly so a caller can reason about a
 * mid-change state). Locked allocations are included in the sum but flagged if
 * they carry an out-of-range value.
 */
export function validateAllocations(
  allocations: MultiplierAllocation[],
  eventCount: number = allocations.length,
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

  const totalTenths = eventCount * DEFAULT_T;
  const remainingTenths = totalTenths - sumTenths;
  if (remainingTenths !== 0) {
    errors.push(
      `budget must balance to zero (off by ${(remainingTenths / 10).toFixed(1)})`,
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
 * the locked events already consume part of the total. Drives the UI's "budget
 * remaining" indicator: it must reach exactly 0 for the set to be submittable.
 */
export function unlockedBudgetRemaining(
  allocations: MultiplierAllocation[],
  eventCount: number = allocations.length,
): number {
  const totalTenths = eventCount * DEFAULT_T;
  const spentTenths = allocations.reduce((sum, a) => sum + toTenths(a.value), 0);
  return (totalTenths - spentTenths) / 10;
}
