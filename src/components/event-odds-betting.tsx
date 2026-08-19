"use client";

import { useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { PlayerName } from "@/components/player-name";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  cancelPerEventBet,
  placePerEventBet,
  updatePerEventBet,
} from "@/lib/data/mutations";
import type { BettingReserve } from "@/lib/betting/reserve";
import {
  payoutMultipliers,
  perEventPayoutMultiplier,
  type RankingEntry,
} from "@/lib/odds/ranking";
import { MULTIPLIER_STEP } from "@/lib/multipliers/budget";
import type { EventRow, PerEventBetRow, PlayerRow } from "@/lib/data/database.types";

const TARGET_LABEL: Record<PerEventBetRow["target"], string> = {
  win: "win",
  place: "place top 3",
};

// Fixed width for the win/place odds cells so the button/text in each row
// lines up under its column header regardless of digit count (e.g. "2.3x"
// vs. "12.4x"). text-center (not justify-center) so it centers a plain
// <span>'s text too, not just a flex Button's content.
const ODDS_CELL_CLASS = "w-16 shrink-0 text-center tabular-nums";

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
  currentPlayerId,
  myBet,
  reserve,
}: {
  event: EventRow;
  ranking: RankingEntry[];
  players: Map<string, PlayerRow>;
  currentPlayerId: string | null;
  myBet: PerEventBetRow | undefined;
  reserve: BettingReserve | null;
}) {
  const [pick, setPick] = useState<string | null>(null);
  const [target, setTarget] = useState<PerEventBetRow["target"]>("win");
  const [wager, setWager] = useState("");
  const [editingBet, setEditingBet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wagerInputRef = useRef<HTMLInputElement>(null);

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
  const odds = pick ? perEventPayoutMultiplier(ranking, pick, target) : null;
  const wagerNum = Number(wager);
  const hasValidWager = Number.isFinite(wagerNum) && wagerNum > 0;
  const payoutPreview = odds != null && hasValidWager ? wagerNum * odds : null;

  function selectPick(playerId: string, nextTarget: PerEventBetRow["target"]) {
    setPick(playerId);
    setTarget(nextTarget);
    // Picking a player/target is step one of placing a bet — jump straight
    // to the wager field next, rather than making them hunt for it below.
    wagerInputRef.current?.focus();
    wagerInputRef.current?.select();
  }

  function startEditing() {
    if (!myBet) return;
    setError(null);
    setEditingBet(true);
    setPick(myBet.pick_player_id);
    setTarget(myBet.target);
    setWager(String(myBet.wager));
  }

  function discardEditing() {
    setEditingBet(false);
    setPick(null);
    setWager("");
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
          wager: wagerNum,
        });
        setEditingBet(false);
      } else {
        await placePerEventBet(getSupabaseBrowserClient(), {
          player_id: currentPlayerId,
          event_id: event.id,
          pick_player_id: pick,
          target,
          wager: wagerNum,
        });
      }
      setPick(null);
      setWager("");
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
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2 px-2">
          <span aria-hidden />
          <div className="flex items-center gap-4">
            <span
              className={cn(
                "font-display text-muted-foreground text-[10px] tracking-wide uppercase",
                ODDS_CELL_CLASS,
              )}
            >
              Win
            </span>
            <span
              className={cn(
                "font-display text-muted-foreground text-[10px] tracking-wide uppercase",
                ODDS_CELL_CLASS,
              )}
            >
              Place
            </span>
          </div>
        </div>

        {order.map(({ playerId }, i) => {
          const player = players.get(playerId);
          const mult = payouts.get(playerId);
          if (!player || !mult) return null;
          const isPick = pick === playerId;
          return (
            <div
              key={playerId}
              className={cn(
                "flex flex-wrap items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm",
                isPick && "border-primary bg-primary/5",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="text-muted-foreground w-4 text-right text-xs tabular-nums">
                  {i + 1}
                </span>
                <PlayerName
                  name={player.name}
                  state={player.state ?? "??"}
                  size="sm"
                  photoUrl={player.photo_url}
                />
              </span>
              <div className="flex items-center gap-4">
                {showForm ? (
                  <Button
                    size="sm"
                    variant={isPick && target === "win" ? "default" : "outline"}
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
                {showForm ? (
                  <Button
                    size="sm"
                    variant={isPick && target === "place" ? "default" : "outline"}
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
              </div>
            </div>
          );
        })}
      </div>

      {myBet || showForm ? (
        <div className="bevel-sunken bg-sunken flex flex-col gap-2 rounded-md p-3">
          <span className="font-display text-muted-foreground text-[10px] tracking-wide uppercase">
            {myBet ? "Your bet" : "Place a bet"}
          </span>

          {myBet && !isEditing ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="flex flex-wrap items-center gap-1.5">
                <PlayerName
                  name={players.get(myBet.pick_player_id)?.name ?? "?"}
                  state={players.get(myBet.pick_player_id)?.state ?? "??"}
                  size="sm"
                />
                <span className="text-muted-foreground">
                  to {TARGET_LABEL[myBet.target]} — wagered {myBet.wager.toFixed(1)}
                </span>
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="outline">Awaiting result</Badge>
                {event.status === "planned" ? (
                  <>
                    <Button size="sm" variant="outline" onClick={startEditing} disabled={busy}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={handleCancelBet}
                      disabled={busy}
                    >
                      Cancel
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
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
              <div className="flex items-center gap-4">
                <span className="text-muted-foreground w-28 text-[10px] uppercase">Wager</span>
                <span className="text-muted-foreground w-14 text-[10px] uppercase">Odds</span>
                <span className="text-muted-foreground w-16 text-[10px] uppercase">Payout</span>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Input
                  ref={wagerInputRef}
                  type="number"
                  step={MULTIPLIER_STEP}
                  min={MULTIPLIER_STEP}
                  max={maxWager}
                  placeholder={`up to ${maxWager.toFixed(1)}`}
                  className="w-28"
                  value={wager}
                  onChange={(e) => setWager(e.target.value)}
                />
                <span className="font-score w-14 tabular-nums">
                  {odds != null ? `${odds.toFixed(1)}×` : "—"}
                </span>
                <span className="font-score w-16 tabular-nums">
                  {payoutPreview != null ? payoutPreview.toFixed(1) : "—"}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleWager}
                    disabled={busy || !pick || !hasValidWager || wagerNum > maxWager}
                  >
                    {isEditing ? "Save changes" : "Wager"}
                  </Button>
                  {isEditing ? (
                    <Button size="sm" variant="ghost" onClick={discardEditing} disabled={busy}>
                      Discard
                    </Button>
                  ) : null}
                </div>
              </div>
              <span className="text-muted-foreground text-xs">
                {reserve
                  ? `${reserve.available.toFixed(1)} available from your multiplier reserve (${reserve.tiedUp.toFixed(1)} tied up in open wagers)${isEditing ? ", plus this bet's current wager while you're editing it" : ""}.`
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
