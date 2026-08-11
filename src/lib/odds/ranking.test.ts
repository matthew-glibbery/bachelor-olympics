import { describe, expect, it } from "vitest";
import {
  impliedProbabilities,
  payoutMultipliers,
  perEventPayoutMultiplier,
  RankingEntry,
} from "./ranking";

const ranking: RankingEntry[] = Array.from({ length: 8 }, (_, i) => ({
  playerId: `p${i + 1}`,
  rank: i + 1,
}));

describe("impliedProbabilities", () => {
  it("win probabilities sum to 1", () => {
    const probs = impliedProbabilities(ranking);
    const total = [...probs.values()].reduce((a, b) => a + b.win, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it("last probabilities sum to 1", () => {
    const probs = impliedProbabilities(ranking);
    const total = [...probs.values()].reduce((a, b) => a + b.last, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it("top3 probabilities sum to 3 (three slots allotted)", () => {
    const probs = impliedProbabilities(ranking);
    const total = [...probs.values()].reduce((a, b) => a + b.top3, 0);
    expect(total).toBeCloseTo(3, 6);
  });

  it("ranks the favorite most likely to win and least likely to come last", () => {
    const probs = impliedProbabilities(ranking);
    const fav = probs.get("p1")!;
    const dog = probs.get("p8")!;
    expect(fav.win).toBeGreaterThan(dog.win);
    expect(fav.last).toBeLessThan(dog.last);
    expect(fav.top3).toBeGreaterThan(dog.top3);
  });

  it("makes top3 at least as likely as an outright win for everyone", () => {
    const probs = impliedProbabilities(ranking);
    for (const p of probs.values()) {
      expect(p.top3).toBeGreaterThanOrEqual(p.win - 1e-9);
    }
  });

  it("rejects a ranking with duplicate or gapped ranks", () => {
    expect(() =>
      impliedProbabilities([
        { playerId: "a", rank: 1 },
        { playerId: "b", rank: 1 },
      ]),
    ).toThrow();
  });
});

describe("payoutMultipliers", () => {
  it("pays the favorite less than the longshot on a win bet", () => {
    const mult = payoutMultipliers(ranking);
    expect(mult.get("p1")!.win).toBeLessThan(mult.get("p8")!.win);
  });

  it("pays more for a rarer outcome (win rarer than place) for the same player", () => {
    const mult = payoutMultipliers(ranking);
    const p1 = mult.get("p1")!;
    expect(p1.win).toBeGreaterThan(p1.top3);
  });
});

describe("perEventPayoutMultiplier", () => {
  it("returns the win multiplier for a win target", () => {
    const expected = payoutMultipliers(ranking).get("p3")!.win;
    expect(perEventPayoutMultiplier(ranking, "p3", "win")).toBeCloseTo(expected, 9);
  });

  it("returns the top3 multiplier for a place target", () => {
    const expected = payoutMultipliers(ranking).get("p3")!.top3;
    expect(perEventPayoutMultiplier(ranking, "p3", "place")).toBeCloseTo(expected, 9);
  });
});
