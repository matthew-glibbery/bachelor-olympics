/**
 * Bridge from raw DB rows to the elimination math in overall.ts — same role
 * as src/lib/scoring/fromRows.ts, but for the overall bet's mathematical
 * elimination (PRODUCT_SPEC.md → Overall betting → Mathematical
 * elimination). Pure and DB-agnostic.
 *
 * Bounds policy (a documented judgment call, like the odds decay model in
 * src/lib/odds/ranking.ts — the spec fixes the *rule*, not the exact
 * numbers): every remaining event, regardless of whether it turns out to be
 * placement- or absolute-scored, is bounded by
 *   - ceiling: best possible finish (100 raw pts) × max multiplier (1.5)
 *   - floor: last-place placement points for the current field size ×
 *     min multiplier (0.5)
 * The floor uses the placement curve's last-place value even for events
 * that might end up absolute-scored, since an absolute blowout could in
 * theory score close to 0 — using the placement floor is a deliberately
 * non-zero, moderately conservative stand-in. This can under- rather than
 * over-eliminate in a corner case; that's the safer direction per the
 * "never prematurely eliminate" rule in isPickAlive's docs.
 */
import { deriveScoreLines } from "@/lib/scoring/fromRows";
import { placementPoints } from "@/lib/scoring/placement";
import { playerTotals } from "@/lib/scoring/total";
import type { EventResultRow, EventRow, MultiplierRow } from "@/lib/data/database.types";
import { remainingBounds, type EliminationInput } from "./overall";

export function eliminationField(
  playerIds: string[],
  events: EventRow[],
  results: EventResultRow[],
  multipliers: MultiplierRow[],
): EliminationInput[] {
  const totals = playerTotals(deriveScoreLines(events, results, multipliers, playerIds));
  const remainingEvents = events.filter(
    (e) => e.status !== "resolved" && e.status !== "cancelled",
  ).length;
  const { maxRemaining, minRemaining } = remainingBounds({
    remainingEvents,
    fieldSize: playerIds.length,
    worstEventPoints: Math.round(placementPoints(playerIds.length)),
  });

  return playerIds.map((playerId) => ({
    playerId,
    current: totals.get(playerId)?.adjusted ?? 0,
    maxRemaining,
    minRemaining,
  }));
}
