import { describe, expect, it } from "vitest";
import { bettingReserve } from "./reserve";

describe("bettingReserve", () => {
  it("with no allocations and no bets, the whole budget is available", () => {
    const r = bettingReserve(8, 0, []);
    expect(r.available).toBe(8);
    expect(r.tiedUp).toBe(0);
  });

  it("subtracts what's already allocated to events", () => {
    const r = bettingReserve(8, 7.5, []);
    expect(r.available).toBeCloseTo(0.5, 5);
  });

  it("an open bet reduces available and shows up as tied up", () => {
    const r = bettingReserve(8, 7.5, [{ wager: 0.3, status: "open", payout: null }]);
    expect(r.tiedUp).toBeCloseTo(0.3, 5);
    expect(r.available).toBeCloseTo(0.2, 5);
  });

  it("a won bet's net profit returns to available and is no longer tied up", () => {
    const r = bettingReserve(8, 7.5, [{ wager: 0.3, status: "won", payout: 1.2 }]);
    expect(r.tiedUp).toBe(0);
    // baseline 0.5, plus the 0.9 net profit (1.2 payout - 0.3 wager) = 1.4
    expect(r.available).toBeCloseTo(1.4, 5);
  });

  it("a lost bet's wager is simply gone — not added back, not tied up", () => {
    const r = bettingReserve(8, 7.5, [{ wager: 0.3, status: "lost", payout: 0 }]);
    expect(r.tiedUp).toBe(0);
    // baseline 0.5, minus the 0.3 that's gone for good = 0.2
    expect(r.available).toBeCloseTo(0.2, 5);
  });

  it("a void bet fully refunds — net neutral versus never having bet", () => {
    const r = bettingReserve(8, 7.5, [{ wager: 0.3, status: "void", payout: 0.3 }]);
    expect(r.available).toBeCloseTo(0.5, 5);
  });

  it("never reports available below zero, even if the ledger would go negative", () => {
    // 8.0 budget, 7.5 allocated to events, 1.0 tied up in an open bet —
    // more committed than the player actually has. Shouldn't happen once
    // callers account for tied-up bets (src/lib/multipliers/budget.ts),
    // but "available to wager" is never a sane negative number to show.
    const r = bettingReserve(8, 7.5, [{ wager: 1.0, status: "open", payout: null }]);
    expect(r.available).toBe(0);
  });
});
