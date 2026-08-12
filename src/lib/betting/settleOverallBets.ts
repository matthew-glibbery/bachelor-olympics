/**
 * Settle every open overall bet once the weekend ends — every event has
 * resolved (PRODUCT_SPEC.md → Overall betting → Payout). Compares each
 * bet's CURRENT pick (switches already baked into `pick_player_id` and
 * `switches` by the time this runs) against the actual final standings.
 *
 * Rank is computed by standard competition ranking (ties share a rank,
 * e.g. two players tied for 2nd both rank 2, next player ranks 4) so an
 * exact tie for 1st still counts as a win for a "win" bet on either of
 * them, and a tie spanning the 3rd/4th boundary is resolved the same way
 * a real podium would be.
 */
import { overallPayoutValue, type OverallBetType } from "./overall";

export interface OpenOverallBetInput {
  id: string;
  betType: OverallBetType;
  pickPlayerId: string;
  switches: number;
}

export interface FinalStanding {
  playerId: string;
  adjusted: number;
}

export interface SettledOverallBet {
  id: string;
  status: "won" | "lost";
  payout: number;
}

export function settleOverallBets(
  openBets: OpenOverallBetInput[],
  finalStandings: FinalStanding[],
): SettledOverallBet[] {
  const rankOf = new Map<string, number>();
  for (const standing of finalStandings) {
    const rank =
      1 + finalStandings.filter((o) => o.adjusted > standing.adjusted).length;
    rankOf.set(standing.playerId, rank);
  }

  return openBets.map((bet) => {
    const rank = rankOf.get(bet.pickPlayerId);
    const won = rank !== undefined && (bet.betType === "win" ? rank === 1 : rank <= 3);
    return {
      id: bet.id,
      status: won ? "won" : "lost",
      payout: won ? overallPayoutValue(bet.betType, bet.switches) : 0,
    };
  });
}
