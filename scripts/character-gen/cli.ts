/**
 * N64 character asset generation pipeline. See
 * scripts/character-gen/README.md for the full workflow — short version:
 *
 *   pnpm run gen:char:status
 *   pnpm run gen:char:image     -- "Matthew" reference-photos/matthew.jpg
 *   pnpm run gen:char:image     -- "Cassandra" reference-photos/cassandra.jpg
 *   pnpm run gen:char:image     -- "Bailey" reference-photos/bailey.jpg
 *   pnpm run gen:char:clip      -- "Matthew" select
 *   pnpm run gen:char:composite -- victory "Matthew"
 *   pnpm run gen:char:clip      -- "Matthew" victory
 *   pnpm run gen:char:upload    -- "Matthew" victory
 *   pnpm run gen:char:composite -- boot
 *   pnpm run gen:char:boot-clip
 *   pnpm run gen:char:boot-upload
 *
 * Deliberately staged rather than one big "do everything" command — per
 * docs/VISUAL_SPEC.md, the portrait needs sign-off before spending Veo calls
 * on clips, and clips need a local look before they're pushed live. Cassandra
 * (the bride) and Bailey (the dog) are portrait-only guests (subjects.ts) —
 * they never get their own select/fullbody/confirm/victory clip, only a
 * portrait used as extra reference material when composing the victory,
 * confirm, and boot scenes that include everyone.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { generateImage, generateVideo } from "./gemini";
import { differenceMatte } from "./matte";
import {
  portraitPrompt,
  headshotPrompt,
  soloClipPrompt,
  victoryScenePrompt,
  victorySceneClipPrompt,
  confirmScenePrompt,
  confirmSceneClipPrompt,
  bootScenePrompt,
  bootSceneClipPrompt,
  CLIP_TYPES,
  CLIP_FIELD,
  type ClipType,
} from "./prompts";
import { uploadClipAndSet } from "./players";
import { uploadBootClipAndSet } from "./appSettings";
import { resolveSubject, allSubjects, SPECIAL_SUBJECTS, type Subject } from "./subjects";

process.loadEnvFile?.(".env.local");

const ASSETS_DIR = path.join(process.cwd(), "character-assets");
const BOOT_DIR = path.join(ASSETS_DIR, "_boot");

function assetDir(key: string): string {
  const dir = path.join(ASSETS_DIR, key);
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

function readAsset(subject: Subject, filename: string): { base64: string; mimeType: string } | undefined {
  const file = path.join(assetDir(subject.key), filename);
  if (!existsSync(file)) return undefined;
  return { base64: readFileSync(file).toString("base64"), mimeType: "image/png" };
}

function readPortrait(subject: Subject): { base64: string; mimeType: string } {
  const asset = readAsset(subject, "portrait.png");
  if (!asset) {
    throw new Error(`No portrait.png for ${subject.name} yet — run gen:char:image "${subject.name}" <reference-photo> first.`);
  }
  return asset;
}

async function cmdStatus() {
  const subjects = await allSubjects();
  for (const s of subjects) {
    const dir = assetDir(s.key);
    const portrait = existsSync(path.join(dir, "portrait.png"));
    const headshot = existsSync(path.join(dir, "headshot.png"));
    if (s.kind !== "player") {
      console.log(`${s.name.padEnd(10)} (${s.kind})  portrait:${portrait ? "yes" : "no "}  headshot:${headshot ? "yes" : "no "}`);
      continue;
    }
    const player = s.player!;
    const clips = CLIP_TYPES.map((t) => {
      const scene = t === "confirm" || t === "victory" ? existsSync(path.join(dir, `${t}-scene.png`)) : false;
      const local = existsSync(path.join(dir, `${t}.mp4`));
      const live = Boolean(player[CLIP_FIELD[t] as keyof typeof player]);
      const localTag = live ? "LIVE" : local ? "local" : scene ? "scene-only" : "-";
      return `${t}:${localTag}`;
    });
    console.log(`${s.name.padEnd(10)} portrait:${portrait ? "yes" : "no "}  headshot:${headshot ? "yes" : "no "}  ${clips.join("  ")}`);
  }
  const bootScene = existsSync(path.join(BOOT_DIR, "scene.png"));
  const bootClip = existsSync(path.join(BOOT_DIR, "clip.mp4"));
  console.log(`\nboot       scene:${bootScene ? "yes" : "no "}  clip:${bootClip ? "yes" : "no "}`);
}

async function cmdImage(nameOrId: string, referencePaths: string[]) {
  const subject = await resolveSubject(nameOrId);
  const dir = assetDir(subject.key);
  const references = referencePaths.map((p) => ({
    base64: readFileSync(p).toString("base64"),
    mimeType: mimeFromExt(p),
  }));
  console.log(`Generating N64 portrait for ${subject.name} (${subject.kind}) from ${referencePaths.join(", ")}...`);
  const { base64 } = await generateImage(
    portraitPrompt(subject.name, subject.kind, subject.outfit, "white", references.length),
    references,
  );
  const out = path.join(dir, "portrait.png");
  writeFileSync(out, Buffer.from(base64, "base64"));
  console.log(`Wrote ${out} — review it before generating clips.`);
}

async function cmdHeadshot(nameOrId: string) {
  const subject = await resolveSubject(nameOrId);
  if (subject.kind !== "player") {
    throw new Error(
      `${subject.name} doesn't need a headshot — Cassandra/Bailey never appear on the select screen or roster strip, only in composite scenes (see composite --boot, and Matthew's composite victory/confirm).`,
    );
  }
  const dir = assetDir(subject.key);
  const portrait = readPortrait(subject);
  console.log(`Generating shoulders-up headshot for ${subject.name} from the approved full-body portrait...`);
  const { base64 } = await generateImage(headshotPrompt(subject.name), [portrait]);
  const out = path.join(dir, "headshot.png");
  writeFileSync(out, Buffer.from(base64, "base64"));
  console.log(`Wrote ${out} — this is what the select-screen render and the hover-loop clip will use.`);
}

function guestPortraits(): Array<{ base64: string; mimeType: string }> {
  return SPECIAL_SUBJECTS.map((s) => readPortrait(s));
}

async function cmdComposite(kind: string, nameOrId?: string) {
  if (kind === "boot") {
    const subjects = await allSubjects();
    const images = subjects.map((s) => readPortrait(s));
    console.log(`Generating boot group scene with ${subjects.map((s) => s.name).join(", ")}...`);
    const { base64 } = await generateImage(
      bootScenePrompt(subjects.map((s) => s.name)),
      images,
    );
    mkdirSync(BOOT_DIR, { recursive: true });
    const out = path.join(BOOT_DIR, "scene.png");
    writeFileSync(out, Buffer.from(base64, "base64"));
    console.log(`Wrote ${out} — review it before generating the boot clip.`);
    return;
  }

  if (kind !== "victory" && kind !== "confirm") {
    throw new Error(`Unknown composite kind "${kind}" — expected victory | confirm | boot`);
  }
  if (!nameOrId) throw new Error(`usage: gen:char:composite -- ${kind} <player>`);
  const subject = await resolveSubject(nameOrId);
  if (subject.kind !== "player") throw new Error(`${kind} composite is per-player — "${nameOrId}" isn't a player`);
  // Cassandra and Bailey only appear in Matthew's confirm/victory clips (he's
  // the groom, they belong in his moments specifically) and the shared boot
  // scene — not every player's clips. Explicit product decision, not a
  // technical limitation.
  if (subject.key !== "matthew") {
    throw new Error(
      `Cassandra/Bailey only appear in Matthew's ${kind} clip, not ${subject.name}'s — run gen:char:clip directly for a solo clip instead (no composite step needed).`,
    );
  }

  const images = [readPortrait(subject), ...guestPortraits()];
  const prompt = kind === "victory" ? victoryScenePrompt(subject.name) : confirmScenePrompt(subject.name);
  console.log(`Generating ${kind} scene for ${subject.name} with Cassandra + Bailey...`);
  const { base64 } = await generateImage(prompt, images);
  const out = path.join(assetDir(subject.key), `${kind}-scene.png`);
  writeFileSync(out, Buffer.from(base64, "base64"));
  console.log(`Wrote ${out} — review it before generating the clip.`);
}

async function cmdClip(nameOrId: string, type: string) {
  if (!CLIP_TYPES.includes(type as ClipType)) {
    throw new Error(`Unknown clip type "${type}" — expected one of ${CLIP_TYPES.join(", ")}`);
  }
  const clipType = type as ClipType;
  const subject = await resolveSubject(nameOrId);
  if (subject.kind !== "player") throw new Error(`Only players get their own clips — "${nameOrId}" is a ${subject.kind}`);
  const dir = assetDir(subject.key);

  let seed: { base64: string; mimeType: string };
  let prompt: string;
  if (clipType === "victory" || clipType === "confirm") {
    const scenePath = path.join(dir, `${clipType}-scene.png`);
    if (existsSync(scenePath)) {
      seed = { base64: readFileSync(scenePath).toString("base64"), mimeType: "image/png" };
      prompt = clipType === "victory" ? victorySceneClipPrompt(subject.name) : confirmSceneClipPrompt(subject.name);
    } else {
      console.log(`No ${clipType}-scene.png for ${subject.name} — falling back to the solo portrait (no Cassandra/Bailey). Run gen:char:composite -- ${clipType} "${subject.name}" first if you want them in it.`);
      seed = readPortrait(subject);
      prompt = soloClipPrompt(clipType, subject.name);
    }
  } else if (clipType === "select") {
    // Selection-screen framing (shoulders-up), not the full-body portrait —
    // this is the clip that plays small, in the roster strip, on hover.
    const headshot = readAsset(subject, "headshot.png");
    if (headshot) {
      seed = headshot;
    } else {
      console.log(`No headshot.png for ${subject.name} — falling back to the full-body portrait for this hover clip. Run gen:char:headshot "${subject.name}" first if you want it framed shoulders-up.`);
      seed = readPortrait(subject);
    }
    prompt = soloClipPrompt(clipType, subject.name);
  } else {
    seed = readPortrait(subject);
    prompt = soloClipPrompt(clipType, subject.name);
  }

  // The hover-loop clip pins its own seed image as both the first AND last
  // frame (Veo 3.1's `lastFrame`), so the loop is exact rather than just
  // prompted for — see docs/VISUAL_SPEC.md's roster-strip hover clip and
  // the explicit ask that drove this.
  const videoOpts = clipType === "select" ? { lastFrame: seed } : {};

  console.log(`Generating "${clipType}" clip for ${subject.name} (this polls Veo, can take a few minutes)...`);
  const video = await generateVideo(prompt, seed, videoOpts);
  const out = path.join(dir, `${clipType}.mp4`);
  writeFileSync(out, video);
  console.log(`Wrote ${out} — review it before uploading.`);
}

async function cmdUpload(nameOrId: string, type: string) {
  if (!CLIP_TYPES.includes(type as ClipType)) {
    throw new Error(`Unknown clip type "${type}" — expected one of ${CLIP_TYPES.join(", ")}`);
  }
  const clipType = type as ClipType;
  const subject = await resolveSubject(nameOrId);
  if (subject.kind !== "player") throw new Error(`Only players upload clips — "${nameOrId}" is a ${subject.kind}`);
  const clipPath = path.join(assetDir(subject.key), `${clipType}.mp4`);
  if (!existsSync(clipPath)) {
    throw new Error(`No local ${clipType}.mp4 for ${subject.name} — run gen:char:clip first.`);
  }
  const buffer = readFileSync(clipPath);
  const url = await uploadClipAndSet(subject.player!.id, CLIP_FIELD[clipType], buffer);
  console.log(`${subject.name}.${CLIP_FIELD[clipType]} -> ${url}`);
}

/**
 * Opt-in — not run automatically by `image`/`headshot`, since it doubles
 * the Nano Banana cost per asset and nothing in the app currently consumes
 * a transparent still (the live surfaces are all video clips, which can't
 * be matted this way — see matte.ts and the README's transparency section
 * for the video-side recommendation instead). Use this only if a specific
 * static transparent asset is actually needed somewhere.
 */
