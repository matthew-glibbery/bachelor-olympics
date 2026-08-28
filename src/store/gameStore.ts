/**
 * Live game state — the ONLY thing components should read game data from.
 * Hydrates from Supabase on load, then keeps itself in sync via Realtime.
 * Components never import Supabase directly; this keeps the UI testable and
 * backend-agnostic (see CLAUDE.md / docs/PRODUCT_SPEC.md for why).
 */
import { create } from "zustand";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  fetchAppSettings,
  fetchBonusEvents,
  fetchBracketMatches,
  fetchBracketSeeds,
  fetchEventRankings,
  fetchEventResults,
  fetchEvents,
  fetchMultipliers,
  fetchOverallBets,
  fetchPerEventBets,
  fetchPlacementRounds,
  fetchPlayers,
  fetchRoundRobinMatches,
} from "@/lib/data/queries";
import type {
  AppSettingsRow,
  BonusEventRow,
  BracketMatchRow,
  BracketSeedRow,
  EventRankingRow,
  EventResultRow,
  EventRow,
  MultiplierRow,
  OverallBetRow,
  PerEventBetRow,
  PlacementRoundRow,
  PlayerRow,
  RoundRobinMatchRow,
} from "@/lib/data/database.types";

const REALTIME_TABLES = [
  "players",
  "events",
  "event_results",
  "multipliers",
  "app_settings",
  "event_rankings",
  "overall_bets",
  "per_event_bets",
  "bonus_events",
  "bracket_seeds",
  "bracket_matches",
  "round_robin_matches",
  "placement_rounds",
] as const;

interface GameState {
  players: PlayerRow[];
  events: EventRow[];
  eventResults: EventResultRow[];
  multipliers: MultiplierRow[];
  eventRankings: EventRankingRow[];
  overallBets: OverallBetRow[];
  perEventBets: PerEventBetRow[];
  bonusEvents: BonusEventRow[];
  bracketSeeds: BracketSeedRow[];
  bracketMatches: BracketMatchRow[];
  roundRobinMatches: RoundRobinMatchRow[];
  placementRounds: PlacementRoundRow[];
  appSettings: AppSettingsRow | null;
  loading: boolean;
  error: string | null;
  /** True once the initial fetch + realtime subscription have completed. */
  ready: boolean;
  /** Fetch everything once and subscribe to live changes. Safe to call once. */
  connect: () => Promise<void>;
  /** Tear down the realtime subscription (e.g. on unmount in tests/storybook). */
  disconnect: () => void;
}

let channel: RealtimeChannel | undefined;

export const useGameStore = create<GameState>((set, get) => ({
  players: [],
  events: [],
  eventResults: [],
  multipliers: [],
  eventRankings: [],
  overallBets: [],
  perEventBets: [],
  bonusEvents: [],
  bracketSeeds: [],
  bracketMatches: [],
  roundRobinMatches: [],
  placementRounds: [],
  appSettings: null,
  loading: false,
  error: null,
  ready: false,

  connect: async () => {
    if (get().ready || get().loading) return;
    set({ loading: true, error: null });

    const client = getSupabaseBrowserClient();
    try {
      const [
        players,
        events,
        eventResults,
        multipliers,
        eventRankings,
        overallBets,
        perEventBets,
        bonusEvents,
        bracketSeeds,
        bracketMatches,
        roundRobinMatches,
        placementRounds,
      ] = await Promise.all([
        fetchPlayers(client),
        fetchEvents(client),
        fetchEventResults(client),
        fetchMultipliers(client),
        fetchEventRankings(client),
        fetchOverallBets(client),
        fetchPerEventBets(client),
        fetchBonusEvents(client),
        fetchBracketSeeds(client),
        fetchBracketMatches(client),
        fetchRoundRobinMatches(client),
        fetchPlacementRounds(client),
      ]);
      // Fetched separately and allowed to fail without taking down the rest
      // of the app: app_settings is a newer table, so until its migration has
      // been run against a given project this would otherwise throw and
      // block players/events/etc. from ever loading. A null appSettings just
      // means no boot video has been uploaded yet.
      const appSettings = await fetchAppSettings(client).catch(() => null);
      set({
        players,
        events,
        eventResults,
        multipliers,
        eventRankings,
        overallBets,
        perEventBets,
        bonusEvents,
        bracketSeeds,
        bracketMatches,
        roundRobinMatches,
        placementRounds,
        appSettings,
        loading: false,
        ready: true,
      });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : String(err) });
      return;
    }

    // Any change on any game table triggers a refetch (debounced — see
    // scheduleRefetch below). Simpler and safer than patching individual
    // rows in place, and cheap enough at this scale (8 players, 8-9 events)
    // to just re-pull everything.
    channel = client
      .channel("game-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () =>
        scheduleRefetch(client, set),
      );
    for (const table of REALTIME_TABLES.slice(1)) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () =>
        scheduleRefetch(client, set),
      );
    }
    channel.subscribe();
  },

  disconnect: () => {
    if (refetchTimer !== undefined) {
      clearTimeout(refetchTimer);
      refetchTimer = undefined;
    }
    channel?.unsubscribe();
    channel = undefined;
    set({ ready: false });
  },
}));

let refetchTimer: ReturnType<typeof setTimeout> | undefined;

/**
 * Coalesces a burst of realtime events into one refetch. A single multi-row
 * write (e.g. saving several multiplier sliders in one upsert, or
 * `setEventRanking`'s wipe-then-insert) fires one `postgres_changes` message
 * per row Postgres actually touched — without this, that meant N *separate*,
 * concurrent, un-deduplicated refetches (9 parallel queries each) for what
 * the user experienced as a single "Save" click. That pile-up is what read
 * as saving being slow: the write itself lands in well under a second, but
 * the page kept visibly working through a queue of redundant refetches
 * after it. A short debounce collapses the whole burst into one refetch
 * fired after it settles — still effectively real-time (300ms), just no
 * longer quadratic in the number of rows a single action touches.
 */
function scheduleRefetch(
  client: ReturnType<typeof getSupabaseBrowserClient>,
  set: (partial: Partial<GameState>) => void,
) {
  if (refetchTimer !== undefined) clearTimeout(refetchTimer);
  refetchTimer = setTimeout(() => {
    refetchTimer = undefined;
    void refetch(client, set);
  }, 300);
}

async function refetch(
  client: ReturnType<typeof getSupabaseBrowserClient>,
  set: (partial: Partial<GameState>) => void,
) {
  const [
    players,
    events,
    eventResults,
    multipliers,
    eventRankings,
    overallBets,
    perEventBets,
    bonusEvents,
    bracketSeeds,
    bracketMatches,
    roundRobinMatches,
    placementRounds,
  ] = await Promise.all([
    fetchPlayers(client),
    fetchEvents(client),
    fetchEventResults(client),
    fetchMultipliers(client),
    fetchEventRankings(client),
    fetchOverallBets(client),
    fetchPerEventBets(client),
    fetchBonusEvents(client),
    fetchBracketSeeds(client),
    fetchBracketMatches(client),
    fetchRoundRobinMatches(client),
    fetchPlacementRounds(client),
  ]);
  const appSettings = await fetchAppSettings(client).catch(() => null);
  set({
    players,
    events,
    eventResults,
    multipliers,
    eventRankings,
    overallBets,
    perEventBets,
    bonusEvents,
    bracketSeeds,
    bracketMatches,
    roundRobinMatches,
    placementRounds,
    appSettings,
  });
}
