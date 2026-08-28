/**
 * Supabase writes for the game tables. Thin wrappers only, same rule as
 * src/lib/data/queries.ts — no business logic here.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveOpenPerEventBets } from "@/lib/betting/resolvePerEventBets";
import { settleOverallBets } from "@/lib/betting/settleOverallBets";
import { applyBonusAwards } from "@/lib/bonus/bonusEvent";
import { finishingPositions } from "@/lib/scoring/finishingPositions";
import {
  applyMatchResult,
  deriveBracketPlacements,
  isMainBracketComplete,
  type BracketMatch,
  type BracketTrack,
} from "@/lib/scoring/bracket";
import { deriveScoreLines } from "@/lib/scoring/fromRows";
import { bestAcrossRounds } from "@/lib/scoring/placementRounds";
import {
  deriveRoundRobinPlacements,
  type RoundRobinMatchResult,
} from "@/lib/scoring/roundRobinScore";
import { standings } from "@/lib/scoring/total";
import type {
  BonusEventRow,
  BracketMatchRow,
  EventFormat,
  EventResultRow,
  EventRow,
  EventStatus,
  MultiplierRow,
  OverallBetRow,
  PerEventBetRow,
  PlacementRoundRow,
  PlayerRow,
  RoundRobinMatchRow,
} from "./database.types";

export interface NewPlayer {
  name: string;
  nickname?: string | null;
  state: string;
  is_groom?: boolean;
}

export async function addPlayer(
  client: SupabaseClient,
  player: NewPlayer,
): Promise<PlayerRow> {
  const { data, error } = await client
    .from("players")
    .insert({
      name: player.name,
      nickname: player.nickname ?? null,
      state: player.state.toUpperCase(),
      is_groom: player.is_groom ?? false,
    })
    .select()
    .single();
  if (error) throw new Error(`addPlayer: ${error.message}`);
  return data as PlayerRow;
}

export async function removePlayer(
  client: SupabaseClient,
  playerId: string,
): Promise<void> {
  const { error } = await client.from("players").delete().eq("id", playerId);
  if (error) throw new Error(`removePlayer: ${error.message}`);
}

export interface PlayerPatch {
  name?: string;
  nickname?: string | null;
  state?: string;
  is_groom?: boolean;
  photo_url?: string | null;
  character_select_video_url?: string | null;
  character_fullbody_video_url?: string | null;
  character_confirm_video_url?: string | null;
  character_victory_video_url?: string | null;
}

export async function updatePlayer(
  client: SupabaseClient,
  playerId: string,
  patch: PlayerPatch,
): Promise<PlayerRow> {
  const { state, ...rest } = patch;
  const { data, error } = await client
    .from("players")
    .update({ ...rest, ...(state ? { state: state.toUpperCase() } : {}) })
    .eq("id", playerId)
    .select()
    .single();
  if (error) throw new Error(`updatePlayer: ${error.message}`);
  return data as PlayerRow;
}

/**
 * Move an event through planned -> scoring -> resolved. Multipliers lock
 * for an event as soon as it leaves "planned" (PRODUCT_SPEC.md → Multipliers).
 * Stamps `resolved_at` the moment it resolves — the progress chart
 * (src/lib/scoring/cumulativeSeries.ts) uses this to interleave events with
 * bonus events in the actual order points were awarded, not just planned
 * sort order. Cleared if the event ever leaves "resolved" again.
 */
export async function setEventStatus(
  client: SupabaseClient,
  eventId: string,
  status: EventStatus,
): Promise<void> {
  const { error } = await client
    .from("events")
    .update({ status, resolved_at: status === "resolved" ? new Date().toISOString() : null })
    .eq("id", eventId);
  if (error) throw new Error(`setEventStatus: ${error.message}`);
}

/**
 * Cancel an event: deleted from the competition entirely, not marked
 * "cancelled" (PRODUCT_SPEC.md → Cancelled events). FK cascades clean up its
 * results and multiplier rows, which frees that budget back into every
 * player's pool automatically (fewer events => smaller total budget divisor).
 */
export async function cancelEvent(
  client: SupabaseClient,
  eventId: string,
): Promise<void> {
  const { error } = await client.from("events").delete().eq("id", eventId);
  if (error) throw new Error(`cancelEvent: ${error.message}`);
}

/**
 * Reset a single event: delete its results and set it back to "planned".
 * Distinct from cancelEvent — the event itself, its photo, and any
 * multiplier allocations for it stay put; going back to "planned" simply
 * re-unlocks multipliers for it (locking is derived from status !==
 * "planned", not a stored flag) so players can redo the event as if it
 * hadn't started scoring yet.
 */
