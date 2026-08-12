/**
 * Hand-written database row types matching supabase/migrations/0001_init.sql.
 *
 * Once a live Supabase project exists these can be regenerated with
 * `supabase gen types typescript`; until then this keeps the data layer typed.
 * Keep in sync with the migration and with the domain types in src/lib/*.
 */

export type EventStatus = "planned" | "scoring" | "resolved" | "cancelled";

export interface PlayerRow {
  id: string;
  name: string;
  nickname: string | null;
  state: string | null; // 2-letter US state code
  is_groom: boolean;
  photo_url: string | null;
  created_at: string;
}

export interface EventRow {
  id: string;
  name: string;
  scoring_mode: "placement" | "absolute";
  lower_is_better: boolean;
  team_reshuffle: boolean;
  custom_placement: boolean;
  safety_check: boolean;
  notes: string | null;
  sort_order: number;
  status: EventStatus;
  photo_url: string | null;
}

export interface EventResultRow {
  event_id: string;
  player_id: string;
  position: number | null;
  raw: number | null;
}

export interface MultiplierRow {
  player_id: string;
  event_id: string;
  value: number;
  locked: boolean;
}

/** The groom's private per-event ranking (PRODUCT_SPEC.md → Overall betting
 * → Odds source) — one ranking per event, not one overall ranking. */
export interface EventRankingRow {
  event_id: string;
  player_id: string;
  rank: number;
}

export interface OverallBetRow {
  id: string;
  player_id: string;
  bet_type: "win" | "top3";
  pick_player_id: string;
  switches: number;
  created_at: string;
  /** "open" until the weekend ends and every event has resolved, then
   * settled to "won"/"lost" (src/lib/data/mutations.ts →
   * settleOverallBetsIfWeekendOver). */
  status: "open" | "won" | "lost";
  payout: number | null;
}

/** A wager on a specific PLAYER'S win/place outcome at one event — the
 * bettor and the pick can be different players (or the same one). */
export interface PerEventBetRow {
  id: string;
  player_id: string;
  event_id: string;
  pick_player_id: string;
  target: "win" | "place";
  wager: number;
  status: "open" | "won" | "lost" | "void";
  payout: number | null;
  created_at: string;
}

export interface BonusEventRow {
  id: string;
  name: string;
  winner_player_id: string | null;
  points: number;
  created_at: string;
}

export interface PowerMoveRow {
  id: 1;
  used: boolean;
  note: string | null;
  used_at: string | null;
}

export interface AppSettingsRow {
  id: 1;
  theme_id: string;
}
