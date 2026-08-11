import { describe, expect, it } from "vitest";
import { openBet, resolveLost, resolveWon, voidBet } from "./perEvent";

const fresh = () =>
  openBet({ id: "b1", playerId: "p1", eventId: "golf", target: "win", wager: 0.3 });

describe("openBet", () => {
  it("opens in the 'open' status with the wager escrowed", () => {
    const bet = fresh();
    expect(bet.status).toBe("open");
    expect(bet.wager).toBe(0.3);
  });

  it("rejects a non-positive wager", () => {
    expect(() => openBet({ id: "x", playerId: "p", eventId: "e", target: "win", wager: 0 })).toThrow();
  });
});

describe("resolveWon", () => {
  it("pays out wager × odds multiplier back to the pool", () => {
    const { bet, poolReturn } = resolveWon(fresh(), 4); // 0.3 staked on a 4x longshot
    expect(bet.status).toBe("won");
    expect(bet.payout).toBeCloseTo(1.2, 9);
    expect(poolReturn).toBeCloseTo(1.2, 9);
  });
});

describe("resolveLost", () => {
  it("forfeits the wager and returns nothing", () => {
    const { bet, poolReturn } = resolveLost(fresh());
    expect(bet.status).toBe("lost");
    expect(poolReturn).toBe(0);
  });
});

describe("voidBet", () => {
  it("refunds the full wager on a cancelled event", () => {
    const { bet, poolReturn } = voidBet(fresh());
    expect(bet.status).toBe("void");
    expect(poolReturn).toBe(0.3);
  });
});

describe("state machine guards", () => {
  it("won't re-resolve an already-settled bet", () => {
    const { bet } = resolveWon(fresh(), 2);
    expect(() => resolveWon(bet, 2)).toThrow();
    expect(() => resolveLost(bet)).toThrow();
    expect(() => voidBet(bet)).toThrow();
  });
});
