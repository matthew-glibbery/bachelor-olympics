/**
 * Bracket event format (PRODUCT_SPEC.md → Event formats → Bracket).
 *
 * Single-elimination with byes for a non-power-of-2 field, seeded from the
 * groom's adjustable `bracket_seeds` ordering (itself pre-filled from the
 * per-event ranking, but independent of it — see 0015_bracket_tables.sql).
 * A bye is a normal advance, no scoring special-casing. Two optional
 * consolation matches — a real 3rd-place match between the two semifinal
 * losers, and a real 5th-place match between the top two seeds of the round-
 * before-semis losers — otherwise those bands just tie, same tie-split
 * semantics as `scorePlacement` (placement.ts). This module only produces a
 * `PlacementEntry[]`; the points formula itself never changes.
 */

import type { PlacementEntry } from "./placement";

/** One bracket slot after seeding: `playerId` is null for a bye slot. */
export interface SeedSlot {
  seed: number;
  playerId: string | null;
}

export type BracketTrack = "main" | "third_place" | "fifth_place";

export interface BracketMatch {
  id: string;
  round: number;
  slot: number;
  track: BracketTrack;
  playerAId: string | null;
  playerBId: string | null;
  winnerId: string | null;
  isBye: boolean;
}

/** Smallest power of two >= n (n >= 1). Loop-based, not log2-based, to avoid
 * floating-point rounding at exact powers of two. */
