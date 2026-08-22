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
import { nameList } from "./format";
import { VICTORY_BEACH_BACKGROUND } from "./background";

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
Neutral standing pose, facing directly forward into the camera, front-on —
not angled to one side in a 3/4 view.

${LIKENESS_LINE}

${FULL_BODY_LINE}

${renderStyle(background)}`;
}

/**
 * Shoulders-up crop of an already-approved full-body image — pushed live as
 * `photo_url` (gen:char:upload-photo), the canonical "photo" shown
 * everywhere in the app. Generated from the full-body image itself (Nano
 * Banana edit mode) rather than a plain image crop, since a naive crop can
 * cut off hair/accessories the full-body framing left room for.
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
angled to one side in a 3/4 profile — same direct, front-on facing as the
source full-body image. Keep the same expression as the source image
exactly. Do not change anything else about the character itself.

${renderStyle(background)}`;
}

export type ClipType = "fullbody" | "victory";

/** Solo clip prompts — apply to the plain single-subject full-body image.
 * Used for fullbody always. NOT used for victory any more (see below) —
 * kept in this Record only because ClipType still has two members and the
 * type wants both covered; calling it for "victory" is a bug, not a
 * fallback, so it throws instead of quietly generating the wrong thing. */
const soloClipPrompts: Record<ClipType, (name: string, background: string, action?: string) => string> = {
  fullbody: (name, background, action) => `Using the attached stylized 3D character image of ${name}, generate a
short, seamlessly loopable animation: ${action ?? "a silly, signature move related to their outfit/character (e.g. a trick, a flex, a move that fits who they are)"}
— starting and ending in the exact same pose so it loops with no visible
seam, facing the camera at both the very start and the very end of the
clip (the middle of the move can turn or shift as the action calls for,
but it must return to fully facing camera by the last frame). The move
itself should be quick, well under the clip's full length: perform it,
settle back into the exact starting pose with time to spare, and hold
there for the remainder of the clip rather than stretching the motion out
to fill the whole duration. Should read as alive and distinctly them, not
a static idle. ${background} Same low-poly N64-era character-select style
as the reference image. The camera is completely static and locked off
for the entire clip — it must not pan, orbit, rotate, dolly, or zoom, not
even slightly; only the character moves, the camera frame never changes.`,

  victory: () => {
    throw new Error(
      "Victory clips no longer have a generic single-character fallback — " +
        "every player's victory clip names and defeats the real rest of the " +
        "cast (victoryBeats.ts), which needs the composite scene step first: " +
        "run `gen:char:composite -- victory <player>`, then " +
        "`gen:char:clip -- <player> victory`.",
    );
  },
};

export function soloClipPrompt(type: ClipType, name: string, background: string, action?: string): string {
  return soloClipPrompts[type](name, background, action);
}

/** Composite *scene image* prompts — combine several existing images
 * (Nano Banana, multi-image input) into one still frame before it's handed
 * to Veo as a single seed image. Keeps every character's likeness anchored
 * to its own reference rather than asking Veo to invent anyone from a text
 * description alone.
 *
 * Generalized from a Matthew-only function to cover every player, on
 * direct ask: each player's victory clip now names and defeats the real
 * rest of the cast (not "generic same-style opposing characters"), all on
 * the same VICTORY_BEACH_BACKGROUND (docs/VISUAL_SPEC.md's Lake Tahoe
 * beach direction, threaded through here — see background.ts). `pose` and
 * `action` are the bespoke per-player content from victoryBeats.ts; this
 * function only owns the shared scaffolding (which images are attached,
 * the background, the likeness-fidelity instruction, the safety/tone
 * footer) so that scaffolding can't drift between players.
 *
 * `guestNames` is empty for everyone except Matthew, whose beat also
 * brings Cassandra and Bailey into the reference-image list and the final
 * pose — see cmdComposite in cli.ts for where that list gets built. */

export function namedVictoryScenePrompt(
  winnerName: string,
  rivalNames: string[],
  guestNames: string[],
  pose: string,
): string {
  const cast = [winnerName, ...rivalNames, ...guestNames];
  return `Using the attached stylized N64-style character images — ${nameList(cast)} —
compose a single wide victory scene on ${VICTORY_BEACH_BACKGROUND}. Keep
every character's face, proportions, outfit, and (for Bailey, if present)
breed/markings identical to their own reference image. ${pose} Full body,
every character fully visible, front-facing.`;
}

export function namedVictorySceneClipPrompt(winnerName: string, action: string): string {
  return `Using the attached composite scene image, animate it into a video: ${action}
Simple dynamic camera, one gentle push-in on ${winnerName}. Cartoon physics,
upbeat and silly, not aggressive or realistic — this is a celebratory gag,
not a fight, and nobody is really hurt.`;
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

export const CLIP_TYPES: ClipType[] = ["fullbody", "victory"];

export const CLIP_FIELD: Record<ClipType, string> = {
  fullbody: "character_fullbody_video_url",
  victory: "character_victory_video_url",
};
