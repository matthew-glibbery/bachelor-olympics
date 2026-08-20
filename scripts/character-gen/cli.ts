/**
 * N64 character asset generation pipeline. See
 * scripts/character-gen/README.md for the full workflow — short version:
 *
 *   pnpm run gen:char:status
 *   pnpm run gen:char:image   -- "Josh" reference-photos/josh.jpg
 *   pnpm run gen:char:clip    -- "Josh" select
 *   pnpm run gen:char:upload  -- "Josh" select
 *
 * Deliberately staged rather than one big "do everything" command — per
 * docs/VISUAL_SPEC.md, the portrait needs sign-off before spending Veo calls
 * on clips, and clips need a local look before they're pushed live.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { generateImage, generateVideo } from "./gemini";
import { portraitPrompt, clipPrompt, CLIP_TYPES, CLIP_FIELD, type ClipType } from "./prompts";
import { fetchPlayers, findPlayer, uploadClipAndSet, slugify } from "./players";

process.loadEnvFile?.(".env.local");

const ASSETS_DIR = path.join(process.cwd(), "character-assets");

function assetDir(name: string): string {
  const dir = path.join(ASSETS_DIR, slugify(name));
  mkdirSync(dir, { recursive: true });
  return dir;
}

function mimeFromExt(file: string): string {
  const ext = path.extname(file).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  throw new Error(`Unrecognized reference photo extension: ${ext}`);
}

async function cmdStatus() {
  const players = await fetchPlayers();
  for (const p of players) {
    const dir = assetDir(p.name);
    const portrait = existsSync(path.join(dir, "portrait.png"));
    const clips = CLIP_TYPES.map((t) => {
      const local = existsSync(path.join(dir, `${t}.mp4`));
      const live = Boolean(p[CLIP_FIELD[t] as keyof typeof p]);
      return `${t}:${live ? "LIVE" : local ? "local" : "-"}`;
    });
    console.log(`${p.name.padEnd(10)} portrait:${portrait ? "yes" : "no "}  ${clips.join("  ")}`);
  }
}

async function cmdImage(nameOrId: string, referencePath: string) {
  const player = await findPlayer(nameOrId);
  const dir = assetDir(player.name);
  const refBytes = readFileSync(referencePath);
  console.log(`Generating N64 portrait for ${player.name} from ${referencePath}...`);
  const { base64 } = await generateImage(portraitPrompt(player.name), {
    base64: refBytes.toString("base64"),
    mimeType: mimeFromExt(referencePath),
  });
  const out = path.join(dir, "portrait.png");
  writeFileSync(out, Buffer.from(base64, "base64"));
  console.log(`Wrote ${out} — review it before generating clips.`);
}

async function cmdClip(nameOrId: string, type: string) {
  if (!CLIP_TYPES.includes(type as ClipType)) {
    throw new Error(`Unknown clip type "${type}" — expected one of ${CLIP_TYPES.join(", ")}`);
  }
  const clipType = type as ClipType;
  const player = await findPlayer(nameOrId);
  const dir = assetDir(player.name);
  const portraitPath = path.join(dir, "portrait.png");
  if (!existsSync(portraitPath)) {
    throw new Error(`No portrait.png for ${player.name} yet — run gen:char:image first.`);
  }
  const portrait = readFileSync(portraitPath);
  console.log(`Generating "${clipType}" clip for ${player.name} (this polls Veo, can take a few minutes)...`);
  const video = await generateVideo(clipPrompt(clipType, player.name), {
    base64: portrait.toString("base64"),
    mimeType: "image/png",
  });
  const out = path.join(dir, `${clipType}.mp4`);
  writeFileSync(out, video);
  console.log(`Wrote ${out} — review it before uploading.`);
}

async function cmdUpload(nameOrId: string, type: string) {
  if (!CLIP_TYPES.includes(type as ClipType)) {
    throw new Error(`Unknown clip type "${type}" — expected one of ${CLIP_TYPES.join(", ")}`);
  }
  const clipType = type as ClipType;
  const player = await findPlayer(nameOrId);
  const dir = assetDir(player.name);
  const clipPath = path.join(dir, `${clipType}.mp4`);
  if (!existsSync(clipPath)) {
    throw new Error(`No local ${clipType}.mp4 for ${player.name} — run gen:char:clip first.`);
  }
  const buffer = readFileSync(clipPath);
  const url = await uploadClipAndSet(player.id, CLIP_FIELD[clipType], buffer);
  console.log(`${player.name}.${CLIP_FIELD[clipType]} -> ${url}`);
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  switch (cmd) {
    case "status":
      return cmdStatus();
    case "image": {
      const [a, b] = args;
      if (!a || !b) throw new Error("usage: gen:char:image -- <player> <reference-photo-path>");
      return cmdImage(a, b);
    }
    case "clip": {
      const [a, b] = args;
      if (!a || !b) throw new Error("usage: gen:char:clip -- <player> <select|fullbody|confirm|victory>");
      return cmdClip(a, b);
    }
    case "upload": {
      const [a, b] = args;
      if (!a || !b) throw new Error("usage: gen:char:upload -- <player> <select|fullbody|confirm|victory>");
      return cmdUpload(a, b);
    }
    default:
      throw new Error(`Unknown command "${cmd ?? ""}" — expected status | image | clip | upload`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