export async function resetEvent(client: SupabaseClient, eventId: string): Promise<void> {
  const { error: resultsError } = await client
    .from("event_results")
    .delete()
    .eq("event_id", eventId);
  if (resultsError) throw new Error(`resetEvent (results): ${resultsError.message}`);

  for (const table of [
    "bracket_seeds",
    "bracket_matches",
    "round_robin_matches",
    "placement_rounds",
  ] as const) {
    const { error } = await client.from(table).delete().eq("event_id", eventId);
    if (error) throw new Error(`resetEvent (${table}): ${error.message}`);
  }

  const { error: statusError } = await client
    .from("events")
    .update({ status: "planned", resolved_at: null })
    .eq("id", eventId);
  if (statusError) throw new Error(`resetEvent (status): ${statusError.message}`);
}

/**
 * Full weekend reset — wipes every table of weekend *activity* (results,
 * multiplier allocations, all bet/bonus-event/power-move state, and every
 * event's ranking) and puts every event back to "planned". Players and the
 * app theme are left alone; this is for restarting the competition itself,
 * not the roster or presentation. A destructive, rarely-used groom action —
 * gated the same way as every other groom tool, with a confirm step in the
 * UI since there's no undo.
 */
export async function resetWeekend(client: SupabaseClient): Promise<void> {
  const wipes: [table: string, notNullColumn: string][] = [
    ["event_results", "event_id"],
    ["multipliers", "player_id"],
    ["overall_bets", "player_id"],
    ["per_event_bets", "player_id"],
    ["bonus_events", "id"],
    ["event_rankings", "player_id"],
    ["bracket_seeds", "player_id"],
    ["bracket_matches", "id"],
    ["round_robin_matches", "id"],
    ["placement_rounds", "player_id"],
  ];
  for (const [table, column] of wipes) {
    const { error } = await client.from(table).delete().not(column, "is", null);
    if (error) throw new Error(`resetWeekend (${table}): ${error.message}`);
  }

  const { error: eventsError } = await client
    .from("events")
    .update({ status: "planned", resolved_at: null })
    .neq("status", "planned");
  if (eventsError) throw new Error(`resetWeekend (events): ${eventsError.message}`);

  const { error: powerMoveError } = await client
    .from("power_move")
    .update({ used: false, note: null, used_at: null })
    .eq("id", 1);
  if (powerMoveError) throw new Error(`resetWeekend (power_move): ${powerMoveError.message}`);
}

export async function updateEventPhoto(
  client: SupabaseClient,
  eventId: string,
  photoUrl: string | null,
): Promise<EventRow> {
  const { data, error } = await client
    .from("events")
    .update({ photo_url: photoUrl })
    .eq("id", eventId)
    .select()
    .single();
  if (error) throw new Error(`updateEventPhoto: ${error.message}`);
  return data as EventRow;
}

export interface NewEvent {
  name: string;
  scoring_mode: "placement" | "absolute";
  lower_is_better?: boolean;
  format?: EventFormat;
  notes?: string | null;
  /** Caller supplies this from the live events list it already has (e.g.
   * `events.length`) — no extra round-trip to look up the current max. */
  sort_order: number;
}

/**
 * Create a groom-added event — events are no longer only seeded from
 * src/lib/events/config.ts, the groom can add more from Setup → Manage
 * events. Generates its own id (the config-seeded events use readable slugs
 * like "golf"; a UUID is just as valid a primary key and needs no
 * uniqueness checking against user-typed names).
 */
export async function createEvent(
  client: SupabaseClient,
  event: NewEvent,
): Promise<EventRow> {
  const { data, error } = await client
    .from("events")
    .insert({
      id: crypto.randomUUID(),
      name: event.name,
      scoring_mode: event.scoring_mode,
      lower_is_better: event.lower_is_better ?? false,
      format: event.format ?? "standard",
      notes: event.notes ?? null,
      sort_order: event.sort_order,
    })
    .select()
    .single();
  if (error) throw new Error(`createEvent: ${error.message}`);
  return data as EventRow;
}

export interface EventPatch {
  name?: string;
  scoring_mode?: "placement" | "absolute";
  lower_is_better?: boolean;
  format?: EventFormat;
  notes?: string | null;
  photo_url?: string | null;
}

/**
 * Edit an event's own details — name, description, scoring type, photo.
 * The UI is responsible for only offering scoring-type changes while the
 * event is still "planned" (no results on file yet to get corrupted by a
 * placement<->absolute switch, which store the result differently —
 * `position` vs `raw`).
 */
export async function updateEvent(
  client: SupabaseClient,
  eventId: string,
  patch: EventPatch,
): Promise<EventRow> {
  const { data, error } = await client
    .from("events")
    .update(patch)
    .eq("id", eventId)
    .select()
    .single();
  if (error) throw new Error(`updateEvent: ${error.message}`);
  return data as EventRow;
}

/**
 * Persist a new drag-to-reorder order for every event in one round trip.
 * Upsert only touches the columns present in the payload (same trick as
 * seedEvents), so this can't clobber anything else about an event.
 */
