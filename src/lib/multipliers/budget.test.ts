import { describe, expect, it } from "vitest";
import {
  budgetTotal,
  isValidMultiplierValue,
  MultiplierAllocation,
  unlockedBudgetRemaining,
  validateAllocations,
} from "./budget";

const alloc = (
  eventId: string,
  value: number,
  locked = false,
): MultiplierAllocation => ({ eventId, value, locked });

describe("isValidMultiplierValue", () => {
  it("accepts in-range values on the 0.1 grid", () => {
    for (const v of [0.5, 0.6, 1.0, 1.4, 1.5]) {
      expect(isValidMultiplierValue(v)).toBe(true);
    }
  });

  it("rejects out-of-range and off-grid values", () => {
    expect(isValidMultiplierValue(0.4)).toBe(false);
    expect(isValidMultiplierValue(1.6)).toBe(false);
    expect(isValidMultiplierValue(1.05)).toBe(false);
  });
});

describe("budgetTotal", () => {
  it("is one point per event", () => {
    expect(budgetTotal(8)).toBe(8);
    expect(budgetTotal(9)).toBe(9);
  });
});

describe("validateAllocations", () => {
  it("accepts a balanced all-default set", () => {
    const allocs = Array.from({ length: 8 }, (_, i) => alloc(`e${i}`, 1.0));
    const result = validateAllocations(allocs);
    expect(result.valid).toBe(true);
    expect(result.budgetRemaining).toBe(0);
  });

  it("accepts a balanced non-trivial redistribution", () => {
    // +0.5 and +0.3 on two events, paid for by -0.5 and -0.3 elsewhere.
    const allocs = [
      alloc("a", 1.5),
      alloc("b", 1.3),
      alloc("c", 0.5),
      alloc("d", 0.7),
      alloc("e", 1.0),
      alloc("f", 1.0),
      alloc("g", 1.0),
      alloc("h", 1.0),
    ];
    const result = validateAllocations(allocs);
    expect(result.valid).toBe(true);
    expect(result.budgetRemaining).toBe(0);
  });

  it("flags an over-allocated set with negative remaining", () => {
    const allocs = [alloc("a", 1.5), alloc("b", 1.0), alloc("c", 1.0)];
    const result = validateAllocations(allocs); // total budget 3.0, spent 3.5
    expect(result.valid).toBe(false);
    expect(result.budgetRemaining).toBeCloseTo(-0.5, 5);
  });

  it("allows an under-allocated set — leftover becomes betting reserve", () => {
    const allocs = [alloc("a", 0.5), alloc("b", 1.0), alloc("c", 1.0)];
    const result = validateAllocations(allocs); // total 3.0, spent 2.5
    expect(result.valid).toBe(true);
    expect(result.budgetRemaining).toBeCloseTo(0.5, 5);
  });

  it("reports off-grid values as errors", () => {
    const allocs = [alloc("a", 1.05), alloc("b", 0.95), alloc("c", 1.0)];
    const result = validateAllocations(allocs);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("a"))).toBe(true);
  });

  it("does not suffer float drift on a 0.1 + 0.2 style sum", () => {
    const allocs = [alloc("a", 0.7), alloc("b", 1.2), alloc("c", 1.1)];
    // 0.7 + 1.2 + 1.1 = 3.0 exactly in tenths; naive floats would drift.
    const result = validateAllocations(allocs);
    expect(result.valid).toBe(true);
    expect(result.budgetRemaining).toBe(0);
  });

  it("treats budget already escrowed in open bets as unavailable to allocate", () => {
    // Total 3.0, spent 2.5 on events — looks like 0.5 free, but 0.5 is
    // already wagered on an open per-event bet, so none is actually free.
    const allocs = [alloc("a", 0.5), alloc("b", 1.0), alloc("c", 1.0)];
    const result = validateAllocations(allocs, 3, 0.5);
    expect(result.valid).toBe(true);
    expect(result.budgetRemaining).toBe(0);
  });

  it("flags over-allocation caused by reallocating already-wagered budget", () => {
    // Same allocation as the "under-allocated" case above (2.5 of 3.0
    // spent, nominally 0.5 free) but 0.7 of the total is tied up in an
    // open bet — the player is trying to spend money they no longer have.
    const allocs = [alloc("a", 0.5), alloc("b", 1.0), alloc("c", 1.0)];
    const result = validateAllocations(allocs, 3, 0.7);
    expect(result.valid).toBe(false);
    expect(result.budgetRemaining).toBeCloseTo(-0.2, 5);
  });
});

describe("unlockedBudgetRemaining", () => {
  it("returns zero when fully and validly allocated", () => {
    const allocs = [alloc("a", 1.5, true), alloc("b", 0.5), alloc("c", 1.0)];
    expect(unlockedBudgetRemaining(allocs)).toBe(0);
  });

  it("returns the shortfall left to distribute across unlocked events", () => {
    const allocs = [alloc("a", 1.5, true), alloc("b", 1.0), alloc("c", 1.0)];
    // total 3.0, spent 3.5 → -0.5 still needs to be clawed back.
    expect(unlockedBudgetRemaining(allocs)).toBeCloseTo(-0.5, 5);
  });
});
