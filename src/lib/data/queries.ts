/**
 * Supabase queries for the game tables. Thin wrappers only — no business logic
 * here (that lives in src/lib/scoring, src/lib/multipliers, src/lib/betting).
 * The store (src/store) is the only caller; components never import this
 * directly.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppSettingsRow,
  EventResultRow,
  EventRow,
  GroomRankingRow,
  MultiplierRow,
  PlayerRow,
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
 * The groom's private pre-weekend ranking (PRODUCT_SPEC.md → Overall
 * betting → Odds source), sorted 1=strongest first. Empty until the groom
 * saves one from the odds screen.
 */
export async function fetchGroomRanking(
  client: SupabaseClient,
): Promise<GroomRankingRow[]> {
  const rows = await selectAll<GroomRankingRow>(client, "groom_ranking");
  return [...rows].sort((a, b) => a.rank - b.rank);
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
