"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { PlayerName } from "@/components/player-name";
import { PlacedBetsTable } from "@/components/placed-bets-table";
import { WagerStepper } from "@/components/wager-stepper";
import { RankBadge, ROSTER_CELL, ROSTER_HEAD_CELL, ROSTER_HEAD_ROW, rosterRowClass } from "@/components/n64/roster-table";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  cancelPerEventBet,
  placePerEventBet,
  updatePerEventBet,
} from "@/lib/data/mutations";
import type { BettingReserve } from "@/lib/betting/reserve";
import {
  payoutMultipliers,
  perEventPayoutMultiplierOrNull,
  type RankingEntry,
} from "@/lib/odds/ranking";
import { fitsBudget, stepAmount, stepsWithin } from "@/lib/multipliers/budget";
import type { EventRow, PerEventBetRow, PlayerRow } from "@/lib/data/database.types";

// `w-full` (not a fixed pixel width) — the column itself is what's fixed
// now (`table-fixed` + a `th` width below), so the button/text inside just
// fills whatever the column gives it. A fixed `w-16` on the control itself
// was the old flex-row layout's trick and overflowed a 390px phone once
// this became a real `<table>`: two 64px buttons plus a rank badge plus an
// unclipped name comfortably exceed the ~326px this panel actually has.
const ODDS_CELL_CLASS = "w-full text-center tabular-nums";

/** Odds tab: this event's own ranking as win/place payout odds, in rank
 * order (1 at top) — and, while the event is still "planned," the wager
 * form to bet on any player's win/place outcome (PRODUCT_SPEC.md →
 * Per-event multiplier betting). Wagers draw from the player's unallocated
 * multiplier reserve, not this event's own multiplier. Mirrors the
 * edit/cancel pattern src/app/bets/page.tsx already has for the same
 * per_event_bets row. */
