import { describe, expect, it } from "vitest";
import { sumAcrossRounds } from "./placementRounds";

describe("sumAcrossRounds", () => {
  it("adds each player's position across every round", () => {
    const entries = sumAcrossRounds([
      { round: 1, playerId: "a", position: 3 },
      { round: 1, playerId: "b", position: 1 },
      { round: 2, playerId: "a", position: 1 },
      { round: 2, playerId: "b", position: 2 },
    ]);
    const byId = Object.fromEntries(entries.map((e) => [e.playerId, e.position]));
    expect(byId.a).toBe(4); // 3 + 1
    expect(byId.b).toBe(3); // 1 + 2 — lower total wins
  });

  it("a single round behaves identically to that round's own positions", () => {
    const entries = sumAcrossRounds([
      { round: 1, playerId: "a", position: 1 },
      { round: 1, playerId: "b", position: 2 },
    ]);
    const byId = Object.fromEntries(entries.map((e) => [e.playerId, e.position]));
    expect(byId.a).toBe(1);
    expect(byId.b).toBe(2);
  });

  it("a player only ranked in some rounds is judged on those rounds alone", () => {
    const entries = sumAcrossRounds([
      { round: 1, playerId: "a", position: 2 },
      { round: 2, playerId: "a", position: 5 },
      { round: 2, playerId: "b", position: 1 },
    ]);
    const byId = Object.fromEntries(entries.map((e) => [e.playerId, e.position]));
    expect(byId.a).toBe(7);
    expect(byId.b).toBe(1);
  });

  it("preserves a genuine tie for equal totals", () => {
    const entries = sumAcrossRounds([
      { round: 1, playerId: "a", position: 1 },
      { round: 1, playerId: "b", position: 2 },
      { round: 2, playerId: "a", position: 2 },
      { round: 2, playerId: "b", position: 1 },
    ]);
    const byId = Object.fromEntries(entries.map((e) => [e.playerId, e.position]));
    expect(byId.a).toBe(byId.b); // 3 each
  });

  it("returns an empty array for no rounds", () => {
    expect(sumAcrossRounds([])).toEqual([]);
  });
});
