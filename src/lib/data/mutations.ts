/**
 * Supabase writes for the game tables. Thin wrappers only, same rule as
 * src/lib/data/queries.ts — no business logic here.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerRow } from "./database.types";

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
