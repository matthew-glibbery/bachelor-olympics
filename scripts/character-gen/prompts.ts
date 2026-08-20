/**
 * Prompt templates, one per pipeline step. The portrait prompt is
 * docs/VISUAL_SPEC.md's Nano Banana template verbatim; the four clip prompts
 * translate its Seedance victory-clip template to Veo's image-to-video
 * input, split by clip type per the media slots on `players`
 * (0011_character_media.sql / 0012_character_confirm_video.sql).
 */

export function portraitPrompt(name: string): string {
  return `Create a stylized 3D-rendered character based on the attached reference
photo of ${name}. Style: chunky, exaggerated proportions in the style of
late-1990s N64-era video game character models (think Ready 2 Rumble
Boxing, Diddy Kong Racing) — thick outlines, low-poly faceted shading,
saturated primary colors, slightly oversized head-to-body ratio. Preserve
recognizable facial features, hairstyle, and skin tone from the reference
photo, but do not aim for photorealism. Full body, neutral standing pose,
plain white background, front 3/4 view. Should look like an official
character-select portrait from a 1998 sports video game box.`;
}

export type ClipType = "select" | "fullbody" | "confirm" | "victory";

const clipPrompts: Record<ClipType, (name: string) => string> = {
  // character_select_video_url — short loop, plays on hover/tap in the
  // roster strip. Needs a clean loop point, so keep the motion small.
  select: (name) => `Using the attached stylized 3D character image of ${name}, generate a
short, seamlessly loopable video: the character stands in place doing a
small, energetic idle gesture — a quick eager bounce or a wave toward
camera — that returns to its exact starting pose by the end of the clip so
it can loop invisibly. Plain white background, same low-poly N64-era
character-select style as the reference image. No camera movement.`,

  // character_fullbody_video_url — idle loop while the player is choosing
  // and while adjusting multipliers. VISUAL_SPEC: "a breathing loop, a
  // little shift of weight."
  fullbody: (name) => `Using the attached stylized 3D character image of ${name}, generate a
subtle, seamlessly loopable idle animation: gentle breathing motion and a
small weight shift from foot to foot, like a character standing on a video
game select screen waiting to be picked. Minimal, continuous, no distinct
start or end pose — should read as alive, not static. Plain white
background, same low-poly N64-era character-select style as the reference
image. No camera movement.`,

  // character_confirm_video_url — one-shot "you're playing as ___" cutscene
  // right after hitting "Let's go," before routing into the app.
  confirm: (name) => `Using the attached stylized 3D character image of ${name}, generate a
short one-shot (non-looping) confirmation animation: the character strikes
a confident, hype "I'm ready" pose — a fist pump, a point at the camera, or
a thumbs up — as if just chosen on a video game character-select screen.
Plain white background, same low-poly N64-era character-select style as
the reference image. Simple push-in camera move for emphasis.`,

  // character_victory_video_url — one clip per player, played whenever they
  // win any event. VISUAL_SPEC scopes this to one generic-opponent clip,
  // not per-matchup. Multi-character squash gag — the riskiest of the four
  // per the earlier Seedance-vs-Veo tradeoff noted in VISUAL_SPEC.md.
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

export function clipPrompt(type: ClipType, name: string): string {
  return clipPrompts[type](name);
}

export const CLIP_TYPES: ClipType[] = ["select", "fullbody", "confirm", "victory"];

export const CLIP_FIELD: Record<ClipType, string> = {
  select: "character_select_video_url",
  fullbody: "character_fullbody_video_url",
  confirm: "character_confirm_video_url",
  victory: "character_victory_video_url",
};
