import { supabase } from "./players";

/** Upload the boot-screen group clip and set it as the single shared
 * `app_settings.boot_video_url` (0011_character_media.sql — one row, id 1,
 * same pattern `BootVideoUploader` uses from the app). Not tied to any one
 * player, unlike `uploadClipAndSet` in players.ts. */
export async function uploadBootClipAndSet(buffer: Buffer): Promise<string> {
  const client = supabase();
  const path = `app/boot-${Date.now()}.mp4`;
  const { error: uploadError } = await client.storage.from("videos").upload(path, buffer, {
    contentType: "video/mp4",
    cacheControl: "31536000, immutable",
    upsert: false,
  });
  if (uploadError) throw new Error(`upload: ${uploadError.message}`);

  const { data } = client.storage.from("videos").getPublicUrl(path);
  const url = data.publicUrl;

  const { error: updateError } = await client.from("app_settings").update({ boot_video_url: url }).eq("id", 1);
  if (updateError) throw new Error(`update app_settings.boot_video_url: ${updateError.message}`);

  return url;
}
