/**
 * Cumulative, multiplier-adjusted point total per player, aligned to
 * equally-spaced x-positions — the data behind the homepage progress chart.
 * Pure and DB-agnostic, same rule as fromRows.ts.
 *
 * A leading "Start" point (all players at 0) anchors every line at a common
 * origin. After that, one point per POINT-AWARDING MOMENT — a resolved
 * event or an awarded bonus event — in the actual order they happened
 * (`resolved_at` / bonus events' `created_at`), not just planned sort
 * order: a bonus event awarded between two planned events shows up between
 * them on the chart. Recharts spaces a categorical axis evenly by entry
 * count regardless of the real time gaps, which is exactly what's wanted
 * here — the x-axis is "the Nth thing that happened," not a clock.
 *
 * Events that haven't resolved yet trail at the end, in their configured
 * `sort_order`, with a null total (the line stops at the frontier instead
 * of implying false continuation) — we don't know yet when they'll
 * actually happen, so they can't be interleaved for real.
 */
import { deriveScoreLines } from "./fromRows";
import { finalEventScore } from "./total";
import type {
  BonusEventRow,
  EventResultRow,
  EventRow,
  MultiplierRow,
} from "@/lib/data/database.types";

export interface SeriesPoint {
  /** "start" for the synthetic origin, otherwise the event/bonus-event id. */
  key: string;
  label: string;
  /** playerId -> cumulative adjusted total through this point, or null if not yet resolved. */
  totals: Record<string, number | null>;
}

interface AwardMoment {
  key: string;
  label: string;
  timestamp: number;
  points: Map<string, number>;
}

export function cumulativeSeries(
  events: EventRow[],
  results: EventResultRow[],
  multipliers: MultiplierRow[],
  playerIds: string[],
  bonusEvents: BonusEventRow[] = [],
): SeriesPoint[] {
  const running: Record<string, number> = Object.fromEntries(
    playerIds.map((id) => [id, 0]),
  );

  const points: SeriesPoint[] = [
    { key: "start", label: "Start", totals: { ...running } },
  ];

  const moments: AwardMoment[] = [];

  // One pass over every resolved event, in the order they actually
  // resolved — the catch-up bonus (fromRows.ts) depends on that same
  // chronological history, so it can't be computed one event at a time in
  // isolation the way it could before catch-up existed.
  const allLines = deriveScoreLines(events, results, multipliers, playerIds);
  const linesByEvent = new Map<string, typeof allLines>();
  for (const line of allLines) {
    const forEvent = linesByEvent.get(line.eventId) ?? [];
    forEvent.push(line);
    linesByEvent.set(line.eventId, forEvent);
  }

  for (const event of events) {
    if (event.status !== "resolved") continue;
    const lines = linesByEvent.get(event.id) ?? [];
    const awarded = new Map<string, number>();
    for (const line of lines) {
      awarded.set(
        line.playerId,
        (awarded.get(line.playerId) ?? 0) +
          finalEventScore(line.points, line.multiplier, line.catchUpBonus),
      );
    }
    moments.push({
      key: event.id,
      label: event.name,
      // No resolved_at on file (shouldn't happen post-migration, but stay
      // safe) sorts last among resolved events rather than crashing.
      timestamp: event.resolved_at ? new Date(event.resolved_at).getTime() : Infinity,
      points: awarded,
    });
  }

  for (const bonus of bonusEvents) {
    if (!bonus.winner_player_id) continue;
    moments.push({
      key: bonus.id,
      label: bonus.name,
      timestamp: new Date(bonus.created_at).getTime(),
      points: new Map([[bonus.winner_player_id, bonus.points]]),
    });
  }

  moments.sort((a, b) => a.timestamp - b.timestamp);

  for (const moment of moments) {
    for (const [playerId, pts] of moment.points) {
      if (!(playerId in running)) continue;
      running[playerId] = (running[playerId] ?? 0) + pts;
    }
    points.push({ key: moment.key, label: moment.label, totals: { ...running } });
  }

  for (const event of events) {
    if (event.status === "resolved") continue;
    points.push({
      key: event.id,
      label: event.name,
      totals: Object.fromEntries(playerIds.map((id) => [id, null])),
    });
  }

  return points;
}
