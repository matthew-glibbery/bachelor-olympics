import { describe, expect, it } from "vitest";
import {
  allocatedMultiplierTotal,
  budgetTotal,
  fitsBudget,
  isValidMultiplierValue,
  MultiplierAllocation,
  stepAmount,
  stepsWithin,
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

describe("allocatedMultiplierTotal", () => {
  const events = [{ id: "e1" }, { id: "e2" }, { id: "e3" }];

  it("sums saved rows for the player", () => {
    const rows = [
      { player_id: "p1", event_id: "e1", value: 1.4 },
      { player_id: "p1", event_id: "e2", value: 0.8 },
      { player_id: "p1", event_id: "e3", value: 0.8 },
    ];
    expect(allocatedMultiplierTotal(events, rows, "p1")).toBeCloseTo(3.0, 5);
  });

  it("defaults an event with no saved row to MULTIPLIER_DEFAULT (1.0), not 0", () => {
    // p1 only ever saved e1 — e2/e3 are implicitly still at the default,
    // same as /multipliers shows them. The naive .filter().reduce() bug
    // this guards against would sum to 1.4 here instead of 3.4.
    const rows = [{ player_id: "p1", event_id: "e1", value: 1.4 }];
    expect(allocatedMultiplierTotal(events, rows, "p1")).toBeCloseTo(3.4, 5);
  });

  it("ignores other players' rows", () => {
    const rows = [{ player_id: "someone-else", event_id: "e1", value: 1.5 }];
    expect(allocatedMultiplierTotal(events, rows, "p1")).toBeCloseTo(3.0, 5);
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

/* The three grid helpers exist because of one specific live bug: the wager
   stepper offered every 0.1 up to the player's reserve, and a reserve arrives
   as a sum of 0.1s — so "0.3 available" is really 0.2999999999999998, the
   stepper reached 0.30000000000000004, and the submit button greyed out at
   exactly the amount the screen had just promised. These pin the behaviour
   that stops that recurring. */
describe("stepsWithin", () => {
  it("counts whole steps that fit", () => {
    expect(stepsWithin(0.5)).toBe(5);
    expect(stepsWithin(1)).toBe(10);
  });

  it("floors a partial step rather than rounding up past the cap", () => {
    // 0.25 must not offer 0.3 — that's more than the player actually has.
    expect(stepsWithin(0.25)).toBe(2);
    expect(stepsWithin(0.29)).toBe(2);
  });

  it("still offers the top step when the cap is float-dirty just under it", () => {
    // What `bettingReserve` really hands over for a nominal 0.3.
    expect(stepsWithin(0.1 + 0.1 + 0.1)).toBe(3);
    expect(stepsWithin(0.2999999999999998)).toBe(3);
  });

  it("offers nothing for a zero, negative, or non-finite cap", () => {
    expect(stepsWithin(0)).toBe(0);
    expect(stepsWithin(-1)).toBe(0);
    expect(stepsWithin(Number.NaN)).toBe(0);
  });
});

describe("stepAmount", () => {
  it("lands exactly on the grid rather than drifting", () => {
    expect(stepAmount(3)).toBe(0.3);
    expect(stepAmount(7)).toBe(0.7);
    expect(stepAmount(0)).toBe(0);
    // The naive version of this is 0.30000000000000004.
    expect(String(stepAmount(3))).toBe("0.3");
  });
});

describe("fitsBudget", () => {
  it("accepts an on-grid amount against a float-dirty cap of the same value", () => {
    expect(fitsBudget(0.3, 0.1 + 0.1 + 0.1)).toBe(true);
    expect(fitsBudget(0.3, 0.2999999999999998)).toBe(true);
  });

  it("still rejects an amount that is genuinely over", () => {
    expect(fitsBudget(0.4, 0.3)).toBe(false);
    expect(fitsBudget(0.31, 0.3)).toBe(false);
  });

  it("accepts anything at or under the cap", () => {
    expect(fitsBudget(0.1, 0.3)).toBe(true);
    expect(fitsBudget(0, 0)).toBe(true);
  });
});

describe("validateAllocations with resolved-bet winnings", () => {
  const evenAllocations = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ eventId: `e${i}`, value: 1.0, locked: false }));

  it("credits a won bet's net back into the spendable budget", () => {
    // Fully allocated at 1.0 across 8 events, so nothing spare — but a
    // resolved bet netted +1.2, which the spec says is reallocatable.
    const validation = validateAllocations(evenAllocations(8), 8, 0, 1.2);
    expect(validation.valid).toBe(true);
    expect(validation.budgetRemaining).toBeCloseTo(1.2, 10);
  });

  it("lets that credit actually be spent on an event", () => {
    // Same field, but one event raised to 1.5 — over budget without the
    // winnings, fine with them.
    const allocations = evenAllocations(8);
    allocations[0]!.value = 1.5;
    expect(validateAllocations(allocations, 8, 0, 0).valid).toBe(false);
    expect(validateAllocations(allocations, 8, 0, 1.2).valid).toBe(true);
  });

  it("subtracts a net loss from the budget", () => {
    const validation = validateAllocations(evenAllocations(8), 8, 0, -0.5);
    expect(validation.budgetRemaining).toBeCloseTo(-0.5, 10);
    expect(validation.valid).toBe(false);
  });

  it("nets winnings against open escrow", () => {
    // +1.2 won, 0.3 currently tied up in a new open bet.
    const validation = validateAllocations(evenAllocations(8), 8, 0.3, 1.2);
    expect(validation.budgetRemaining).toBeCloseTo(0.9, 10);
  });

  it("is unchanged when there are no resolved bets", () => {
    expect(validateAllocations(evenAllocations(8), 8).budgetRemaining).toBe(0);
  });
});
