import { describe, expect, it } from "vitest";
import { deriveScoreLines } from "./fromRows";
import type {
  EventResultRow,
  EventRow,
  MultiplierRow,
} from "@/lib/data/database.types";

const baseEvent: Omit<EventRow, "id" | "scoring_mode" | "status"> = {
  name: "Test",
  lower_is_better: false,
  team_reshuffle: false,
  custom_placement: false,
  safety_check: false,
  notes: null,
  sort_order: 0,
  photo_url: null,
  resolved_at: null,
};

describe("deriveScoreLines", () => {
  it("scores a resolved placement event with multipliers applied", () => {
    const events: EventRow[] = [
      { ...baseEvent, id: "e1", scoring_mode: "placement", status: "resolved" },
    ];
    const results: EventResultRow[] = [
      { event_id: "e1", player_id: "p1", position: 1, raw: null },
      { event_id: "e1", player_id: "p2", position: 2, raw: null },
    ];
    const multipliers: MultiplierRow[] = [
      { player_id: "p1", event_id: "e1", value: 1.5, locked: true },
    ];
    const lines = deriveScoreLines(events, results, multipliers);
    expect(lines).toHaveLength(2);
    const p1 = lines.find((l) => l.playerId === "p1")!;
    const p2 = lines.find((l) => l.playerId === "p2")!;
    expect(p1.points).toBeCloseTo(100, 5);
    expect(p1.multiplier).toBe(1.5);
    expect(p2.points).toBeCloseTo(72, 5);
    expect(p2.multiplier).toBe(1.0); // default, no row present
  });

  it("scores a resolved absolute event honouring lower_is_better", () => {
    const events: EventRow[] = [
      {
        ...baseEvent,
        id: "golf",
        scoring_mode: "absolute",
        status: "resolved",
        lower_is_better: true,
      },
    ];
    const results: EventResultRow[] = [
      { event_id: "golf", player_id: "p1", position: null, raw: 30 },
      { event_id: "golf", player_id: "p2", position: null, raw: 60 },
    ];
    const lines = deriveScoreLines(events, results, []);
    expect(lines.find((l) => l.playerId === "p1")!.points).toBeCloseTo(100, 5);
    expect(lines.find((l) => l.playerId === "p2")!.points).toBeCloseTo(50, 5);
  });

  it("skips events that are not resolved", () => {
    const events: EventRow[] = [
      { ...baseEvent, id: "e1", scoring_mode: "placement", status: "scoring" },
      { ...baseEvent, id: "e2", scoring_mode: "placement", status: "planned" },
      { ...baseEvent, id: "e3", scoring_mode: "placement", status: "cancelled" },
    ];
    const results: EventResultRow[] = [
      { event_id: "e1", player_id: "p1", position: 1, raw: null },
      { event_id: "e2", player_id: "p1", position: 1, raw: null },
      { event_id: "e3", player_id: "p1", position: 1, raw: null },
    ];
    expect(deriveScoreLines(events, results, [])).toHaveLength(0);
  });

  it("skips a resolved event with no results yet", () => {
    const events: EventRow[] = [
      { ...baseEvent, id: "e1", scoring_mode: "placement", status: "resolved" },
    ];
    expect(deriveScoreLines(events, [], [])).toHaveLength(0);
  });
});
