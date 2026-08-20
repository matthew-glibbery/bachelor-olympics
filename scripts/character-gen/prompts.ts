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

export type MatteBackground = "white" | "black";

/** Appended to every portrait/headshot prompt. Iterated three times against
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
 * `background` is parameterized (not hardcoded white) so the same prompt
 * can render on white and on black for difference matting (matte.ts) —
 * Gemini's image models have no alpha channel, this is how a real
 * transparent cutout gets recovered after the fact. */
function renderStyle(background: MatteBackground): string {
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
Plain solid ${background} background, nothing else in frame — no text, no
logos, no watermarks, no game-box framing or UI chrome of any kind.`;
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

export function portraitPrompt(
  name: string,
  kind: SubjectKind,
  outfit?: string,
  background: MatteBackground = "white",
  photoCount = 1,
): string {
  const photosLine = referencePhotosLine(photoCount);
  if (kind === "pet") {
    const outfitLine = outfit ? ` Make sure to ${outfit}.` : "";
    return `Create a stylized 3D-rendered dog character based on the attached
${photosLine} of ${name}, in the style of late-1990s N64-era video game
creature models (think Diddy Kong Racing's animal characters). Preserve
${name}'s recognizable breed, coat color/pattern, and markings from the
reference photo(s), but do not aim for photorealism.${outfitLine} Full
body, standing pose, front 3/4 view.

${renderStyle(background)}`;
  }
  const outfitLine = outfit ? ` Dress the character in ${outfit}.` : "";
  return `Create a stylized 3D-rendered character based on the attached
${photosLine} of ${name}, in the style of late-1990s N64-era video game
character models (think Ready 2 Rumble Boxing, Diddy Kong Racing).
Preserve recognizable facial features, hairstyle, and skin tone from the
reference photo(s), but do not aim for photorealism.${outfitLine} Full
body, neutral standing pose, front 3/4 view.

${renderStyle(background)}`;
}

/**
 * Shoulders-up crop of an already-approved full-body portrait — the
 * selection-screen render, and the seed for the `select` hover clip
 * (start AND end frame, so it loops on the actual framing that clip plays
 * at, not the full-body one). Generated from the full-body portrait itself
 * (Nano Banana edit mode) rather than a plain image crop, since a naive
 * crop can cut off hair/accessories the full-body framing left room for.
 */
export function headshotPrompt(name: string, background: MatteBackground = "white"): string {
  return `Using the attached full-body character image of ${name}, reframe it as a
shoulders-up headshot: same character, same face, hair, outfit, and
proportions, exactly as already rendered — just recomposed to frame from
the shoulders up. The face must be centered horizontally in the frame with
roughly equal empty margin on the left and right sides, and positioned so
the whole head has clear space above it — do not crop into the hair, ears,
or any part of the head, and do not push the face toward one edge. The
face should be turned to look directly into the camera, straight-on, not
angled to one side in a 3/4 profile — this is a head-on selection-screen
headshot, unlike the full-body portrait's 3/4 stance. Keep the same
expression as the source image exactly. Do not change anything else about
the character itself.

${renderStyle(background)}`;
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
