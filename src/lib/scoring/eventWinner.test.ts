import { describe, expect, it } from "vitest";
import { eventWinnerIds } from "./eventWinner";
import type { EventResultRow, EventRow } from "@/lib/data/database.types";

function makeEvent(overrides: Partial<EventRow> = {}): EventRow {
  return {
    id: "e1",
    name: "Test event",
    scoring_mode: "placement",
    lower_is_better: false,
    format: "standard",
    custom_placement: false,
    safety_check: false,
    notes: null,
    sort_order: 0,
    status: "resolved",
    photo_url: null,
    resolved_at: null,
    ...overrides,
  };
}

describe("eventWinnerIds", () => {
  it("returns [] for an unresolved event", () => {
    const event = makeEvent({ status: "scoring" });
    const results: EventResultRow[] = [{ event_id: "e1", player_id: "a", position: 1, raw: null }];
    expect(eventWinnerIds(event, results)).toEqual([]);
  });

  it("picks the position-1 player in placement mode", () => {
    const event = makeEvent();
    const results: EventResultRow[] = [
      { event_id: "e1", player_id: "a", position: 2, raw: null },
      { event_id: "e1", player_id: "b", position: 1, raw: null },
    ];
    expect(eventWinnerIds(event, results)).toEqual(["b"]);
  });

  it("returns every tied-for-first player in placement mode", () => {
    const event = makeEvent();
    const results: EventResultRow[] = [
      { event_id: "e1", player_id: "a", position: 1, raw: null },
      { event_id: "e1", player_id: "b", position: 1, raw: null },
      { event_id: "e1", player_id: "c", position: 3, raw: null },
    ];
    expect(eventWinnerIds(event, results)).toEqual(["a", "b"]);
  });

  it("picks the max raw value in absolute mode when higher is better", () => {
    const event = makeEvent({ scoring_mode: "absolute", lower_is_better: false });
    const results: EventResultRow[] = [
      { event_id: "e1", player_id: "a", position: null, raw: 10 },
      { event_id: "e1", player_id: "b", position: null, raw: 25 },
    ];
    expect(eventWinnerIds(event, results)).toEqual(["b"]);
  });

  it("picks the min raw value in absolute mode when lower is better", () => {
    const event = makeEvent({ scoring_mode: "absolute", lower_is_better: true });
    const results: EventResultRow[] = [
      { event_id: "e1", player_id: "a", position: null, raw: 10 },
      { event_id: "e1", player_id: "b", position: null, raw: 25 },
    ];
    expect(eventWinnerIds(event, results)).toEqual(["a"]);
  });
});
