/**
 * On-the-fly bonus events (PRODUCT_SPEC.md → Event-specific structure).
 *
 * These are added spontaneously during the weekend, NOT pre-planned. They are
 * deliberately OUTSIDE the core event/scoring and betting systems entirely:
 * flat winner-take-all, no odds, no multiplier interaction, no effect on
 * elimination math. Kept as its own isolated path — nothing here imports from
 * scoring / multipliers / betting, and nothing there should import this.
 */

export const BONUS_EVENT_POINTS = 50;

export interface BonusAward {
  playerId: string;
  points: number;
}

/**
 * Award a spontaneous bonus event to its winner. Flat points (default 50),
 * winner-take-all. Returns a plain points award to be added straight onto the
 * player's total.
 */
export function awardBonusEvent(
  winnerId: string,
  points: number = BONUS_EVENT_POINTS,
): BonusAward {
  return { playerId: winnerId, points };
}
