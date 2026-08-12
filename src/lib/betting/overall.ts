/**
 * Overall betting — the "who wins it all" bet (PRODUCT_SPEC.md → Overall
 * betting). Uses POINTS as currency, not multiplier.
 *
 * Exactly two bet types (do not add more without revisiting the spec — a
 * third "pick who finishes last" joke bet was considered and cut):
 *   - win:  pick a player to win outright
 *   - top3: pick a player to place top 3
 *
 * Payout is flat if correct, regardless of who was picked — the odds already
 * reflect difficulty. Win pays 100 (derived from simulation, see
 * docs/simulation-notes.md — don't change without re-running it). Top3 pays
 * 20: in an 8-player field every event guarantees exactly 3 "top3" slots
 * against 1 "win" slot, so an average pick is roughly 3x likelier to land
 * top3 than win — a payout cut well past 3x (100→20, a 5x cut) keeps top3
 * clearly the lower-conviction, lower-reward bet without making it
 * worthless.
 *
 * Switching picks: if a pick becomes mathematically eliminated from its
 * category, the bettor may switch to a still-alive player, but each switch
 * HALVES the payout relative to that bet type's own base value. No limit;
 * the halving is the only deterrent.
 *
 * Mathematical elimination is computed live after each event resolves (and must
 * be recomputed whenever an event is cancelled, since that changes how many
 * points are left on the table). It's load-bearing: it's what unlocks the
 * switch-pick option.
 */

export type OverallBetType = "win" | "top3";

export const OVERALL_BASE_PAYOUT: Record<OverallBetType, number> = {
  win: 100,
  top3: 20,
};

/** The payout value for `betType` after `switches` pick-switches (each halves it). */
export function overallPayoutValue(betType: OverallBetType, switches: number): number {
  if (switches < 0 || !Number.isInteger(switches)) {
    throw new Error(`switches must be a non-negative integer, got ${switches}`);
  }
  return OVERALL_BASE_PAYOUT[betType] / 2 ** switches;
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

  const guaranteedAhead = others.filter((o) => floorOf(o) > pickCeiling).length;
  return betType === "win" ? guaranteedAhead === 0 : guaranteedAhead < 3;
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
