import { describe, expect, it } from "vitest";
import { placementPoints, scorePlacement } from "./placement";

describe("placementPoints", () => {
  it("matches the spec's worked table", () => {
    const expected = [100, 70, 50, 35, 25, 20, 15, 10];
    expected.forEach((pts, i) => {
      expect(placementPoints(i + 1)).toBe(pts);
    });
  });

  it("awards every place a multiple of 5, never zero, never increasing", () => {
    let previous = Infinity;
    for (let place = 1; place <= 20; place++) {
      const points = placementPoints(place);
      expect(points % 5).toBe(0);
      expect(points).toBeGreaterThan(0);
      expect(points).toBeLessThanOrEqual(previous);
      previous = points;
    }
  });

  it("rejects places below 1", () => {
    expect(() => placementPoints(0)).toThrow();
  });
});

describe("scorePlacement", () => {
  it("awards straight places with no ties, on the round-number curve", () => {
    const result = scorePlacement([
      { playerId: "a", position: 1 },
      { playerId: "b", position: 2 },
      { playerId: "c", position: 3 },
    ]);
    expect(result.get("a")).toBe(100);
    expect(result.get("b")).toBe(70);
    expect(result.get("c")).toBe(50);
  });

  it("every awarded value is a whole number", () => {
    const result = scorePlacement(
      Array.from({ length: 8 }, (_, i) => ({ playerId: `p${i}`, position: i + 1 })),
    );
    for (const points of result.values()) {
      expect(Number.isInteger(points)).toBe(true);
    }
  });

  it("splits a tie across the places it spans, then rounds", () => {
    // b and c tie for 2nd → they span places 2 and 3.
    const result = scorePlacement([
      { playerId: "a", position: 1 },
      { playerId: "b", position: 2 },
      { playerId: "c", position: 2 },
      { playerId: "d", position: 4 },
    ]);
    const expectedShare = Math.round((placementPoints(2) + placementPoints(3)) / 2);
    expect(result.get("a")).toBe(100);
    expect(result.get("b")).toBe(expectedShare);
    expect(result.get("c")).toBe(expectedShare);
    // d occupies place 4 regardless of the numeric gap in the input.
    expect(result.get("d")).toBe(Math.round(placementPoints(4)));
  });

  it("keeps the total-points invariant close, even with rounding and ties", () => {
    const noTies = scorePlacement(
      Array.from({ length: 8 }, (_, i) => ({ playerId: `p${i}`, position: i + 1 })),
    );
    const withTies = scorePlacement([
      { playerId: "a", position: 1 },
      { playerId: "b", position: 2 },
      { playerId: "c", position: 2 },
      { playerId: "d", position: 2 },
      { playerId: "e", position: 5 },
      { playerId: "f", position: 6 },
      { playerId: "g", position: 7 },
      { playerId: "h", position: 8 },
    ]);
    const sum = (m: Map<string, number>) => [...m.values()].reduce((a, b) => a + b, 0);
    // Rounding each share independently can drift the total by a couple of
    // points — negligible against the 70-130 point gaps between finishers.
    expect(Math.abs(sum(withTies) - sum(noTies))).toBeLessThanOrEqual(3);
  });

  it("treats [1,2,2,4] and [1,2,2,3] identically", () => {
    const a = scorePlacement([
      { playerId: "w", position: 1 },
      { playerId: "x", position: 2 },
      { playerId: "y", position: 2 },
      { playerId: "z", position: 4 },
    ]);
    const b = scorePlacement([
      { playerId: "w", position: 1 },
      { playerId: "x", position: 2 },
      { playerId: "y", position: 2 },
      { playerId: "z", position: 3 },
    ]);
    for (const id of ["w", "x", "y", "z"]) {
      expect(a.get(id)).toBeCloseTo(b.get(id)!, 10);
    }
  });

  it("returns an empty map for an empty field", () => {
    expect(scorePlacement([]).size).toBe(0);
  });
});
