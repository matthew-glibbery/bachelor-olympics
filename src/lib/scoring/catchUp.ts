/**
 * Catch-up bonus for players trailing in the standings (PRODUCT_SPEC.md →
 * Multipliers → Catch-up bonus). Whoever is last, 2nd-last, and 3rd-last in
 * the multiplier-adjusted standings gets an automatic bonus multiplier —
 * stacked on top of (not replacing) their own event-multiplier slider — for
 * the very next event only:
 *
 *   last       +30%
 *   2nd-last   +20%
 *   3rd-last   +10%
 *
 * Kept as a tiered array, not hardcoded field names, so it survives a
 * change in player count. A genuine tie (equal adjusted AND raw totals)
 * shares the tiers its group spans, averaged — same "sum across the tied
 * positions and split evenly" philosophy as placement-scoring ties
 * (src/lib/scoring/placement.ts), just applied to a bonus rate instead of a
 * points pool. A tie that spans past the 3rd-last tier only "spends" the
 * real tiers it covers — the rest of the group's span contributes 0, not a
 * phantom tier value.
 */
import type { PlayerTotal } from "@/lib/scoring/total";

export const CATCHUP_TIERS = [0.3, 0.2, 0.1];

/** playerId -> bonus fraction (e.g. 0.3 for +30%), only for players who get one. */
export function catchUpBonuses(totals: PlayerTotal[]): Map<string, number> {
  const worstFirst = [...totals].sort(
    (a, b) =>
      a.adjusted - b.adjusted || a.raw - b.raw || a.playerId.localeCompare(b.playerId),
  );

  // Never award a catch-up bonus to the actual best-ranked player — with a
  // small field, CATCHUP_TIERS' fixed 3 slots can otherwise reach past the
  // bottom and into the lead (e.g. with only 2 players, "2nd-last" IS the
  // leader). Bound eligible tiers to strictly below the top spot.
  const maxIndex = Math.min(CATCHUP_TIERS.length, Math.max(worstFirst.length - 1, 0));

  const bonuses = new Map<string, number>();
  let i = 0;
  while (i < worstFirst.length && i < maxIndex) {
    let j = i;
    while (
      j + 1 < worstFirst.length &&
      worstFirst[j + 1]!.adjusted === worstFirst[i]!.adjusted &&
      worstFirst[j + 1]!.raw === worstFirst[i]!.raw
    ) {
      j++;
    }

    const groupSize = j - i + 1;
    let sum = 0;
    for (let k = i; k <= j; k++) {
      sum += k < maxIndex ? CATCHUP_TIERS[k]! : 0;
    }
    const bonus = sum / groupSize;
    if (bonus > 0) {
      for (let k = i; k <= j; k++) bonuses.set(worstFirst[k]!.playerId, bonus);
    }

    i = j + 1;
  }

  return bonuses;
}
