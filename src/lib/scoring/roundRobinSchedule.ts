/**
 * Round-robin event format (PRODUCT_SPEC.md → Event formats → Round-robin) —
 * a generated schedule of rotating 2- or 4-person teams. Adapts the classic
 * round-robin "circle method" (fix one player, rotate the rest each round)
 * generalized to team-of-T groupings, with a rotating sit-out set — chosen
 * to keep cumulative sit-outs balanced across players — when the player
 * count doesn't divide evenly into full teams. Deterministic (no RNG), so
 * "regenerate" always produces the same schedule for the same inputs.
 */

export type TeamSize = 2 | 4;

export interface RoundRobinTeam {
  team: number;
  playerIds: string[];
}

export interface RoundRobinMatchup {
  teamA: number;
  teamB: number;
}

export interface RoundRobinRound {
  round: number;
  teams: RoundRobinTeam[];
  matches: RoundRobinMatchup[];
  sittingOut: string[];
}

/** Circle method: fix `order[0]`, rotate everyone else by `round` steps.
 * Cycles with period `order.length - 1` before repeating. */
function rotate(order: string[], round: number): string[] {
  const n = order.length;
  if (n <= 2) return order;
  const period = n - 1;
  const r = ((round % period) + period) % period;
  const rest = order.slice(1);
  return [order[0]!, ...rest.slice(r), ...rest.slice(0, r)];
}

/**
 * Generate `roundCount` rounds for `playerIds` grouped into `teamSize`-
 * person teams, one round-robin-style match per full group of `2*teamSize`
 * players each round (as many simultaneous matches as the roster fully
 * fills — e.g. 8 players at team size 2 plays two 2v2 matches per round;
 * leftover players sit out that round, rotating fairly across rounds).
 *
 * Throws if there aren't enough players to field even one match of this
 * team size (`playerIds.length < teamSize * 2`) — the caller/UI should
 * validate team-size choice against the roster before calling this.
 */
export function generateRoundRobinSchedule(
  playerIds: string[],
  teamSize: TeamSize,
  roundCount: number,
): RoundRobinRound[] {
  const n = playerIds.length;
  if (n < teamSize * 2) {
    throw new Error(
      `generateRoundRobinSchedule: need at least ${teamSize * 2} players for team size ${teamSize}, got ${n}`,
    );
  }

  const sitOutTally = new Map<string, number>(playerIds.map((id) => [id, 0]));
  const rounds: RoundRobinRound[] = [];

  for (let r = 0; r < roundCount; r++) {
    const rotated = rotate(playerIds, r);
    const perMatch = teamSize * 2;
    const sitOutCount = n % perMatch;

    const bySitOuts = [...rotated].sort((a, b) => {
      const diff = sitOutTally.get(a)! - sitOutTally.get(b)!;
      return diff !== 0 ? diff : rotated.indexOf(a) - rotated.indexOf(b);
    });
    const sittingOut = bySitOuts.slice(0, sitOutCount);
    for (const id of sittingOut) sitOutTally.set(id, sitOutTally.get(id)! + 1);

    const sittingOutSet = new Set(sittingOut);
    const playing = rotated.filter((id) => !sittingOutSet.has(id));

    const teams: RoundRobinTeam[] = [];
    for (let i = 0; i < playing.length; i += teamSize) {
      teams.push({ team: teams.length + 1, playerIds: playing.slice(i, i + teamSize) });
    }

    const matches: RoundRobinMatchup[] = [];
    for (let i = 0; i < teams.length; i += 2) {
      matches.push({ teamA: teams[i]!.team, teamB: teams[i + 1]!.team });
    }

    rounds.push({ round: r + 1, teams, matches, sittingOut });
  }

  return rounds;
}