export async function reorderEvents(
  client: SupabaseClient,
  orderedEventIds: string[],
): Promise<void> {
  // Every id here already exists — this only ever updates, never inserts —
  // so plain per-row UPDATEs, not upsert(). `events.name`/`scoring_mode` are
  // NOT NULL with no default: upsert()'s INSERT ... ON CONFLICT DO UPDATE
  // still forms an INSERT-branch tuple with those columns defaulted to NULL
  // and fails the NOT NULL check before it ever reaches the conflict
  // redirect, so a sort_order-only upsert() throws on every call.
  const results = await Promise.all(
    orderedEventIds.map((id, i) => client.from("events").update({ sort_order: i }).eq("id", id)),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(`reorderEvents: ${failed.error.message}`);
}

export interface EventResultInput {
  player_id: string;
  position?: number | null;
  raw?: number | null;
}

/** Bulk-write an event's results (placement uses `position`, absolute uses `raw`). */
export async function upsertEventResults(
  client: SupabaseClient,
  eventId: string,
  results: EventResultInput[],
): Promise<void> {
  const rows = results.map((r) => ({
    event_id: eventId,
    player_id: r.player_id,
    position: r.position ?? null,
    raw: r.raw ?? null,
  }));
  const { error } = await client
    .from("event_results")
    .upsert(rows, { onConflict: "event_id,player_id" });
  if (error) throw new Error(`upsertEventResults: ${error.message}`);
}

export interface MultiplierInput {
  player_id: string;
  event_id: string;
  value: number;
}

/** Bulk-write a player's multipliers for whichever events are still unlocked. */
export async function upsertMultipliers(
  client: SupabaseClient,
  entries: MultiplierInput[],
): Promise<void> {
  const rows = entries.map((e) => ({
    player_id: e.player_id,
    event_id: e.event_id,
    value: e.value,
  }));
  const { error } = await client
    .from("multipliers")
    .upsert(rows, { onConflict: "player_id,event_id" });
  if (error) throw new Error(`upsertMultipliers: ${error.message}`);
}

/**
 * Replace one event's ranking in one go — the ranking editor always saves a
 * full 1..N ordering for that event (PRODUCT_SPEC.md → Overall betting →
 * Odds source), never a partial edit, so wipe-then-insert (scoped to this
 * event only — other events' rankings are untouched) is simpler and safer
 * than diffing against whatever was there before. Not atomic (two
 * round-trips), but this is a single-groom, low-concurrency admin action.
 */
export async function setEventRanking(
  client: SupabaseClient,
  eventId: string,
  ranking: { player_id: string; rank: number }[],
): Promise<void> {
  const { error: deleteError } = await client
    .from("event_rankings")
    .delete()
    .eq("event_id", eventId);
  if (deleteError) throw new Error(`setEventRanking (clear): ${deleteError.message}`);

  if (ranking.length === 0) return;
  const rows = ranking.map((r) => ({ ...r, event_id: eventId }));
  const { error: insertError } = await client.from("event_rankings").insert(rows);
  if (insertError) throw new Error(`setEventRanking (insert): ${insertError.message}`);
}

/**
 * Replace one bracket event's seed order — independent of `event_rankings`
 * (PRODUCT_SPEC.md → Event formats → Bracket): the groom can adjust bracket
 * seeding without that edit touching betting odds. Same wipe-then-insert
 * shape as `setEventRanking`.
 */
export async function setBracketSeeds(
  client: SupabaseClient,
  eventId: string,
  seeds: { player_id: string; seed: number }[],
): Promise<void> {
  const { error: deleteError } = await client
    .from("bracket_seeds")
    .delete()
    .eq("event_id", eventId);
  if (deleteError) throw new Error(`setBracketSeeds (clear): ${deleteError.message}`);

  if (seeds.length === 0) return;
  const rows = seeds.map((s) => ({ ...s, event_id: eventId }));
  const { error: insertError } = await client.from("bracket_seeds").insert(rows);
  if (insertError) throw new Error(`setBracketSeeds (insert): ${insertError.message}`);
}

/** Replace a bracket event's whole match tree in one go — used once, when
 * the tree is first generated from the seed order (src/lib/scoring/bracket.ts
 * → generateMainBracket). Later edits go through `recordBracketMatchResult`. */
export async function setBracketMatches(
  client: SupabaseClient,
  eventId: string,
  matches: BracketMatch[],
): Promise<void> {
  const { error: deleteError } = await client
    .from("bracket_matches")
    .delete()
    .eq("event_id", eventId);
  if (deleteError) throw new Error(`setBracketMatches (clear): ${deleteError.message}`);

  if (matches.length === 0) return;
  const rows = matches.map((m) => bracketMatchToRow(eventId, m));
  const { error: insertError } = await client.from("bracket_matches").insert(rows);
  if (insertError) throw new Error(`setBracketMatches (insert): ${insertError.message}`);
}

export function bracketMatchToRow(eventId: string, m: BracketMatch) {
  return {
    id: m.id,
    event_id: eventId,
    round: m.round,
    slot: m.slot,
    bracket_track: m.track,
    player_a_id: m.playerAId,
    player_b_id: m.playerBId,
    winner_id: m.winnerId,
    is_bye: m.isBye,
  };
}

export function bracketRowToMatch(r: BracketMatchRow): BracketMatch {
  return {
    id: r.id,
    round: r.round,
    slot: r.slot,
    track: r.bracket_track,
    playerAId: r.player_a_id,
    playerBId: r.player_b_id,
    winnerId: r.winner_id,
    isBye: r.is_bye,
  };
}

/**
 * Create or remove a bracket event's optional 3rd-/5th-place consolation
 * match (PRODUCT_SPEC.md → Event formats → Bracket) — existence of the row
 * IS the opt-in, no separate boolean. `players` supplies the two
 * participants when enabling (the two semifinal losers for `third_place`,
 * the top two seeds of the round-before-losers for `fifth_place` — the
 * caller works out who that is from the current match tree).
 */
export async function setConsolationMatch(
  client: SupabaseClient,
  eventId: string,
  track: Extract<BracketTrack, "third_place" | "fifth_place">,
  players: { playerAId: string; playerBId: string } | null,
): Promise<void> {
  const { error: deleteError } = await client
    .from("bracket_matches")
    .delete()
    .eq("event_id", eventId)
    .eq("bracket_track", track);
  if (deleteError) throw new Error(`setConsolationMatch (clear): ${deleteError.message}`);
  if (!players) return;

  const { error: insertError } = await client.from("bracket_matches").insert({
    id: crypto.randomUUID(),
    event_id: eventId,
    round: 1,
    slot: 1,
    bracket_track: track,
    player_a_id: players.playerAId,
    player_b_id: players.playerBId,
    winner_id: null,
    is_bye: false,
  });
  if (insertError) throw new Error(`setConsolationMatch (insert): ${insertError.message}`);
}

/**
 * Record one bracket match's winner: runs the pure cascade
 * (src/lib/scoring/bracket.ts → applyMatchResult) against the event's
 * current match rows, bulk-upserts the result, and — once the main bracket
 * (plus any resolved consolation matches) is fully decided — derives final
 * placements and upserts `event_results` immediately, so the existing
 * points-preview in EventCard stays live with no changes there.
 */
export async function recordBracketMatchResult(
  client: SupabaseClient,
  eventId: string,
  matchId: string,
  winnerId: string,
): Promise<void> {
  const { data, error } = await client
    .from("bracket_matches")
    .select("*")
    .eq("event_id", eventId);
  if (error) throw new Error(`recordBracketMatchResult (read): ${error.message}`);

  const matches = ((data ?? []) as BracketMatchRow[]).map(bracketRowToMatch);
  const updated = applyMatchResult(matches, matchId, winnerId);

  const { error: upsertError } = await client
    .from("bracket_matches")
    .upsert(updated.map((m) => bracketMatchToRow(eventId, m)), { onConflict: "id" });
  if (upsertError) throw new Error(`recordBracketMatchResult (write): ${upsertError.message}`);

  if (isMainBracketComplete(updated)) {
    const placements = deriveBracketPlacements(updated);
    await upsertEventResults(
      client,
      eventId,
      placements.map((p) => ({ player_id: p.playerId, position: p.position })),
    );
  }
}

/**
 * Replace a round-robin event's whole generated schedule in one go
 * (src/lib/scoring/roundRobinSchedule.ts → generateRoundRobinSchedule).
 * Wipe-then-insert, same shape as `setEventRanking` — the UI is responsible
 * for warning before regenerating once any match already has a result.
 */
export async function setRoundRobinSchedule(
  client: SupabaseClient,
  eventId: string,
  rounds: { round: number; teamA: string[]; teamB: string[] }[],
): Promise<void> {
  const { error: deleteError } = await client
    .from("round_robin_matches")
    .delete()
    .eq("event_id", eventId);
  if (deleteError) throw new Error(`setRoundRobinSchedule (clear): ${deleteError.message}`);

  if (rounds.length === 0) return;
  const rows = rounds.map((r) => ({
    event_id: eventId,
    round: r.round,
    team_a: r.teamA,
    team_b: r.teamB,
    winner: null,
  }));
  const { error: insertError } = await client.from("round_robin_matches").insert(rows);
  if (insertError) throw new Error(`setRoundRobinSchedule (insert): ${insertError.message}`);
}

/**
 * Append one more round to a round-robin event's existing schedule — a
 * plain insert, not the wipe-then-insert `setRoundRobinSchedule` does, so
 * every already-recorded result on earlier rounds is left untouched. The
 * caller (round-robin-schedule.tsx) derives the new round's matchups by
 * re-running `generateRoundRobinSchedule` up through the new round count
 * and taking only its last round — deterministic, so every earlier round
 * it recomputes along the way matches what's already stored.
 */
export async function addRoundRobinRound(
  client: SupabaseClient,
  eventId: string,
  matches: { round: number; teamA: string[]; teamB: string[] }[],
): Promise<void> {
  if (matches.length === 0) return;
  const rows = matches.map((m) => ({
    event_id: eventId,
    round: m.round,
    team_a: m.teamA,
    team_b: m.teamB,
    winner: null,
  }));
  const { error } = await client.from("round_robin_matches").insert(rows);
  if (error) throw new Error(`addRoundRobinRound: ${error.message}`);
}

/**
 * Record one round-robin match's winning team, then re-derive and re-upsert
 * `event_results` from the current win counts across the whole schedule
 * (src/lib/scoring/roundRobinScore.ts) — same "auto-sync on every tap"
 * pattern as `recordBracketMatchResult`.
 */
export async function recordRoundRobinMatchResult(
  client: SupabaseClient,
  eventId: string,
  matchId: string,
  winner: "a" | "b",
): Promise<void> {
  const { error: updateError } = await client
    .from("round_robin_matches")
    .update({ winner })
    .eq("id", matchId);
  if (updateError) throw new Error(`recordRoundRobinMatchResult (write): ${updateError.message}`);

  const { data, error: readError } = await client
    .from("round_robin_matches")
    .select("*")
    .eq("event_id", eventId);
  if (readError) throw new Error(`recordRoundRobinMatchResult (read): ${readError.message}`);

  const matches: RoundRobinMatchResult[] = ((data ?? []) as RoundRobinMatchRow[]).map((r) => ({
    teamA: r.team_a,
    teamB: r.team_b,
    winner: r.winner,
  }));
  const placements = deriveRoundRobinPlacements(matches);
  if (placements.length === 0) return;
  await upsertEventResults(
    client,
    eventId,
    placements.map((p) => ({ player_id: p.playerId, position: p.position })),
  );
}

/**
 * Record (or edit) one round of a best-of-rounds event's rankings, then
 * re-derive and re-upsert `event_results` from each player's best position
 * across every round recorded so far (src/lib/scoring/placementRounds.ts)
 * — same "auto-sync on every write" pattern as `recordBracketMatchResult`/
 * `recordRoundRobinMatchResult`. Scoped clear-then-insert on just this
 * round (not the whole event), so adding round 2 never touches round 1,
 * and re-saving round 1 later only replaces round 1's own rows.
 */
export async function recordPlacementRound(
  client: SupabaseClient,
  eventId: string,
  round: number,
  entries: { player_id: string; position: number }[],
): Promise<void> {
  const { error: deleteError } = await client
    .from("placement_rounds")
    .delete()
    .eq("event_id", eventId)
    .eq("round", round);
  if (deleteError) throw new Error(`recordPlacementRound (clear): ${deleteError.message}`);

  if (entries.length > 0) {
    const rows = entries.map((e) => ({ event_id: eventId, round, player_id: e.player_id, position: e.position }));
    const { error: insertError } = await client.from("placement_rounds").insert(rows);
    if (insertError) throw new Error(`recordPlacementRound (insert): ${insertError.message}`);
  }

  const { data, error: readError } = await client
    .from("placement_rounds")
    .select("*")
    .eq("event_id", eventId);
  if (readError) throw new Error(`recordPlacementRound (read): ${readError.message}`);

  const placements = bestAcrossRounds(
    ((data ?? []) as PlacementRoundRow[]).map((r) => ({
      round: r.round,
      playerId: r.player_id,
      position: r.position,
    })),
  );
  if (placements.length === 0) return;
  await upsertEventResults(
    client,
    eventId,
    placements.map((p) => ({ player_id: p.playerId, position: p.position })),
  );
}

export interface NewOverallBet {
  player_id: string;
  bet_type: "win" | "top3";
  pick_player_id: string;
}

/**
 * Place a new overall bet — PRODUCT_SPEC.md → Overall betting. One row per
 * (player, bet_type); the UI is responsible for offering "switch" instead
 * of a second placement once one exists for that type, since a duplicate
 * insert isn't rejected at the DB level (no unique constraint on
 * player_id+bet_type in 0001_init.sql).
 */
export async function placeOverallBet(
  client: SupabaseClient,
  bet: NewOverallBet,
): Promise<OverallBetRow> {
  const { data, error } = await client
    .from("overall_bets")
    .insert(bet)
    .select()
    .single();
  if (error) throw new Error(`placeOverallBet: ${error.message}`);
  return data as OverallBetRow;
}

/**
 * Switch an existing bet to a new pick — only offered once the current pick
 * is mathematically eliminated (PRODUCT_SPEC.md → Switching picks). Each
 * switch halves the eventual payout (src/lib/betting/overall.ts →
 * overallPayoutValue), so `switches` is incremented here, not left for the
 * caller to compute and pass in — avoids a stale-read race between reading
 * the current count and writing the new one.
 */
export async function switchOverallBetPick(
  client: SupabaseClient,
  betId: string,
  newPickPlayerId: string,
): Promise<OverallBetRow> {
  const { data: current, error: fetchError } = await client
    .from("overall_bets")
    .select("switches")
    .eq("id", betId)
    .single();
  if (fetchError) throw new Error(`switchOverallBetPick (read): ${fetchError.message}`);

  const { data, error } = await client
    .from("overall_bets")
    .update({ pick_player_id: newPickPlayerId, switches: (current.switches as number) + 1 })
    .eq("id", betId)
    .select()
    .single();
  if (error) throw new Error(`switchOverallBetPick (write): ${error.message}`);
  return data as OverallBetRow;
}

export interface NewPerEventBet {
  player_id: string;
  event_id: string;
  pick_player_id: string;
  target: "win" | "place";
  wager: number;
}

/**
 * Place a per-event multiplier bet — PRODUCT_SPEC.md → Per-event multiplier
 * betting. Escrows `wager` out of the player's unallocated multiplier
 * reserve (src/lib/betting/reserve.ts), not out of any specific event's own
 * multiplier value. The UI is responsible for only offering this while the
 * event is still "planned" (bets close once it starts) and for capping the
 * wager at the bettor's current reserve — same "no DB constraint,
 * UI-enforced" pattern as overall bets.
 */
export async function placePerEventBet(
  client: SupabaseClient,
  bet: NewPerEventBet,
): Promise<PerEventBetRow> {
  const { data, error } = await client
    .from("per_event_bets")
    .insert(bet)
    .select()
    .single();
  if (error) throw new Error(`placePerEventBet: ${error.message}`);
  return data as PerEventBetRow;
}

export type PerEventBetPatch = Partial<
  Pick<NewPerEventBet, "pick_player_id" | "target" | "wager">
>;

/**
 * Change an open per-event bet's pick, target, or wager. Same "UI-enforced,
 * no DB constraint" pattern as placing one — the caller is responsible for
 * only offering this while the bet is still "open" and its event still
 * "planned" (PRODUCT_SPEC.md: betting closes once the event starts), and
 * for capping a new wager amount against the player's current reserve
 * (src/lib/betting/reserve.ts), remembering to add the bet's *own* current
 * wager back first since that's what's being replaced, not added to.
 */
export async function updatePerEventBet(
  client: SupabaseClient,
  betId: string,
  patch: PerEventBetPatch,
): Promise<PerEventBetRow> {
  const { data, error } = await client
    .from("per_event_bets")
    .update(patch)
    .eq("id", betId)
    .select()
    .single();
  if (error) throw new Error(`updatePerEventBet: ${error.message}`);
  return data as PerEventBetRow;
}

/** Cancel an open per-event bet outright — the wagered amount returns to
 * the player's betting reserve immediately (it was never spent). */
export async function cancelPerEventBet(client: SupabaseClient, betId: string): Promise<void> {
  const { error } = await client.from("per_event_bets").delete().eq("id", betId);
  if (error) throw new Error(`cancelPerEventBet: ${error.message}`);
}

/**
 * (Re-)settle every LIVE per-event bet on one just-finalized event — "live"
 * meaning anything except "void" (a bet voided by its event being
 * cancelled, which is a separate, terminal path that this must not
 * disturb). Reads those bets and the event's ranking, runs the pure
 * resolution logic (src/lib/betting/resolvePerEventBets.ts — a deliberate
 * exception to this file's "no business logic" rule, same as
 * switchOverallBetPick's read-then-write above: the alternative is
 * duplicating the fetch/write plumbing at every call site), and writes the
 * outcomes back. Called right after `upsertEventResults` +
 * `setEventStatus(..., "resolved")` in the event-finalize flow.
 *
 * Deliberately NOT filtered to `status = "open"`. This function is called
 * on every finalize, including a re-finalize after the groom edits results
 * on an already-resolved event ("Edit results" → change the order → Save →
 * Finalize again) — and the second time through, every bet on this event is
 * already "won" or "lost" from the first pass. Filtering to "open" here
 * meant a re-finalize found nothing to do and silently left every bet's
 * status/payout stuck on the OLD results — a real bug, reported directly
 * ("the bets don't reassess if I edit and refinalize"). The pure resolution
 * function recomputes status and payout fresh from the current
 * `finalResults` every time regardless of a bet's prior status, so re-
 * reading and re-writing every live bet here is exactly as correct on a
 * re-finalize as it is on the first one — this whole function is
 * idempotent, not just first-run-safe.
 */
export async function resolvePerEventBets(
  client: SupabaseClient,
  event: EventRow,
  finalResults: EventResultInput[],
): Promise<void> {
  const eventId = event.id;
  const { data: liveBets, error: betsError } = await client
    .from("per_event_bets")
    .select("*")
    .eq("event_id", eventId)
    .in("status", ["open", "won", "lost"]);
  if (betsError) throw new Error(`resolvePerEventBets (read bets): ${betsError.message}`);
  if (!liveBets || liveBets.length === 0) return;

  const { data: rankingRows, error: rankingError } = await client
    .from("event_rankings")
    .select("*")
    .eq("event_id", eventId);
  if (rankingError) throw new Error(`resolvePerEventBets (read ranking): ${rankingError.message}`);

  // Takes the whole event row, not just an id, because an absolute-scored
  // event stores a raw measurement rather than a position — deriving "who
  // won / who made the top 3" needs the scoring mode and lower_is_better.
  // This used to read `r.position` straight off the results, which is null
  // for every absolute event, so the caller guarded the whole call behind
  // `if (isPlacement)` and bets on the golf never settled at all.
  const positions = finishingPositions(event, [
    ...finalResults.map((r) => ({
      player_id: r.player_id,
      position: r.position ?? null,
      raw: r.raw ?? null,
    })),
  ]);
  const eventRanking = (rankingRows ?? []).map((r) => ({
    playerId: r.player_id as string,
    rank: r.rank as number,
  }));

  const outcomes = resolveOpenPerEventBets(
    (liveBets as PerEventBetRow[]).map((b) => ({
      id: b.id,
      pickPlayerId: b.pick_player_id,
      target: b.target,
      wager: b.wager,
    })),
    positions,
    eventRanking,
  );

  for (const outcome of outcomes) {
    const { error } = await client
      .from("per_event_bets")
      .update({ status: outcome.status, payout: outcome.payout })
      .eq("id", outcome.id);
    if (error) throw new Error(`resolvePerEventBets (write ${outcome.id}): ${error.message}`);
  }
}

/**
 * Settle any per-event bet that is still "open" on an event that has
 * already resolved.
 *
 * A repair path, not a normal one: the finalize flow settles bets as part of
 * finalizing (resolvePerEventBets above). But bets placed on absolute-scored
 * events were skipped entirely until 2026-08-24, and any bet stranded that
 * way stays open forever — the wager escrowed, the payout never paid, on an
 * event whose result is long since known. Nothing in the normal flow ever
 * revisits a resolved event, so without this those bets need a manual
 * database edit to clear.
 *
 * Safe to call on every load of the events screen: it reads nothing but
 * already-final data, is a no-op when there is nothing stranded, and is
 * deterministic — settling the same bet twice from the same results produces
 * the same answer, and the second call finds no open bets anyway.
 */
export async function settleStrandedPerEventBets(client: SupabaseClient): Promise<void> {
  const { data: openBets, error: betsError } = await client
    .from("per_event_bets")
    .select("*")
    .eq("status", "open");
  if (betsError) throw new Error(`settleStrandedPerEventBets (read bets): ${betsError.message}`);
  if (!openBets || openBets.length === 0) return;

  const strandedEventIds = [...new Set((openBets as PerEventBetRow[]).map((b) => b.event_id))];
  const { data: eventRows, error: eventsError } = await client
    .from("events")
    .select("*")
    .in("id", strandedEventIds)
    .eq("status", "resolved");
  if (eventsError) throw new Error(`settleStrandedPerEventBets (read events): ${eventsError.message}`);
  if (!eventRows || eventRows.length === 0) return;

  for (const event of eventRows as EventRow[]) {
    const { data: resultRows, error: resultsError } = await client
      .from("event_results")
      .select("*")
      .eq("event_id", event.id);
    if (resultsError) {
      throw new Error(`settleStrandedPerEventBets (read results): ${resultsError.message}`);
    }
    if (!resultRows || resultRows.length === 0) continue;

    await resolvePerEventBets(
      client,
      event,
      (resultRows as EventResultRow[]).map((r) => ({
        player_id: r.player_id,
        position: r.position,
        raw: r.raw,
      })),
    );
  }
}

/**
 * Settle every open overall bet, but ONLY once the weekend has actually
 * ended — every event has resolved (cancelled events are hard-deleted per
 * PRODUCT_SPEC.md → Cancelled events, so they never linger in a
 * not-yet-resolved state). A no-op otherwise, so it's safe to call after
 * every single event finalize (src/components/event-card.tsx does exactly
 * that) without needing a separate "end the weekend" step — it naturally
 * fires for real on whichever finalize happens to be the last one, and any
 * call after that finds zero still-open bets and does nothing.
 *
 * Final standings include bonus-event points (`applyBonusAwards`) — same
 * total a player would see on the medal table — since a bet is about who
 * actually finishes where, not just raw event scoring.
 */
export async function settleOverallBetsIfWeekendOver(client: SupabaseClient): Promise<void> {
  const { data: events, error: eventsError } = await client.from("events").select("*");
  if (eventsError) throw new Error(`settleOverallBets (read events): ${eventsError.message}`);
  if (!events || events.length === 0) return;
  const weekendOver = (events as EventRow[]).every((e) => e.status === "resolved");
  if (!weekendOver) return;

  const { data: openBets, error: betsError } = await client
    .from("overall_bets")
    .select("*")
    .eq("status", "open");
  if (betsError) throw new Error(`settleOverallBets (read bets): ${betsError.message}`);
  if (!openBets || openBets.length === 0) return;

  const [
    { data: results, error: resultsError },
    { data: multipliers, error: multipliersError },
    { data: bonusEvents, error: bonusError },
    { data: players, error: playersError },
  ] = await Promise.all([
    client.from("event_results").select("*"),
    client.from("multipliers").select("*"),
    client.from("bonus_events").select("*"),
    client.from("players").select("id"),
  ]);
  if (resultsError) throw new Error(`settleOverallBets (read results): ${resultsError.message}`);
  if (multipliersError) throw new Error(`settleOverallBets (read multipliers): ${multipliersError.message}`);
  if (bonusError) throw new Error(`settleOverallBets (read bonus events): ${bonusError.message}`);
  if (playersError) throw new Error(`settleOverallBets (read players): ${playersError.message}`);

  const scoreLines = deriveScoreLines(
    events as EventRow[],
    (results ?? []) as EventResultRow[],
    (multipliers ?? []) as MultiplierRow[],
    ((players ?? []) as { id: string }[]).map((p) => p.id),
  );
  const bonusAwards = ((bonusEvents ?? []) as BonusEventRow[])
    .filter((b) => b.winner_player_id)
    .map((b) => ({ playerId: b.winner_player_id as string, points: b.points }));
  const finalStandings = applyBonusAwards(standings(scoreLines), bonusAwards).map((t) => ({
    playerId: t.playerId,
    adjusted: t.adjusted,
  }));

  const outcomes = settleOverallBets(
    (openBets as OverallBetRow[]).map((b) => ({
      id: b.id,
      betType: b.bet_type,
      pickPlayerId: b.pick_player_id,
      switches: b.switches,
    })),
    finalStandings,
  );

  for (const outcome of outcomes) {
    const { error } = await client
      .from("overall_bets")
      .update({ status: outcome.status, payout: outcome.payout })
      .eq("id", outcome.id);
    if (error) throw new Error(`settleOverallBets (write ${outcome.id}): ${error.message}`);
  }
}

export interface NewBonusEvent {
  name: string;
  winner_player_id: string;
  points?: number;
}

/**
 * Award a spontaneous, on-the-fly bonus event — PRODUCT_SPEC.md → Event-
 * specific structure. Deliberately outside the core scoring/betting system
 * (no odds, no multiplier, no elimination-math effect); its points still
 * land on the medal table via src/lib/bonus/bonusEvent.ts's
 * `applyBonusAwards`. Winner is chosen at award time — there's no separate
 * "create, then resolve later" step, matching how spontaneous this is meant
 * to be.
 */
export async function createBonusEvent(
  client: SupabaseClient,
  bonus: NewBonusEvent,
): Promise<BonusEventRow> {
  const { data, error } = await client
    .from("bonus_events")
    .insert(bonus)
    .select()
    .single();
  if (error) throw new Error(`createBonusEvent: ${error.message}`);
  return data as BonusEventRow;
}

export interface BonusEventPatch {
  name?: string;
  winner_player_id?: string;
  points?: number;
}

/** Edit an already-awarded bonus event in place — same shape as creating one. */
export async function updateBonusEvent(
  client: SupabaseClient,
  bonusEventId: string,
  patch: BonusEventPatch,
): Promise<BonusEventRow> {
  const { data, error } = await client
    .from("bonus_events")
    .update(patch)
    .eq("id", bonusEventId)
    .select()
    .single();
  if (error) throw new Error(`updateBonusEvent: ${error.message}`);
  return data as BonusEventRow;
}

/** Remove a bonus event entirely — its points stop counting immediately. */
export async function removeBonusEvent(
  client: SupabaseClient,
  bonusEventId: string,
): Promise<void> {
  const { error } = await client.from("bonus_events").delete().eq("id", bonusEventId);
  if (error) throw new Error(`removeBonusEvent: ${error.message}`);
}

/** Set the shared boot-screen video (docs/VISUAL_SPEC.md) — one asset for the whole app. */
export async function setBootVideo(client: SupabaseClient, url: string | null): Promise<void> {
  const { error } = await client
    .from("app_settings")
    .update({ boot_video_url: url })
    .eq("id", 1);
  if (error) throw new Error(`setBootVideo: ${error.message}`);
}
