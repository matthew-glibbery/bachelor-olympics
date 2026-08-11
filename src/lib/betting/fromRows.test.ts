import { describe, expect, it } from "vitest";
import { eliminationField } from "./fromRows";
import { isPickAlive } from "./overall";
import type { EventResultRow, EventRow, MultiplierRow } from "@/lib/data/database.types";

const baseEvent: Omit<EventRow, "id" | "scoring_mode" | "status"> = {
  name: "Test",
  lower_is_better: false,
  team_reshuffle: false,
  custom_placement: false,
  safety_check: false,
  notes: null,
  sort_order: 0,
  photo_url: null,
};

describe("eliminationField", () => {
  it("gives each player their current adjusted total plus shared remaining bounds", () => {
    const events: EventRow[] = [
      { ...baseEvent, id: "e1", scoring_mode: "placement", status: "resolved" },
      { ...baseEvent, id: "e2", scoring_mode: "placement", status: "planned" },
    ];
    const results: EventResultRow[] = [
      { event_id: "e1", player_id: "p1", position: 1, raw: null },
      { event_id: "e1", player_id: "p2", position: 2, raw: null },
    ];
    const multipliers: MultiplierRow[] = [];

    const field = eliminationField(["p1", "p2"], events, results, multipliers);
    const p1 = field.find((f) => f.playerId === "p1")!;
    const p2 = field.find((f) => f.playerId === "p2")!;

    expect(p1.current).toBeCloseTo(100, 5);
    expect(p2.current).toBeCloseTo(72, 5);
    // One event left, same bounds for everyone regardless of current total.
    expect(p1.maxRemaining).toBe(p2.maxRemaining);
    expect(p1.minRemaining).toBe(p2.minRemaining);
    expect(p1.maxRemaining).toBeGreaterThan(0);
  });

  it("shrinks bounds to zero once every event has resolved (or been cancelled)", () => {
    const events: EventRow[] = [
      { ...baseEvent, id: "e1", scoring_mode: "placement", status: "resolved" },
      { ...baseEvent, id: "e2", scoring_mode: "placement", status: "cancelled" },
    ];
    const results: EventResultRow[] = [
      { event_id: "e1", player_id: "p1", position: 1, raw: null },
    ];
    const field = eliminationField(["p1"], events, results, []);
    expect(field[0]?.maxRemaining).toBe(0);
    expect(field[0]?.minRemaining).toBe(0);
  });

  it("feeds isPickAlive correctly: a huge lead makes a rival's 'win' pick dead", () => {
    const events: EventRow[] = [
      { ...baseEvent, id: "e1", scoring_mode: "placement", status: "resolved" },
      { ...baseEvent, id: "e2", scoring_mode: "placement", status: "resolved" },
    ];
    const results: EventResultRow[] = [
      { event_id: "e1", player_id: "p1", position: 1, raw: null },
      { event_id: "e1", player_id: "p2", position: 2, raw: null },
      { event_id: "e2", player_id: "p1", position: 1, raw: null },
      { event_id: "e2", player_id: "p2", position: 2, raw: null },
    ];
    // No events remain, so bounds are 0 — p1's floor (200) already exceeds
    // p2's ceiling (144), so a "win" pick on p2 is dead.
    const field = eliminationField(["p1", "p2"], events, results, []);
    expect(isPickAlive("win", "p2", field)).toBe(false);
    expect(isPickAlive("win", "p1", field)).toBe(true);
  });
});
