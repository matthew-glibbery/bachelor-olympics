/**
 * Bridge from raw DB rows (src/lib/data/database.types.ts) to the domain
 * scoring layer (src/lib/scoring/*). Pure and DB-agnostic — the store calls
 * this after fetching rows; it's unit-testable without Supabase.
 *
 * Only RESOLVED events (status === "resolved") produce score lines: a
 * "planned"/"scoring" event has no final result yet, and a "cancelled" event
 * is excluded entirely per PRODUCT_SPEC.md → Cancelled events (deleted from the
 * competition, not scored).
 *
 * Events are processed in the actual order they resolved (`resolved_at`),
 * not `sort_order` — the catch-up bonus (PRODUCT_SPEC.md → Multipliers →
 * Catch-up bonus) depends on the standings as they stood right before each
 * event, so this has to walk history in the order it really happened, same
 * principle as cumulativeSeries.ts's award-order interleaving.
 */
import { scorePlacement, type PlacementEntry } from "@/lib/scoring/placement";
import { scoreAbsolute, type AbsoluteEntry } from "@/lib/scoring/absolute";
import { catchUpBonuses } from "@/lib/scoring/catchUp";
import { finalEventScore, type EventScoreLine, type PlayerTotal } from "@/lib/scoring/total";
import type {
  EventResultRow,
  EventRow,
  MultiplierRow,
} from "@/lib/data/database.types";

const MULTIPLIER_DEFAULT = 1.0;

