/**
 * Who won a single resolved event — for the victory-clip replay (see
 * docs/VISUAL_SPEC.md → Victory videos), not for scoring. Ties for first are
 * all returned; the caller picks how to handle more than one winner.
 */
import type { EventResultRow, EventRow } from "@/lib/data/database.types";

/** Winning player id(s) for `event`, or [] if unresolved / no results yet. */
export function eventWinnerIds(event: EventRow, results: EventResultRow[]): string[] {
  if (event.status !== "resolved") return [];
  const eventResults = results.filter((r) => r.event_id === event.id);
  if (eventResults.length === 0) return [];

  if (event.scoring_mode === "placement") {
    const positioned = eventResults.filter((r) => r.position != null);
    if (positioned.length === 0) return [];
    const best = Math.min(...positioned.map((r) => r.position as number));
    return positioned.filter((r) => r.position === best).map((r) => r.player_id);
  }

  const valued = eventResults.filter((r) => r.raw != null);
  if (valued.length === 0) return [];
  const best = event.lower_is_better
    ? Math.min(...valued.map((r) => r.raw as number))
    : Math.max(...valued.map((r) => r.raw as number));
  return valued.filter((r) => r.raw === best).map((r) => r.player_id);
}
