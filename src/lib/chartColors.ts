/**
 * Per-player chart line colors, "flag-inspired, auto-disambiguated."
 *
 * The 8-slot categorical palette below is the dataviz skill's validated
 * default — fixed hue order, never cycled, passes all six categorical checks
 * (lightness band, chroma floor, CVD separation, normal-vision floor,
 * contrast) against this app's actual chart surfaces (validated
 * 2026-08-11: light `#ffffff`, dark `#241e1a` — the app's --card token).
 *
 * Most US state flags share the same "blue field + seal" design, so literally
 * deriving a color from every flag would make most lines the same dark blue —
 * exactly the collision a categorical palette exists to prevent. Instead:
 * a small, deliberately non-exhaustive table maps a handful of genuinely
 * distinctive state flags (ones with a real, well-known non-blue signature
 * color) to their nearest slot in the fixed palette; every other player —
 * including a collision on an already-claimed slot — falls back to the next
 * free slot in fixed order. Every player still gets a distinct, validated
 * color; only some get one that's literally flag-derived.
 *
 * Assignment is deterministic given a stable player order (sort by id before
 * calling), not regenerated per render — color follows the entity, never its
 * rank on screen.
 */

const SLOT_HUES = [
  "blue",
  "orange",
  "aqua",
  "yellow",
  "magenta",
  "green",
  "violet",
  "red",
] as const;

type SlotHue = (typeof SLOT_HUES)[number];

const LIGHT_HEX: Record<SlotHue, string> = {
  blue: "#2a78d6",
  orange: "#eb6834",
  aqua: "#1baf7a",
  yellow: "#eda100",
  magenta: "#e87ba4",
  green: "#008300",
  violet: "#4a3aa7",
  red: "#e34948",
};

const DARK_HEX: Record<SlotHue, string> = {
  blue: "#3987e5",
  orange: "#d95926",
  aqua: "#199e70",
  yellow: "#c98500",
  magenta: "#d55181",
  green: "#008300",
  violet: "#9085e9",
  red: "#e66767",
};

/**
 * Deliberately partial: only states with a genuinely well-known, distinctive
 * non-"blue field + seal" flag. Everything else gets a fallback slot — this
 * is not a claim of literal accuracy for every state's actual flag colors.
 */
const STATE_HUE_FAMILY: Partial<Record<string, SlotHue>> = {
  AZ: "orange", // copper/red-orange rays fanning from a copper star
  NM: "yellow", // red Zia sun symbol on a yellow/gold field
  CA: "red", // red star + red stripe on a white field (Bear Flag)
  MD: "yellow", // black/gold Calvert checkerboard quartered with red/white
  OH: "red", // the one non-rectangular state flag; red disc dominates
  FL: "red", // diagonal red saltire on white
  AL: "red", // diagonal red saltire on white
  TX: "blue", // navy "Lone Star" canton
  SC: "blue", // indigo field, white palmetto and crescent
};

/**
 * Colours pinned to a specific person, by first name (case-insensitive).
 *
 * Everything below this is assigned by flag preference then by fixed slot
 * order, which means a player's colour depends on who ELSE is in the roster:
 * removing someone shifts every unpinned player after them onto a different
 * slot. That happened for real on 2026-08-24 — a player was removed and the
 * field changed colour — and these two were pinned back by explicit request
 * (Josh to the green slot, #008300; Matthew to the violet slot, #9085e9).
 *
 * Keyed by name rather than player id on purpose: a player deleted and
 * re-added gets a new id but the same name, and re-adding someone is exactly
 * the situation that shuffled the colours in the first place. The trade-off
 * is that two players sharing a first name would both claim the pin — the
 * second one loses the race and falls through to normal assignment, same as
 * any other collision.
 *
 * These are slots in the existing validated palette, not new hex values, so
 * the CVD/contrast work behind that palette still holds.
 */
const PINNED_SLOTS: Record<string, SlotHue> = {
  josh: "green",
  matthew: "violet",
};

export interface ChartPlayer {
  id: string;
  state: string;
  /** First name, used only for PINNED_SLOTS. Optional — unpinned without it. */
  name?: string;
}

/** Deterministic playerId -> hex color, using `mode`'s validated hex set. */
export function assignPlayerColors(
  players: ChartPlayer[],
  mode: "light" | "dark" = "light",
): Record<string, string> {
  const hexFor = mode === "dark" ? DARK_HEX : LIGHT_HEX;
  const used = new Set<SlotHue>();
  const slotByPlayerId: Record<string, SlotHue> = {};

  // Pass 0: pinned players claim their slot before anything else can take
  // it — a pin is an explicit instruction, so it outranks both a flag
  // preference and fixed-order fallback.
  for (const player of players) {
    const pinned = player.name ? PINNED_SLOTS[player.name.trim().toLowerCase()] : undefined;
    if (pinned && !used.has(pinned)) {
      used.add(pinned);
      slotByPlayerId[player.id] = pinned;
    }
  }

  // Pass 1: let every flag-matched player claim their preferred slot first —
  // otherwise a no-preference player processed earlier could grab it via
  // fallback before the player it actually means something for gets a turn.
  for (const player of players) {
    if (slotByPlayerId[player.id]) continue;
    const preferred = STATE_HUE_FAMILY[player.state.toUpperCase()];
    if (preferred && !used.has(preferred)) {
      used.add(preferred);
      slotByPlayerId[player.id] = preferred;
    }
  }

  // Pass 2: everyone else (no preference, or their preference lost the race)
  // takes the next free slot in fixed order.
  for (const player of players) {
    if (slotByPlayerId[player.id]) continue;
    let slot = SLOT_HUES.find((hue) => !used.has(hue));
    // More than 8 players (beyond the game's normal 8-competitor cap): cycle
    // rather than leave someone uncolored.
    if (!slot) {
      const index = players.indexOf(player) % SLOT_HUES.length;
      slot = SLOT_HUES[index] ?? SLOT_HUES[0];
    }
    used.add(slot);
    slotByPlayerId[player.id] = slot;
  }

  const result: Record<string, string> = {};
  for (const player of players) {
    result[player.id] = hexFor[slotByPlayerId[player.id]!];
  }
  return result;
}
