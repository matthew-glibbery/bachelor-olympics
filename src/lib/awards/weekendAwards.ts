/**
 * "Weekend awards" — light, fun, flat-points categories the groom can hand
 * out once the competition is winding down, computed live from the same
 * data everything else already reads (bets, results). Deliberately outside
 * the core scoring/betting system, same isolation principle as on-the-fly
 * bonus events (src/lib/bonus/bonusEvent.ts) — this module only *computes
 * who'd win each category*; awarding is just creating a normal bonus_events
 * row (src/lib/data/mutations.ts → createBonusEvent), so these show up
 * under Bonus events like anything else the groom hands out by hand.
 *
 * Point values were sized the same way the overall-bet payout was
 * (docs/simulation-notes.md): small next to the typical ~70-130 point gap
 * between adjacent final standings, so even someone sweeping more than one
 * of these can't flip the competition on their own. See the chat writeup
 * this module shipped with for the full reasoning — short version, from
 * least to most "deserves a bigger nudge":
 *
 *   Most bets placed   +20  (participation, pure fun, no judgement either way)
 *   Most improved       +25  (one big single-event rank jump — a positive,
 *                             forward-looking category, doesn't compound
 *                             with whoever's already leading)
 *   Most bets lost      +25  (a bad-beat consolation prize)
 *   Most times last      +35  (the one that matters most for "nobody feels
 *                             out of it" — repeatedly finishing last is the
 *                             single most demoralizing outcome this app
 *                             produces, so its consolation is sized like a
 *                             mid-tier event's own points, not a token)
 *
 * Deliberately NOT recommended, and not implemented here:
 *   - Anything that rewards winning/leading (a "most 1st-place finishes"
 *     category) — standings already reward that; a bonus on top of it works
 *     against "no one runs away with it," the explicit design goal here.
 *   - A peer-vote category ("funniest moment," etc.) — PRODUCT_SPEC.md →
 *     Explicitly out of scope already rejects this, for reasons that still
 *     apply here.
 */
import { scorePlacement, type PlacementEntry } from "@/lib/scoring/placement";
import { scoreAbsolute, type AbsoluteEntry } from "@/lib/scoring/absolute";
import { deriveScoreLines } from "@/lib/scoring/fromRows";
import { finalEventScore } from "@/lib/scoring/total";
import type {
  EventResultRow,
  EventRow,
  MultiplierRow,
  OverallBetRow,
  PerEventBetRow,
} from "@/lib/data/database.types";

export const WEEKEND_AWARD_POINTS = {
  mostBetsPlaced: 20,
  mostImproved: 25,
  mostBetsLost: 25,
  mostLastPlace: 35,
} as const;

export interface AwardWinner {
  playerId: string;
  /** Human-readable, e.g. "6 bets" or "last place 3 times" or "+4 places at Spikeball". */
  detail: string;
}

export interface WeekendAwardCategory {
  key: keyof typeof WEEKEND_AWARD_POINTS;
  name: string;
  points: number;
  /** More than one entry means a genuine tie — award each. Empty means
   * nothing to award yet (e.g. no bets placed at all). */
  winners: AwardWinner[];
}

function resolvedInOrder(events: EventRow[]): EventRow[] {
  return events
    .filter((e) => e.status === "resolved")
    .slice()
    .sort((a, b) => {
      const at = a.resolved_at ? new Date(a.resolved_at).getTime() : Infinity;
      const bt = b.resolved_at ? new Date(b.resolved_at).getTime() : Infinity;
      return at - bt;
    });
}

function pointsForEvent(event: EventRow, results: EventResultRow[]): Map<string, number> {
  if (event.scoring_mode === "placement") {
    const entries: PlacementEntry[] = results
      .filter((r) => r.position != null)
      .map((r) => ({ playerId: r.player_id, position: r.position as number }));
    return scorePlacement(entries);
  }
  const entries: AbsoluteEntry[] = results
    .filter((r) => r.raw != null)
    .map((r) => ({ playerId: r.player_id, raw: r.raw as number }));
  return scoreAbsolute(entries, { lowerIsBetter: event.lower_is_better });
}

/** Leaders (all tied for the max) from a playerId -> count map, or []
 * if every count is 0/the map is empty — nothing to award yet. */
function leaders(counts: Map<string, number>): { playerId: string; count: number }[] {
  const max = Math.max(0, ...counts.values());
  if (max === 0) return [];
  return [...counts.entries()].filter(([, c]) => c === max).map(([playerId, count]) => ({ playerId, count }));
}

/** Every bet a player has ever placed, either kind, any status — a pure
 * participation/engagement count, not about winning or losing. */
export function mostBetsPlaced(
  perEventBets: PerEventBetRow[],
  overallBets: OverallBetRow[],
): AwardWinner[] {
  const counts = new Map<string, number>();
  for (const b of perEventBets) counts.set(b.player_id, (counts.get(b.player_id) ?? 0) + 1);
  for (const b of overallBets) counts.set(b.player_id, (counts.get(b.player_id) ?? 0) + 1);
  return leaders(counts).map(({ playerId, count }) => ({
    playerId,
    detail: `${count} bet${count === 1 ? "" : "s"} placed`,
  }));
}

/** Bets that actually resolved "lost" — a bad-luck consolation, not a
 * judgement on bet quality. */
