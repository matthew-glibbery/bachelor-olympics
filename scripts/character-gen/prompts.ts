/**
 * Prompt templates. The full-body prompt is docs/VISUAL_SPEC.md's Nano
 * Banana template, split by subject kind (player/guest use the human
 * version, Bailey the dog gets a dog-appropriate variant of the same
 * style). Solo clip prompts (select/fullbody) translate the spec's
 * Seedance victory-clip template to Veo's image-to-video input; the
 * composite scenes (victory/confirm/boot) are a deliberate extension past
 * the original spec, per explicit ask, to fold Cassandra and Bailey into
 * those three moments without giving them their own player-style clip set.
 */
import type { SubjectKind } from "./subjects";

/** Appended to every full-body/headshot prompt. Iterated four times against
 * real renders before landing here:
 *   1. "official video game box" framing caused Nano Banana to bake in an
 *      actual "NINTENDO 64" logo watermark, and the result read as flat 2D
 *      vector art with no sense of a 3D model at all — rewrote to name the
 *      actual 3D-render qualities and explicitly ban text/logos.
 *   2. That fix still had a black outline stroke and looked too smooth/
 *      high-poly for real N64 hardware — dropped the outline entirely and
 *      pushed much harder on genuinely low vertex-count geometry.
 *   3. Silhouette outline was gone, but every internal facet boundary
 *      still had a thin black seam drawn along it (comic/vector-illustration
 *      "inked panels" look) — that's not how a GPU actually rasterizes flat-
 *      shaded polygons, adjacent faces just meet at a hard color change with
 *      no line. Named that explicitly; asking for "no outline" alone wasn't
 *      enough to stop it drawing seams *between* facets.
 *   4. A "full body" generation drifted into a shoulders-up crop with no
 *      legs/shoes visible — nearly identical to the headshot it was meant
 *      to seed — and the likeness read as a generic handsome face, not the
 *      actual person. "Full body, neutral standing pose" alone wasn't
 *      explicit enough about what counts as a full-body violation, and
 *      "preserve recognizable features" wasn't strong enough to stop the
 *      model idealizing the face. Both addressed directly below.
 * `background` is the full descriptive sentence (background.ts), not a
 * bare color — plain white read badly once live in the app (a stray white
 * halo behind every render); default is now a radial gradient from the
 * player's own chart color into the app's dark navy, matching what the
 * procedural fallback already looks like. White/black are still used, but
 * only by the opt-in `matte` command's difference-matting technique
 * (matte.ts) — unrelated to what the *shipped* asset looks like. */
function renderStyle(background: string): string {
  return `This must read as a genuinely low-polygon 3D-rendered video game
character model from actual N64-era hardware — not a modern "low-poly art
style" indie game, not 2D artwork, and absolutely not a comic/vector
illustration. Real N64 games ran on a tiny vertex budget: large, clearly
visible flat triangular/quad facets on every surface, faceted/angular heads
and shoulders rather than smoothly rounded ones, blocky low-resolution
textures with no fine detail or smooth gradients. It should look primitive
and a little rough on purpose, the way actual N64 hardware looked, not
polished. Adjacent facets meet at a hard, sharp color change ONLY — like a
GPU rasterizing flat-shaded polygons, where two faces at different angles
to the light are simply two different flat colors sitting next to each
other. Do not draw any line, stroke, seam, or outline along ANY edge,
anywhere — not around the silhouette, and not between individual facets
either. The only thing that should ever separate one facet from its
neighbor is a direct color-to-color boundary with zero stroke of any kind;
no ink lines, no comic-style panel borders, no dark edge on the polygon
boundaries themselves. Directional shading that implies real volume and
depth purely from those flat color facets. Saturated primary colors,
chunky exaggerated proportions, slightly oversized head-to-body ratio.
${background} No text, no logos, no watermarks, no game-box framing or UI
chrome of any kind.`;
}

/** When more than one reference photo is attached (players.ts's `image`
 * command accepts several — many players supplied a second photo
 * specifically to show an outfit/accessory detail the first doesn't),
 * make the multi-photo intent explicit rather than leaving Nano Banana to
 * guess why there are extra images attached. */
function referencePhotosLine(photoCount: number): string {
  if (photoCount <= 1) return "reference photo";
  return "reference photos — use all of them together: likeness (face, hairstyle, skin tone) from whichever shows the face most clearly, and outfit/accessory details from any of the others that show them better";
}

/** Likeness is a real, named requirement, not just "don't be
 * photorealistic" — a render that's technically well-styled but reads as a
 * generic handsome/attractive face rather than the actual person in the
 * photo is a failed render, not a stylistic choice. */
const LIKENESS_LINE = `This must be immediately recognizable as the specific
person in the reference photo(s), not a generic idealized face in this art
style — match their exact hairstyle (cut, length, texture, and how it's
parted or styled, not a different haircut), face shape, eye spacing, nose
shape, and the specific character of their smile (open/toothy vs. closed,
how wide) as closely as the low-poly faceted style allows. Prioritize
recognizability over making the face conventionally symmetrical or
idealized.`;

/** The single most common failure mode seen in practice: the render
 * quietly crops to the chest/shoulders instead of showing the whole body,
 * which then makes the downstream headshot crop (headshotPrompt) barely
 * different from this image at all. Named as an explicit pass/fail check,
 * not just "full body" as one adjective among many. */
const FULL_BODY_LINE = `This is a FULL BODY image: the entire character must
be visible from the top of the head all the way down to their feet/shoes,
with both full legs clearly shown — not cropped at the waist, chest, or
shoulders. If any part of the body below the chest is cut off or not
visible in the frame, the image is wrong and must include more of the
body, even if that means the character appears smaller within the frame.`;

