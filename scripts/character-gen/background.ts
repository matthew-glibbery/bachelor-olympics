/**
 * Generation background, replacing the original plain white/black.
 * Explicit product decision after the white background read poorly once
 * live in the app (a stray white halo behind every character render,
 * `character-clip-mask`'s edge-fade making it worse, not better) — the
 * white/black pair still exists but is now opt-in-only, for matte.ts's
 * difference-matting technique (see matte.ts's own doc comment), not the
 * default for portraits/headshots/clips.
 *
 * New default: a radial gradient from the player's own assigned chart
 * color (src/lib/chartColors.ts — the same color already used for their
 * rank badge, chart line, and the ProceduralBust fallback's own
 * background) fading into the app's actual `--background` token. Real
 * art now picks up visually where the placeholder left off, instead of
 * introducing a new white-box look the rest of the app never has.
 */
import { assignPlayerColors, type ChartPlayer } from "../../src/lib/chartColors";
import { fetchPlayers, slugify } from "./players";

/** `--background` (globals.css) converted oklch(0.16 0.06 275) -> srgb hex —
 * see the conversion math in the PR that introduced this file if it ever
 * needs recomputing after a token change. */
export const APP_BACKGROUND_HEX = "#070926";

let cache: Record<string, string> | undefined;

/** Dark-mode chart colors for every player, keyed by id — same function,
 * same "dark" mode, same sort-by-id-first requirement the real app's
 * chart rendering uses (chartColors.ts's own doc comment), so these are
 * the *actual* colors a player sees elsewhere in the app, not a
 * re-derived approximation that could drift out of sync. */
async function playerColorsById(): Promise<Record<string, string>> {
  if (cache) return cache;
  const players = await fetchPlayers();
  const sorted = [...players].sort((a, b) => a.id.localeCompare(b.id));
  const chartPlayers: ChartPlayer[] = sorted.map((p) => ({ id: p.id, state: p.state }));
  cache = assignPlayerColors(chartPlayers, "dark");
  return cache;
}

export async function playerColorByKey(key: string): Promise<string | undefined> {
  const players = await fetchPlayers();
  const player = players.find((p) => slugify(p.name) === key);
  if (!player) return undefined;
  const colors = await playerColorsById();
  return colors[player.id];
}

/** The actual sentence fed into every render-style prompt. `hex` is a
 * player's own color (gradient); omit it for guests/the boot scene, which
 * get a flat version of the same navy instead of inventing a color that
 * means nothing for them. */
export function backgroundDescription(hex?: string): string {
  if (hex) {
    return `A plain radial gradient background: solid ${hex} at the center of the frame, smoothly fading outward into ${APP_BACKGROUND_HEX} (a dark navy blue) toward the edges — no other scenery, nothing else in frame.`;
  }
  return `A plain solid ${APP_BACKGROUND_HEX} (dark navy blue) background, nothing else in frame.`;
}

/** For matte.ts's difference-matting technique specifically — needs real
 * white/black for the alpha-recovery math, unrelated to what the *final*
 * asset's background should look like. Kept separate on purpose. */
export function matteBackgroundDescription(color: "white" | "black"): string {
  return `Plain solid ${color} background, nothing else in frame.`;
}

/** docs/VISUAL_SPEC.md's Lake Tahoe beach direction, threaded through for
 * victory scenes — this file's own header used to flag that as deferred;
 * done here, on direct ask. The boot scene still uses the older "arena"
 * language in prompts.ts's bootScenePrompt — a separate, still-open
 * follow-up, not touched by this change.
 *
 * One shared constant, not a per-player variant like
 * backgroundDescription()'s hex gradient — the whole point (per
 * VISUAL_SPEC) is that every clip reads as "this all happened at the same
 * party," which a different beach per player would undercut. */
export const VICTORY_BEACH_BACKGROUND =
  "a stylized, low-poly N64-era Lake Tahoe beach: pale sand meeting brilliant " +
  "turquoise-blue water, granite boulders at the waterline, tall pine trees " +
  "along the shore, and snow-capped mountains rising across the lake under a " +
  "bright blue sky — the same colorful, saturated N64-era sports-game look " +
  "as the rest of the cast's world, no photorealism, no real-world logos";
