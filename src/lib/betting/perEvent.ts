/**
 * Per-event multiplier betting (PRODUCT_SPEC.md → Per-event multiplier betting).
 *
 * Separate from the multiplier sliders: a player can wager a portion of their
 * *already-allocated* multiplier on a specific event's outcome (win or place),
 * live, during the weekend.
 *
 *   - Placing a bet ESCROWS the wagered amount immediately — it's removed from
 *     the player's pool and can't be spent elsewhere while the bet is open.
 *   - Win: the wager pays out scaled by how much of an underdog it was (the
 *     odds multiplier from src/lib/odds), and the payout returns to the pool,
 *     reallocatable to any still-unlocked event.
 *   - Loss: the wagered multiplier is simply gone.
 *   - Cancelled event: the bet is void — no win, no loss, the wager is returned.
 *
 * Each bet is a small state machine: open → won | lost | void. Transitions are
 * pure; each returns the next bet plus the amount to return to the player's
 * multiplier pool (0 for a loss).
 */

export type PerEventBetStatus = "open" | "won" | "lost" | "void";
export type PerEventBetTarget = "win" | "place";

export interface PerEventBet {
  id: string;
  playerId: string;
  eventId: string;
  /** Which outcome the wager is on. */
  target: PerEventBetTarget;
  /** Portion of multiplier escrowed on the bet (must be > 0). */
  wager: number;
  status: PerEventBetStatus;
  /** Amount returned to the pool once resolved (won payout / void refund). */
  payout?: number;
}

export interface BetTransition {
  bet: PerEventBet;
  /** Amount to credit back to the player's multiplier pool. */
  poolReturn: number;
}

/** Open a new bet, escrowing `wager` from the player's pool. */
export function openBet(params: {
  id: string;
  playerId: string;
  eventId: string;
  target: PerEventBetTarget;
  wager: number;
}): PerEventBet {
  if (!(params.wager > 0)) {
    throw new Error(`wager must be positive, got ${params.wager}`);
  }
  return { ...params, status: "open" };
}

function assertOpen(bet: PerEventBet, action: string): void {
  if (bet.status !== "open") {
    throw new Error(`cannot ${action} a bet in status '${bet.status}'`);
  }
}

/**
 * Resolve a winning bet. `oddsMultiplier` is the underdog-scaled factor from
 * src/lib/odds (`perEventPayoutMultiplier`). The full payout (wager × factor)
 * returns to the pool.
 */
export function resolveWon(bet: PerEventBet, oddsMultiplier: number): BetTransition {
  assertOpen(bet, "settle as won");
  const payout = bet.wager * oddsMultiplier;
  return { bet: { ...bet, status: "won", payout }, poolReturn: payout };
}

/** Resolve a losing bet. The escrowed wager is forfeited. */
export function resolveLost(bet: PerEventBet): BetTransition {
  assertOpen(bet, "settle as lost");
  return { bet: { ...bet, status: "lost", payout: 0 }, poolReturn: 0 };
}

/**
 * Void a bet (its event was cancelled). The escrowed wager is returned in full —
 * no win, no loss.
 */
export function voidBet(bet: PerEventBet): BetTransition {
  assertOpen(bet, "void");
  return { bet: { ...bet, status: "void", payout: bet.wager }, poolReturn: bet.wager };
}
