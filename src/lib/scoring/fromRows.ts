/**
 * Bridge from raw DB rows (src/lib/data/database.types.ts) to the domain
 * scoring layer (src/lib/scoring/*). Pure and DB-agnostic — the store calls
 * this after fetching rows; it's unit-testable without Supabase.
 *
 * Only RESOLVED events (status === "resolved") produce score lines: a
 * "planned"/"scoring" event has no final result yet, and a "cancelled" event
 * is excluded entirely per PRODUCT_SPEC.md → Cancelled events (deleted from the
 * competition, not scored).
 *
 * Events are processed in the actual order they resolved (`resolved_at`),
 * not `sort_order` — the catch-up bonus (PRODUCT_SPEC.md → Multipliers →
 * Catch-up bonus) depends on the standings as they stood right before each
 * event, so this has to walk history in the order it really happened, same
 * principle as cumulativeSeries.ts's award-order interleaving.
 */
import { scorePlacement, type PlacementEntry } from "@/lib/scoring/placement";
import { scoreAbsolute, type AbsoluteEntry } from "@/lib/scoring/absolute";
import { catchUpBonuses } from "@/lib/scoring/catchUp";
import { finalEventScore, type EventScoreLine, type PlayerTotal } from "@/lib/scoring/total";
import type {
  EventResultRow,
  EventRow,
  MultiplierRow,
} from "@/lib/data/database.types";

const MULTIPLIER_DEFAULT = 1.0;

function resolvedOrder(events: EventRow[]): EventRow[] {
  return events
    .filter((e) => e.status === "resolved")
    .slice()
    .sort((a, b) => {
      const at = a.resolved_at ? new Date(a.resolved_at).getTime() : Infinity;
      const bt = b.resolved_at ? new Date(b.resolved_at).getTime() : Infinity;
      return at - bt;
    });
}

function pointsForEvent(event: EventRow, results: EventResultRow[]): Map<string, number> {
  if (event.scoring_mode === "placement") {
    const entries: PlacementEntry[] = results
      .filter((r) => r.position != null)
      .map((r) => ({ playerId: r.player_id, position: r.position as number }));
    return scorePlacement(entries);
  }
  const entries: AbsoluteEntry[] = results
    .filter((r) => r.raw != null)
    .map((r) => ({ playerId: r.player_id, raw: r.raw as number }));
  return scoreAbsolute(entries, { lowerIsBetter: event.lower_is_better });
}

/**
 * Walk resolved events in chronological order, maintaining a running
 * standings snapshot. Returns both the resulting score lines (each carrying
 * the catch-up bonus that applied *at the time*, based on standings before
 * that event) and the final running totals once every resolved event has
 * been applied — the latter is what determines who's eligible for the
 * catch-up bonus on whichever event is played next.
 */
function deriveScoreLinesWithStandings(
  events: EventRow[],
  results: EventResultRow[],
  multipliers: MultiplierRow[],
  playerIds: string[],
): { lines: EventScoreLine[]; finalTotals: PlayerTotal[] } {
  const multiplierFor = (playerId: string, eventId: string): number =>
    multipliers.find((m) => m.player_id === playerId && m.event_id === eventId)
      ?.value ?? MULTIPLIER_DEFAULT;

  const running = new Map<string, PlayerTotal>(
    playerIds.map((id) => [id, { playerId: id, raw: 0, adjusted: 0 }]),
  );

  const lines: EventScoreLine[] = [];
  // No catch-up bonus on the very first resolved event — with zero prior
  // history every player is (trivially, meaninglessly) tied, and nobody's
  // actually "behind" yet.
  let hasPriorHistory = false;

  for (const event of resolvedOrder(events)) {
    const eventResults = results.filter((r) => r.event_id === event.id);
    if (eventResults.length === 0) continue;

    const points = pointsForEvent(event, eventResults);
    const bonuses = hasPriorHistory
      ? catchUpBonuses([...running.values()])
      : new Map<string, number>();

    for (const [playerId, pts] of points) {
      const multiplier = multiplierFor(playerId, event.id);
      const catchUpBonus = bonuses.get(playerId) ?? 0;
      lines.push({ eventId: event.id, playerId, points: pts, multiplier, catchUpBonus });

      const existing = running.get(playerId) ?? { playerId, raw: 0, adjusted: 0 };
      existing.raw += pts;
      existing.adjusted += finalEventScore(pts, multiplier, catchUpBonus);
      running.set(playerId, existing);
    }
    hasPriorHistory = true;
  }

  return { lines, finalTotals: [...running.values()] };
}

export function deriveScoreLines(
  events: EventRow[],
  results: EventResultRow[],
  multipliers: MultiplierRow[],
  playerIds: string[],
): EventScoreLine[] {
  return deriveScoreLinesWithStandings(events, results, multipliers, playerIds).lines;
}

/**
 * The catch-up bonus that will apply to whichever not-yet-resolved event is
 * next up (lowest `sort_order` among "planned"/"scoring" events), based on
 * current standings — for showing the bonus on that event's card *before*
 * it resolves, same rate it'll actually score with once it does. Null if
 * there's no such event, or nobody currently qualifies.
 */
export function upcomingCatchUp(
  events: EventRow[],
  results: EventResultRow[],
  multipliers: MultiplierRow[],
  playerIds: string[],
): { eventId: string; bonuses: Map<string, number> } | null {
  const target = events
    .filter((e) => e.status === "planned" || e.status === "scoring")
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)[0];
  if (!target) return null;

  const { finalTotals } = deriveScoreLinesWithStandings(events, results, multipliers, playerIds);
  return { eventId: target.id, bonuses: catchUpBonuses(finalTotals) };
}
