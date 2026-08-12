import { describe, expect, it } from "vitest";
import {
  EliminationInput,
  isPickAlive,
  overallPayoutValue,
  remainingBounds,
} from "./overall";

describe("overallPayoutValue", () => {
  it("win starts at 100 and halves per switch", () => {
    expect(overallPayoutValue("win", 0)).toBe(100);
    expect(overallPayoutValue("win", 1)).toBe(50);
    expect(overallPayoutValue("win", 2)).toBe(25);
    expect(overallPayoutValue("win", 3)).toBe(12.5);
  });

  it("top3 starts at 20 and halves per switch", () => {
    expect(overallPayoutValue("top3", 0)).toBe(20);
    expect(overallPayoutValue("top3", 1)).toBe(10);
  });

  it("rejects a negative or fractional switch count", () => {
    expect(() => overallPayoutValue("win", -1)).toThrow();
    expect(() => overallPayoutValue("win", 1.5)).toThrow();
  });
});

// Late in the weekend: little remaining headroom.
const field = (): EliminationInput[] => [
  { playerId: "leader", current: 500, maxRemaining: 50, minRemaining: 10 },
  { playerId: "mid", current: 400, maxRemaining: 50, minRemaining: 10 },
  { playerId: "mid2", current: 380, maxRemaining: 50, minRemaining: 10 },
  { playerId: "tail", current: 200, maxRemaining: 50, minRemaining: 10 },
];

describe("isPickAlive — win", () => {
  it("keeps the leader alive", () => {
    expect(isPickAlive("win", "leader", field())).toBe(true);
  });

  it("eliminates a pick whose ceiling can't reach the leader's floor", () => {
    // tail ceiling 250 < leader floor 510 → guaranteed behind.
    expect(isPickAlive("win", "tail", field())).toBe(false);
  });

  it("keeps a chaser alive while their ceiling still clears every rival floor", () => {
    // mid ceiling 450 vs leader floor 510 → leader guaranteed ahead → dead.
    expect(isPickAlive("win", "mid", field())).toBe(false);
  });
});

describe("isPickAlive — top3", () => {
  it("stays alive with fewer than three rivals guaranteed ahead", () => {
    // For 'mid2' (ceiling 430): rivals with floor > 430? leader(510) only → 1 < 3.
    expect(isPickAlive("top3", "mid2", field())).toBe(true);
  });

  it("is eliminated once three rivals are guaranteed ahead", () => {
    const f: EliminationInput[] = [
      { playerId: "a", current: 500, maxRemaining: 0, minRemaining: 0 },
      { playerId: "b", current: 490, maxRemaining: 0, minRemaining: 0 },
      { playerId: "c", current: 480, maxRemaining: 0, minRemaining: 0 },
      { playerId: "pick", current: 100, maxRemaining: 300, minRemaining: 0 }, // ceiling 400
    ];
    expect(isPickAlive("top3", "pick", f)).toBe(false);
  });
});

describe("remainingBounds", () => {
  it("scales by the multiplier band and event count", () => {
    const b = remainingBounds({
      remainingEvents: 2,
      fieldSize: 8,
      worstEventPoints: 10,
    });
    expect(b.maxRemaining).toBe(2 * 100 * 1.5); // 300
    expect(b.minRemaining).toBe(2 * 10 * 0.5); // 10
  });

  it("shrinks the pool when an event is cancelled (fewer remaining events)", () => {
    const before = remainingBounds({ remainingEvents: 3, fieldSize: 8, worstEventPoints: 10 });
    const after = remainingBounds({ remainingEvents: 2, fieldSize: 8, worstEventPoints: 10 });
    expect(after.maxRemaining).toBeLessThan(before.maxRemaining);
  });
});
