import { describe, expect, it } from "vitest";
import { generateRoundRobinSchedule } from "./roundRobinSchedule";

const players = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

describe("generateRoundRobinSchedule", () => {
  it("throws only when there aren't enough players for any match", () => {
    expect(() => generateRoundRobinSchedule(players(1), 2, 5)).toThrow();
  });

  it("plays everyone in one uneven match when the roster is below the target team size", () => {
    const rounds = generateRoundRobinSchedule(players(7), 4, 3);
    for (const round of rounds) {
      expect(round.sittingOut).toHaveLength(0);
      expect(round.teams).toHaveLength(2);
      expect(round.matches).toHaveLength(1);
      const sizes = round.teams.map((t) => t.playerIds.length).sort();
      expect(sizes).toEqual([3, 4]);
      const allPlayers = round.teams.flatMap((t) => t.playerIds);
      expect(new Set(allPlayers).size).toBe(7);
    }
  });

  it("rotates who lands on the smaller side of an uneven match, not always the same player", () => {
    const rounds = generateRoundRobinSchedule(players(7), 4, 7);
    const smallTeamCount = new Map<string, number>(players(7).map((id) => [id, 0]));
    for (const round of rounds) {
      const smaller = round.teams.reduce((a, b) => (a.playerIds.length <= b.playerIds.length ? a : b));
      for (const id of smaller.playerIds) smallTeamCount.set(id, smallTeamCount.get(id)! + 1);
    }
    const counts = [...smallTeamCount.values()];
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
    // No player sits on the small side every single round.
    expect(Math.max(...counts)).toBeLessThan(rounds.length);
  });

  it("is deterministic", () => {
    const a = generateRoundRobinSchedule(players(7), 2, 6);
    const b = generateRoundRobinSchedule(players(7), 2, 6);
    expect(a).toEqual(b);
  });

  it("gives every team exactly `teamSize` players and pairs every team into a match", () => {
    const rounds = generateRoundRobinSchedule(players(7), 2, 6);
    for (const round of rounds) {
      expect(round.teams.every((t) => t.playerIds.length === 2)).toBe(true);
      expect(round.teams.length % 2).toBe(0);
      expect(round.matches.length).toBe(round.teams.length / 2);
      // Every playing player appears in exactly one team, plus the sitters.
      const inTeams = round.teams.flatMap((t) => t.playerIds);
      const all = new Set([...inTeams, ...round.sittingOut]);
      expect(all.size).toBe(7);
      expect(new Set(inTeams).size).toBe(inTeams.length); // no duplicates
    }
  });

  it("fully fills every round with no sit-outs when N is an exact multiple of 2*teamSize", () => {
    const rounds = generateRoundRobinSchedule(players(8), 4, 5);
    for (const round of rounds) {
      expect(round.sittingOut).toHaveLength(0);
      expect(round.teams).toHaveLength(2);
      expect(round.matches).toHaveLength(1);
    }
  });

  it("keeps cumulative sit-outs roughly balanced across players", () => {
    const rounds = generateRoundRobinSchedule(players(7), 2, 14); // 3 sit out per round
    const tally = new Map<string, number>(players(7).map((id) => [id, 0]));
    for (const round of rounds) {
      for (const id of round.sittingOut) tally.set(id, tally.get(id)! + 1);
    }
    const counts = [...tally.values()];
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it("supports team size 4 at N=8", () => {
    const rounds = generateRoundRobinSchedule(players(8), 4, 3);
    for (const round of rounds) {
      expect(round.teams.every((t) => t.playerIds.length === 4)).toBe(true);
    }
  });
});
