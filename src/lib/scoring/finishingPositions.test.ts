import { describe, expect, it } from "vitest";
import { finishingPositions } from "./finishingPositions";

const placement = { scoring_mode: "placement", lower_is_better: false } as const;
const absoluteHigh = { scoring_mode: "absolute", lower_is_better: false } as const;
const golf = { scoring_mode: "absolute", lower_is_better: true } as const;

describe("finishingPositions", () => {
  it("reads a placement event's stored positions", () => {
    const map = finishingPositions(placement, [
      { player_id: "a", position: 1, raw: null },
      { player_id: "b", position: 2, raw: null },
      { player_id: "c", position: 3, raw: null },
    ]);
    expect(map.get("a")).toBe(1);
    expect(map.get("b")).toBe(2);
    expect(map.get("c")).toBe(3);
  });

  it("re-derives dense placement positions into competition ranking", () => {
    // Stored as [1, 2, 2, 4] — two tied for 2nd, then 4th.
    const map = finishingPositions(placement, [
      { player_id: "a", position: 1, raw: null },
      { player_id: "b", position: 2, raw: null },
      { player_id: "c", position: 2, raw: null },
      { player_id: "d", position: 4, raw: null },
    ]);
    expect(map.get("a")).toBe(1);
    expect(map.get("b")).toBe(2);
    expect(map.get("c")).toBe(2);
    // The tie consumed places 2 and 3, so d is 4th — and NOT top 3.
    expect(map.get("d")).toBe(4);
  });

  it("ranks a higher-is-better absolute event", () => {
    const map = finishingPositions(absoluteHigh, [
      { player_id: "a", position: null, raw: 10 },
      { player_id: "b", position: null, raw: 30 },
      { player_id: "c", position: null, raw: 20 },
    ]);
    expect(map.get("b")).toBe(1);
    expect(map.get("c")).toBe(2);
    expect(map.get("a")).toBe(3);
  });

  it("ranks golf the right way up (lower is better)", () => {
    const map = finishingPositions(golf, [
      { player_id: "a", position: null, raw: 44 },
      { player_id: "b", position: null, raw: 38 },
      { player_id: "c", position: null, raw: 51 },
    ]);
    expect(map.get("b")).toBe(1);
    expect(map.get("a")).toBe(2);
    expect(map.get("c")).toBe(3);
  });

  it("shares a position for equal raw results, then skips past the tie", () => {
    const map = finishingPositions(golf, [
      { player_id: "a", position: null, raw: 40 },
      { player_id: "b", position: null, raw: 40 },
      { player_id: "c", position: null, raw: 42 },
      { player_id: "d", position: null, raw: 43 },
    ]);
    expect(map.get("a")).toBe(1);
    expect(map.get("b")).toBe(1);
    expect(map.get("c")).toBe(3);
    expect(map.get("d")).toBe(4);
  });

  it("returns null for a player with no usable result", () => {
    const map = finishingPositions(golf, [
      { player_id: "a", position: null, raw: 40 },
      { player_id: "b", position: null, raw: null },
    ]);
    expect(map.get("a")).toBe(1);
    expect(map.get("b")).toBeNull();
  });

  it("returns an empty map for no results", () => {
    expect(finishingPositions(placement, []).size).toBe(0);
  });
});
