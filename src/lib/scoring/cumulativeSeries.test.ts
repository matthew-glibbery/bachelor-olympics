import { describe, expect, it } from "vitest";
import { cumulativeSeries } from "./cumulativeSeries";
import type {
  EventResultRow,
  EventRow,
  MultiplierRow,
} from "@/lib/data/database.types";

const baseEvent: Omit<EventRow, "id" | "name" | "status"> = {
  scoring_mode: "placement",
  lower_is_better: false,
  team_reshuffle: false,
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
      { ...baseEvent, id: "e1", name: "Event 1", status: "planned" },
    ];
    const series = cumulativeSeries(events, [], [], ["p1"]);
    expect(series[1]).toEqual({ key: "e1", label: "Event 1", totals: { p1: null } });
  });

  it("accumulates resolved events with multipliers applied", () => {
    const events: EventRow[] = [
      { ...baseEvent, id: "e1", name: "Event 1", status: "resolved" },
      { ...baseEvent, id: "e2", name: "Event 2", status: "resolved" },
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
    // e1: p1 = 100 * 1.5 = 150, p2 = 72 * 1.0 = 72
    expect(series[1]!.totals).toEqual({ p1: 150, p2: 72 });
    // e2: p1 += 72*1.0 = 222, p2 += 100*1.0 = 172
    expect(series[2]!.totals).toEqual({ p1: 222, p2: 172 });
  });

  it("keeps summing whatever IS resolved even if a middle event is still pending", () => {
    const events: EventRow[] = [
      { ...baseEvent, id: "e1", name: "Event 1", status: "resolved" },
      { ...baseEvent, id: "e2", name: "Event 2", status: "planned" },
      { ...baseEvent, id: "e3", name: "Event 3", status: "resolved" },
    ];
    const results: EventResultRow[] = [
      { event_id: "e1", player_id: "p1", position: 1, raw: null },
      { event_id: "e3", player_id: "p1", position: 1, raw: null },
    ];
    const series = cumulativeSeries(events, results, [], ["p1"]);
    expect(series[1]!.totals.p1).toBe(100); // e1 resolved
    expect(series[2]!.totals.p1).toBeNull(); // e2 still pending — gap
    expect(series[3]!.totals.p1).toBe(200); // e3 resolved, sums both resolved events
  });

  it("produces one point per event plus the leading start point", () => {
    const events: EventRow[] = [
      { ...baseEvent, id: "e1", name: "Event 1", status: "planned" },
      { ...baseEvent, id: "e2", name: "Event 2", status: "planned" },
      { ...baseEvent, id: "e3", name: "Event 3", status: "planned" },
    ];
    const series = cumulativeSeries(events, [], [], ["p1"]);
    expect(series).toHaveLength(4);
    expect(series.map((p) => p.key)).toEqual(["start", "e1", "e2", "e3"]);
  });
});
