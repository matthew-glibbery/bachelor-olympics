/**
 * Bridge from the in-app event config (src/lib/events/config.ts) to database
 * rows, so the `events` table is seeded from the same single source of truth.
 */
import { EVENTS, type EventDefinition } from "@/lib/events/config";
import type { EventRow } from "./database.types";

/** Convert one event definition into an insertable `events` row. */
export function eventConfigToRow(def: EventDefinition, sortOrder: number): EventRow {
  return {
    id: def.id,
    name: def.name,
    scoring_mode: def.scoringMode,
    lower_is_better: def.lowerIsBetter ?? false,
    team_reshuffle: def.teamReshuffle ?? false,
    custom_placement: def.customPlacement ?? false,
    safety_check: def.safetyCheck ?? false,
    notes: def.notes ?? null,
    sort_order: sortOrder,
    status: "planned",
    photo_url: null,
    resolved_at: null,
  };
}

/** All configured events as insertable rows, in config order. */
export function eventSeedRows(): EventRow[] {
  return EVENTS.map((def, i) => eventConfigToRow(def, i));
}
