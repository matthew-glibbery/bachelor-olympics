import { createClient } from "@supabase/supabase-js";

export function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");
  }
  return createClient(url, key);
}

export type PlayerRow = {
  id: string;
  name: string;
  state: string;
  photo_url: string | null;
  character_select_video_url: string | null;
  character_fullbody_video_url: string | null;
  character_confirm_video_url: string | null;
  character_victory_video_url: string | null;
};

export async function fetchPlayers(): Promise<PlayerRow[]> {
  const { data, error } = await supabase()
    .from("players")
    .select(
      "id,name,state,photo_url,character_select_video_url,character_fullbody_video_url,character_confirm_video_url,character_victory_video_url",
    )
    .order("name");
  if (error) throw new Error(`fetchPlayers: ${error.message}`);
  return data as PlayerRow[];
}

export async function findPlayer(nameOrId: string): Promise<PlayerRow> {
  const players = await fetchPlayers();
  const match = players.find(
    (p) => p.id === nameOrId || p.name.toLowerCase() === nameOrId.toLowerCase() || slugify(p.name) === slugify(nameOrId),
  );
  if (!match) {
    throw new Error(`No player matching "${nameOrId}". Known players: ${players.map((p) => p.name).join(", ")}`);
  }
  return match;
}

async function uploadAndSet(
  bucket: "videos" | "photos",
  playerId: string,
  field: string,
  buffer: Buffer,
  ext: string,
  contentType: string,
): Promise<string> {
  const client = supabase();
  const path = `players/${playerId}-${Date.now()}.${ext}`;
  const { error: uploadError } = await client.storage.from(bucket).upload(path, buffer, {
    contentType,
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError) throw new Error(`upload: ${uploadError.message}`);

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  const url = data.publicUrl;

  const { error: updateError } = await client.from("players").update({ [field]: url }).eq("id", playerId);
  if (updateError) throw new Error(`update player.${field}: ${updateError.message}`);

  return url;
}

/** Upload a local video file to the `videos` bucket and set it on a player's
 * given clip field — the same bucket/RLS/mutation shape
 * `src/lib/supabase/storage.ts` and `ManagePlayerRow` use from the app, just
 * driven from Node with a Buffer instead of a browser `File`. */
export async function uploadClipAndSet(playerId: string, field: string, buffer: Buffer, ext = "mp4"): Promise<string> {
  return uploadAndSet("videos", playerId, field, buffer, ext, ext === "mp4" ? "video/mp4" : "application/octet-stream");
}

/** Upload a local PNG (the stylized N64 headshot) to the `photos` bucket and
 * set it as `photo_url` — per explicit product decision, the headshot is
 * now the canonical "photo" shown everywhere (PlayerName, medal table,
 * event cards, roster strip), superseding whatever real photo was there. */
export async function uploadPhotoAndSet(playerId: string, buffer: Buffer): Promise<string> {
  return uploadAndSet("photos", playerId, "photo_url", buffer, "png", "image/png");
}
