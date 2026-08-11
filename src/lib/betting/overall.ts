/**
 * Overall betting — the "who wins it all" bet (PRODUCT_SPEC.md → Overall
 * betting). Uses POINTS as currency, not multiplier.
 *
 * Exactly three bet types (do not add more without revisiting the spec):
 *   - win:  pick a player to win outright
 *   - top3: pick a player to place top 3
 *   - last: pick a player to finish last (the joke bet)
 *
 * Payout is a flat 100 points if correct, regardless of who was picked — the
 * odds already reflect difficulty. Do NOT change 100 without re-running
 * docs/simulation-notes.md.
 *
 * Switching picks: if a pick becomes mathematically eliminated from its
 * category, the bettor may switch to a still-alive player, but each switch
 * HALVES the payout: 100 → 50 → 25 → 12.5 → … No limit; the halving is the
 * only deterrent.
 *
 * Mathematical elimination is computed live after each event resolves (and must
 * be recomputed whenever an event is cancelled, since that changes how many
 * points are left on the table). It's load-bearing: it's what unlocks the
 * switch-pick option.
 */

export type OverallBetType = "win" | "top3" | "last";

export const OVERALL_BET_BASE_PAYOUT = 100;

/** The payout value after `switches` pick-switches (each halves it). */
export function overallPayoutValue(switches: number): number {
  if (switches < 0 || !Number.isInteger(switches)) {
    throw new Error(`switches must be a non-negative integer, got ${switches}`);
  }
  return OVERALL_BET_BASE_PAYOUT / 2 ** switches;
}

/** A player's current multiplier-adjusted total, plus their reachable bounds. */
export interface EliminationInput {
  playerId: string;
  /** Points already banked (multiplier-adjusted event points + any bonuses). */
  current: number;
  /** Most additional points still reachable across all remaining events. */
  maxRemaining: number;
  /** Fewest additional points they'll still bank across remaining events. */
  minRemaining: number;
}

const ceilingOf = (p: EliminationInput) => p.current + p.maxRemaining;
const floorOf = (p: EliminationInput) => p.current + p.minRemaining;

/**
 * Is `pickId` still mathematically able to achieve `betType`?
 *
 * The bounds are deliberately generous (each player's own best/worst case,
 * uncoupled), so a pick is only declared eliminated when it's truly impossible
 * — never prematurely.
 *
 *   - win:  alive unless some *other* player's floor already exceeds the pick's
 *           ceiling (that rival is guaranteed ahead).
 *   - top3: alive unless at least 3 other players' floors exceed the pick's
 *           ceiling (3+ rivals guaranteed ahead ⇒ can't be top 3).
 *   - last: alive unless some other player's ceiling is below the pick's floor
 *           (that rival is guaranteed below ⇒ the pick can't be last).
 */
export function isPickAlive(
  betType: OverallBetType,
  pickId: string,
  field: EliminationInput[],
): boolean {
  const pick = field.find((p) => p.playerId === pickId);
  if (!pick) throw new Error(`pick ${pickId} is not in the field`);
  const others = field.filter((p) => p.playerId !== pickId);
  const pickCeiling = ceilingOf(pick);
  const pickFloor = floorOf(pick);

  switch (betType) {
    case "win": {
      const guaranteedAhead = others.filter((o) => floorOf(o) > pickCeiling).length;
      return guaranteedAhead === 0;
    }
    case "top3": {
      const guaranteedAhead = others.filter((o) => floorOf(o) > pickCeiling).length;
      return guaranteedAhead < 3;
    }
    case "last": {
      const guaranteedBelow = others.some((o) => ceilingOf(o) < pickFloor);
      return !guaranteedBelow;
    }
  }
}

export interface RemainingBoundsOptions {
  /** Number of events still to be scored for this player. */
  remainingEvents: number;
  /** Field size, for the worst-place point floor. Read from player count. */
  fieldSize: number;
  maxMultiplier?: number;
  minMultiplier?: number;
  /** Best raw points obtainable in one event (placement 1st = 100). */
  bestEventPoints?: number;
  /** Worst raw points obtainable in one event (placement last place). */
  worstEventPoints: number;
}

/**
 * Convenience helper: the max/min additional points a player can bank across
 * their remaining events, given the multiplier band. Callers that model
 * per-event ceilings more precisely can bypass this and fill EliminationInput
 * directly. Cancelling an event = call again with a smaller `remainingEvents`.
 */
export function remainingBounds(options: RemainingBoundsOptions): {
  maxRemaining: number;
  minRemaining: number;
} {
  const {
    remainingEvents,
    maxMultiplier = 1.5,
    minMultiplier = 0.5,
    bestEventPoints = 100,
    worstEventPoints,
  } = options;
  return {
    maxRemaining: remainingEvents * bestEventPoints * maxMultiplier,
    minRemaining: remainingEvents * worstEventPoints * minMultiplier,
  };
}
