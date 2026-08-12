/**
 * Odds from the groom's ranking (PRODUCT_SPEC.md → Overall betting).
 *
 * The groom privately ranks all players (himself included) once PER EVENT,
 * 1 = strongest at that event — not one overall ranking. Every function
 * below operates on a single ranking (`RankingEntry[]`); callers pass in
 * whichever one applies: an event's own ranking for that event's odds
 * (src/lib/betting/resolvePerEventBets.ts), or the cross-event aggregate
 * (src/lib/odds/aggregate.ts) for the overall win/top3 bet. The groom never
 * updates a ranking live once its event has started — see the lock in
 * src/app/setup/page.tsx.
 *
 * Model (the spec fixes the inputs and the shape, not the exact math, so this
 * is a documented, tunable choice — like docs/simulation-notes.md):
 *
 *   - Each rank gets an exponentially-decaying "strength" s = DECAY^(rank-1),
 *     reusing the same 0.72 decay as the scoring curve for consistency.
 *   - Finishing probabilities come from the Plackett-Luce model over those
 *     strengths: p_win is the chance of being drawn first, p_top3 the chance of
 *     landing in the first three draws, p_last the chance of being drawn first
 *     under *inverted* strengths (best-at-being-worst).
 *   - Payout multiplier = fair decimal odds = 1 / probability. So a strong
 *     favourite (high probability) pays out close to 1:1, and a longshot (low
 *     probability) pays out much more — exactly the "favorites ~1:1, longshots
 *     much more" behaviour the spec calls for. This underdog scaling is what
 *     the per-event bet payouts use.
 */

export const ODDS_DECAY = 0.72;

export interface RankingEntry {
  playerId: string;
  /** 1 = strongest. Ranks must be unique and cover 1..N. */
  rank: number;
}

export interface FinishingProbabilities {
  win: number;
  top3: number;
  last: number;
}

export interface PayoutMultipliers {
  win: number;
  top3: number;
  last: number;
}

function strengthFor(rank: number): number {
  return Math.pow(ODDS_DECAY, rank - 1);
}

function assertValidRanking(ranking: RankingEntry[]): void {
  const ranks = ranking.map((r) => r.rank).sort((a, b) => a - b);
  ranks.forEach((rank, i) => {
    if (rank !== i + 1) {
      throw new Error("ranking must contain unique ranks covering 1..N");
    }
  });
}

/**
 * Probability that `target` is drawn within the first `positions` picks of a
 * Plackett-Luce process over `strengths`. positions=1 → win, positions=3 → top3.
 */
function probWithinTopPositions(
  strengths: Map<string, number>,
  target: string,
  positions: number,
): number {
  const totalSum = [...strengths.values()].reduce((a, b) => a + b, 0);

  const recurse = (
    remaining: string[],
    remainingSum: number,
    positionsLeft: number,
  ): number => {
    if (positionsLeft === 0) return 0;
    let prob = 0;
    for (const id of remaining) {
      const pPick = strengths.get(id)! / remainingSum;
      if (id === target) {
        prob += pPick;
      } else {
        prob +=
          pPick *
          recurse(
            remaining.filter((x) => x !== id),
            remainingSum - strengths.get(id)!,
            positionsLeft - 1,
          );
      }
    }
    return prob;
  };

  return recurse([...strengths.keys()], totalSum, positions);
}

/** Win / top-3 / last probabilities for every player from the ranking. */
export function impliedProbabilities(
  ranking: RankingEntry[],
): Map<string, FinishingProbabilities> {
  assertValidRanking(ranking);

  const strengths = new Map(ranking.map((r) => [r.playerId, strengthFor(r.rank)]));
  // "Last" = first under inverted strengths (the weakest is likeliest last).
  const invStrengths = new Map(
    ranking.map((r) => [r.playerId, 1 / strengthFor(r.rank)]),
  );

  const result = new Map<string, FinishingProbabilities>();
  for (const { playerId } of ranking) {
    result.set(playerId, {
      win: probWithinTopPositions(strengths, playerId, 1),
      top3: probWithinTopPositions(strengths, playerId, Math.min(3, ranking.length)),
      last: probWithinTopPositions(invStrengths, playerId, 1),
    });
  }
  return result;
}

/** Fair decimal-odds payout multipliers (= 1 / probability) per player. */
export function payoutMultipliers(
  ranking: RankingEntry[],
): Map<string, PayoutMultipliers> {
  const probs = impliedProbabilities(ranking);
  const result = new Map<string, PayoutMultipliers>();
  for (const [playerId, p] of probs) {
    result.set(playerId, {
      win: 1 / p.win,
      top3: 1 / p.top3,
      last: 1 / p.last,
    });
  }
  return result;
}

/**
 * The underdog-scaled payout multiplier for a per-event bet on `target`.
 * Per-event bets are on an event's outcome — "win" or "place" (top 3) — and
 * reuse the same odds logic as the overall bet (PRODUCT_SPEC.md → Per-event
 * multiplier betting). Returns the factor a winning wager is multiplied by.
 */
export function perEventPayoutMultiplier(
  ranking: RankingEntry[],
  playerId: string,
  target: "win" | "place",
): number {
  const mult = payoutMultipliers(ranking).get(playerId);
  if (!mult) throw new Error(`unknown player: ${playerId}`);
  return target === "win" ? mult.win : mult.top3;
}
