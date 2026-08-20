/**
 * Thin REST wrappers around the two Gemini API surfaces this pipeline uses:
 *
 *  - Interactions API (gemini-3.1-flash-image, aka "Nano Banana") for the
 *    stylized N64 character portrait.
 *  - Veo (predictLongRunning) for image-to-video clips.
 *
 * No @google/genai dependency — this is a one-off content-generation tool,
 * not app code, so plain fetch keeps it dependency-free. See
 * docs/VISUAL_SPEC.md for the product context and prompt templates this
 * pipeline is built from.
 */

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const IMAGE_MODEL = "gemini-3.1-flash-image";
const VIDEO_MODEL = "veo-3.1-generate-preview";

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY in .env.local");
  return key;
}

/** Recursively find the first `{ data: "<base64>" }`-shaped image block in an
 * arbitrarily-nested response. The Interactions API's documented convenience
 * field (`interaction.output_image.data`) and its raw `steps[].content[]`
 * shape both satisfy this, so scanning defensively covers both without
 * hard-coding a schema Google may still be settling. */
function findImageData(node: unknown): string | undefined {
  if (!node || typeof node !== "object") return undefined;
  const obj = node as Record<string, unknown>;
  if (typeof obj.data === "string" && (obj.type === "image" || "mime_type" in obj || "mimeType" in obj)) {
    return obj.data;
  }
  if (typeof (obj as { output_image?: { data?: string } }).output_image?.data === "string") {
    return (obj as { output_image: { data: string } }).output_image.data;
  }
  for (const value of Object.values(obj)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findImageData(item);
        if (found) return found;
      }
    } else if (value && typeof value === "object") {
      const found = findImageData(value);
      if (found) return found;
    }
  }
  return undefined;
}

/**
 * Generate (or edit) a stylized character image. Pass a reference photo to
 * anchor likeness; pass several to compose a scene from multiple existing
 * character portraits (the victory/confirm/boot composites in
 * composites.ts). Returns raw PNG/JPEG bytes as a base64 string plus the
 * mime type reported back, since Nano Banana doesn't always return the same
 * format it was given.
 */
export async function generateImage(
  prompt: string,
  references: Array<{ base64: string; mimeType: string }> = [],
): Promise<{ base64: string; mimeType: string }> {
  const input: unknown[] = [{ type: "text", text: prompt }];
  for (const reference of references) {
    input.push({ type: "image", mime_type: reference.mimeType, data: reference.base64 });
  }

  const res = await fetch(`${BASE_URL}/interactions`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey(), "Content-Type": "application/json" },
    body: JSON.stringify({ model: IMAGE_MODEL, input }),
  });
  if (!res.ok) {
    throw new Error(`Nano Banana generateImage failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  const base64 = findImageData(json);
  if (!base64) {
    throw new Error(
      `Nano Banana response had no recognizable image block — dump: ${JSON.stringify(json).slice(0, 2000)}`,
    );
  }
  return { base64, mimeType: "image/png" };
}

export type AspectRatio = "16:9" | "9:16";

/**
 * Kick off an image-to-video generation and poll until it completes.
 * durationSeconds is capped at "8" by Veo 3.1 — the victory clip's spec'd
 * 12-15s is out of reach in a single call (see docs/VISUAL_SPEC.md and the
 * character-gen README for the plan around that).
 */
export async function generateVideo(
  prompt: string,
  image: { base64: string; mimeType: string },
  opts: { aspectRatio?: AspectRatio; durationSeconds?: "4" | "6" | "8" } = {},
): Promise<Buffer> {
  const startRes = await fetch(`${BASE_URL}/models/${VIDEO_MODEL}:predictLongRunning`, {
    method: "POST",
    headers: { "x-goog-api-key": apiKey(), "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [
        {
          prompt,
          image: { inlineData: { mimeType: image.mimeType, data: image.base64 } },
        },
      ],
      parameters: {
        aspectRatio: opts.aspectRatio ?? "9:16",
        durationSeconds: opts.durationSeconds ?? "8",
      },
    }),
  });
  if (!startRes.ok) {
    throw new Error(`Veo predictLongRunning failed: ${startRes.status} ${await startRes.text()}`);
  }
  const { name: operationName } = (await startRes.json()) as { name: string };
  if (!operationName) throw new Error("Veo response had no operation name to poll");

  let done = false;
  let response: unknown;
  while (!done) {
    await new Promise((r) => setTimeout(r, 10_000));
    const pollRes = await fetch(`${BASE_URL}/${operationName}`, {
      headers: { "x-goog-api-key": apiKey() },
    });
    if (!pollRes.ok) {
      throw new Error(`Veo poll failed: ${pollRes.status} ${await pollRes.text()}`);
    }
    const pollJson = (await pollRes.json()) as { done?: boolean; error?: { message: string }; response?: unknown };
    if (pollJson.error) throw new Error(`Veo generation errored: ${pollJson.error.message}`);
    done = Boolean(pollJson.done);
    response = pollJson.response;
  }

  const videoUri = (
    response as {
      generateVideoResponse?: { generatedSamples?: Array<{ video?: { uri?: string } }> };
    }
  )?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (!videoUri) {
    throw new Error(`Veo operation finished with no video uri — dump: ${JSON.stringify(response).slice(0, 2000)}`);
  }

  const videoRes = await fetch(videoUri, { headers: { "x-goog-api-key": apiKey() } });
  if (!videoRes.ok) {
    throw new Error(`Veo video download failed: ${videoRes.status} ${await videoRes.text()}`);
  }
  return Buffer.from(await videoRes.arrayBuffer());
}
