/**
 * Supabase queries for the game tables. Thin wrappers only — no business logic
 * here (that lives in src/lib/scoring, src/lib/multipliers, src/lib/betting).
 * The store (src/store) is the only caller; components never import this
 * directly.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  EventResultRow,
  EventRow,
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
 * Idempotently seed the `events` table from src/lib/events/config.ts. Safe to
 * call more than once — upserts by id, so re-running after an edit to the
 * config just updates the rows (never touches `status`, which is live game
 * state owned by the app, not the config).
 */
export async function seedEvents(client: SupabaseClient): Promise<void> {
  const rows = eventSeedRows();
  const { error } = await client
    .from("events")
    .upsert(rows, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error(`seedEvents: ${error.message}`);
}
