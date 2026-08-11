import { describe, expect, it } from "vitest";
import { finalEventScore, playerTotals, standings } from "./total";
import type { EventScoreLine } from "./total";

const lines: EventScoreLine[] = [
  { eventId: "e1", playerId: "a", points: 100, multiplier: 1.5 },
  { eventId: "e2", playerId: "a", points: 72, multiplier: 0.5 },
  { eventId: "e1", playerId: "b", points: 72, multiplier: 1.0 },
  { eventId: "e2", playerId: "b", points: 100, multiplier: 1.0 },
];

describe("finalEventScore", () => {
  it("multiplies points by the multiplier", () => {
    expect(finalEventScore(100, 1.5)).toBeCloseTo(150, 5);
    expect(finalEventScore(72, 0.5)).toBeCloseTo(36, 5);
  });
});

describe("playerTotals", () => {
  it("sums raw and multiplier-adjusted totals per player", () => {
    const totals = playerTotals(lines);
    expect(totals.get("a")).toEqual({ playerId: "a", raw: 172, adjusted: 150 + 36 });
    expect(totals.get("b")).toEqual({ playerId: "b", raw: 172, adjusted: 172 });
  });
});

describe("standings", () => {
  it("orders by adjusted total descending", () => {
    const order = standings(lines).map((t) => t.playerId);
    expect(order).toEqual(["a", "b"]); // a: 186 adjusted, b: 172 adjusted
  });

  it("breaks adjusted ties by raw total", () => {
    const tied: EventScoreLine[] = [
      { eventId: "e1", playerId: "x", points: 100, multiplier: 1 },
      { eventId: "e1", playerId: "y", points: 50, multiplier: 2 }, // same adjusted 100, lower raw
    ];
    expect(standings(tied).map((t) => t.playerId)).toEqual(["x", "y"]);
  });
});
