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
  fetchEventRankings,
  fetchEventResults,
  fetchEvents,
  fetchMultipliers,
  fetchOverallBets,
  fetchPerEventBets,
  fetchPlayers,
  fetchPowerMove,
} from "@/lib/data/queries";
import type {
  AppSettingsRow,
  BonusEventRow,
  EventRankingRow,
  EventResultRow,
  EventRow,
  MultiplierRow,
  OverallBetRow,
  PerEventBetRow,
  PlayerRow,
  PowerMoveRow,
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
  "power_move",
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
  powerMove: PowerMoveRow | null;
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
  powerMove: null,
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
        powerMove,
      ] = await Promise.all([
        fetchPlayers(client),
        fetchEvents(client),
        fetchEventResults(client),
        fetchMultipliers(client),
        fetchEventRankings(client),
        fetchOverallBets(client),
        fetchPerEventBets(client),
        fetchBonusEvents(client),
        fetchPowerMove(client),
      ]);
      // Fetched separately and allowed to fail without taking down the rest
      // of the app: app_settings is a newer table, so until its migration has
      // been run against a given project this would otherwise throw and
      // block players/events/etc. from ever loading. ThemeApplier already
      // treats a null appSettings as "use the default theme."
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
        powerMove,
        appSettings,
        loading: false,
        ready: true,
      });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : String(err) });
      return;
    }

    // Any change on any game table triggers a full refetch. Simpler and safer
    // than patching individual rows in place, and cheap enough at this scale
    // (8 players, 8-9 events) to just re-pull everything on every change.
    channel = client
      .channel("game-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () =>
        refetch(client, set),
      );
    for (const table of REALTIME_TABLES.slice(1)) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, () =>
        refetch(client, set),
      );
    }
    channel.subscribe();
  },

  disconnect: () => {
    channel?.unsubscribe();
    channel = undefined;
    set({ ready: false });
  },
}));

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
    powerMove,
  ] = await Promise.all([
    fetchPlayers(client),
    fetchEvents(client),
    fetchEventResults(client),
    fetchMultipliers(client),
    fetchEventRankings(client),
    fetchOverallBets(client),
    fetchPerEventBets(client),
    fetchBonusEvents(client),
    fetchPowerMove(client),
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
    powerMove,
    appSettings,
  });
}
