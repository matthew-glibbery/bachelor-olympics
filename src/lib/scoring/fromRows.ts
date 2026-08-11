/**
 * Bridge from raw DB rows (src/lib/data/database.types.ts) to the domain
 * scoring layer (src/lib/scoring/*). Pure and DB-agnostic — the store calls
 * this after fetching rows; it's unit-testable without Supabase.
 *
 * Only RESOLVED events (status === "resolved") produce score lines: a
 * "planned"/"scoring" event has no final result yet, and a "cancelled" event
 * is excluded entirely per PRODUCT_SPEC.md → Cancelled events (deleted from the
 * competition, not scored).
 */
import { scorePlacement, type PlacementEntry } from "@/lib/scoring/placement";
import { scoreAbsolute, type AbsoluteEntry } from "@/lib/scoring/absolute";
import type { EventScoreLine } from "@/lib/scoring/total";
import type {
  EventResultRow,
  EventRow,
  MultiplierRow,
} from "@/lib/data/database.types";

const MULTIPLIER_DEFAULT = 1.0;

export function deriveScoreLines(
  events: EventRow[],
  results: EventResultRow[],
  multipliers: MultiplierRow[],
): EventScoreLine[] {
  const multiplierFor = (playerId: string, eventId: string): number =>
    multipliers.find((m) => m.player_id === playerId && m.event_id === eventId)
      ?.value ?? MULTIPLIER_DEFAULT;

  const lines: EventScoreLine[] = [];

  for (const event of events) {
    if (event.status !== "resolved") continue;
    const eventResults = results.filter((r) => r.event_id === event.id);
    if (eventResults.length === 0) continue;

    let points: Map<string, number>;
    if (event.scoring_mode === "placement") {
      const entries: PlacementEntry[] = eventResults
        .filter((r) => r.position != null)
        .map((r) => ({ playerId: r.player_id, position: r.position as number }));
      points = scorePlacement(entries);
    } else {
      const entries: AbsoluteEntry[] = eventResults
        .filter((r) => r.raw != null)
        .map((r) => ({ playerId: r.player_id, raw: r.raw as number }));
      points = scoreAbsolute(entries, { lowerIsBetter: event.lower_is_better });
    }

    for (const [playerId, pts] of points) {
      lines.push({
        eventId: event.id,
        playerId,
        points: pts,
        multiplier: multiplierFor(playerId, event.id),
      });
    }
  }

  return lines;
}
