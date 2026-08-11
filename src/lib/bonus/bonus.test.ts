import { describe, expect, it } from "vitest";
import { awardBonusEvent, BONUS_EVENT_POINTS } from "./bonusEvent";
import { PEER_AWARD_POINTS, tallyPeerAward } from "./peerAward";

describe("awardBonusEvent", () => {
  it("gives the winner a flat 50 by default, winner-take-all", () => {
    expect(awardBonusEvent("p1")).toEqual({ playerId: "p1", points: BONUS_EVENT_POINTS });
    expect(BONUS_EVENT_POINTS).toBe(50);
  });

  it("accepts a custom point value", () => {
    expect(awardBonusEvent("p1", 25).points).toBe(25);
  });
});

describe("tallyPeerAward", () => {
  it("awards the plurality winner a flat 50", () => {
    const result = tallyPeerAward([
      { voterId: "a", choiceId: "x" },
      { voterId: "b", choiceId: "x" },
      { voterId: "c", choiceId: "y" },
    ]);
    expect(result.winners).toEqual(["x"]);
    expect(result.voteCount).toBe(2);
    expect(result.points).toBe(PEER_AWARD_POINTS);
  });

  it("returns all winners on a tie", () => {
    const result = tallyPeerAward([
      { voterId: "a", choiceId: "x" },
      { voterId: "b", choiceId: "y" },
    ]);
    expect(new Set(result.winners)).toEqual(new Set(["x", "y"]));
    expect(result.voteCount).toBe(1);
  });

  it("returns no winners for an empty vote set", () => {
    const result = tallyPeerAward([]);
    expect(result.winners).toEqual([]);
    expect(result.voteCount).toBe(0);
  });
});