async function cmdMatte(nameOrId: string, which: string) {
  if (which !== "portrait" && which !== "headshot") {
    throw new Error(`usage: gen:char:matte -- <player|Cassandra|Bailey> <portrait|headshot>`);
  }
  const subject = await resolveSubject(nameOrId);
  const dir = assetDir(subject.key);
  const onWhite = readAsset(subject, `${which}.png`);
  if (!onWhite) throw new Error(`No ${which}.png for ${subject.name} yet — generate it first.`);

  console.log(`Generating a black-background twin of ${subject.name}'s ${which} for difference matting...`);
  const prompt =
    which === "portrait"
      ? portraitPrompt(subject.name, subject.kind, subject.outfit, "black")
      : headshotPrompt(subject.name, "black");
  // Edit mode: pass the white-background render itself as the reference so
  // the black version stays pixel-aligned with it (a fresh generation
  // wouldn't be) — matte.ts's math depends on that alignment.
  const { base64 } = await generateImage(prompt, [onWhite]);
  const onBlack = Buffer.from(base64, "base64");

  console.log("Computing per-pixel alpha from the white/black pair...");
  const transparent = await differenceMatte(Buffer.from(onWhite.base64, "base64"), onBlack);
  const out = path.join(dir, `${which}-transparent.png`);
  writeFileSync(out, transparent);
  console.log(`Wrote ${out}.`);
}

