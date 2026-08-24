import { describe, expect, it } from "vitest";
import { scoreAbsolute } from "./absolute";
import { placementPoints } from "./placement";

describe("scoreAbsolute", () => {
  it("pins the best at 100 and the worst at last place's placement value", () => {
    const result = scoreAbsolute([
      { playerId: "a", raw: 100 },
      { playerId: "b", raw: 50 },
      { playerId: "c", raw: 0 },
    ]);
    const floor = placementPoints(3); // 50 in a 3-strong field
    expect(result.get("a")).toBe(100);
    expect(result.get("c")).toBe(floor);
    // Exactly halfway between the two raw results, so exactly halfway
    // between the two point values.
    expect(result.get("b")).toBe(Math.round((100 + floor) / 2));
  });

  it("pins the lowest golf score at 100 (lower is better)", () => {
    const result = scoreAbsolute(
      [
        { playerId: "a", raw: 30 }, // best round
        { playerId: "b", raw: 60 }, // worst round
        { playerId: "c", raw: 45 }, // halfway
      ],
      { lowerIsBetter: true },
    );
    const floor = placementPoints(3);
    expect(result.get("a")).toBe(100);
    expect(result.get("b")).toBe(floor);
    expect(result.get("c")).toBe(Math.round((100 + floor) / 2));
  });

  it("spaces the field by raw distance, not by rank", () => {
    // b is much closer to the winner than to the back-marker, and should
    // score much closer to the winner too.
    const result = scoreAbsolute([
      { playerId: "a", raw: 100 },
      { playerId: "b", raw: 90 },
      { playerId: "c", raw: 0 },
    ]);
    expect(result.get("a")).toBe(100);
    expect(result.get("b")!).toBeGreaterThan(90);
    expect(result.get("c")).toBe(placementPoints(3));
  });

  it("never awards more than 100 or less than the field's last-place value", () => {
    const entries = Array.from({ length: 7 }, (_, i) => ({ playerId: `p${i}`, raw: i * 3 }));
    const result = scoreAbsolute(entries);
    const floor = placementPoints(7); // 15
    for (const points of result.values()) {
      expect(points).toBeGreaterThanOrEqual(floor);
      expect(points).toBeLessThanOrEqual(100);
    }
    expect(result.get("p6")).toBe(100);
    expect(result.get("p0")).toBe(floor);
  });

  it("treats an all-identical field as a full tie, not as everyone winning", () => {
    const result = scoreAbsolute([
      { playerId: "a", raw: 0 },
      { playerId: "b", raw: 0 },
    ]);
    // Both span places 1 and 2, so they split those two values — the same
    // answer scorePlacement gives a two-way tie for first.
    const share = Math.round((placementPoints(1) + placementPoints(2)) / 2);
    expect(result.get("a")).toBe(share);
    expect(result.get("b")).toBe(share);
  });

  it("gives a lone scored player the full 100", () => {
    const result = scoreAbsolute([{ playerId: "a", raw: 7 }]);
    expect(result.get("a")).toBe(100);
  });

  it("returns an empty map for an empty field", () => {
    expect(scoreAbsolute([]).size).toBe(0);
  });

  it("awards whole numbers only", () => {
    const result = scoreAbsolute([
      { playerId: "a", raw: 3 },
      { playerId: "b", raw: 2 },
      { playerId: "c", raw: 1 },
    ]);
    for (const points of result.values()) {
      expect(Number.isInteger(points)).toBe(true);
    }
  });
});
