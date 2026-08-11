/**
 * Bridge between a drag-reordered list (top-to-bottom = finishing order) and
 * the `position` numbers scorePlacement() expects. Kept pure and separate
 * from the drag UI so the tie/ordering logic is unit-tested without a DOM.
 *
 * Ties are represented as "this player is tied with the row directly above
 * them" rather than a drag gesture — reordering to express a tie precisely
 * is fiddly, a toggle isn't. A tied player takes the SAME position as the
 * row above; scorePlacement's dense re-grouping (see placement.ts) means the
 * exact position numbers after a tie don't need to be contiguous, only
 * correctly ordered and grouped, so this stays simple.
 */

export interface PositionedResult {
  player_id: string;
  position: number | null;
}

/** Position numbers implied by the current order + which rows are tied. */
export function positionsFromOrder(
  order: string[],
  tied: ReadonlySet<string>,
): Record<string, number> {
  const positions: Record<string, number> = {};
  order.forEach((playerId, i) => {
    const prevId = order[i - 1];
    positions[playerId] = i > 0 && tied.has(playerId) ? positions[prevId!]! : i + 1;
  });
  return positions;
}

/**
 * Reconstruct a draggable order + tie set from existing saved results (so
 * re-opening the editor reflects what's already stored). Players with no
 * result yet are appended at the end, in their original order.
 */
export function orderFromResults(
  playerIds: string[],
  results: PositionedResult[],
): { order: string[]; tied: Set<string> } {
  const posMap = new Map(
    results.filter((r) => r.position != null).map((r) => [r.player_id, r.position as number]),
  );
  const ranked = playerIds.filter((id) => posMap.has(id)).sort((a, b) => posMap.get(a)! - posMap.get(b)!);
  const unranked = playerIds.filter((id) => !posMap.has(id));

  const tied = new Set<string>();
  for (let i = 1; i < ranked.length; i++) {
    if (posMap.get(ranked[i]!) === posMap.get(ranked[i - 1]!)) tied.add(ranked[i]!);
  }

  return { order: [...ranked, ...unranked], tied };
}
