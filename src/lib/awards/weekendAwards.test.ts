import { describe, expect, it } from "vitest";
import {
  computeWeekendAwards,
  mostBetsLost,
  mostBetsPlaced,
  mostImproved,
  mostLastPlaceFinishes,
} from "./weekendAwards";
import type {
  EventResultRow,
  EventRow,
  OverallBetRow,
  PerEventBetRow,
} from "@/lib/data/database.types";

const baseEvent: Omit<EventRow, "id" | "scoring_mode" | "status"> = {
  name: "Test",
  lower_is_better: false,
  format: "standard",
  custom_placement: false,
  safety_check: false,
  notes: null,
  sort_order: 0,
  photo_url: null,
  resolved_at: null,
};

function perEventBet(overrides: Partial<PerEventBetRow>): PerEventBetRow {
  return {
    id: Math.random().toString(),
    player_id: "p1",
    event_id: "e1",
    pick_player_id: "p1",
    target: "win",
    wager: 0.1,
    status: "open",
    payout: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function overallBet(overrides: Partial<OverallBetRow>): OverallBetRow {
  return {
    id: Math.random().toString(),
    player_id: "p1",
    bet_type: "win",
    pick_player_id: "p1",
    switches: 0,
    created_at: "2026-01-01T00:00:00Z",
    status: "open",
    payout: null,
    ...overrides,
  };
}

describe("mostBetsPlaced", () => {
  it("counts both bet types per bettor, any status", () => {
    const perEvent = [
      perEventBet({ player_id: "p1", status: "won" }),
      perEventBet({ player_id: "p1", status: "lost" }),
      perEventBet({ player_id: "p2", status: "open" }),
    ];
    const overall = [overallBet({ player_id: "p1", status: "open" })];
    const winners = mostBetsPlaced(perEvent, overall);
    expect(winners).toEqual([{ playerId: "p1", detail: "3 bets placed" }]);
  });

  it("returns every tied leader", () => {
    const perEvent = [perEventBet({ player_id: "p1" }), perEventBet({ player_id: "p2" })];
    const winners = mostBetsPlaced(perEvent, []);
    expect(winners.map((w) => w.playerId).sort()).toEqual(["p1", "p2"]);
  });

  it("is empty when nobody's bet on anything", () => {
    expect(mostBetsPlaced([], [])).toEqual([]);
  });
});

describe("mostBetsLost", () => {
  it("only counts lost bets, not open/won ones", () => {
    const perEvent = [
      perEventBet({ player_id: "p1", status: "lost" }),
      perEventBet({ player_id: "p1", status: "won" }),
      perEventBet({ player_id: "p2", status: "lost" }),
      perEventBet({ player_id: "p2", status: "lost" }),
    ];
    const winners = mostBetsLost(perEvent, []);
    expect(winners).toEqual([{ playerId: "p2", detail: "2 bets lost" }]);
  });
});

describe("mostLastPlaceFinishes", () => {
  it("counts dead-last finishes across resolved events only", () => {
    const events: EventRow[] = [
      { ...baseEvent, id: "e1", scoring_mode: "placement", status: "resolved", resolved_at: "2026-01-01T00:00:00Z" },
      { ...baseEvent, id: "e2", scoring_mode: "placement", status: "resolved", resolved_at: "2026-01-02T00:00:00Z" },
      { ...baseEvent, id: "e3", scoring_mode: "placement", status: "planned" },
    ];
    const results: EventResultRow[] = [
      { event_id: "e1", player_id: "p1", position: 1, raw: null },
      { event_id: "e1", player_id: "p2", position: 2, raw: null },
      { event_id: "e2", player_id: "p1", position: 1, raw: null },
      { event_id: "e2", player_id: "p2", position: 2, raw: null },
    ];
    const winners = mostLastPlaceFinishes(events, results);
    expect(winners).toEqual([{ playerId: "p2", detail: "last place 2 times" }]);
  });

  it("gives every tied-for-last player credit, not just one", () => {
    const events: EventRow[] = [
      { ...baseEvent, id: "e1", scoring_mode: "placement", status: "resolved", resolved_at: "2026-01-01T00:00:00Z" },
    ];
    // p2 and p3 tie for last (both position 3 of 3).
    const results: EventResultRow[] = [
      { event_id: "e1", player_id: "p1", position: 1, raw: null },
      { event_id: "e1", player_id: "p2", position: 3, raw: null },
      { event_id: "e1", player_id: "p3", position: 3, raw: null },
    ];
    const winners = mostLastPlaceFinishes(events, results);
    expect(winners.map((w) => w.playerId).sort()).toEqual(["p2", "p3"]);
  });
});

describe("mostImproved", () => {
  it("finds the single biggest one-event rank climb", () => {
    const events: EventRow[] = [
      { ...baseEvent, id: "e1", scoring_mode: "placement", status: "resolved", resolved_at: "2026-01-01T00:00:00Z" },
      { ...baseEvent, id: "e2", scoring_mode: "placement", status: "resolved", resolved_at: "2026-01-02T00:00:00Z" },
    ];
    // After e1: p1 first, p2 second, p3 last. At e2, p3 wins outright,
    // vaulting from 3rd to 1st — a +2 place jump, the biggest possible here.
    const results: EventResultRow[] = [
      { event_id: "e1", player_id: "p1", position: 1, raw: null },
      { event_id: "e1", player_id: "p2", position: 2, raw: null },
      { event_id: "e1", player_id: "p3", position: 3, raw: null },
      { event_id: "e2", player_id: "p3", position: 1, raw: null },
      { event_id: "e2", player_id: "p1", position: 2, raw: null },
      { event_id: "e2", player_id: "p2", position: 3, raw: null },
    ];
    const winners = mostImproved(events, results, [], ["p1", "p2", "p3"]);
    expect(winners).toEqual([{ playerId: "p3", detail: "+2 places at Test" }]);
  });

  it("is empty with fewer than two resolved events", () => {
    const events: EventRow[] = [
      { ...baseEvent, id: "e1", scoring_mode: "placement", status: "resolved", resolved_at: "2026-01-01T00:00:00Z" },
    ];
    const results: EventResultRow[] = [{ event_id: "e1", player_id: "p1", position: 1, raw: null }];
    expect(mostImproved(events, results, [], ["p1", "p2"])).toEqual([]);
  });

  it("never picks the player who's already leading throughout", () => {
    const events: EventRow[] = [
      { ...baseEvent, id: "e1", scoring_mode: "placement", status: "resolved", resolved_at: "2026-01-01T00:00:00Z" },
      { ...baseEvent, id: "e2", scoring_mode: "placement", status: "resolved", resolved_at: "2026-01-02T00:00:00Z" },
    ];
    const results: EventResultRow[] = [
      { event_id: "e1", player_id: "p1", position: 1, raw: null },
      { event_id: "e1", player_id: "p2", position: 2, raw: null },
      { event_id: "e2", player_id: "p1", position: 1, raw: null },
      { event_id: "e2", player_id: "p2", position: 2, raw: null },
    ];
    const winners = mostImproved(events, results, [], ["p1", "p2"]);
    expect(winners.every((w) => w.playerId !== "p1")).toBe(true);
  });
});

describe("computeWeekendAwards", () => {
  it("returns all four categories, empty winners where there's no data", () => {
    const categories = computeWeekendAwards({
      events: [],
      eventResults: [],
      multipliers: [],
      playerIds: ["p1", "p2"],
      perEventBets: [],
      overallBets: [],
    });
    expect(categories).toHaveLength(4);
    expect(categories.every((c) => c.winners.length === 0)).toBe(true);
  });
});
