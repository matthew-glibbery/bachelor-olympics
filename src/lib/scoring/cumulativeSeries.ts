/**
 * Cumulative, multiplier-adjusted point total per player, aligned to
 * equally-spaced event x-positions — the data behind the homepage progress
 * chart. Pure and DB-agnostic, same rule as fromRows.ts.
 *
 * A leading "Start" point (all players at 0) anchors every line at a common
 * origin, since every event applies to every player simultaneously in this
 * app. Each subsequent point corresponds to one event, in `events`' order
 * (equally spaced regardless of how many actually have a result yet — Recharts
 * spaces a categorical axis evenly by entry count, not by any real-world
 * value). A player's total at an event is only set once that event is
 * `resolved`; otherwise it's null, so the line simply stops at the most
 * recent resolved event instead of implying a flat, false continuation into
 * events that haven't happened yet.
 */
import { deriveScoreLines } from "./fromRows";
import { finalEventScore } from "./total";
import type { EventResultRow, EventRow, MultiplierRow } from "@/lib/data/database.types";

export interface SeriesPoint {
  /** "start" for the synthetic origin, otherwise the event's id. */
  key: string;
  label: string;
  /** playerId -> cumulative adjusted total through this point, or null if not yet resolved. */
  totals: Record<string, number | null>;
}

export function cumulativeSeries(
  events: EventRow[],
  results: EventResultRow[],
  multipliers: MultiplierRow[],
  playerIds: string[],
): SeriesPoint[] {
  const running: Record<string, number> = Object.fromEntries(
    playerIds.map((id) => [id, 0]),
  );

  const points: SeriesPoint[] = [
    { key: "start", label: "Start", totals: { ...running } },
  ];

  for (const event of events) {
    if (event.status === "resolved") {
      const lines = deriveScoreLines([event], results, multipliers);
      for (const line of lines) {
        if (!(line.playerId in running)) continue;
        running[line.playerId] =
          (running[line.playerId] ?? 0) + finalEventScore(line.points, line.multiplier);
      }
      points.push({ key: event.id, label: event.name, totals: { ...running } });
    } else {
      points.push({
        key: event.id,
        label: event.name,
        totals: Object.fromEntries(playerIds.map((id) => [id, null])),
      });
    }
  }

  return points;
}
