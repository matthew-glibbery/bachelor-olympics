/**
 * Prompt templates. The solo portrait prompt is docs/VISUAL_SPEC.md's Nano
 * Banana template, split by subject kind (player/guest use the human
 * version, Bailey the dog gets a dog-appropriate variant of the same
 * style). Solo clip prompts (select/fullbody) translate the spec's
 * Seedance victory-clip template to Veo's image-to-video input; the
 * composite scenes (victory/confirm/boot) are a deliberate extension past
 * the original spec, per explicit ask, to fold Cassandra and Bailey into
 * those three moments without giving them their own player-style clip set.
 */
import type { SubjectKind } from "./subjects";

/** Appended to every portrait prompt. Two real failures showed up in the
 * first test render (a fully flat 2D vector look with no sense of a 3D
 * model, and an unprompted "NINTENDO 64" logo baked into the image) — both
 * traced back to "should look like an official ... video game box" reading
 * as "add real game-box branding." Named the actual 3D-render qualities
 * instead of leaning on a box-art comparison, and explicitly banned any
 * text/logo/watermark. */
const RENDER_STYLE = `This must read as a 3D-rendered video game character model, not 2D
artwork: hard-edged low-poly geometry with visible flat-shaded polygon
facets (especially on the face and clothing folds), a distinct rim/outline
only where geometry edges would actually catch light, and directional
shading that implies real volume and depth — not a flat vector
illustration, not a smooth cartoon drawing, not a comic-style cel shade.
Saturated primary colors, chunky exaggerated proportions, slightly
oversized head-to-body ratio, thick dark outline only around the
silhouette. Plain solid white background, nothing else in frame — no text,
no logos, no watermarks, no game-box framing or UI chrome of any kind.`;

export function portraitPrompt(name: string, kind: SubjectKind, outfit?: string): string {
  if (kind === "pet") {
    const outfitLine = outfit ? ` Make sure to ${outfit}.` : "";
    return `Create a stylized 3D-rendered dog character based on the attached
reference photo of ${name}, in the style of late-1990s N64-era video game
creature models (think Diddy Kong Racing's animal characters). Preserve
${name}'s recognizable breed, coat color/pattern, and markings from the
reference photo, but do not aim for photorealism.${outfitLine} Full body,
standing pose, front 3/4 view.

${RENDER_STYLE}`;
  }
  const outfitLine = outfit ? ` Dress the character in ${outfit}.` : "";
  return `Create a stylized 3D-rendered character based on the attached reference
photo of ${name}, in the style of late-1990s N64-era video game character
models (think Ready 2 Rumble Boxing, Diddy Kong Racing). Preserve
recognizable facial features, hairstyle, and skin tone from the reference
photo, but do not aim for photorealism.${outfitLine} Full body, neutral
standing pose, front 3/4 view.

${RENDER_STYLE}`;
}

export type ClipType = "select" | "fullbody" | "confirm" | "victory";

/** Solo clip prompts — apply to the plain single-subject portrait, no
 * Cassandra/Bailey. Used for select/fullbody always, and for confirm/
 * victory only as a fallback when no composite scene has been generated
 * yet (see cli.ts's `clip` command). */
const soloClipPrompts: Record<ClipType, (name: string) => string> = {
  select: (name) => `Using the attached stylized 3D character image of ${name} as both the
starting frame and the ending frame, animate a short, energetic idle
gesture in between them — a quick eager bounce or a wave toward camera —
that departs from and returns to that exact pose, so the clip loops
perfectly on hover. Plain white background, same low-poly N64-era
character-select style as the reference image throughout. No camera
movement.`,

  fullbody: (name) => `Using the attached stylized 3D character image of ${name}, generate a
subtle, seamlessly loopable idle animation: gentle breathing motion and a
small weight shift from foot to foot, like a character standing on a video
game select screen waiting to be picked. Minimal, continuous, no distinct
start or end pose — should read as alive, not static. Plain white
background, same low-poly N64-era character-select style as the reference
image. No camera movement.`,

  confirm: (name) => `Using the attached stylized 3D character image of ${name}, generate a
short one-shot (non-looping) confirmation animation: the character strikes
a confident, hype "I'm ready" pose — a fist pump, a point at the camera, or
a thumbs up — as if just chosen on a video game character-select screen.
Plain white background, same low-poly N64-era character-select style as
the reference image. Simple push-in camera move for emphasis.`,

  victory: (name) => `Using the attached stylized 3D character image of ${name}'s low-poly
N64-era character, generate a video: ${name}'s character performs a
triumphant, comedic victory move, then playfully stomps/squashes a small
group of generic same-style opposing characters, who comically flatten
like inflatable toys and pop back up dazed. Setting: a colorful, stylized
arena matching a late-1990s video game aesthetic, bright primary-color
lighting, medal/trophy accents in the background. Simple dynamic camera,
one push-in on the winning character. Cartoon physics, upbeat and silly,
not aggressive or realistic — this is a celebratory gag, not a fight.`,
};

