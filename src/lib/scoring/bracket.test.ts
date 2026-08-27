import { describe, expect, it } from "vitest";
import {
  applyMatchResult,
  deriveBracketPlacements,
  generateMainBracket,
  isMainBracketComplete,
  seedBracket,
  type BracketMatch,
} from "./bracket";

const players = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`); // p1 = seed 1

describe("seedBracket", () => {
  it("gives the sole bye to the top seed at N=7", () => {
    const seeds = seedBracket(players(7));
    expect(seeds).toHaveLength(8);
    const byeSeeds = seeds.filter((s) => s.playerId == null).map((s) => s.seed);
    expect(byeSeeds).toEqual([8]);
    // Seed 8's bracket-slot partner in the standard [1,8,4,5,2,7,3,6] order
    // is seed 1 — the top seed gets the bye.
    const order = seeds.map((s) => s.seed);
    expect(order).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("gives the top 3 seeds byes at N=5 (size 8)", () => {
    const seeds = seedBracket(players(5));
    const byeSeeds = seeds.filter((s) => s.playerId == null).map((s) => s.seed).sort((a, b) => a - b);
    expect(byeSeeds).toEqual([6, 7, 8]);
  });

  it("never pairs a bye against a bye", () => {
    for (let n = 1; n <= 16; n++) {
      const seeds = seedBracket(players(n));
      for (let i = 0; i < seeds.length; i += 2) {
        const a = seeds[i]!;
        const b = seeds[i + 1]!;
        expect(a.playerId == null && b.playerId == null).toBe(false);
      }
    }
  });

  it("needs no byes at a power-of-two N", () => {
    const seeds = seedBracket(players(8));
    expect(seeds.every((s) => s.playerId != null)).toBe(true);
  });
});

describe("generateMainBracket", () => {
  it("auto-resolves a bye's winner and propagates it into round 2", () => {
    const seeds = seedBracket(players(7)); // seed 1 (p1) gets the bye
    const matches = generateMainBracket(seeds);
    const byeMatch = matches.find((m) => m.isBye)!;
    expect(byeMatch.winnerId).toBe("p1");

    const round2 = matches.filter((m) => m.round === 2);
    const advanced = round2.some((m) => m.playerAId === "p1" || m.playerBId === "p1");
    expect(advanced).toBe(true);
  });

  it("builds every round's shells up front, not just round 1", () => {
    const matches = generateMainBracket(seedBracket(players(8)));
    const rounds = new Set(matches.map((m) => m.round));
    expect(rounds).toEqual(new Set([1, 2, 3]));
  });
});

describe("applyMatchResult", () => {
  it("cascades a winner into the next round's participant slot", () => {
    let matches = generateMainBracket(seedBracket(players(4))); // seeds: [1,4,2,3]
    const m1 = matches.find((m) => m.round === 1 && m.slot === 1)!; // seed1 vs seed4
    matches = applyMatchResult(matches, m1.id, m1.playerAId!);
    const final = matches.find((m) => m.round === 2)!;
    expect(final.playerAId).toBe(m1.playerAId);
  });

  it("clears a downstream winner when an earlier result is edited", () => {
    let matches = generateMainBracket(seedBracket(players(4)));
    const m1 = matches.find((m) => m.round === 1 && m.slot === 1)!;
    const m2 = matches.find((m) => m.round === 1 && m.slot === 2)!;
    matches = applyMatchResult(matches, m1.id, m1.playerAId!);
    matches = applyMatchResult(matches, m2.id, m2.playerAId!);
    let final = matches.find((m) => m.round === 2)!;
    matches = applyMatchResult(matches, final.id, final.playerAId!);
    final = matches.find((m) => m.round === 2)!;
    expect(final.winnerId).not.toBeNull();

    // Flip m1's winner to the other participant — final's playerA changes,
    // so its previously-recorded winner (the old m1 winner) is no longer a
    // valid participant and must be cleared.
    matches = applyMatchResult(matches, m1.id, m1.playerBId!);
    final = matches.find((m) => m.round === 2)!;
    expect(final.playerAId).toBe(m1.playerBId);
    expect(final.winnerId).toBeNull();
  });

  it("rejects a winner that isn't a participant in the match", () => {
    const matches = generateMainBracket(seedBracket(players(4)));
    const m1 = matches.find((m) => m.round === 1 && m.slot === 1)!;
    expect(() => applyMatchResult(matches, m1.id, "not-a-player")).toThrow();
  });
});

describe("isMainBracketComplete", () => {
  it("is false until every main match has a winner, true once resolved", () => {
    let matches = generateMainBracket(seedBracket(players(4)));
    expect(isMainBracketComplete(matches)).toBe(false);
    const m1 = matches.find((m) => m.round === 1 && m.slot === 1)!;
    const m2 = matches.find((m) => m.round === 1 && m.slot === 2)!;
    matches = applyMatchResult(matches, m1.id, m1.playerAId!);
    matches = applyMatchResult(matches, m2.id, m2.playerAId!);
    expect(isMainBracketComplete(matches)).toBe(false);
    const final = matches.find((m) => m.round === 2)!;
    matches = applyMatchResult(matches, final.id, final.playerAId!);
    expect(isMainBracketComplete(matches)).toBe(true);
  });
});

describe("deriveBracketPlacements", () => {
  function playAllRounds(matches: BracketMatch[], winners: Record<string, string>): BracketMatch[] {
    let result = matches;
    // Repeatedly resolve any main match whose participants are known but
    // has no winner yet, in the order the fixture provides winners for.
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (const m of result.filter((x) => x.track === "main" && x.winnerId == null)) {
        const key = `${m.round}:${m.slot}`;
        if (winners[key]) {
          result = applyMatchResult(result, m.id, winners[key]!);
          progressed = true;
        }
      }
    }
    return result;
  }

  it("places winner=1, final loser=2, semifinal losers tied for 3 with no third-place match", () => {
    const seeds = seedBracket(players(4)); // round1: (p1,p4), (p2,p3)
    let matches = generateMainBracket(seeds);
    matches = playAllRounds(matches, { "1:1": "p1", "1:2": "p3" }); // p3 upsets p2
    const final = matches.find((m) => m.round === 2)!;
    matches = applyMatchResult(matches, final.id, "p3"); // p3 upsets p1 too

    const placements = deriveBracketPlacements(matches);
    const byId = Object.fromEntries(placements.map((e) => [e.playerId, e.position]));
    expect(byId.p3).toBe(1);
    expect(byId.p1).toBe(2);
    expect(byId.p4).toBe(3);
    expect(byId.p2).toBe(3);
  });

  it("splits the semifinal-loser tie when a third-place match is played", () => {
    const seeds = seedBracket(players(4));
    let matches = generateMainBracket(seeds);
    matches = playAllRounds(matches, { "1:1": "p1", "1:2": "p2" });
    const final = matches.find((m) => m.round === 2)!;
    matches = applyMatchResult(matches, final.id, "p1");

    const thirdPlace: BracketMatch = {
      id: "3rd",
      round: 1,
      slot: 1,
      track: "third_place",
      playerAId: "p4",
      playerBId: "p3",
      winnerId: "p3",
      isBye: false,
    };
    const placements = deriveBracketPlacements([...matches, thirdPlace]);
    const byId = Object.fromEntries(placements.map((e) => [e.playerId, e.position]));
    expect(byId.p3).toBe(3);
    expect(byId.p4).toBe(4);
  });

  it("splits only the top-2-seeded pair of an 8-player quarterfinal-round band via a 5th-place match, ties the rest", () => {
    const seeds = seedBracket(players(8)); // round1: (1,8) (4,5) (2,7) (3,6)
    let matches = generateMainBracket(seeds);
    matches = playAllRounds(matches, {
      "1:1": "p1",
      "1:2": "p4",
      "1:3": "p2",
      "1:4": "p3",
      "2:1": "p1",
      "2:2": "p2",
    });
    const final = matches.find((m) => m.round === 3)!;
    matches = applyMatchResult(matches, final.id, "p1");
    // Round-1 losers: p8, p5, p7, p6. Top-2-seeded pair of those (lowest
    // seed number) is p5 (seed 5) and p6 (seed 6).
    const fifthPlace: BracketMatch = {
      id: "5th",
      round: 1,
      slot: 1,
      track: "fifth_place",
      playerAId: "p5",
      playerBId: "p6",
      winnerId: "p5",
      isBye: false,
    };
    const placements = deriveBracketPlacements([...matches, fifthPlace]);
    const byId = Object.fromEntries(placements.map((e) => [e.playerId, e.position]));
    expect(byId.p1).toBe(1);
    expect(byId.p2).toBe(2);
    expect(byId.p4).toBe(3);
    expect(byId.p3).toBe(3);
    expect(byId.p5).toBe(5);
    expect(byId.p6).toBe(6);
    expect(byId.p8).toBe(7);
    expect(byId.p7).toBe(7);
  });

  it("returns an empty array when the bracket isn't complete yet", () => {
    const matches = generateMainBracket(seedBracket(players(4)));
    expect(deriveBracketPlacements(matches)).toEqual([]);
  });
});
