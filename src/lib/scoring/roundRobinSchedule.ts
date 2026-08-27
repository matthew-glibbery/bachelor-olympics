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
 * `teamSize` is a target, not a strict requirement: when the roster can't
 * field even one full match of that size (`playerIds.length < teamSize *
 * 2` — e.g. team size 4 with only 7 players), every player still plays,
 * split into the two most evenly-sized teams possible (4 vs 3 for 7
 * players) rather than benching most of the roster or refusing to run at
 * all. This fallback only kicks in when a full-size match genuinely isn't
 * possible; whenever it is, the normal sit-out rotation above still
 * applies unchanged.
 *
 * Throws only if there aren't enough players for any match at all
 * (`playerIds.length < 2`).
 */
export function generateRoundRobinSchedule(
  playerIds: string[],
  teamSize: TeamSize,
  roundCount: number,
): RoundRobinRound[] {
  const n = playerIds.length;
  if (n < 2) {
    throw new Error(`generateRoundRobinSchedule: need at least 2 players, got ${n}`);
  }

  const sitOutTally = new Map<string, number>(playerIds.map((id) => [id, 0]));
  const rounds: RoundRobinRound[] = [];
  const perMatch = teamSize * 2;
  const fullChunks = Math.floor(n / perMatch);

  for (let r = 0; r < roundCount; r++) {
    const rotated = rotate(playerIds, r);
    // Below the target team size entirely: nobody sits out, everyone plays
    // in one match split as evenly as two teams can be.
    const sitOutCount = fullChunks >= 1 ? n % perMatch : 0;

    const bySitOuts = [...rotated].sort((a, b) => {
      const diff = sitOutTally.get(a)! - sitOutTally.get(b)!;
      return diff !== 0 ? diff : rotated.indexOf(a) - rotated.indexOf(b);
    });
    const sittingOut = bySitOuts.slice(0, sitOutCount);
    for (const id of sittingOut) sitOutTally.set(id, sitOutTally.get(id)! + 1);

    const sittingOutSet = new Set(sittingOut);
    const playing = rotated.filter((id) => !sittingOutSet.has(id));

    const teams: RoundRobinTeam[] = [];
    let idx = 0;
    for (let c = 0; c < fullChunks; c++) {
      teams.push({ team: teams.length + 1, playerIds: playing.slice(idx, idx + teamSize) });
      idx += teamSize;
      teams.push({ team: teams.length + 1, playerIds: playing.slice(idx, idx + teamSize) });
      idx += teamSize;
    }
    // Whatever's left after however many full-size matches fit — either
    // the whole roster (fullChunks === 0) or a too-small remainder that a
    // sit-out couldn't absorb evenly. Split it as evenly as possible into
    // one more, uneven match instead of leaving it unplayed.
    const leftover = playing.slice(idx);
    if (leftover.length >= 2) {
      const half = Math.floor(leftover.length / 2);
      teams.push({ team: teams.length + 1, playerIds: leftover.slice(0, half) });
      teams.push({ team: teams.length + 1, playerIds: leftover.slice(half) });
    }

    const matches: RoundRobinMatchup[] = [];
    for (let i = 0; i < teams.length; i += 2) {
      matches.push({ teamA: teams[i]!.team, teamB: teams[i + 1]!.team });
    }

    rounds.push({ round: r + 1, teams, matches, sittingOut });
  }

  return rounds;
}
