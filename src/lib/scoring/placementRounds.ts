/**
 * Best-of-rounds event format (PRODUCT_SPEC.md → Event formats → Best of
 * rounds) — the groom ranks the field once per round (same drag-order +
 * tie-toggle semantics as a standard placement event, just scoped to one
 * round at a time), can add more rounds without disturbing earlier ones,
 * and each player's final placement is their BEST (lowest) position across
 * every round they've been ranked in.
 */

import type { PlacementEntry } from "./placement";

export interface PlacementRoundEntry {
  round: number;
  playerId: string;
  /** That round's finishing position for this player — same "only
   * ordering/equality matters" convention as PlacementEntry.position. */
  position: number;
}

/**
 * Reduce every recorded round down to one PlacementEntry per player: their
 * best (numerically lowest) position across all rounds they appear in.
 * Ties in the result are exactly what they should be — two players whose
 * best round result was an equal position tie for that same place — and
 * flow straight into `scorePlacement`'s existing pooling, unchanged.
 */
export function bestAcrossRounds(entries: PlacementRoundEntry[]): PlacementEntry[] {
  const best = new Map<string, number>();
  for (const { playerId, position } of entries) {
    const current = best.get(playerId);
    if (current === undefined || position < current) best.set(playerId, position);
  }
  return [...best.entries()].map(([playerId, position]) => ({ playerId, position }));
}
