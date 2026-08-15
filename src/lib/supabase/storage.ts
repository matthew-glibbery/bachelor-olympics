import type { SupabaseClient } from "@supabase/supabase-js";

const PHOTOS_BUCKET = "photos";
const VIDEOS_BUCKET = "videos";

async function uploadTo(
  client: SupabaseClient,
  bucket: string,
  prefix: string,
  id: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${prefix}/${id}-${Date.now()}.${ext}`;

  const { error } = await client.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw new Error(`uploadTo(${bucket}): ${error.message}`);

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

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
  return uploadTo(client, PHOTOS_BUCKET, prefix, id, file);
}

/**
 * Upload a video (character select/fullbody/victory clips, boot screen) to
 * the `videos` bucket (public, see supabase/migrations/0011_character_media.sql)
 * and return its public URL. Kept in a separate bucket from `photos` since
 * these files are much larger.
 */
export async function uploadVideo(
  client: SupabaseClient,
  prefix: "players" | "app",
  id: string,
  file: File,
): Promise<string> {
  return uploadTo(client, VIDEOS_BUCKET, prefix, id, file);
}