function resolvedOrder(events: EventRow[]): EventRow[] {
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

/**
 * Walk resolved events in chronological order, maintaining a running
 * standings snapshot. Returns both the resulting score lines (each carrying
 * the catch-up bonus that applied *at the time*, based on standings before
 * that event) and the final running totals once every resolved event has
 * been applied — the latter is what determines who's eligible for the
 * catch-up bonus on whichever event is played next.
 */
function deriveScoreLinesWithStandings(
  events: EventRow[],
  results: EventResultRow[],
  multipliers: MultiplierRow[],
  playerIds: string[],
): { lines: EventScoreLine[]; finalTotals: PlayerTotal[] } {
  const multiplierFor = (playerId: string, eventId: string): number =>
    multipliers.find((m) => m.player_id === playerId && m.event_id === eventId)
      ?.value ?? MULTIPLIER_DEFAULT;

  const running = new Map<string, PlayerTotal>(
    playerIds.map((id) => [id, { playerId: id, raw: 0, adjusted: 0 }]),
  );

  const lines: EventScoreLine[] = [];
  // No catch-up bonus on the very first resolved event — with zero prior
  // history every player is (trivially, meaninglessly) tied, and nobody's
  // actually "behind" yet.
  let hasPriorHistory = false;

  for (const event of resolvedOrder(events)) {
    const eventResults = results.filter((r) => r.event_id === event.id);
    if (eventResults.length === 0) continue;

    const points = pointsForEvent(event, eventResults);
    const bonuses = hasPriorHistory
      ? catchUpBonuses([...running.values()])
      : new Map<string, number>();

    for (const [playerId, pts] of points) {
      const multiplier = multiplierFor(playerId, event.id);
      const catchUpBonus = bonuses.get(playerId) ?? 0;
      lines.push({ eventId: event.id, playerId, points: pts, multiplier, catchUpBonus });

      const existing = running.get(playerId) ?? { playerId, raw: 0, adjusted: 0 };
      existing.raw += pts;
      existing.adjusted += finalEventScore(pts, multiplier, catchUpBonus);
      running.set(playerId, existing);
    }
    hasPriorHistory = true;
  }

  return { lines, finalTotals: [...running.values()] };
}

export function deriveScoreLines(
  events: EventRow[],
  results: EventResultRow[],
  multipliers: MultiplierRow[],
  playerIds: string[],
): EventScoreLine[] {
  return deriveScoreLinesWithStandings(events, results, multipliers, playerIds).lines;
}

/**
 * The catch-up bonus that will apply to whichever event is up next, based
 * on current standings — for showing the bonus *before* that event
 * resolves, at the same rate it'll actually score with once it does.
 *
 * Prefers `status === "scoring"` over the lowest `sort_order` among
 * "planned" events: the real play order at the party routinely diverges
 * from however events happen to be listed, and "scoring" is the one
 * unambiguous signal for "this is the event actually being played right
 * now" (set when the groom hits Start on it, `event-card.tsx`'s
 * `startScoring`) — so once an event is genuinely underway, the preview
 * snaps to that one even if it jumped the configured order. Before that,
 * the lowest-`sort_order` "planned" event is the best available guess, and
 * showing it (marked `confirmed: false`) beats showing nothing — the
 * groom's badge-relevant deviations from list order are the exception, not
 * the common case. `confirmed` tells the caller which situation it's in, so
 * the UI can word a live "in progress" state differently from a "here's
 * what's next, going by the current running order" one. If somehow more
 * than one event is mid-scoring at once (not a normal flow, but not
 * prevented by a DB constraint either), `sort_order` breaks the tie
 * deterministically.
 *
 * No preview (empty bonuses map) until at least one event has actually
 * resolved — same "no catch-up bonus on the very first resolved event" rule
 * `deriveScoreLinesWithStandings` applies to real scoring, for the same
 * reason: with zero history every player is trivially tied at 0, and
 * `catchUpBonuses` on a fully-tied field hands out a bonus to the *whole*
 * group (they're all "tied for last" together), not just the bottom three.
 * Without this guard the very first event started would preview a bonus for
 * nearly everyone instead of nobody.
 *
 * `bonusAwards` folds in bonus-event/overall-bet points, same shape and
 * effect as bonusEvent.ts's `applyBonusAwards` (duplicated inline rather
 * than imported — that module's own doc comment makes this a deliberate
 * one-way dependency, bonus -> scoring types only, never the reverse).
 * Without this, "who's behind" here could disagree with the standings
 * actually shown on the leaderboard (which does fold those awards in) —
 * e.g. a player who just won a bonus event and jumped out of the bottom
 * three would still show as catching up here, and someone else's bonus
 * multiplier could land on the wrong player entirely.
 */
export function upcomingCatchUp(
  events: EventRow[],
  results: EventResultRow[],
  multipliers: MultiplierRow[],
  playerIds: string[],
  bonusAwards: { playerId: string; points: number }[] = [],
): { eventId: string; bonuses: Map<string, number>; confirmed: boolean } | null {
  const scoring = events
    .filter((e) => e.status === "scoring")
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)[0];
  const planned = events
    .filter((e) => e.status === "planned")
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)[0];
  const target = scoring ?? planned;
  if (!target) return null;
  const confirmed = target.status === "scoring";

  const hasAnyResolvedResults = resolvedOrder(events).some((e) =>
    results.some((r) => r.event_id === e.id),
  );
  if (!hasAnyResolvedResults) return { eventId: target.id, bonuses: new Map(), confirmed };

  const { finalTotals } = deriveScoreLinesWithStandings(events, results, multipliers, playerIds);
  const withAwards = foldBonusAwards(finalTotals, bonusAwards);
  return { eventId: target.id, bonuses: catchUpBonuses(withAwards), confirmed };
}

/** Add flat bonus-award points (bonus events, won overall bets) onto both
 * `raw` and `adjusted` — same folding `applyBonusAwards` (bonusEvent.ts)
 * does for the leaderboard's own standings, kept as a separate copy here so
 * this module doesn't import from bonus/. */
function foldBonusAwards(
  totals: PlayerTotal[],
  awards: { playerId: string; points: number }[],
): PlayerTotal[] {
  const byPlayer = new Map(totals.map((t) => [t.playerId, { ...t }]));
  for (const award of awards) {
    const existing = byPlayer.get(award.playerId) ?? { playerId: award.playerId, raw: 0, adjusted: 0 };
    existing.raw += award.points;
    existing.adjusted += award.points;
    byPlayer.set(award.playerId, existing);
  }
  return [...byPlayer.values()];
}
