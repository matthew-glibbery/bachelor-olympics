import { describe, expect, it } from "vitest";
import { deriveScoreLines, upcomingCatchUp } from "./fromRows";
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
    const lines = deriveScoreLines(events, results, multipliers, ["p1", "p2"]);
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
    const lines = deriveScoreLines(events, results, [], ["p1", "p2"]);
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
    expect(deriveScoreLines(events, results, [], ["p1"])).toHaveLength(0);
  });

  it("skips a resolved event with no results yet", () => {
    const events: EventRow[] = [
      { ...baseEvent, id: "e1", scoring_mode: "placement", status: "resolved" },
    ];
    expect(deriveScoreLines(events, [], [], ["p1"])).toHaveLength(0);
  });

  it("has no catch-up bonus on the very first resolved event", () => {
    const events: EventRow[] = [
      { ...baseEvent, id: "e1", scoring_mode: "placement", status: "resolved" },
    ];
    const results: EventResultRow[] = [
      { event_id: "e1", player_id: "p1", position: 1, raw: null },
      { event_id: "e1", player_id: "p2", position: 2, raw: null },
      { event_id: "e1", player_id: "p3", position: 3, raw: null },
    ];
    const lines = deriveScoreLines(events, results, [], ["p1", "p2", "p3"]);
    expect(lines.every((l) => l.catchUpBonus === 0)).toBe(true);
  });

  it("applies last/2nd-last/3rd-last catch-up bonuses on the next event, based on standings before it", () => {
    const events: EventRow[] = [
      {
        ...baseEvent,
        id: "e1",
        scoring_mode: "placement",
        status: "resolved",
        sort_order: 0,
        resolved_at: "2026-01-01T00:00:00Z",
      },
      {
        ...baseEvent,
        id: "e2",
        scoring_mode: "placement",
        status: "resolved",
        sort_order: 1,
        resolved_at: "2026-01-02T00:00:00Z",
      },
    ];
    // Event 1: p1 1st, p2 2nd, p3 3rd, p4 4th (last).
    const results: EventResultRow[] = [
      { event_id: "e1", player_id: "p1", position: 1, raw: null },
      { event_id: "e1", player_id: "p2", position: 2, raw: null },
      { event_id: "e1", player_id: "p3", position: 3, raw: null },
      { event_id: "e1", player_id: "p4", position: 4, raw: null },
      { event_id: "e2", player_id: "p1", position: 1, raw: null },
      { event_id: "e2", player_id: "p2", position: 2, raw: null },
      { event_id: "e2", player_id: "p3", position: 3, raw: null },
      { event_id: "e2", player_id: "p4", position: 4, raw: null },
    ];
    const lines = deriveScoreLines(events, results, [], ["p1", "p2", "p3", "p4"]);
    const e2 = (playerId: string) => lines.find((l) => l.eventId === "e2" && l.playerId === playerId)!;
    expect(e2("p4").catchUpBonus).toBeCloseTo(0.3, 5); // last after e1
    expect(e2("p3").catchUpBonus).toBeCloseTo(0.2, 5); // 2nd-last after e1
    expect(e2("p2").catchUpBonus).toBeCloseTo(0.1, 5); // 3rd-last after e1
    expect(e2("p1").catchUpBonus).toBe(0);
  });

  it("stacks the catch-up bonus multiplicatively on top of the player's own multiplier", () => {
    const events: EventRow[] = [
      {
        ...baseEvent,
        id: "e1",
        scoring_mode: "placement",
        status: "resolved",
        resolved_at: "2026-01-01T00:00:00Z",
      },
      {
        ...baseEvent,
        id: "e2",
        scoring_mode: "placement",
        status: "resolved",
        resolved_at: "2026-01-02T00:00:00Z",
      },
    ];
    const results: EventResultRow[] = [
      { event_id: "e1", player_id: "p1", position: 1, raw: null },
      { event_id: "e1", player_id: "p2", position: 2, raw: null },
      { event_id: "e2", player_id: "p1", position: 1, raw: null },
      { event_id: "e2", player_id: "p2", position: 1, raw: null },
    ];
    const multipliers: MultiplierRow[] = [
      { player_id: "p2", event_id: "e2", value: 1.2, locked: true },
    ];
    const lines = deriveScoreLines(events, results, multipliers, ["p1", "p2"]);
    const p2e2 = lines.find((l) => l.eventId === "e2" && l.playerId === "p2")!;
    expect(p2e2.multiplier).toBe(1.2); // unaffected — still what the player set
    expect(p2e2.catchUpBonus).toBeCloseTo(0.3, 5); // last (only 2 players) after e1
  });
});

describe("upcomingCatchUp", () => {
  it("previews the catch-up bonus for the event actually being scored", () => {
    const events: EventRow[] = [
      {
        ...baseEvent,
        id: "e1",
        scoring_mode: "placement",
        status: "resolved",
        sort_order: 0,
        resolved_at: "2026-01-01T00:00:00Z",
      },
      { ...baseEvent, id: "e2", scoring_mode: "placement", status: "scoring", sort_order: 1 },
    ];
    const results: EventResultRow[] = [
      { event_id: "e1", player_id: "p1", position: 1, raw: null },
      { event_id: "e1", player_id: "p2", position: 2, raw: null },
    ];
    const preview = upcomingCatchUp(events, results, [], ["p1", "p2"]);
    expect(preview?.eventId).toBe("e2");
    expect(preview?.bonuses.get("p2")).toBeCloseTo(0.3, 5);
    expect(preview?.bonuses.has("p1")).toBe(false);
  });

  it("returns null when nothing is currently being scored, even if a planned event exists", () => {
    // The real play order routinely diverges from configured sort_order, so
    // a merely "planned" event is never assumed to be next — only an event
    // that's actually been started (status "scoring") qualifies.
    const events: EventRow[] = [
      {
        ...baseEvent,
        id: "e1",
        scoring_mode: "placement",
        status: "resolved",
        sort_order: 0,
        resolved_at: "2026-01-01T00:00:00Z",
      },
      { ...baseEvent, id: "e2", scoring_mode: "placement", status: "planned", sort_order: 1 },
    ];
    const results: EventResultRow[] = [
      { event_id: "e1", player_id: "p1", position: 1, raw: null },
      { event_id: "e1", player_id: "p2", position: 2, raw: null },
    ];
    expect(upcomingCatchUp(events, results, [], ["p1", "p2"])).toBeNull();
  });

  it("targets the scoring event even when a planned event has a lower sort_order", () => {
    const events: EventRow[] = [
      { ...baseEvent, id: "e1", scoring_mode: "placement", status: "planned", sort_order: 0 },
      { ...baseEvent, id: "e2", scoring_mode: "placement", status: "scoring", sort_order: 5 },
    ];
    const preview = upcomingCatchUp(events, [], [], ["p1", "p2"]);
    expect(preview?.eventId).toBe("e2");
  });

  it("returns null when every event is already resolved", () => {
    const events: EventRow[] = [
      { ...baseEvent, id: "e1", scoring_mode: "placement", status: "resolved" },
    ];
    expect(upcomingCatchUp(events, [], [], ["p1"])).toBeNull();
  });
});