export function soloClipPrompt(type: ClipType, name: string): string {
  return soloClipPrompts[type](name);
}

/** Composite *scene image* prompts — combine several existing portraits
 * (Nano Banana, multi-image input) into one still frame before it's handed
 * to Veo as a single seed image. Keeps every character's likeness anchored
 * to its own reference rather than asking Veo to invent Cassandra/Bailey
 * from a text description alone. */
export function victoryScenePrompt(playerName: string): string {
  return `Using the attached stylized N64-style character images — ${playerName}'s
character, Cassandra's character (the bride), and Bailey's character (the
dog) — compose a single wide victory scene. Keep every character's face,
proportions, outfit, and (for Bailey) breed/markings identical to their own
reference image. ${playerName}'s character stands center, triumphant, arms
raised, a medal around their neck. Cassandra and Bailey stand to the side,
visibly cheering and celebrating for ${playerName} — not part of the
victory gag, just happy spectators. Leave room in the composition for a
small group of generic, same-style rival characters off to ${playerName}'s
other side, since the video step will animate them getting comically
squashed. Colorful stylized N64-era sports-game arena background, medal/
trophy accents, bright primary-color lighting. Full body, every character
fully visible, front-facing.`;
}

export function victorySceneClipPrompt(playerName: string): string {
  return `Using the attached composite scene image (${playerName} at center with
Cassandra and Bailey cheering beside them, and room for rival characters),
animate it into a video: ${playerName}'s character performs a triumphant,
comedic victory move, then playfully stomps/squashes the small group of
generic rival characters, who comically flatten like inflatable toys and
pop back up dazed — while Cassandra and Bailey, unharmed, cheer and
celebrate the whole time. Simple dynamic camera, one push-in on
${playerName}. Cartoon physics, upbeat and silly, not aggressive or
realistic — a celebratory gag, not a fight.`;
}

export function confirmScenePrompt(playerName: string): string {
  return `Using the attached stylized N64-style character images — ${playerName}'s
character, Cassandra's character (the bride), and Bailey's character (the
dog) — compose a single character-select confirmation scene. Keep every
character's face, proportions, outfit, and (for Bailey) breed/markings
identical to their own reference image. ${playerName}'s character stands
center-front in a confident "I'm ready to play" pose. Cassandra and Bailey
are positioned just behind/beside them, smiling and supportive — Cassandra
giving a thumbs up, Bailey alert and happy. Plain bold background suitable
for a video game "you're playing as ___" confirmation screen. Full body,
every character fully visible.`;
}

export function confirmSceneClipPrompt(playerName: string): string {
  return `Using the attached composite scene image (${playerName} with Cassandra
and Bailey supporting them), animate it into a short one-shot (non-looping)
video: ${playerName}'s character strikes their confident "I'm ready" pose
— a fist pump or point at camera — while Cassandra gives an enthusiastic
thumbs up and Bailey wags happily beside them. Simple push-in camera on
${playerName} for emphasis.`;
}

export function bootScenePrompt(names: string[]): string {
  return `Using the attached stylized N64-style character images — ${names.join(", ")}
— compose a single wide group scene, like the opening cast shot of a 1998
sports video game box. Keep every character's face, proportions, outfit,
and (for Bailey the dog) breed/markings identical to their own reference
image. Arrange everyone left to right in a triumphant group pose, all
fully visible, facing camera, evenly spaced. Colorful stylized N64-era
sports-game arena background, bright primary-color lighting, medal/trophy
accents. This is a title-card image, not an action shot.`;
}

export function bootSceneClipPrompt(names: string[]): string {
  return `Using the attached composite group scene image (${names.join(", ")}
standing together), animate it into a short video game boot/title
sequence: the whole group does a synchronized cheer or wave, like the cast
intro of a 1998 sports game, camera slowly pushes in on the group. Upbeat,
energetic, all characters visible and in motion at once. No dialogue
needed.`;
}

export const CLIP_TYPES: ClipType[] = ["select", "fullbody", "confirm", "victory"];

export const CLIP_FIELD: Record<ClipType, string> = {
  select: "character_select_video_url",
  fullbody: "character_fullbody_video_url",
  confirm: "character_confirm_video_url",
  victory: "character_victory_video_url",
};
