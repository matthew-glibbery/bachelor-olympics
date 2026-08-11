import { describe, expect, it } from "vitest";
import { orderFromResults, positionsFromOrder } from "./rankedOrder";
import { scorePlacement } from "./placement";

describe("positionsFromOrder", () => {
  it("assigns dense 1..N positions with no ties", () => {
    expect(positionsFromOrder(["a", "b", "c"], new Set())).toEqual({
      a: 1,
      b: 2,
      c: 3,
    });
  });

  it("gives a tied row the same position as the row above", () => {
    const positions = positionsFromOrder(["a", "b", "c", "d"], new Set(["c"]));
    expect(positions).toEqual({ a: 1, b: 2, c: 2, d: 4 });
  });

  it("chains ties across more than two rows", () => {
    const positions = positionsFromOrder(["a", "b", "c", "d"], new Set(["b", "c"]));
    expect(positions).toEqual({ a: 1, b: 1, c: 1, d: 4 });
  });

  it("feeds scorePlacement correctly regardless of the resulting gaps", () => {
    const positions = positionsFromOrder(["a", "b", "c", "d"], new Set(["c"]));
    const entries = Object.entries(positions).map(([playerId, position]) => ({
      playerId,
      position,
    }));
    const points = scorePlacement(entries);
    // b and c tie for 2nd (spanning places 2 & 3) → equal points, both less
    // than a's and more than d's.
    expect(points.get("b")).toBe(points.get("c"));
    expect(points.get("a")).toBeGreaterThan(points.get("b")!);
    expect(points.get("d")).toBeLessThan(points.get("b")!);
  });
});

describe("orderFromResults", () => {
  it("orders players by their saved position", () => {
    const { order, tied } = orderFromResults(
      ["a", "b", "c"],
      [
        { player_id: "a", position: 2 },
        { player_id: "b", position: 1 },
        { player_id: "c", position: 3 },
      ],
    );
    expect(order).toEqual(["b", "a", "c"]);
    expect(tied.size).toBe(0);
  });

  it("appends players with no result yet, in their original order", () => {
    const { order } = orderFromResults(
      ["a", "b", "c"],
      [{ player_id: "b", position: 1 }],
    );
    expect(order).toEqual(["b", "a", "c"]);
  });

  it("detects ties from equal saved positions", () => {
    const { order, tied } = orderFromResults(
      ["a", "b", "c"],
      [
        { player_id: "a", position: 1 },
        { player_id: "b", position: 2 },
        { player_id: "c", position: 2 },
      ],
    );
    expect(order).toEqual(["a", "b", "c"]);
    expect(tied).toEqual(new Set(["c"]));
  });

  it("round-trips through positionsFromOrder for an untied field", () => {
    const results = [
      { player_id: "a", position: 3 },
      { player_id: "b", position: 1 },
      { player_id: "c", position: 2 },
    ];
    const { order, tied } = orderFromResults(["a", "b", "c"], results);
    expect(positionsFromOrder(order, tied)).toEqual({ a: 3, b: 1, c: 2 });
  });
});
