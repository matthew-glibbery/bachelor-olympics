import { describe, expect, it } from "vitest";
import { resolveOpenPerEventBets } from "./resolvePerEventBets";

const ranking = [
  { playerId: "p1", rank: 1 },
  { playerId: "p2", rank: 2 },
  { playerId: "p3", rank: 3 },
];

describe("resolveOpenPerEventBets", () => {
  it("wins a 'win' bet for the actual 1st-place finisher, scaled by that event's odds", () => {
    const [result] = resolveOpenPerEventBets(
      [{ id: "b1", playerId: "p1", target: "win", wager: 0.3 }],
      new Map([["p1", 1]]),
      ranking,
    );
    expect(result?.status).toBe("won");
    expect(result?.payout).toBeGreaterThan(0);
  });

  it("loses a 'win' bet for anyone who didn't finish 1st", () => {
    const [result] = resolveOpenPerEventBets(
      [{ id: "b1", playerId: "p2", target: "win", wager: 0.3 }],
      new Map([
        ["p1", 1],
        ["p2", 2],
      ]),
      ranking,
    );
    expect(result).toEqual({ id: "b1", status: "lost", payout: 0 });
  });

  it("wins a 'place' bet for a top-3 finish, even if not 1st", () => {
    const [result] = resolveOpenPerEventBets(
      [{ id: "b1", playerId: "p3", target: "place", wager: 0.2 }],
      new Map([["p3", 3]]),
      ranking,
    );
    expect(result?.status).toBe("won");
  });

  it("loses if the bettor has no result at all", () => {
    const [result] = resolveOpenPerEventBets(
      [{ id: "b1", playerId: "p1", target: "win", wager: 0.3 }],
      new Map(),
      ranking,
    );
    expect(result).toEqual({ id: "b1", status: "lost", payout: 0 });
  });

  it("pays out flat 1:1 when the event has no ranking on file", () => {
    const [result] = resolveOpenPerEventBets(
      [{ id: "b1", playerId: "p1", target: "win", wager: 0.4 }],
      new Map([["p1", 1]]),
      [],
    );
    expect(result).toEqual({ id: "b1", status: "won", payout: 0.4 });
  });
});
