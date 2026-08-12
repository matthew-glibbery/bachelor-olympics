import { describe, expect, it } from "vitest";
import { applyBonusAwards, awardBonusEvent, BONUS_EVENT_POINTS } from "./bonusEvent";
import type { PlayerTotal } from "@/lib/scoring/total";

describe("awardBonusEvent", () => {
  it("gives the winner a flat 50 by default, winner-take-all", () => {
    expect(awardBonusEvent("p1")).toEqual({ playerId: "p1", points: BONUS_EVENT_POINTS });
    expect(BONUS_EVENT_POINTS).toBe(50);
  });

  it("accepts a custom point value", () => {
    expect(awardBonusEvent("p1", 25).points).toBe(25);
  });
});

describe("applyBonusAwards", () => {
  const totals: PlayerTotal[] = [
    { playerId: "p1", raw: 100, adjusted: 120 },
    { playerId: "p2", raw: 90, adjusted: 90 },
  ];

  it("adds bonus points equally to raw and adjusted (no multiplier applies)", () => {
    const result = applyBonusAwards(totals, [{ playerId: "p2", points: 50 }]);
    const p2 = result.find((t) => t.playerId === "p2")!;
    expect(p2.raw).toBe(140);
    expect(p2.adjusted).toBe(140);
  });

  it("re-sorts by the new adjusted total after applying bonuses", () => {
    const result = applyBonusAwards(totals, [{ playerId: "p2", points: 50 }]);
    expect(result.map((t) => t.playerId)).toEqual(["p2", "p1"]);
  });

  it("creates a fresh total for a bonus winner with no prior scored events", () => {
    const result = applyBonusAwards(totals, [{ playerId: "p3", points: 50 }]);
    expect(result.find((t) => t.playerId === "p3")).toEqual({
      playerId: "p3",
      raw: 50,
      adjusted: 50,
    });
  });

  it("sums multiple bonuses for the same player", () => {
    const result = applyBonusAwards(totals, [
      { playerId: "p1", points: 50 },
      { playerId: "p1", points: 25 },
    ]);
    expect(result.find((t) => t.playerId === "p1")?.adjusted).toBe(195);
  });
});
