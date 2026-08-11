/**
 * Score aggregation (PRODUCT_SPEC.md → Multipliers, Live standings).
 *
 *   final event score = placement/absolute points × that event's multiplier
 *
 * Player totals expose both the raw points earned and the multiplier-adjusted
 * total, because the live "medal table" shows both.
 */

/** One resolved, multiplier-applied line for a player in one event. */
export interface EventScoreLine {
  eventId: string;
  playerId: string;
  /** Raw placement/absolute points before the multiplier. */
  points: number;
  /** The player's multiplier for this event (0.5–1.5). */
  multiplier: number;
}

/** The final, multiplier-adjusted score for a single event line. */
export function finalEventScore(points: number, multiplier: number): number {
  return points * multiplier;
}

export interface PlayerTotal {
  playerId: string;
  /** Sum of raw points across all this player's scored events. */
  raw: number;
  /** Sum of multiplier-adjusted points across all scored events. */
  adjusted: number;
}

/**
 * Aggregate per-event lines into per-player totals. Bonuses (bonus events, peer
 * award, overall-bet payouts) are added on top elsewhere — this function covers
 * only core event scoring.
 */
export function playerTotals(lines: EventScoreLine[]): Map<string, PlayerTotal> {
  const totals = new Map<string, PlayerTotal>();
  for (const line of lines) {
    const existing =
      totals.get(line.playerId) ??
      ({ playerId: line.playerId, raw: 0, adjusted: 0 } satisfies PlayerTotal);
    existing.raw += line.points;
    existing.adjusted += finalEventScore(line.points, line.multiplier);
    totals.set(line.playerId, existing);
  }
  return totals;
}

/**
 * Player totals sorted into standings order (highest adjusted total first).
 * Ties in adjusted total are broken by raw total, then player id for stability.
 */
export function standings(lines: EventScoreLine[]): PlayerTotal[] {
  return [...playerTotals(lines).values()].sort(
    (a, b) =>
      b.adjusted - a.adjusted || b.raw - a.raw || a.playerId.localeCompare(b.playerId),
  );
}
