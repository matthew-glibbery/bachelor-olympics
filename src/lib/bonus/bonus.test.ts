import { describe, expect, it } from "vitest";
import { awardBonusEvent, BONUS_EVENT_POINTS } from "./bonusEvent";

describe("awardBonusEvent", () => {
  it("gives the winner a flat 50 by default, winner-take-all", () => {
    expect(awardBonusEvent("p1")).toEqual({ playerId: "p1", points: BONUS_EVENT_POINTS });
    expect(BONUS_EVENT_POINTS).toBe(50);
  });

  it("accepts a custom point value", () => {
    expect(awardBonusEvent("p1", 25).points).toBe(25);
  });
});
