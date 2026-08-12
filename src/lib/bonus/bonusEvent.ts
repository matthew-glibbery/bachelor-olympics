/**
 * On-the-fly bonus events (PRODUCT_SPEC.md → Event-specific structure).
 *
 * These are added spontaneously during the weekend, NOT pre-planned. They are
 * deliberately OUTSIDE the core event/scoring and betting systems entirely:
 * flat winner-take-all, no odds, no multiplier interaction, no effect on
 * elimination math. Kept as its own isolated path — nothing here imports from
 * multipliers / odds / betting, and nothing there should import this.
 *
 * The one deliberate exception is `applyBonusAwards` below, which adds bonus
 * points straight onto a player's medal-table total (src/lib/scoring/total.ts
 * → PlayerTotal already anticipates this: "Bonuses ... are added on top
 * elsewhere"). This is a one-way dependency (bonus → scoring's types only);
 * scoring itself still never imports bonus.
 */
import type { PlayerTotal } from "@/lib/scoring/total";

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

/**
 * Fold bonus awards into already-computed player totals — added equally to
 * both `raw` and `adjusted` (a bonus is flat, no multiplier applies), then
 * re-sorted with the same tie-break as `standings()` (highest adjusted
 * first, then raw, then playerId for stability).
 */
export function applyBonusAwards(
  totals: PlayerTotal[],
  awards: BonusAward[],
): PlayerTotal[] {
  const byPlayer = new Map(totals.map((t) => [t.playerId, { ...t }]));
  for (const award of awards) {
    const existing =
      byPlayer.get(award.playerId) ??
      ({ playerId: award.playerId, raw: 0, adjusted: 0 } satisfies PlayerTotal);
    existing.raw += award.points;
    existing.adjusted += award.points;
    byPlayer.set(award.playerId, existing);
  }
  return [...byPlayer.values()].sort(
    (a, b) => b.adjusted - a.adjusted || b.raw - a.raw || a.playerId.localeCompare(b.playerId),
  );
}
