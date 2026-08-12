import { describe, expect, it } from "vitest";
import { aggregateRanking } from "./aggregate";

describe("aggregateRanking", () => {
  it("returns an empty ranking for no input", () => {
    expect(aggregateRanking([])).toEqual([]);
  });

  it("passes through a single event's ranking unchanged", () => {
    const ranking = [
      { playerId: "p1", rank: 1 },
      { playerId: "p2", rank: 2 },
    ];
    expect(aggregateRanking([ranking])).toEqual(ranking);
  });

  it("averages ranks across events consistently ranked the same way", () => {
    const e1 = [
      { playerId: "p1", rank: 1 },
      { playerId: "p2", rank: 2 },
    ];
    const e2 = [
      { playerId: "p1", rank: 1 },
      { playerId: "p2", rank: 2 },
    ];
    expect(aggregateRanking([e1, e2])).toEqual([
      { playerId: "p1", rank: 1 },
      { playerId: "p2", rank: 2 },
    ]);
  });

  it("lets a player who's stronger on average come out ahead overall", () => {
    // p1 is 1st then 3rd (avg 2); p2 is 2nd then 1st (avg 1.5) -> p2 ahead.
    const e1 = [
      { playerId: "p1", rank: 1 },
      { playerId: "p2", rank: 2 },
      { playerId: "p3", rank: 3 },
    ];
    const e2 = [
      { playerId: "p2", rank: 1 },
      { playerId: "p3", rank: 2 },
      { playerId: "p1", rank: 3 },
    ];
    const result = aggregateRanking([e1, e2]);
    expect(result.find((r) => r.playerId === "p2")?.rank).toBe(1);
    expect(result.find((r) => r.playerId === "p1")?.rank).toBe(2);
  });

  it("breaks exact ties on playerId for a stable order", () => {
    const e1 = [
      { playerId: "b", rank: 1 },
      { playerId: "a", rank: 1 },
    ];
    const result = aggregateRanking([e1]);
    expect(result.map((r) => r.playerId)).toEqual(["a", "b"]);
  });
});
