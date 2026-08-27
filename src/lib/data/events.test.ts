import { describe, expect, it } from "vitest";
import { EVENTS } from "@/lib/events/config";
import { eventConfigToRow, eventSeedRows } from "./events";

describe("eventConfigToRow", () => {
  it("maps optional flags to concrete defaults", () => {
    const row = eventConfigToRow(
      { id: "x", name: "X", scoringMode: "placement" },
      3,
    );
    expect(row).toEqual({
      id: "x",
      name: "X",
      scoring_mode: "placement",
      lower_is_better: false,
      format: "standard",
      custom_placement: false,
      safety_check: false,
      notes: null,
      sort_order: 3,
      status: "planned",
      photo_url: null,
      resolved_at: null,
    });
  });

  it("carries golf's lower-is-better through", () => {
    const golf = EVENTS.find((e) => e.id === "golf")!;
    expect(eventConfigToRow(golf, 0).lower_is_better).toBe(true);
  });
});

describe("eventSeedRows", () => {
  it("produces one row per configured event, in order", () => {
    const rows = eventSeedRows();
    expect(rows).toHaveLength(EVENTS.length);
    expect(rows.map((r) => r.sort_order)).toEqual(EVENTS.map((_, i) => i));
  });
});