export function mostBetsLost(
  perEventBets: PerEventBetRow[],
  overallBets: OverallBetRow[],
): AwardWinner[] {
  const counts = new Map<string, number>();
  for (const b of perEventBets) if (b.status === "lost") counts.set(b.player_id, (counts.get(b.player_id) ?? 0) + 1);
  for (const b of overallBets) if (b.status === "lost") counts.set(b.player_id, (counts.get(b.player_id) ?? 0) + 1);
  return leaders(counts).map(({ playerId, count }) => ({
    playerId,
    detail: `${count} bet${count === 1 ? "" : "s"} lost`,
  }));
}

/** How many resolved events a player finished dead last in (ties for last
 * count for everyone in the tied group, same "no one player 'deserves' the
 * whole tier" logic the catch-up bonus uses for tied positions). */
export function mostLastPlaceFinishes(
  events: EventRow[],
  results: EventResultRow[],
): AwardWinner[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (event.status !== "resolved") continue;
    const eventResults = results.filter((r) => r.event_id === event.id);
    const points = pointsForEvent(event, eventResults);
    if (points.size === 0) continue;
    const min = Math.min(...points.values());
    for (const [playerId, pts] of points) {
      if (pts === min) counts.set(playerId, (counts.get(playerId) ?? 0) + 1);
    }
  }
  return leaders(counts).map(({ playerId, count }) => ({
    playerId,
    detail: `last place ${count} time${count === 1 ? "" : "s"}`,
  }));
}

/** The single biggest one-event jump in adjusted-standings rank (climbing,
 * not falling) across the whole resolved history — a positive, forward-
 * looking category on purpose: whoever already leads can't win this, since
 * there's no room left above them to climb into. */
export function mostImproved(
  events: EventRow[],
  results: EventResultRow[],
  multipliers: MultiplierRow[],
  playerIds: string[],
): AwardWinner[] {
  const resolved = resolvedInOrder(events);
  if (resolved.length < 2 || playerIds.length < 2) return [];

  const allLines = deriveScoreLines(events, results, multipliers, playerIds);
  const linesByEvent = new Map<string, typeof allLines>();
  for (const line of allLines) {
    const forEvent = linesByEvent.get(line.eventId) ?? [];
    forEvent.push(line);
    linesByEvent.set(line.eventId, forEvent);
  }

  const running = new Map(playerIds.map((id) => [id, 0]));
  const ranksNow = (): Map<string, number> => {
    const sorted = [...running.entries()].sort((a, b) => b[1] - a[1]);
    const r = new Map<string, number>();
    sorted.forEach(([id], i) => r.set(id, i + 1));
    return r;
  };

  let prevRanks: Map<string, number> | null = null;
  let bestPlaces = 0;
  let best: { playerId: string; places: number; eventName: string }[] = [];

  for (const event of resolved) {
    for (const line of linesByEvent.get(event.id) ?? []) {
      running.set(line.playerId, (running.get(line.playerId) ?? 0) + finalEventScore(line.points, line.multiplier, line.catchUpBonus));
    }
    const afterRanks = ranksNow();
    if (prevRanks) {
      for (const playerId of playerIds) {
        const before = prevRanks.get(playerId);
        const after = afterRanks.get(playerId);
        if (before == null || after == null) continue;
        const places = before - after; // positive = moved up (lower rank number is better)
        if (places <= 0) continue;
        if (places > bestPlaces) {
          bestPlaces = places;
          best = [{ playerId, places, eventName: event.name }];
        } else if (places === bestPlaces) {
          best.push({ playerId, places, eventName: event.name });
        }
      }
    }
    prevRanks = afterRanks;
  }

  return best.map(({ playerId, places, eventName }) => ({
    playerId,
    detail: `+${places} place${places === 1 ? "" : "s"} at ${eventName}`,
  }));
}

export interface WeekendAwardsInput {
  events: EventRow[];
  eventResults: EventResultRow[];
  multipliers: MultiplierRow[];
  playerIds: string[];
  perEventBets: PerEventBetRow[];
  overallBets: OverallBetRow[];
}

/** All four categories, most-points-first — categories with no winner yet
 * (nothing to compute from) are still included with an empty `winners`
 * array, so the UI can show "not enough data yet" rather than the category
 * silently not existing. */
export function computeWeekendAwards(input: WeekendAwardsInput): WeekendAwardCategory[] {
  return [
    {
      key: "mostLastPlace",
      name: "Perennial underdog",
      points: WEEKEND_AWARD_POINTS.mostLastPlace,
      winners: mostLastPlaceFinishes(input.events, input.eventResults),
    },
    {
      key: "mostBetsLost",
      name: "Bad beat",
      points: WEEKEND_AWARD_POINTS.mostBetsLost,
      winners: mostBetsLost(input.perEventBets, input.overallBets),
    },
    {
      key: "mostImproved",
      name: "Most improved",
      points: WEEKEND_AWARD_POINTS.mostImproved,
      winners: mostImproved(input.events, input.eventResults, input.multipliers, input.playerIds),
    },
    {
      key: "mostBetsPlaced",
      name: "Action junkie",
      points: WEEKEND_AWARD_POINTS.mostBetsPlaced,
      winners: mostBetsPlaced(input.perEventBets, input.overallBets),
    },
  ];
}