export function EventOddsBetting({
  event,
  ranking,
  players,
  colorByPlayer,
  currentPlayerId,
  myBet,
  reserve,
}: {
  event: EventRow;
  ranking: RankingEntry[];
  players: Map<string, PlayerRow>;
  colorByPlayer: Record<string, string>;
  currentPlayerId: string | null;
  myBet: PerEventBetRow | undefined;
  reserve: BettingReserve | null;
}) {
  const [pick, setPick] = useState<string | null>(null);
  const [target, setTarget] = useState<PerEventBetRow["target"]>("win");
  // A number, not a text draft: the amount is stepped rather than typed
  // (WagerStepper), so there is no in-between "1." string state to model.
  const [wager, setWager] = useState(0);
  const [editingBet, setEditingBet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (ranking.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        The groom hasn&apos;t ranked this event yet — no odds until then.
      </p>
    );
  }

  const payouts = payoutMultipliers(ranking);
  const order = [...ranking].sort((a, b) => a.rank - b.rank);
  const isEditing = editingBet && myBet != null;
  const showForm = event.status === "planned" && !!currentPlayerId && (!myBet || isEditing);
  // Editing doesn't cost anything on top of the existing wager — it's
  // replacing it, not adding to it — so add this bet's own current wager
  // back to what's otherwise available before capping the new amount.
  const maxWager = reserve
    ? Math.max(0, reserve.available) + (isEditing && myBet ? myBet.wager : 0)
    : 0;
  const odds = pick ? perEventPayoutMultiplierOrNull(ranking, pick, target) : null;
  // `fitsBudget`, not `wager <= maxWager`: maxWager is a derived reserve and
  // arrives float-dirty (0.2999999999999998 for what the screen calls 0.3),
  // so a straight comparison rejects the top step the stepper offers.
  const hasValidWager = wager > 0 && fitsBudget(wager, maxWager);
  const payoutPreview = odds != null && hasValidWager ? wager * odds : null;

  function selectPick(playerId: string, nextTarget: PerEventBetRow["target"]) {
    setPick(playerId);
    setTarget(nextTarget);
    // Picking someone with nothing staked yet leaves the form in a state
    // where the only enabled control is a "+" — so the first pick seeds one
    // step, which is both the minimum legal wager and a real default. Once
    // there is an amount, changing your mind about the pick leaves it alone.
    setWager((w) => (w > 0 ? w : stepAmount(Math.min(1, stepsWithin(maxWager)))));
  }

  function startEditing() {
    if (!myBet) return;
    setError(null);
    setEditingBet(true);
    setPick(myBet.pick_player_id);
    setTarget(myBet.target);
    setWager(myBet.wager);
  }

  function discardEditing() {
    setEditingBet(false);
    setPick(null);
    setWager(0);
  }

  async function handleWager() {
    if (!currentPlayerId || !pick || !hasValidWager) return;
    setBusy(true);
    setError(null);
    try {
      if (isEditing && myBet) {
        await updatePerEventBet(getSupabaseBrowserClient(), myBet.id, {
          pick_player_id: pick,
          target,
          wager,
        });
        setEditingBet(false);
      } else {
        await placePerEventBet(getSupabaseBrowserClient(), {
          player_id: currentPlayerId,
          event_id: event.id,
          pick_player_id: pick,
          target,
          wager,
        });
      }
      setPick(null);
      setWager(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelBet() {
    if (!myBet) return;
    setBusy(true);
    setError(null);
    try {
      await cancelPerEventBet(getSupabaseBrowserClient(), myBet.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Same row language as the leaderboard's Standings table
          (roster-table.tsx) — a real `<table>`, the colour-coded rank chip,
          alternating row tint, `px-3 py-2` rows tall enough for a button to
          sit in comfortably. This used to be its own thing (bordered divs,
          a plain grey rank number), one more table in the app not styled
          like the others for no reason. */}
      <div className="bevel-sunken bg-sunken overflow-hidden rounded-md">
        {/* `table-fixed` with explicit widths on every column but the
            player's — a phone doesn't have room for auto layout to size two
            odds columns AND an unclipped name off their natural content
            width, which is what actually overflowed the viewport here. The
            name column gets whatever's left and truncates. */}
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr className={ROSTER_HEAD_ROW}>
              <th scope="col" className={cn(ROSTER_HEAD_CELL, "w-10 text-left")} />
              <th scope="col" className={cn(ROSTER_HEAD_CELL, "text-left")} />
              <th scope="col" className={cn(ROSTER_HEAD_CELL, "w-16 text-right")}>
                Win
              </th>
              <th scope="col" className={cn(ROSTER_HEAD_CELL, "w-16 text-right")}>
                Place
              </th>
            </tr>
          </thead>
          <tbody>
            {order.map(({ playerId, rank }, i) => {
              const player = players.get(playerId);
              const mult = payouts.get(playerId);
              if (!player || !mult) return null;
              const isPick = pick === playerId;
              // Can't bet on yourself — PRODUCT_SPEC.md → Per-event
              // multiplier betting, matching overall betting's own rule
              // (overall-betting.tsx). This used to be allowed here
              // specifically; the spec's own history note explains why that
              // changed.
              const isSelf = playerId === currentPlayerId;
              const canPickRow = showForm && !isSelf;

              return (
                <tr
                  key={playerId}
                  className={rosterRowClass(i, isPick && "bg-primary/10")}
                >
                  <td className={ROSTER_CELL}>
                    <RankBadge rank={rank} color={colorByPlayer[playerId] ?? "var(--muted)"} />
                  </td>
                  <td className={cn(ROSTER_CELL, "max-w-0")}>
                    <span className="flex min-w-0 items-center gap-1.5">
                      <PlayerName
                        name={player.name}
                        state={player.state ?? "??"}
                        size="sm"
                        photoUrl={player.photo_url}
                        color={colorByPlayer[playerId]}
                      />
                      {isSelf ? (
                        <span className="hud-label text-muted-foreground shrink-0">You</span>
                      ) : null}
                    </span>
                  </td>
                  <td className={cn(ROSTER_CELL, "text-right")}>
                    {canPickRow ? (
                      <Button
                        size="sm"
                        variant={isPick && target === "win" ? "default" : "secondary"}
                        className={ODDS_CELL_CLASS}
                        onClick={() => selectPick(playerId, "win")}
                      >
                        {mult.win.toFixed(1)}x
                      </Button>
                    ) : (
                      <span className={cn("text-muted-foreground text-xs", ODDS_CELL_CLASS)}>
                        {mult.win.toFixed(1)}x
                      </span>
                    )}
                  </td>
                  <td className={cn(ROSTER_CELL, "text-right")}>
                    {canPickRow ? (
                      <Button
                        size="sm"
                        variant={isPick && target === "place" ? "default" : "secondary"}
                        className={ODDS_CELL_CLASS}
                        onClick={() => selectPick(playerId, "place")}
                      >
                        {mult.top3.toFixed(1)}x
                      </Button>
                    ) : (
                      <span className={cn("text-muted-foreground text-xs", ODDS_CELL_CLASS)}>
                        {mult.top3.toFixed(1)}x
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {myBet || showForm ? (
        <div className="bevel-sunken bg-sunken flex flex-col gap-2 rounded-md p-3">
          <span className="hud-label text-muted-foreground">
            {myBet ? "Your bet" : "Place a bet"}
          </span>

          {myBet && !isEditing ? (
            /* The same table every other bet listing in the app uses, rather
               than this screen's own sentence — one bet or twenty, a wager
               reads as a row of figures you can compare. */
            <PlacedBetsTable
              framed={false}
              colorByPlayer={colorByPlayer}
              onEdit={startEditing}
              bets={[
                {
                  id: myBet.id,
                  pick: players.get(myBet.pick_player_id) ?? null,
                  target: myBet.target,
                  odds: perEventPayoutMultiplierOrNull(ranking, myBet.pick_player_id, myBet.target),
                  wager: myBet.wager,
                  status: myBet.status,
                  payout: myBet.payout,
                  canEdit: myBet.status === "open" && event.status === "planned",
                  busy,
                },
              ]}
            />
          ) : showForm ? (
            <div className="flex flex-col gap-2">
              {error ? <p className="text-destructive text-sm">{error}</p> : null}
              {/* Label row and value row share the same column widths
                  (Wager / Odds / Payout, `gap-4` between each) so the
                  labels line up directly over their values — Payout used
                  to sit lower than Wager because they were two independent
                  flex columns of different heights, bottom-aligned
                  (`items-end`) rather than sharing a real grid. `items-center`
                  on the value row centers the Odds/Payout text and the
                  Wager/Discard buttons against the tallest thing in the
                  row (the Input), instead of everything sitting on its own
                  baseline. The trailing button group has no label of its
                  own, and is the one thing allowed to wrap onto its own
                  line on a narrow phone when editing shows two buttons. */}
              {/* Stake on its own row with the two derived figures beside
                  it. The stepper is ~150px wide on its own, so the old
                  three-column label/value grid (which assumed a 112px text
                  field) no longer fits a 390px phone — labels sit directly on
                  each figure instead of in a separate header row. */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="hud-label text-muted-foreground">Stake</span>
                  <WagerStepper value={wager} max={maxWager} onChange={setWager} disabled={busy} />
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="hud-label text-muted-foreground">Odds</span>
                    <span className="font-score text-base leading-9 tabular-nums">
                      {odds != null ? `${odds.toFixed(1)}×` : "—"}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="hud-label text-muted-foreground">To win</span>
                    <span className="font-score text-primary text-base leading-9 tabular-nums">
                      {payoutPreview != null ? payoutPreview.toFixed(1) : "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  className="flex-1"
                  onClick={handleWager}
                  disabled={busy || !pick || !hasValidWager}
                >
                  {isEditing ? "Save changes" : "Place wager"}
                </Button>
                {isEditing ? (
                  <>
                    <Button variant="outline" onClick={discardEditing} disabled={busy}>
                      Discard
                    </Button>
                    {/* Cancelling the bet outright lives in the editor now,
                        not as a trash icon on the row — see PlacedBetsTable's
                        own note on why that icon came out. */}
                    <Button
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={handleCancelBet}
                      disabled={busy}
                    >
                      Delete bet
                    </Button>
                  </>
                ) : null}
              </div>

              <span className="text-muted-foreground text-xs">
                {reserve
                  ? `${maxWager.toFixed(1)} available to stake · ${reserve.tiedUp.toFixed(1)} tied up in open wagers`
                  : null}
              </span>
            </div>
          ) : null}
        </div>
      ) : !currentPlayerId && event.status === "planned" ? (
        <p className="text-muted-foreground text-sm">
          Pick who you are on Setup to place a bet.
        </p>
      ) : null}
    </div>
  );
}
