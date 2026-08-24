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
import { budgetTotal, MULTIPLIER_STEP } from "@/lib/multipliers/budget";

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

/**
 * Net effect of every RESOLVED bet on the player's budget: won bets add
 * their profit, lost bets subtract their stake, void bets are exactly
 * neutral (payout equals wager).
 *
 * Snapped DOWN onto the 0.1 multiplier grid, because this number is
 * spendable on multiplier sliders that only move in tenths. Odds are
 * continuous, so a real payout looks like 1.5651093; leaving that unsnapped
 * left two figures that are meant to be the same number — "budget
 * remaining" and "available to wager" — printing 1.2 and 1.3. Rounding down
 * rather than to nearest so a payout can never credit more than was
 * actually won. Only winnings are ever off-grid: stakes are placed in
 * tenths, so lost (-wager) and void (0) nets are exact already.
 */
export function resolvedBetsNet(bets: ReserveBet[]): number {
  const raw = bets
    .filter((b) => b.status !== "open")
    .reduce((sum, b) => sum + ((b.payout ?? 0) - b.wager), 0);
  const steps = Math.floor(raw / MULTIPLIER_STEP + 1e-9);
  return Math.round(steps * MULTIPLIER_STEP * 10) / 10;
}

export function bettingReserve(
  eventCount: number,
  allocatedToEvents: number,
  bets: ReserveBet[],
): BettingReserve {
  const tiedUp = bets
    .filter((b) => b.status === "open")
    .reduce((sum, b) => sum + b.wager, 0);
  const netFromResolved = resolvedBetsNet(bets);

  // Floored at zero: this is "free to wager right now," and negative money
  // isn't a state a player can act on. If the ledger genuinely goes
  // negative (e.g. multiplier allocations and open-bet escrow disagreeing
  // about the same budget), that's a bug to fix at the source, not a
  // number to show someone mid-party.
  const available = Math.max(
    0,
    budgetTotal(eventCount) - allocatedToEvents - tiedUp + netFromResolved,
  );

  return { available, tiedUp };
}
