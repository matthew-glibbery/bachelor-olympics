/**
 * Placement-based scoring (PRODUCT_SPEC.md → Scoring).
 *
 * Points follow an exponential decay so first place is worth meaningfully more
 * than a close second, but last place still isn't zero:
 *
 *   points = 100 * 0.72^(place - 1)
 *
 * | Place | 1   | 2  | 3    | 4    | 5    | 6    | 7    | 8  |
 * | Points| 100 | 72 | 51.8 | 37.3 | 26.9 | 19.3 | 13.9 | 10 |
 *
 * Kept as a formula, not a table, so it survives a change in event/field count.
 */

export const PLACEMENT_BASE = 100;
export const PLACEMENT_DECAY = 0.72;

/** Raw points for a given finishing place (1-indexed). */
export function placementPoints(place: number): number {
  if (place < 1 || !Number.isFinite(place)) {
    throw new Error(`placementPoints: place must be >= 1, got ${place}`);
  }
  return PLACEMENT_BASE * Math.pow(PLACEMENT_DECAY, place - 1);
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
 * The final awarded share is rounded to the nearest whole number — scores
 * should read as clean, full numbers rather than decimals like 51.8. This is
 * done on the tie-split share, not the underlying curve, so ties still split
 * fairly in continuous space before the one rounding step at the end. It can
 * shift the total-points-awarded invariant by a point or so versus the raw
 * curve sum — accepted as negligible against the 70-130 point gaps
 * docs/simulation-notes.md found between finishers across a full event.
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