export function fullBodyPrompt(
  name: string,
  kind: SubjectKind,
  outfit: string | undefined,
  background: string,
  photoCount = 1,
): string {
  const photosLine = referencePhotosLine(photoCount);
  if (kind === "pet") {
    const outfitLine = outfit ? ` Make sure to ${outfit}.` : "";
    return `Create a stylized 3D-rendered dog character based on the attached
${photosLine} of ${name}, in the style of late-1990s N64-era video game
creature models (think Diddy Kong Racing's animal characters). Preserve
${name}'s recognizable breed, coat color/pattern, and markings from the
reference photo(s), but do not aim for photorealism.${outfitLine} Standing
pose, front 3/4 view.

${FULL_BODY_LINE}

${renderStyle(background)}`;
  }
  const outfitLine = outfit ? ` Dress the character in ${outfit}.` : "";
  return `Create a stylized 3D-rendered character based on the attached
${photosLine} of ${name}, in the style of late-1990s N64-era video game
character models (think Ready 2 Rumble Boxing, Diddy Kong Racing).${outfitLine}
Neutral standing pose, front 3/4 view.

${LIKENESS_LINE}

${FULL_BODY_LINE}

${renderStyle(background)}`;
}

/**
 * Shoulders-up crop of an already-approved full-body image — the
 * selection-screen render, and the seed for the `select` hover clip
 * (start AND end frame, so it loops on the actual framing that clip plays
 * at, not the full-body one). Generated from the full-body image itself
 * (Nano Banana edit mode) rather than a plain image crop, since a naive
 * crop can cut off hair/accessories the full-body framing left room for.
 */
export function headshotPrompt(name: string, background: string): string {
  return `Using the attached full-body character image of ${name}, reframe it as a
shoulders-up headshot: same character, same face, hair, outfit, and
proportions, exactly as already rendered — just recomposed to frame from
the shoulders up. The face must be centered horizontally in the frame with
roughly equal empty margin on the left and right sides, and positioned so
the whole head has clear space above it — do not crop into the hair, ears,
or any part of the head, and do not push the face toward one edge. The
face should be turned to look directly into the camera, straight-on, not
angled to one side in a 3/4 profile — this is a head-on selection-screen
headshot, unlike the full-body image's 3/4 stance. Keep the same
expression as the source image exactly. Do not change anything else about
the character itself.

${renderStyle(background)}`;
}

export type ClipType = "select" | "fullbody" | "confirm" | "victory";

/** Solo clip prompts — apply to the plain single-subject full-body image
 * (or headshot, for `select`), no Cassandra/Bailey. Used for select/
 * fullbody always, and for confirm/victory only as a fallback when no
 * composite scene has been generated yet (see cli.ts's `clip` command). */
const soloClipPrompts: Record<ClipType, (name: string, background: string, action?: string) => string> = {
  select: (name, background) => `Using the attached stylized 3D character image of ${name} as both the
starting frame and the ending frame, animate a short, energetic idle
gesture in between them — a quick eager bounce or a wave toward camera —
that departs from and returns to that exact pose, so the clip loops
perfectly on hover. ${background} Same low-poly N64-era character-select
style as the reference image throughout. No camera movement.`,

  fullbody: (name, background, action) => `Using the attached stylized 3D character image of ${name}, generate a
short, seamlessly loopable animation: ${action ?? "a silly, signature move related to their outfit/character (e.g. a trick, a flex, a move that fits who they are)"}
— starting and ending in the exact same pose so it loops with no visible
seam. The move itself should be quick, well under the clip's full length:
perform it, settle back into the exact starting pose with time to spare,
and hold there for the remainder of the clip rather than stretching the
motion out to fill the whole duration. Should read as alive and distinctly
them, not a static idle. ${background} Same low-poly N64-era
character-select style as the reference image. The camera is completely
static and locked off for the entire clip — it must not pan, orbit,
rotate, dolly, or zoom, not even slightly; only the character moves, the
camera frame never changes.`,

  confirm: (name, background) => `Using the attached stylized 3D character image of ${name}, generate a
short one-shot (non-looping) confirmation animation: the character
celebrates being selected/chosen — a confident, hype reaction, a fist
pump, a point at the camera, or a thumbs up — as if just picked on a video
game character-select screen. ${background} Same low-poly N64-era
character-select style as the reference image. Simple push-in camera move
for emphasis.`,

  victory: (name, background) => `Using the attached stylized 3D character image of ${name}'s low-poly
N64-era character, generate a video: ${name}'s character performs a
triumphant, comedic victory move, then playfully stomps/squashes a small
group of generic same-style opposing characters, who comically flatten
like inflatable toys and pop back up dazed. ${background} Cartoon physics,
upbeat and silly, not aggressive or realistic — this is a celebratory gag,
not a fight.`,
};

export function soloClipPrompt(type: ClipType, name: string, background: string, action?: string): string {
  return soloClipPrompts[type](name, background, action);
}

/** Composite *scene image* prompts — combine several existing images
 * (Nano Banana, multi-image input) into one still frame before it's handed
 * to Veo as a single seed image. Keeps every character's likeness anchored
 * to its own reference rather than asking Veo to invent Cassandra/Bailey
 * from a text description alone. Still on the original "arena" background
 * language — docs/VISUAL_SPEC.md's newer Lake Tahoe beach direction for
 * victory/boot hasn't been threaded through here yet, deliberately lowest
 * priority (see that doc's per-player-clip generation order). */
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