function nextPowerOfTwo(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

/**
 * The standard recursive "seed pairing" order used by real single-
 * elimination brackets: seed 1 and 2 can only meet in the final, seeds 1-4
 * can't meet before the semifinal, etc. E.g. size 8 → [1,8,4,5,2,7,3,6].
 * Consecutive pairs in the returned list are the round-1 matchups.
 */
function seedOrderList(size: number): number[] {
  if (size <= 1) return [1];
  let order = [1, 2];
  while (order.length < size) {
    const n = order.length * 2;
    const next: number[] = [];
    for (const s of order) next.push(s, n + 1 - s);
    order = next;
  }
  return order;
}

/**
 * Seed a field of N players (already ordered strongest-first) into bracket
 * slots for a field of size `S` (next power of two ≥ N). The top `S - N`
 * seeds land in bye slots — this generalizes "seed 1 gets the bye" to any N
 * (e.g. N=5,S=8 gives seeds 1-3 byes, matching standard tournament seeding).
 */
export function seedBracket(orderedPlayerIds: string[]): SeedSlot[] {
  const n = orderedPlayerIds.length;
  if (n === 0) return [];
  const size = nextPowerOfTwo(n);
  return seedOrderList(size).map((seed) => ({
    seed,
    playerId: seed <= n ? orderedPlayerIds[seed - 1]! : null,
  }));
}

/** Recompute every main-track match's participants/winner from the current
 * round-1 state forward — the cascade that makes editing an earlier match
 * correctly invalidate/recompute later rounds. Pure; used by both initial
 * generation and `applyMatchResult`. */
function propagateMainBracket(matches: BracketMatch[]): BracketMatch[] {
  const byRoundSlot = new Map<string, BracketMatch>();
  let maxRound = 0;
  for (const m of matches) {
    if (m.track !== "main") continue;
    byRoundSlot.set(`${m.round}:${m.slot}`, m);
    if (m.round > maxRound) maxRound = m.round;
  }

  for (let round = 2; round <= maxRound; round++) {
    const count = [...byRoundSlot.values()].filter((m) => m.round === round).length;
    for (let slot = 1; slot <= count; slot++) {
      const match = byRoundSlot.get(`${round}:${slot}`);
      if (!match) continue;
      const sourceA = byRoundSlot.get(`${round - 1}:${2 * slot - 1}`);
      const sourceB = byRoundSlot.get(`${round - 1}:${2 * slot}`);
      match.playerAId = sourceA?.winnerId ?? null;
      match.playerBId = sourceB?.winnerId ?? null;
      if (match.winnerId !== match.playerAId && match.winnerId !== match.playerBId) {
        match.winnerId = null;
      }
    }
  }

  return matches;
}

/**
 * Build the full main-track match tree (every round's shells, not just
 * round 1) from a seed map — byes auto-resolve at creation (no groom input
 * needed), and their winners propagate into round 2 immediately.
 */
export function generateMainBracket(seeds: SeedSlot[]): BracketMatch[] {
  const size = seeds.length;
  if (size < 2) return [];

  const matches: BracketMatch[] = [];
  const round1Count = size / 2;
  for (let slot = 1; slot <= round1Count; slot++) {
    const a = seeds[2 * slot - 2]!;
    const b = seeds[2 * slot - 1]!;
    const isBye = a.playerId == null || b.playerId == null;
    matches.push({
      id: crypto.randomUUID(),
      round: 1,
      slot,
      track: "main",
      playerAId: a.playerId,
      playerBId: b.playerId,
      winnerId: isBye ? (a.playerId ?? b.playerId) : null,
      isBye,
    });
  }

  let round = 2;
  let count = round1Count / 2;
  while (count >= 1) {
    for (let slot = 1; slot <= count; slot++) {
      matches.push({
        id: crypto.randomUUID(),
        round,
        slot,
        track: "main",
        playerAId: null,
        playerBId: null,
        winnerId: null,
        isBye: false,
      });
    }
    round++;
    count /= 2;
  }

  return propagateMainBracket(matches);
}

/**
 * Record a match's winner and cascade the change forward. Pure — the caller
 * persists the returned array with one bulk upsert. Works for any track;
 * only `main`-track edits cascade (consolation matches are leaves).
 */
export function applyMatchResult(
  matches: BracketMatch[],
  matchId: string,
  winnerId: string,
): BracketMatch[] {
  const next = matches.map((m) => ({ ...m }));
  const target = next.find((m) => m.id === matchId);
  if (!target) throw new Error(`applyMatchResult: no match ${matchId}`);
  if (winnerId !== target.playerAId && winnerId !== target.playerBId) {
    throw new Error(`applyMatchResult: ${winnerId} is not a participant in match ${matchId}`);
  }
  target.winnerId = winnerId;

  return target.track === "main" ? propagateMainBracket(next) : next;
}

/** True once every main-track match has a recorded winner. */
export function isMainBracketComplete(matches: BracketMatch[]): boolean {
  const main = matches.filter((m) => m.track === "main");
  return main.length > 0 && main.every((m) => m.winnerId != null);
}

function loserOf(m: BracketMatch): string | null {
  if (m.winnerId == null || m.isBye) return null;
  return m.winnerId === m.playerAId ? m.playerBId : m.playerAId;
}

/**
 * Derive final placements from a completed main bracket plus whichever
 * optional consolation matches exist. Precondition: `isMainBracketComplete`.
 * Walks the bracket backward from the final: winner→1, loser→2; semifinal
 * losers tie for 3 unless a resolved `third_place` match splits them into
 * 3/4; the round-before-semis losers tie for the next band unless a
 * resolved `fifth_place` match (always just the top-two-seeded pair from
 * that band) splits the top two, leaving any remaining players in that round
 * tied one band lower; every earlier round always ties as one band, no
 * consolation option offered past 5th.
 */
export function deriveBracketPlacements(matches: BracketMatch[]): PlacementEntry[] {
  const main = matches.filter((m) => m.track === "main");
  if (main.length === 0) return [];
  const maxRound = Math.max(...main.map((m) => m.round));
  const byRound = (round: number, track: BracketTrack = "main") =>
    matches
      .filter((m) => m.track === track && m.round === round)
      .sort((a, b) => a.slot - b.slot);

  const entries: PlacementEntry[] = [];
  let place = 1;

  const final = byRound(maxRound)[0];
  if (!final?.winnerId) return [];
  entries.push({ playerId: final.winnerId, position: place });
  place += 1;
  const finalLoser = loserOf(final);
  if (finalLoser) {
    entries.push({ playerId: finalLoser, position: place });
    place += 1;
  }

  for (let round = maxRound - 1; round >= 1; round--) {
    const losers = byRound(round)
      .map(loserOf)
      .filter((id): id is string => id != null);
    if (losers.length === 0) continue;

    if (round === maxRound - 1) {
      const thirdPlaceMatch = matches.find(
        (m) => m.track === "third_place" && m.winnerId != null,
      );
      if (thirdPlaceMatch && losers.length === 2) {
        entries.push({ playerId: thirdPlaceMatch.winnerId!, position: place });
        entries.push({ playerId: loserOf(thirdPlaceMatch)!, position: place + 1 });
        place += 2;
        continue;
      }
    }

    if (round === maxRound - 2) {
      const fifthPlaceMatch = matches.find(
        (m) => m.track === "fifth_place" && m.winnerId != null,
      );
      if (fifthPlaceMatch) {
        const inMatch = new Set([fifthPlaceMatch.playerAId, fifthPlaceMatch.playerBId]);
        entries.push({ playerId: fifthPlaceMatch.winnerId!, position: place });
        entries.push({ playerId: loserOf(fifthPlaceMatch)!, position: place + 1 });
        place += 2;
        const rest = losers.filter((id) => !inMatch.has(id));
        for (const id of rest) entries.push({ playerId: id, position: place });
        place += rest.length;
        continue;
      }
    }

    for (const id of losers) entries.push({ playerId: id, position: place });
    place += losers.length;
  }

  return entries;
}
