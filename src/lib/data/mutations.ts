/**
 * Supabase writes for the game tables. Thin wrappers only, same rule as
 * src/lib/data/queries.ts — no business logic here.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveOpenPerEventBets } from "@/lib/betting/resolvePerEventBets";
import { settleOverallBets } from "@/lib/betting/settleOverallBets";
import { applyBonusAwards } from "@/lib/bonus/bonusEvent";
import { deriveScoreLines } from "@/lib/scoring/fromRows";
import { standings } from "@/lib/scoring/total";
import type {
  BonusEventRow,
  EventResultRow,
  EventRow,
  EventStatus,
  MultiplierRow,
  OverallBetRow,
  PerEventBetRow,
  PlayerRow,
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
  const rows = orderedEventIds.map((id, i) => ({ id, sort_order: i }));
  const { error } = await client.from("events").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`reorderEvents: ${error.message}`);
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

/**
 * Settle every open per-event bet on one just-finalized event. Reads the
 * open bets and that event's ranking, runs the pure resolution logic
 * (src/lib/betting/resolvePerEventBets.ts — a deliberate exception to this
 * file's "no business logic" rule, same as switchOverallBetPick's
 * read-then-write above: the alternative is duplicating the fetch/write
 * plumbing at every call site), and writes the outcomes back. Called right
 * after `upsertEventResults` + `setEventStatus(..., "resolved")` in the
 * event-finalize flow.
 */
export async function resolvePerEventBets(
  client: SupabaseClient,
  eventId: string,
  finalResults: EventResultInput[],
): Promise<void> {
  const { data: openBets, error: betsError } = await client
    .from("per_event_bets")
    .select("*")
    .eq("event_id", eventId)
    .eq("status", "open");
  if (betsError) throw new Error(`resolvePerEventBets (read bets): ${betsError.message}`);
  if (!openBets || openBets.length === 0) return;

  const { data: rankingRows, error: rankingError } = await client
    .from("event_rankings")
    .select("*")
    .eq("event_id", eventId);
  if (rankingError) throw new Error(`resolvePerEventBets (read ranking): ${rankingError.message}`);

  const finishingPositions = new Map(
    finalResults.map((r) => [r.player_id, r.position ?? null]),
  );
  const eventRanking = (rankingRows ?? []).map((r) => ({
    playerId: r.player_id as string,
    rank: r.rank as number,
  }));

  const outcomes = resolveOpenPerEventBets(
    (openBets as PerEventBetRow[]).map((b) => ({
      id: b.id,
      pickPlayerId: b.pick_player_id,
      target: b.target,
      wager: b.wager,
    })),
    finishingPositions,
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
  ] = await Promise.all([
    client.from("event_results").select("*"),
    client.from("multipliers").select("*"),
    client.from("bonus_events").select("*"),
  ]);
  if (resultsError) throw new Error(`settleOverallBets (read results): ${resultsError.message}`);
  if (multipliersError) throw new Error(`settleOverallBets (read multipliers): ${multipliersError.message}`);
  if (bonusError) throw new Error(`settleOverallBets (read bonus events): ${bonusError.message}`);

  const scoreLines = deriveScoreLines(
    events as EventRow[],
    (results ?? []) as EventResultRow[],
    (multipliers ?? []) as MultiplierRow[],
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

/**
 * Spend the groom's one-time power move — PRODUCT_SPEC.md → Extras. A
 * manual, freeform admin action (the spec deliberately keeps the mechanic
 * undefined — "the fun is in the surprise and timing"): this just records
 * that it happened, with a note for what the groom did, and when. Can only
 * be used once — the UI is responsible for checking `used` first and
 * hiding the control once it's true.
 */
export async function spendPowerMove(client: SupabaseClient, note: string): Promise<void> {
  const { error } = await client
    .from("power_move")
    .update({ used: true, note: note || null, used_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error(`spendPowerMove: ${error.message}`);
}

/** Set the shared app theme — applies live to every device via Realtime. */
export async function setTheme(client: SupabaseClient, themeId: string): Promise<void> {
  const { error } = await client
    .from("app_settings")
    .update({ theme_id: themeId })
    .eq("id", 1);
  if (error) throw new Error(`setTheme: ${error.message}`);
}
