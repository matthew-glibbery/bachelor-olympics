/**
 * Supabase writes for the game tables. Thin wrappers only, same rule as
 * src/lib/data/queries.ts — no business logic here.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EventRow, EventStatus, PlayerRow } from "./database.types";

export interface NewPlayer {
  name: string;
  nickname?: string | null;
  state: string;
  is_groom?: boolean;
}

export async function addPlayer(
  client: SupabaseClient,
  player: NewPlayer,
): Promise<PlayerRow> {
  const { data, error } = await client
    .from("players")
    .insert({
      name: player.name,
      nickname: player.nickname ?? null,
      state: player.state.toUpperCase(),
      is_groom: player.is_groom ?? false,
    })
    .select()
    .single();
  if (error) throw new Error(`addPlayer: ${error.message}`);
  return data as PlayerRow;
}

export async function removePlayer(
  client: SupabaseClient,
  playerId: string,
): Promise<void> {
  const { error } = await client.from("players").delete().eq("id", playerId);
  if (error) throw new Error(`removePlayer: ${error.message}`);
}

export interface PlayerPatch {
  name?: string;
  nickname?: string | null;
  state?: string;
  is_groom?: boolean;
  photo_url?: string | null;
}

export async function updatePlayer(
  client: SupabaseClient,
  playerId: string,
  patch: PlayerPatch,
): Promise<PlayerRow> {
  const { state, ...rest } = patch;
  const { data, error } = await client
    .from("players")
    .update({ ...rest, ...(state ? { state: state.toUpperCase() } : {}) })
    .eq("id", playerId)
    .select()
    .single();
  if (error) throw new Error(`updatePlayer: ${error.message}`);
  return data as PlayerRow;
}

/** Move an event through planned -> scoring -> resolved. Multipliers lock
 * for an event as soon as it leaves "planned" (PRODUCT_SPEC.md → Multipliers). */
export async function setEventStatus(
  client: SupabaseClient,
  eventId: string,
  status: EventStatus,
): Promise<void> {
  const { error } = await client.from("events").update({ status }).eq("id", eventId);
  if (error) throw new Error(`setEventStatus: ${error.message}`);
}

/**
 * Cancel an event: deleted from the competition entirely, not marked
 * "cancelled" (PRODUCT_SPEC.md → Cancelled events). FK cascades clean up its
 * results and multiplier rows, which frees that budget back into every
 * player's pool automatically (fewer events => smaller total budget divisor).
 */
export async function cancelEvent(
  client: SupabaseClient,
  eventId: string,
): Promise<void> {
  const { error } = await client.from("events").delete().eq("id", eventId);
  if (error) throw new Error(`cancelEvent: ${error.message}`);
}

export async function updateEventPhoto(
  client: SupabaseClient,
  eventId: string,
  photoUrl: string | null,
): Promise<EventRow> {
  const { data, error } = await client
    .from("events")
    .update({ photo_url: photoUrl })
    .eq("id", eventId)
    .select()
    .single();
  if (error) throw new Error(`updateEventPhoto: ${error.message}`);
  return data as EventRow;
}

export interface EventResultInput {
  player_id: string;
  position?: number | null;
  raw?: number | null;
}

/** Bulk-write an event's results (placement uses `position`, absolute uses `raw`). */
export async function upsertEventResults(
  client: SupabaseClient,
  eventId: string,
  results: EventResultInput[],
): Promise<void> {
  const rows = results.map((r) => ({
    event_id: eventId,
    player_id: r.player_id,
    position: r.position ?? null,
    raw: r.raw ?? null,
  }));
  const { error } = await client
    .from("event_results")
    .upsert(rows, { onConflict: "event_id,player_id" });
  if (error) throw new Error(`upsertEventResults: ${error.message}`);
}

export interface MultiplierInput {
  player_id: string;
  event_id: string;
  value: number;
}

/** Bulk-write a player's multipliers for whichever events are still unlocked. */
export async function upsertMultipliers(
  client: SupabaseClient,
  entries: MultiplierInput[],
): Promise<void> {
  const rows = entries.map((e) => ({
    player_id: e.player_id,
    event_id: e.event_id,
    value: e.value,
  }));
  const { error } = await client
    .from("multipliers")
    .upsert(rows, { onConflict: "player_id,event_id" });
  if (error) throw new Error(`upsertMultipliers: ${error.message}`);
}

/** Set the shared app theme — applies live to every device via Realtime. */
export async function setTheme(client: SupabaseClient, themeId: string): Promise<void> {
  const { error } = await client
    .from("app_settings")
    .update({ theme_id: themeId })
    .eq("id", 1);
  if (error) throw new Error(`setTheme: ${error.message}`);
}
