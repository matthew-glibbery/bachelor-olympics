import { describe, expect, it } from "vitest";
import { bestAcrossRounds } from "./placementRounds";

describe("bestAcrossRounds", () => {
  it("takes each player's lowest (best) position across all rounds", () => {
    const entries = bestAcrossRounds([
      { round: 1, playerId: "a", position: 3 },
      { round: 1, playerId: "b", position: 1 },
      { round: 2, playerId: "a", position: 1 },
      { round: 2, playerId: "b", position: 2 },
    ]);
    const byId = Object.fromEntries(entries.map((e) => [e.playerId, e.position]));
    expect(byId.a).toBe(1); // best of {3,1}
    expect(byId.b).toBe(1); // best of {1,2}
  });

  it("a player only ranked in some rounds is judged on those rounds only", () => {
    const entries = bestAcrossRounds([
      { round: 1, playerId: "a", position: 2 },
      { round: 2, playerId: "a", position: 5 },
      { round: 2, playerId: "b", position: 1 },
    ]);
    const byId = Object.fromEntries(entries.map((e) => [e.playerId, e.position]));
    expect(byId.a).toBe(2);
    expect(byId.b).toBe(1);
  });

  it("preserves a genuine tie for the same best position", () => {
    const entries = bestAcrossRounds([
      { round: 1, playerId: "a", position: 1 },
      { round: 1, playerId: "b", position: 1 },
    ]);
    const byId = Object.fromEntries(entries.map((e) => [e.playerId, e.position]));
    expect(byId.a).toBe(byId.b);
  });

  it("returns an empty array for no rounds", () => {
    expect(bestAcrossRounds([])).toEqual([]);
  });
});
