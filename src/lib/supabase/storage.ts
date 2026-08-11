import type { SupabaseClient } from "@supabase/supabase-js";

const PHOTOS_BUCKET = "photos";

/**
 * Upload a photo to the `photos` bucket (public, see
 * supabase/migrations/0004_photos.sql) and return its public URL.
 *
 * `prefix` namespaces player vs. event photos; `id` is the row's id, so a
 * re-upload for the same player/event naturally has a distinct filename via
 * the timestamp — no need to delete the old object first (it becomes
 * unreferenced, acceptable for this app's scale).
 */
export async function uploadPhoto(
  client: SupabaseClient,
  prefix: "players" | "events",
  id: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${prefix}/${id}-${Date.now()}.${ext}`;

  const { error } = await client.storage.from(PHOTOS_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(`uploadPhoto: ${error.message}`);

  const { data } = client.storage.from(PHOTOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
