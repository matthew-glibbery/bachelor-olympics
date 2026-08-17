/**
 * The game's name, as decided in docs/VISUAL_SPEC.md → Open decisions:
 * "Bachelor Party." Isolated here so a future rename stays a one-line
 * change — the logo (src/components/n64/game-logo.tsx), the browser tab
 * (layout.tsx), and the boot sequence all follow.
 *
 * Split into two parts because the logo renders them in two different
 * treatments (gold wordmark, cyan accent word) the way a real cartridge
 * title splits its name from a stylized suffix.
 */
export const GAME_NAME = "BACHELOR";
export const GAME_NAME_SUFFIX = "PARTY";

/** Full name, for the tab title and anywhere the logo isn't drawn. */
export const GAME_NAME_FULL = `${GAME_NAME} ${GAME_NAME_SUFFIX}`;

/** Sits under the logo on the title screen, in the register of a box-art tagline. */
export const GAME_TAGLINE = "EIGHT EVENTS · EIGHT COMPETITORS · ONE LEADERBOARD";

/** Fake copyright line, because every one of these screens had one. */
export const GAME_COPYRIGHT = "© 2026 BACHELOR PARTY SOFTWARE — ALL RIGHTS RESERVED";
