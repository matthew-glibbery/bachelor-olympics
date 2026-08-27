/**
 * Round-robin event format (PRODUCT_SPEC.md → Event formats → Round-robin) —
 * a generated schedule of rotating 2- or 4-person teams. Each round fully
 * cyclically rotates the player order (see `rotate` below) before chunking
 * it into team-of-T groups, so who lands in which team — and, when teams
 * are uneven, who lands on the smaller side — varies round to round rather
 * than any one player being pinned to a fixed seat. A rotating sit-out set
 * — chosen to keep cumulative sit-outs balanced across players — covers
 * whatever's left over when the player count doesn't divide evenly into
 * full teams. Deterministic (no RNG), so "regenerate" always produces the
 * same schedule for the same inputs.
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

/**
 * Full cyclic rotation by `round` steps — every player cycles through
 * every seat position over a period of `order.length` rounds, with no
 * player permanently anchored to one spot.
 *
 * Deliberately NOT the classic "fix player 0, rotate the rest" circle
 * method: that variant privileges seat 0, and this schedule's team
 * assignment is a straight positional chunking of the rotated order (first
 * `teamSize` seats → team 1, next → team 2, …) — with a fixed seat 0, its
 * occupant landed in the same team slot (e.g. always the smaller side of
 * an uneven 4-vs-3 split) every single round. A full rotation removes that
 * bias; which two seats fall on which side of a chunk boundary still
 * shifts round to round, but no player is pinned to one.
 */
function rotate(order: string[], round: number): string[] {
  const n = order.length;
  if (n <= 1) return order;
  const r = ((round % n) + n) % n;
  return [...order.slice(r), ...order.slice(0, r)];
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
