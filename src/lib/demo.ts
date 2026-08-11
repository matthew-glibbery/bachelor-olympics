/**
 * Placeholder seed data for Phase 2 UI development ONLY.
 *
 * This exists so the medal table has something to render before the Phase-1
 * data layer / store is wired. It builds real `EventScoreLine`s through the
 * Phase-0 scoring functions (so the numbers are genuine), but the players and
 * results are made up. Delete once the store feeds live data.
 */
import { scorePlacement, type PlacementEntry } from "@/lib/scoring/placement";
import { scoreAbsolute, type AbsoluteEntry } from "@/lib/scoring/absolute";
import type { EventScoreLine } from "@/lib/scoring/total";
import type { MedalTablePlayer } from "@/components/medal-table";

export const DEMO_PLAYERS: MedalTablePlayer[] = [
  { id: "p1", name: "Marcus", nickname: "The Closer", state: "TX" },
  { id: "p2", name: "Devon", state: "CA" },
  { id: "p3", name: "Theo", nickname: "Groomzilla", state: "NY" },
  { id: "p4", name: "Ravi", state: "IL" },
  { id: "p5", name: "Jonah", state: "CO" },
  { id: "p6", name: "Kwame", state: "GA" },
  { id: "p7", name: "Felix", state: "WA" },
  { id: "p8", name: "Sam", nickname: "Wildcard", state: "FL" },
];

// A made-up multiplier per player per event (all valid 0.5–1.5, roughly zero-sum).
const MULT: Record<string, number> = {
  p1: 1.3,
  p2: 1.1,
  p3: 1.5,
  p4: 0.9,
  p5: 1.0,
  p6: 0.8,
  p7: 1.2,
  p8: 0.7,
};

function placementLines(eventId: string, order: string[]): EventScoreLine[] {
  const entries: PlacementEntry[] = order.map((playerId, i) => ({
    playerId,
    position: i + 1,
  }));
  const points = scorePlacement(entries);
  return order.map((playerId) => ({
    eventId,
    playerId,
    points: points.get(playerId) ?? 0,
    multiplier: MULT[playerId] ?? 1,
  }));
}

function absoluteLines(
  eventId: string,
  raws: [string, number][],
  lowerIsBetter: boolean,
): EventScoreLine[] {
  const entries: AbsoluteEntry[] = raws.map(([playerId, raw]) => ({ playerId, raw }));
  const points = scoreAbsolute(entries, { lowerIsBetter });
  return raws.map(([playerId]) => ({
    eventId,
    playerId,
    points: points.get(playerId) ?? 0,
    multiplier: MULT[playerId] ?? 1,
  }));
}

/** Two resolved events worth of demo score lines. */
export const DEMO_SCORE_LINES: EventScoreLine[] = [
  ...placementLines("spikeball", ["p3", "p1", "p5", "p2", "p7", "p4", "p6", "p8"]),
  ...absoluteLines(
    "golf",
    [
      ["p1", 41],
      ["p2", 44],
      ["p3", 39],
      ["p4", 47],
      ["p5", 45],
      ["p6", 52],
      ["p7", 43],
      ["p8", 55],
    ],
    true,
  ),
];
