/**
 * Placement-based scoring (PRODUCT_SPEC.md → Scoring).
 *
 * Points follow an exponential decay so first place is worth meaningfully more
 * than a close second, but last place still isn't zero, snapped to the
 * nearest 5:
 *
 *   points = round_to_5(100 * 0.72^(place - 1))
 *
 * | Place | 1   | 2  | 3  | 4  | 5  | 6  | 7  | 8  |
 * | Points| 100 | 70 | 50 | 35 | 25 | 20 | 15 | 10 |
 *
 * The snapping is a deliberate product decision (2026-08-24): the underlying
 * curve is unchanged — these are exactly its own values rounded — but a
 * scoreboard reading 100 / 70 / 50 is legible at a glance in a way that
 * 100 / 72 / 51.8 is not, and every value a player sees is now a number they
 * can add up in their head. The floor keeps a very deep field from awarding
 * zero; past about 10th place the curve flattens onto it, which is well
 * outside this game's 7-8 player field.
 *
 * Kept as a formula, not a table, so it survives a change in event/field count.
 */

export const PLACEMENT_BASE = 100;
export const PLACEMENT_DECAY = 0.72;
/** Every place's value snaps to a multiple of this. */
export const PLACEMENT_STEP = 5;
/** No place is ever worth less than this, however deep the field. */
export const PLACEMENT_FLOOR = 5;

/** Raw points for a given finishing place (1-indexed). */
export function placementPoints(place: number): number {
  if (place < 1 || !Number.isFinite(place)) {
    throw new Error(`placementPoints: place must be >= 1, got ${place}`);
  }
  const exact = PLACEMENT_BASE * Math.pow(PLACEMENT_DECAY, place - 1);
  return Math.max(PLACEMENT_FLOOR, Math.round(exact / PLACEMENT_STEP) * PLACEMENT_STEP);
}

/** A single player's finishing position for an event. Equal `position` = tie. */
export interface PlacementEntry {
  playerId: string;
  /**
   * Finishing position. Only the *ordering* and equality of these values
   * matter — [1,2,2,4] and [1,2,2,3] are treated identically (two players
   * tied for 2nd). Places are re-derived densely from the sorted groups.
   */
  position: number;
}

/**
 * Award placement points to a field, honouring ties.
 *
 * Ties (PRODUCT_SPEC.md): players sharing a position split the *sum* of the
 * point values for all the places they span, evenly. E.g. two players tied for
 * 2nd occupy places 2 and 3, so each gets (pts(2) + pts(3)) / 2.
 *
 * The places being pooled are already snapped to multiples of 5, so an
 * even-sized tie usually lands on a round number too (2nd+3rd = 70+50, so
 * 60 each). An odd split can still land on a half — (50+35)/2 = 42.5 — and
 * is rounded to the nearest whole number there, because a tie is the one
 * case where insisting on multiples of 5 would have to distort the split
 * itself rather than just present it. Fractional points are never awarded.
 */
export function scorePlacement(entries: PlacementEntry[]): Map<string, number> {
  const points = new Map<string, number>();
  if (entries.length === 0) return points;

  // Group players by their finishing position.
  const groups = new Map<number, string[]>();
  for (const { playerId, position } of entries) {
    const group = groups.get(position);
    if (group) group.push(playerId);
    else groups.set(position, [playerId]);
  }

  // Walk groups best-to-worst, assigning dense, contiguous places.
  const sortedPositions = [...groups.keys()].sort((a, b) => a - b);
  let nextPlace = 1;
  for (const position of sortedPositions) {
    const members = groups.get(position)!;
    let pooled = 0;
    for (let i = 0; i < members.length; i++) {
      pooled += placementPoints(nextPlace + i);
    }
    const share = Math.round(pooled / members.length);
    for (const playerId of members) {
      points.set(playerId, share);
    }
    nextPlace += members.length;
  }

  return points;
}