async function cmdBootClip() {
  const scenePath = path.join(BOOT_DIR, "scene.png");
  if (!existsSync(scenePath)) {
    throw new Error(`No boot scene.png yet — run gen:char:composite -- boot first.`);
  }
  const subjects = await allSubjects();
  const seed = { base64: readFileSync(scenePath).toString("base64"), mimeType: "image/png" };
  console.log(`Generating boot clip (this polls Veo, can take a few minutes)...`);
  const video = await generateVideo(bootSceneClipPrompt(subjects.map((s) => s.name)), seed);
  const out = path.join(BOOT_DIR, "clip.mp4");
  writeFileSync(out, video);
  console.log(`Wrote ${out} — review it before uploading.`);
}

async function cmdBootUpload() {
  const clipPath = path.join(BOOT_DIR, "clip.mp4");
  if (!existsSync(clipPath)) {
    throw new Error(`No local boot clip.mp4 — run gen:char:boot-clip first.`);
  }
  const url = await uploadBootClipAndSet(readFileSync(clipPath));
  console.log(`app_settings.boot_video_url -> ${url}`);
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  switch (cmd) {
    case "status":
      return cmdStatus();
    case "image": {
      const [a, ...photos] = args;
      if (!a || photos.length === 0) {
        throw new Error("usage: gen:char:image -- <player|Cassandra|Bailey> <reference-photo-path> [more-reference-photos...]");
      }
      return cmdImage(a, photos);
    }
    case "headshot": {
      const [a] = args;
      if (!a) throw new Error("usage: gen:char:headshot -- <player|Cassandra|Bailey>");
      return cmdHeadshot(a);
    }
    case "matte": {
      const [a, b] = args;
      if (!a || !b) throw new Error("usage: gen:char:matte -- <player|Cassandra|Bailey> <portrait|headshot>");
      return cmdMatte(a, b);
    }
    case "composite": {
      const [a, b] = args;
      if (!a) throw new Error("usage: gen:char:composite -- <victory|confirm> <player>  |  gen:char:composite -- boot");
      return cmdComposite(a, b);
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
    case "boot-clip":
      return cmdBootClip();
    case "boot-upload":
      return cmdBootUpload();
    default:
      throw new Error(`Unknown command "${cmd ?? ""}" — expected status | image | headshot | matte | composite | clip | upload | boot-clip | boot-upload`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
