/**
 * Score aggregation (PRODUCT_SPEC.md → Multipliers, Live standings).
 *
 *   final event score = placement/absolute points × that event's multiplier
 *                        × (1 + catch-up bonus, if any)
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
  /** The player's own multiplier for this event (0.5–1.5) — unaffected by
   * any catch-up bonus, so this always reflects what they actually set. */
  multiplier: number;
  /** Automatic catch-up bonus fraction (e.g. 0.3 for +30%), default 0 — see
   * src/lib/scoring/catchUp.ts. Stacks with `multiplier`, doesn't replace it. */
  catchUpBonus?: number;
}

/** The final, multiplier- and catch-up-adjusted score for a single event line. */
export function finalEventScore(
  points: number,
  multiplier: number,
  catchUpBonus = 0,
): number {
  return points * multiplier * (1 + catchUpBonus);
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
    existing.adjusted += finalEventScore(line.points, line.multiplier, line.catchUpBonus ?? 0);
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
