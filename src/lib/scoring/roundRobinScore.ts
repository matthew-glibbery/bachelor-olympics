/**
 * Round-robin placement derivation (PRODUCT_SPEC.md → Event formats →
 * Round-robin). Win/loss only, no margin — rank by win count across every
 * decided match, ties pool-and-split via the same semantics `scorePlacement`
 * already implements (placement.ts). Undecided matches simply don't count
 * yet, so this can also drive a live mid-event standings preview.
 */

import type { PlacementEntry } from "./placement";

export interface RoundRobinMatchResult {
  teamA: string[];
  teamB: string[];
  winner: "a" | "b" | null;
}

/** Win count per player across every decided match they played in. Players
 * who haven't played a decided match yet are omitted, not zeroed. */
export function winCounts(matches: RoundRobinMatchResult[]): Map<string, number> {
  const counts = new Map<string, number>();
  const bump = (id: string) => counts.set(id, (counts.get(id) ?? 0) + 1);
  const touch = (id: string) => {
    if (!counts.has(id)) counts.set(id, 0);
  };
  for (const m of matches) {
    for (const id of m.teamA) touch(id);
    for (const id of m.teamB) touch(id);
    if (m.winner === "a") m.teamA.forEach(bump);
    else if (m.winner === "b") m.teamB.forEach(bump);
  }
  return counts;
}

/** Rank players by win count descending; equal counts tie-share a position
 * band. Output feeds `scorePlacement()` unchanged. */
export function deriveRoundRobinPlacements(matches: RoundRobinMatchResult[]): PlacementEntry[] {
  const counts = winCounts(matches);
  const byWins = new Map<number, string[]>();
  for (const [playerId, wins] of counts) {
    const group = byWins.get(wins);
    if (group) group.push(playerId);
    else byWins.set(wins, [playerId]);
  }

  const sortedWinCounts = [...byWins.keys()].sort((a, b) => b - a);
  const entries: PlacementEntry[] = [];
  let place = 1;
  for (const wins of sortedWinCounts) {
    const group = byWins.get(wins)!;
    for (const playerId of group) entries.push({ playerId, position: place });
    place += group.length;
  }
  return entries;
}
