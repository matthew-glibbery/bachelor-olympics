import { describe, expect, it } from "vitest";
import { cumulativeSeries } from "./cumulativeSeries";
import type {
  BonusEventRow,
  EventResultRow,
  EventRow,
  MultiplierRow,
} from "@/lib/data/database.types";

const baseEvent: Omit<EventRow, "id" | "name" | "status" | "resolved_at"> = {
  scoring_mode: "placement",
  lower_is_better: false,
  format: "standard",
  custom_placement: false,
  safety_check: false,
  notes: null,
  sort_order: 0,
  photo_url: null,
};

describe("cumulativeSeries", () => {
  it("starts every player at zero", () => {
    const series = cumulativeSeries([], [], [], ["p1", "p2"]);
    expect(series).toEqual([{ key: "start", label: "Start", totals: { p1: 0, p2: 0 } }]);
  });

  it("leaves unresolved events as null (line doesn't extend past the frontier)", () => {
    const events: EventRow[] = [
      { ...baseEvent, id: "e1", name: "Event 1", status: "planned", resolved_at: null },
    ];
    const series = cumulativeSeries(events, [], [], ["p1"]);
    expect(series[1]).toEqual({ key: "e1", label: "Event 1", totals: { p1: null } });
  });

  it("accumulates resolved events in resolved_at order, with multipliers applied", () => {
    const events: EventRow[] = [
      {
        ...baseEvent,
        id: "e1",
        name: "Event 1",
        status: "resolved",
        resolved_at: "2026-08-10T10:00:00Z",
      },
      {
        ...baseEvent,
        id: "e2",
        name: "Event 2",
        status: "resolved",
        resolved_at: "2026-08-10T11:00:00Z",
      },
    ];
    const results: EventResultRow[] = [
      { event_id: "e1", player_id: "p1", position: 1, raw: null },
      { event_id: "e1", player_id: "p2", position: 2, raw: null },
      { event_id: "e2", player_id: "p1", position: 2, raw: null },
      { event_id: "e2", player_id: "p2", position: 1, raw: null },
    ];
    const multipliers: MultiplierRow[] = [
      { player_id: "p1", event_id: "e1", value: 1.5, locked: true },
    ];
    const series = cumulativeSeries(events, results, multipliers, ["p1", "p2"]);
    // e1: p1 = 100 * 1.5 = 150, p2 = 70 * 1.0 = 70 (no catch-up yet — e1 is
    // the very first resolved event, so there's no "before" standing).
    expect(series[1]!.totals).toEqual({ p1: 150, p2: 70 });
    // e2: p1 += 70*1.0 = 220 (was already ahead after e1, no catch-up).
    // p2 was last after e1 (only 2 players), so gets the +30% catch-up:
    // p2 += 100 * 1.0 * 1.3 = 130 -> 70 + 130 = 200.
    expect(series[2]!.totals).toEqual({ p1: 220, p2: 200 });
  });

  it("puts events in the real order they resolved, not their planned sort order", () => {
    const events: EventRow[] = [
      {
        ...baseEvent,
        id: "e1",
        name: "Event 1",
        sort_order: 0,
        status: "resolved",
        resolved_at: "2026-08-10T12:00:00Z", // resolved SECOND despite being sort_order 0
      },
      {
        ...baseEvent,
        id: "e2",
        name: "Event 2",
        sort_order: 1,
        status: "resolved",
        resolved_at: "2026-08-10T11:00:00Z", // resolved FIRST despite being sort_order 1
      },
    ];
    const series = cumulativeSeries(events, [], [], ["p1"]);
    expect(series.map((p) => p.key)).toEqual(["start", "e2", "e1"]);
  });

  it("interleaves an awarded bonus event between two resolved events by timestamp", () => {
    const events: EventRow[] = [
      {
        ...baseEvent,
        id: "e1",
        name: "Event 1",
        status: "resolved",
        resolved_at: "2026-08-10T10:00:00Z",
      },
      {
        ...baseEvent,
        id: "e2",
        name: "Event 2",
        status: "resolved",
        resolved_at: "2026-08-10T12:00:00Z",
      },
    ];
    const results: EventResultRow[] = [
      { event_id: "e1", player_id: "p1", position: 1, raw: null },
      { event_id: "e2", player_id: "p1", position: 1, raw: null },
    ];
    const bonusEvents: BonusEventRow[] = [
      {
        id: "b1",
        name: "Cornhole",
        winner_player_id: "p1",
        points: 50,
        created_at: "2026-08-10T11:00:00Z", // between e1 and e2
      },
    ];
    const series = cumulativeSeries(events, results, [], ["p1"], bonusEvents);
    expect(series.map((p) => p.key)).toEqual(["start", "e1", "b1", "e2"]);
    expect(series[1]!.totals.p1).toBe(100); // e1
    expect(series[2]!.totals.p1).toBe(150); // + bonus
    expect(series[3]!.totals.p1).toBe(250); // + e2
  });

  it("still trails unresolved events at the end regardless of any bonus events", () => {
    const events: EventRow[] = [
      {
        ...baseEvent,
        id: "e1",
        name: "Event 1",
        status: "resolved",
        resolved_at: "2026-08-10T10:00:00Z",
      },
      { ...baseEvent, id: "e2", name: "Event 2", status: "planned", resolved_at: null },
    ];
    const bonusEvents: BonusEventRow[] = [
      {
        id: "b1",
        name: "Cornhole",
        winner_player_id: "p1",
        points: 50,
        created_at: "2026-08-10T09:00:00Z",
      },
    ];
    const series = cumulativeSeries(events, [], [], ["p1"], bonusEvents);
    expect(series.map((p) => p.key)).toEqual(["start", "b1", "e1", "e2"]);
    expect(series.at(-1)!.totals.p1).toBeNull();
  });
});
