/**
 * Event configuration — the source list of events for the weekend.
 *
 * Per PRODUCT_SPEC.md: the roster listed here is 9 and may still be trimmed to
 * a clean 8. NOTHING downstream should hardcode the count — always read it from
 * this config (`EVENTS.length` / `eventCount()`), so trimming an event or
 * cancelling one mid-weekend flows through automatically.
 */

export type ScoringMode = "placement" | "absolute";

export interface EventDefinition {
  /** Stable identifier, used everywhere else to reference the event. */
  id: string;
  /** Display name. */
  name: string;
  /** How this event's raw points are computed. */
  scoringMode: ScoringMode;
  /**
   * Team event whose rosters reshuffle between games (beach volleyball,
   * soccer). No single game result exists — placement is derived from each
   * player's win/loss record across all games. See PRODUCT_SPEC.md.
   */
  teamReshuffle?: boolean;
  /**
   * For absolute-scored events only: true when a lower raw result is better
   * (e.g. golf strokes). Ignored for placement events.
   */
  lowerIsBetter?: boolean;
  /**
   * Placement isn't a single race and is worked out case-by-case rather than
   * from a formula (Super Smash Bros. groups + final).
   */
  customPlacement?: boolean;
  /** Requires a sobriety/safety check before play (Stump). */
  safetyCheck?: boolean;
  /** Freeform note surfaced in the UI. */
  notes?: string;
}

/**
 * The nine planned events. May be trimmed to eight — do not assume a count.
 * (On-the-fly bonus events are NOT here; they live entirely outside the core
 * event/scoring model — see src/lib/bonus.)
 */
export const EVENTS: readonly EventDefinition[] = [
  {
    id: "beach-volleyball",
    name: "Beach Volleyball",
    scoringMode: "placement",
    teamReshuffle: true,
    notes: "4v4, multiple games, teams reshuffled between games.",
  },
  { id: "spikeball", name: "Spikeball", scoringMode: "placement" },
  {
    id: "molkky",
    name: "Mölkky",
    scoringMode: "placement",
    notes: "a.k.a. Skittle Scatter.",
  },
  {
    id: "smash-bros",
    name: "Super Smash Bros. (N64)",
    scoringMode: "placement",
    customPlacement: true,
    notes: "Two groups of four, round-robin, top two per group advance to a four-player final.",
  },
  {
    id: "catan",
    name: "Settlers of Catan",
    scoringMode: "placement",
    notes: "One single 8-player game on the combined 'peanut' board.",
  },
  {
    id: "golf",
    name: "Nine Holes of Golf",
    scoringMode: "absolute",
    lowerIsBetter: true,
    notes: "Scored on strokes — fewer is better.",
  },
  {
    id: "soccer",
    name: "3v3 Soccer",
    scoringMode: "placement",
    teamReshuffle: true,
  },
  { id: "beer-pong", name: "Beer Pong", scoringMode: "placement" },
  {
    id: "stump",
    name: "Stump",
    scoringMode: "placement",
    safetyCheck: true,
    notes: "Hammering nails into a stump — sobriety check required first, real injury risk.",
  },
] as const;

/** Number of events currently in the competition. Never hardcode this. */
export function eventCount(): number {
  return EVENTS.length;
}

/** Look up an event definition by id, or undefined if it doesn't exist. */
export function getEvent(id: string): EventDefinition | undefined {
  return EVENTS.find((e) => e.id === id);
}
