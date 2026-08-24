/**
 * Wiring tests for per-event bet settlement.
 *
 * The bug these exist for was not in the odds or payout math — that was
 * correct and unit-tested all along. It was in the plumbing: settlement was
 * only ever invoked for placement-scored events, and it read `position`
 * straight off the results, which is null for every absolute event. So a
 * winning bet on the golf sat "open" with the stake escrowed, forever. Pure
 * function tests could not have caught that, and didn't.
 *
 * The Supabase client is stubbed rather than mocked with a library: the
 * surface used here is a handful of chained builder calls, and a stub that
 * actually applies the filters is a better check of the query than an
 * assertion that some mock was called.
 */
import { describe, expect, it } from "vitest";
import { resolvePerEventBets, settleStrandedPerEventBets } from "./mutations";
import type { EventRow } from "./database.types";

type Rows = Record<string, Record<string, unknown>[]>;

function makeClient(tables: Rows) {
  const client = {
    from(table: string) {
      const filters: { op: "eq" | "in"; col: string; value: unknown }[] = [];
      let patch: Record<string, unknown> | null = null;

      const matching = () =>
        (tables[table] ?? []).filter((row) =>
          filters.every((f) =>
            f.op === "eq"
              ? row[f.col] === f.value
              : Array.isArray(f.value) && f.value.includes(row[f.col]),
          ),
        );

      const builder = {
        select: () => builder,
        update: (next: Record<string, unknown>) => {
          patch = next;
          return builder;
        },
        eq: (col: string, value: unknown) => {
          filters.push({ op: "eq", col, value });
          return builder;
        },
        in: (col: string, value: unknown[]) => {
          filters.push({ op: "in", col, value });
          return builder;
        },
        // Awaiting the builder is what actually runs it, same as the real
        // client (PostgrestBuilder is a thenable, not a promise).
        then(resolve: (r: { data: unknown; error: null }) => unknown) {
          const rows = matching();
          if (patch) for (const row of rows) Object.assign(row, patch);
          return Promise.resolve(resolve({ data: rows, error: null }));
        },
      };
      return builder;
    },
  };
  // The mutations take a real SupabaseClient; this stub implements the slice
  // of it they touch.
  return client as unknown as Parameters<typeof settleStrandedPerEventBets>[0];
}

const golf: EventRow = {
  id: "golf",
  name: "Nine Holes of Golf",
  scoring_mode: "absolute",
  lower_is_better: true,
  team_reshuffle: false,
  custom_placement: false,
  safety_check: false,
  notes: null,
  sort_order: 1,
  status: "resolved",
  photo_url: null,
  resolved_at: "2026-08-24T12:00:00.000Z",
};

describe("resolvePerEventBets on an absolute event", () => {
  it("settles a winning bet from raw scores, with no stored positions", async () => {
    const tables: Rows = {
      per_event_bets: [
        {
          id: "bet-1",
          player_id: "bettor",
          event_id: "golf",
          pick_player_id: "winner",
          target: "win",
          wager: 1.5,
          status: "open",
          payout: null,
        },
      ],
      event_rankings: [],
    };
    const client = makeClient(tables);

    await resolvePerEventBets(client, golf, [
      { player_id: "winner", position: null, raw: 38 },
      { player_id: "other", position: null, raw: 44 },
    ]);

    const bet = tables.per_event_bets![0]!;
    expect(bet.status).toBe("won");
    // No ranking on file, so the payout is a flat 1:1 return of the stake.
    expect(bet.payout).toBe(1.5);
  });

  it("settles a losing bet rather than leaving it open", async () => {
    const tables: Rows = {
      per_event_bets: [
        {
          id: "bet-1",
          player_id: "bettor",
          event_id: "golf",
          pick_player_id: "loser",
          target: "win",
          wager: 1,
          status: "open",
          payout: null,
        },
      ],
      event_rankings: [],
    };
    const client = makeClient(tables);

    await resolvePerEventBets(client, golf, [
      { player_id: "winner", position: null, raw: 38 },
      { player_id: "loser", position: null, raw: 51 },
    ]);

    expect(tables.per_event_bets![0]!.status).toBe("lost");
  });
});

describe("settleStrandedPerEventBets", () => {
  it("settles a bet left open on an already-resolved event", async () => {
    const tables: Rows = {
      per_event_bets: [
        {
          id: "stranded",
          player_id: "bettor",
          event_id: "golf",
          pick_player_id: "winner",
          target: "place",
          wager: 2,
          status: "open",
          payout: null,
        },
      ],
      events: [golf as unknown as Record<string, unknown>],
      event_results: [
        { event_id: "golf", player_id: "winner", position: null, raw: 38 },
        { event_id: "golf", player_id: "other", position: null, raw: 44 },
      ],
      event_rankings: [],
    };
    const client = makeClient(tables);

    await settleStrandedPerEventBets(client);

    expect(tables.per_event_bets![0]!.status).toBe("won");
  });

  it("leaves a bet on a still-planned event alone", async () => {
    const tables: Rows = {
      per_event_bets: [
        {
          id: "live",
          player_id: "bettor",
          event_id: "stump",
          pick_player_id: "winner",
          target: "win",
          wager: 1,
          status: "open",
          payout: null,
        },
      ],
      // Only resolved events come back from the query, so a planned one is
      // simply absent here.
      events: [],
      event_results: [],
      event_rankings: [],
    };
    const client = makeClient(tables);

    await settleStrandedPerEventBets(client);

    expect(tables.per_event_bets![0]!.status).toBe("open");
  });

  it("does nothing when there are no open bets at all", async () => {
    const client = makeClient({ per_event_bets: [] });
    await expect(settleStrandedPerEventBets(client)).resolves.toBeUndefined();
  });
});
