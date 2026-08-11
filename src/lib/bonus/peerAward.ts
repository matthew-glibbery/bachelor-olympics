/**
 * Peer award (PRODUCT_SPEC.md → Extras).
 *
 * At the end of the weekend (or optionally once per day), every player secretly
 * submits one name for something like "funniest moment" or "most chaotic
 * energy." Whoever gets the most votes gets a flat 50-point bonus. Simple
 * plurality — no ranked choice.
 *
 * Isolated from core scoring, like bonus events: this just tallies votes and
 * emits flat point awards.
 */

export const PEER_AWARD_POINTS = 50;

export interface PeerVote {
  voterId: string;
  /** The player this vote is cast for. */
  choiceId: string;
}

export interface PeerAwardResult {
  /** Every player tied for the most votes (plurality; usually one). */
  winners: string[];
  /** Votes the winner(s) received. */
  voteCount: number;
  /** Flat award each winner receives. */
  points: number;
  /** Full tally, for display. */
  tally: Map<string, number>;
}

/**
 * Tally a round of peer-award votes by simple plurality. On a tie, all
 * top-voted players win and each receives the flat award.
 */
export function tallyPeerAward(
  votes: PeerVote[],
  points: number = PEER_AWARD_POINTS,
): PeerAwardResult {
  const tally = new Map<string, number>();
  for (const { choiceId } of votes) {
    tally.set(choiceId, (tally.get(choiceId) ?? 0) + 1);
  }

  let max = 0;
  for (const count of tally.values()) max = Math.max(max, count);

  const winners = max === 0 ? [] : [...tally.entries()].filter(([, c]) => c === max).map(([id]) => id);

  return { winners, voteCount: max, points, tally };
}
