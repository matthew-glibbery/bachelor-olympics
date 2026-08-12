/**
 * Aggregates the groom's per-event rankings into one synthetic overall
 * ranking, for the overall win/top3 bet's odds (PRODUCT_SPEC.md → Overall
 * betting). Each event's ranking is an independent judgment of who's
 * strongest AT THAT EVENT; the overall odds need a single cross-event order,
 * so this averages each player's rank across whichever events the groom has
 * ranked so far and re-derives a dense 1..N order from those averages —
 * updates automatically as the groom ranks more events, never needs its own
 * separate input. A documented policy choice, like the decay model in
 * ranking.ts: simple mean of ranks, not a weighted or Plackett-Luce
 * combination, since the events themselves already carry the emphasis (via
 * each player's own multiplier choices) and stacking another weighting
 * scheme on top would be hard to reason about for players checking the odds.
 */
import type { RankingEntry } from "./ranking";

export function aggregateRanking(perEventRankings: RankingEntry[][]): RankingEntry[] {
  const rankSums = new Map<string, number>();
  const counts = new Map<string, number>();

  for (const ranking of perEventRankings) {
    for (const { playerId, rank } of ranking) {
      rankSums.set(playerId, (rankSums.get(playerId) ?? 0) + rank);
      counts.set(playerId, (counts.get(playerId) ?? 0) + 1);
    }
  }

  const averages = [...rankSums.keys()].map((playerId) => ({
    playerId,
    average: rankSums.get(playerId)! / counts.get(playerId)!,
  }));
  averages.sort((a, b) => a.average - b.average || a.playerId.localeCompare(b.playerId));

  return averages.map(({ playerId }, i) => ({ playerId, rank: i + 1 }));
}
