/**
 * Supabase queries for the game tables. Thin wrappers only — no business logic
 * here (that lives in src/lib/scoring, src/lib/multipliers, src/lib/betting).
 * The store (src/store) is the only caller; components never import this
 * directly.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppSettingsRow,
  BonusEventRow,
  EventResultRow,
  EventRankingRow,
  EventRow,
  MultiplierRow,
  OverallBetRow,
  PerEventBetRow,
  PlayerRow,
  PowerMoveRow,
} from "./database.types";
import { eventSeedRows } from "./events";

async function selectAll<T>(
  client: SupabaseClient,
  table: string,
): Promise<T[]> {
  const { data, error } = await client.from(table).select("*");
  if (error) throw new Error(`${table}: ${error.message}`);
  return (data ?? []) as T[];
}

export function fetchPlayers(client: SupabaseClient): Promise<PlayerRow[]> {
  return selectAll<PlayerRow>(client, "players");
}

export async function fetchEvents(client: SupabaseClient): Promise<EventRow[]> {
  const rows = await selectAll<EventRow>(client, "events");
  return [...rows].sort((a, b) => a.sort_order - b.sort_order);
}

export function fetchEventResults(
  client: SupabaseClient,
): Promise<EventResultRow[]> {
  return selectAll<EventResultRow>(client, "event_results");
}

export function fetchMultipliers(
  client: SupabaseClient,
): Promise<MultiplierRow[]> {
  return selectAll<MultiplierRow>(client, "multipliers");
}

/**
 * The groom's private per-event rankings (PRODUCT_SPEC.md → Overall betting
 * → Odds source) — one ranking per event, sorted event then 1=strongest
 * first. Empty for an event until the groom saves one for it on Setup.
 */
export async function fetchEventRankings(
  client: SupabaseClient,
): Promise<EventRankingRow[]> {
  const rows = await selectAll<EventRankingRow>(client, "event_rankings");
  return [...rows].sort(
    (a, b) => a.event_id.localeCompare(b.event_id) || a.rank - b.rank,
  );
}

/** Every overall ("who wins it all") bet placed so far (PRODUCT_SPEC.md →
 * Overall betting). */
export function fetchOverallBets(client: SupabaseClient): Promise<OverallBetRow[]> {
  return selectAll<OverallBetRow>(client, "overall_bets");
}

/** Every per-event multiplier bet placed so far (PRODUCT_SPEC.md → Per-event
 * multiplier betting). */
export function fetchPerEventBets(client: SupabaseClient): Promise<PerEventBetRow[]> {
  return selectAll<PerEventBetRow>(client, "per_event_bets");
}

/** Every on-the-fly bonus event awarded so far (PRODUCT_SPEC.md → Event-
 * specific structure), newest first. */
export async function fetchBonusEvents(client: SupabaseClient): Promise<BonusEventRow[]> {
  const rows = await selectAll<BonusEventRow>(client, "bonus_events");
  return [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** The single shared power_move row (PRODUCT_SPEC.md → Extras). */
export async function fetchPowerMove(client: SupabaseClient): Promise<PowerMoveRow> {
  const { data, error } = await client
    .from("power_move")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) throw new Error(`power_move: ${error.message}`);
  return data as PowerMoveRow;
}

/** The single shared app_settings row (currently just the active theme). */
export async function fetchAppSettings(
  client: SupabaseClient,
): Promise<AppSettingsRow> {
  const { data, error } = await client
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) throw new Error(`app_settings: ${error.message}`);
  return data as AppSettingsRow;
}

/**
 * Sync the `events` table from src/lib/events/config.ts. Safe to call more
 * than once — upserts by id, so a fresh project gets all events inserted, and
 * re-running after an edit to the config (name, notes, safety flag, etc.)
 * propagates that edit to existing rows. `status` and `photo_url` are live
 * state owned by the app, not the config, so they're deliberately left out of
 * the payload — an upsert only touches columns present in it, so omitting
 * them here means Postgres leaves whatever's already stored untouched.
 */
export async function seedEvents(client: SupabaseClient): Promise<void> {
  const rows = eventSeedRows().map((row) => {
    const { id, name, scoring_mode, lower_is_better, team_reshuffle, custom_placement, safety_check, notes, sort_order } = row;
    return { id, name, scoring_mode, lower_is_better, team_reshuffle, custom_placement, safety_check, notes, sort_order };
  });
  const { error } = await client.from("events").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`seedEvents: ${error.message}`);
}
