import { describe, expect, it } from "vitest";
import { placementPoints, scorePlacement } from "./placement";

describe("placementPoints", () => {
  it("matches the spec's worked table (to 1 decimal)", () => {
    const expected = [100, 72, 51.8, 37.3, 26.9, 19.3, 13.9, 10];
    expected.forEach((pts, i) => {
      expect(placementPoints(i + 1)).toBeCloseTo(pts, 1);
    });
  });

  it("rejects places below 1", () => {
    expect(() => placementPoints(0)).toThrow();
  });
});

describe("scorePlacement", () => {
  it("awards straight places with no ties", () => {
    const result = scorePlacement([
      { playerId: "a", position: 1 },
      { playerId: "b", position: 2 },
      { playerId: "c", position: 3 },
    ]);
    expect(result.get("a")).toBeCloseTo(100, 5);
    expect(result.get("b")).toBeCloseTo(72, 5);
    expect(result.get("c")).toBeCloseTo(51.84, 5);
  });

  it("splits a tie across the places it spans", () => {
    // b and c tie for 2nd → they span places 2 and 3.
    const result = scorePlacement([
      { playerId: "a", position: 1 },
      { playerId: "b", position: 2 },
      { playerId: "c", position: 2 },
      { playerId: "d", position: 4 },
    ]);
    const expectedShare = (placementPoints(2) + placementPoints(3)) / 2;
    expect(result.get("a")).toBeCloseTo(100, 5);
    expect(result.get("b")).toBeCloseTo(expectedShare, 5);
    expect(result.get("c")).toBeCloseTo(expectedShare, 5);
    // d occupies place 4 regardless of the numeric gap in the input.
    expect(result.get("d")).toBeCloseTo(placementPoints(4), 5);
  });

  it("preserves the total-points invariant even with ties", () => {
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
    expect(sum(withTies)).toBeCloseTo(sum(noTies), 5);
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
