/**
 * Settle every open per-event bet once an event finalizes (PRODUCT_SPEC.md →
 * Per-event multiplier betting). `per_event_bets` has no separate "pick"
 * column — a player wagers on their OWN finish in that event — so resolution
 * just checks the bettor's actual finishing position against their target,
 * and scales a win by that event's own odds (`perEventPayoutMultiplier`).
 * This is exactly why the groom's ranking is now per-event rather than one
 * overall ranking: a per-event bet's fairness depends on how strong the
 * bettor was predicted to be AT THAT EVENT specifically.
 */
import { perEventPayoutMultiplier, type RankingEntry } from "@/lib/odds/ranking";
import { resolveLost, resolveWon, type PerEventBet, type PerEventBetTarget } from "./perEvent";

export interface OpenBetInput {
  id: string;
  playerId: string;
  target: PerEventBetTarget;
  wager: number;
}

export interface ResolvedBetOutcome {
  id: string;
  status: "won" | "lost";
  payout: number;
}

/**
 * `finishingPositions` maps playerId -> finishing position (1-indexed,
 * ties share a position) or null if they have no result. If the event has
 * no ranking on file (the groom never set one), a winning bet still pays
 * out — at a flat 1:1, since there's no odds data to scale it by — rather
 * than leaving the bet stuck open forever.
 */
export function resolveOpenPerEventBets(
  openBets: OpenBetInput[],
  finishingPositions: Map<string, number | null>,
  eventRanking: RankingEntry[],
): ResolvedBetOutcome[] {
  return openBets.map((bet) => {
    const position = finishingPositions.get(bet.playerId) ?? null;
    const won = bet.target === "win" ? position === 1 : position != null && position <= 3;
    const asDomainBet: PerEventBet = {
      id: bet.id,
      playerId: bet.playerId,
      eventId: "",
      target: bet.target,
      wager: bet.wager,
      status: "open",
    };

    if (won) {
      const oddsMultiplier =
        eventRanking.length > 0
          ? perEventPayoutMultiplier(eventRanking, bet.playerId, bet.target)
          : 1;
      const { bet: resolved } = resolveWon(asDomainBet, oddsMultiplier);
      return { id: bet.id, status: "won", payout: resolved.payout as number };
    }

    const { bet: resolved } = resolveLost(asDomainBet);
    return { id: bet.id, status: "lost", payout: resolved.payout as number };
  });
}
