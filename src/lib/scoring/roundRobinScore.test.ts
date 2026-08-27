import { describe, expect, it } from "vitest";
import { deriveRoundRobinPlacements, winCounts } from "./roundRobinScore";

describe("winCounts", () => {
  it("counts a win for every member of the winning team", () => {
    const counts = winCounts([
      { teamA: ["a", "b"], teamB: ["c", "d"], winner: "a" }, // a, b win
      { teamA: ["a", "c"], teamB: ["b", "d"], winner: "b" }, // b, d win
    ]);
    expect(counts.get("a")).toBe(1);
    expect(counts.get("b")).toBe(2);
    expect(counts.get("c")).toBe(0);
    expect(counts.get("d")).toBe(1);
  });

  it("doesn't count an undecided match", () => {
    const counts = winCounts([{ teamA: ["a"], teamB: ["b"], winner: null }]);
    expect(counts.get("a")).toBe(0);
    expect(counts.get("b")).toBe(0);
  });
});

describe("deriveRoundRobinPlacements", () => {
  it("ranks by win count descending", () => {
    const entries = deriveRoundRobinPlacements([
      { teamA: ["a"], teamB: ["b"], winner: "a" }, // a wins
      { teamA: ["a"], teamB: ["c"], winner: "a" }, // a wins again (2 total)
      { teamA: ["b"], teamB: ["c"], winner: "a" }, // b (teamA here) wins once
    ]);
    const byId = Object.fromEntries(entries.map((e) => [e.playerId, e.position]));
    expect(byId.a).toBe(1); // 2 wins
    expect(byId.b).toBe(2); // 1 win
    expect(byId.c).toBe(3); // 0 wins
  });

  it("ties players with equal win counts", () => {
    const entries = deriveRoundRobinPlacements([
      { teamA: ["a"], teamB: ["b"], winner: "a" }, // a wins
      { teamA: ["c"], teamB: ["d"], winner: "a" }, // c (teamA here) wins
    ]);
    const byId = Object.fromEntries(entries.map((e) => [e.playerId, e.position]));
    expect(byId.a).toBe(byId.c);
    expect(byId.b).toBe(byId.d);
    expect(byId.a!).toBeLessThan(byId.b!);
  });
});
