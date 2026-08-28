/**
 * Optional multiple-rounds scoring for placement events (PRODUCT_SPEC.md →
 * Scoring → Multiple rounds). Any standard placement event can, time
 * permitting, be re-ranked in a second (or third, …) full round instead of
 * just one — the groom ranks the field once per round (the same drag-order
 * + tie-toggle entry as a single-round result, just scoped to one round at
 * a time), and each player's final placement is the SUM of their position
 * across every round they've been ranked in — lower total wins, same as
 * stroke-play golf or a darts league, not an average and not their best
 * single round. A player only ranked in some rounds is judged on those
 * rounds alone. This is not a separate event format — it's always
 * available for any placement-scored event, and behaves identically to a
 * single-round result when only one round is ever entered.
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
 * Reduce every recorded round down to one PlacementEntry per player: the
 * sum of their position across every round they appear in. Ties in the
 * result are exactly what they should be — two players whose totals match
 * tie for that place — and flow straight into `scorePlacement`'s existing
 * pooling, unchanged.
 */
export function sumAcrossRounds(entries: PlacementRoundEntry[]): PlacementEntry[] {
  const totals = new Map<string, number>();
  for (const { playerId, position } of entries) {
    totals.set(playerId, (totals.get(playerId) ?? 0) + position);
  }
  return [...totals.entries()].map(([playerId, position]) => ({ playerId, position }));
}
