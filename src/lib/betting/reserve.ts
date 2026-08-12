/**
 * A player's per-event betting reserve — the unallocated slice of their
 * multiplier budget available to wager (PRODUCT_SPEC.md → Multipliers /
 * Per-event multiplier betting). Since `validateAllocations`
 * (src/lib/multipliers/budget.ts) no longer requires the full budget to be
 * spent on events, whatever's left over is this reserve.
 *
 * A simple running ledger, not a stored balance — recomputed fresh from the
 * player's current multiplier allocations and bet history every time:
 *   available = totalBudget - allocatedToEvents - openWagers + Σ(payout - wager)
 *               over every RESOLVED (non-open) bet
 *   tiedUp    = openWagers
 * The per-resolved-bet net (payout - wager) is what keeps the ledger
 * consistent across all three outcomes: a void bet's payout equals its
 * wager, so its net is exactly 0 (fully refunded, no lasting effect); a
 * lost bet has payout 0, so its net is -wager (permanently gone); a won bet
 * nets its profit (payout - wager), added back on top of the baseline.
 */
import { budgetTotal } from "@/lib/multipliers/budget";

export interface ReserveBet {
  wager: number;
  status: "open" | "won" | "lost" | "void";
  payout: number | null;
}

export interface BettingReserve {
  /** Free to wager on a new bet right now. */
  available: number;
  /** Currently escrowed in this player's open bets. */
  tiedUp: number;
}

export function bettingReserve(
  eventCount: number,
  allocatedToEvents: number,
  bets: ReserveBet[],
): BettingReserve {
  const tiedUp = bets
    .filter((b) => b.status === "open")
    .reduce((sum, b) => sum + b.wager, 0);
  const netFromResolved = bets
    .filter((b) => b.status !== "open")
    .reduce((sum, b) => sum + ((b.payout ?? 0) - b.wager), 0);

  return {
    available: budgetTotal(eventCount) - allocatedToEvents - tiedUp + netFromResolved,
    tiedUp,
  };
}
