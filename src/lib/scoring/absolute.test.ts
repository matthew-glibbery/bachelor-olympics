import { describe, expect, it } from "vitest";
import { scoreAbsolute } from "./absolute";

describe("scoreAbsolute", () => {
  it("pins the best higher-is-better result at 100 and scales the rest", () => {
    const result = scoreAbsolute([
      { playerId: "a", raw: 100 },
      { playerId: "b", raw: 50 },
      { playerId: "c", raw: 25 },
    ]);
    expect(result.get("a")).toBeCloseTo(100, 5);
    expect(result.get("b")).toBeCloseTo(50, 5);
    expect(result.get("c")).toBeCloseTo(25, 5);
  });

  it("pins the lowest golf score at 100 (lower is better)", () => {
    const result = scoreAbsolute(
      [
        { playerId: "a", raw: 30 }, // best round
        { playerId: "b", raw: 60 }, // twice as many strokes
        { playerId: "c", raw: 40 },
      ],
      { lowerIsBetter: true },
    );
    expect(result.get("a")).toBeCloseTo(100, 5);
    expect(result.get("b")).toBeCloseTo(50, 5);
    expect(result.get("c")).toBeCloseTo(75, 5);
  });

  it("makes a blowout look like a blowout", () => {
    const result = scoreAbsolute([
      { playerId: "winner", raw: 1000 },
      { playerId: "loser", raw: 100 },
    ]);
    expect(result.get("winner")).toBeCloseTo(100, 5);
    expect(result.get("loser")).toBeCloseTo(10, 5);
  });

  it("handles degenerate all-zero input without dividing by zero", () => {
    const result = scoreAbsolute([
      { playerId: "a", raw: 0 },
      { playerId: "b", raw: 0 },
    ]);
    expect(result.get("a")).toBe(100);
    expect(result.get("b")).toBe(100);
  });

  it("returns an empty map for an empty field", () => {
    expect(scoreAbsolute([]).size).toBe(0);
  });

  it("rounds a fractional ratio to the nearest whole number", () => {
    const result = scoreAbsolute([
      { playerId: "a", raw: 3 },
      { playerId: "b", raw: 1 },
    ]);
    // b's ratio is 1/3 * 100 = 33.33... -> rounds to 33, not a fraction.
    expect(result.get("a")).toBe(100);
    expect(result.get("b")).toBe(33);
    expect(Number.isInteger(result.get("b"))).toBe(true);
  });
});
