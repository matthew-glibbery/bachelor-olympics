"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import { PlayerName } from "@/components/player-name";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { placePerEventBet } from "@/lib/data/mutations";
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

/** Odds tab: this event's own ranking as win/place payout odds, in rank
 * order (1 at top) — and, while the event is still "planned," the wager
 * form to bet on any player's win/place outcome (PRODUCT_SPEC.md →
 * Per-event multiplier betting). Wagers draw from the player's unallocated
 * multiplier reserve, not this event's own multiplier. */
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
  const bettingOpen = event.status === "planned" && !!currentPlayerId && !myBet;
  const maxWager = reserve ? Math.max(0, reserve.available) : 0;
  const odds = pick ? perEventPayoutMultiplier(ranking, pick, target) : null;
  const wagerNum = Number(wager);
  const hasValidWager = Number.isFinite(wagerNum) && wagerNum > 0;
  const payoutPreview = odds != null && hasValidWager ? wagerNum * odds : null;

  async function handleWager() {
    if (!currentPlayerId || !pick || !hasValidWager) return;
    setBusy(true);
    setError(null);
    try {
      await placePerEventBet(getSupabaseBrowserClient(), {
        player_id: currentPlayerId,
        event_id: event.id,
        pick_player_id: pick,
        target,
        wager: wagerNum,
      });
      setPick(null);
      setWager("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
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
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-xs tabular-nums">
                  {mult.win.toFixed(1)}x
                </span>
                {bettingOpen ? (
                  <Button
                    size="sm"
                    variant={isPick && target === "win" ? "default" : "outline"}
                    onClick={() => {
                      setPick(playerId);
                      setTarget("win");
                    }}
                  >
                    Win
                  </Button>
                ) : null}
                <span className="text-muted-foreground text-xs tabular-nums">
                  {mult.top3.toFixed(1)}x
                </span>
                {bettingOpen ? (
                  <Button
                    size="sm"
                    variant={isPick && target === "place" ? "default" : "outline"}
                    onClick={() => {
                      setPick(playerId);
                      setTarget("place");
                    }}
                  >
                    Place
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {myBet ? (
        <div className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground">Your bet:</span>
            <PlayerName
              name={players.get(myBet.pick_player_id)?.name ?? "?"}
              state={players.get(myBet.pick_player_id)?.state ?? "??"}
              size="sm"
            />
            <span className="text-muted-foreground">
              to {TARGET_LABEL[myBet.target]} — wagered {myBet.wager.toFixed(1)}
            </span>
          </span>
          <Badge variant="outline">Awaiting result</Badge>
        </div>
      ) : bettingOpen ? (
        <div className="flex flex-col gap-2 border-t pt-3">
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <div className="flex flex-wrap items-end gap-2">
            <Input
              type="number"
              step={MULTIPLIER_STEP}
              min={MULTIPLIER_STEP}
              max={maxWager}
              placeholder={`up to ${maxWager.toFixed(1)}`}
              className="w-28"
              value={wager}
              onChange={(e) => setWager(e.target.value)}
            />
            <span className="text-muted-foreground text-xs">
              {pick
                ? payoutPreview != null
                  ? `pays ${payoutPreview.toFixed(1)} if correct (${odds?.toFixed(1)}×)`
                  : `${odds?.toFixed(1)}× if correct`
                : "pick a player above to win or place"}
            </span>
            <Button
              size="sm"
              onClick={handleWager}
              disabled={busy || !pick || !hasValidWager || wagerNum > maxWager}
            >
              Wager
            </Button>
          </div>
          <span className="text-muted-foreground text-xs">
            {reserve
              ? `${reserve.available.toFixed(1)} available from your multiplier reserve (${reserve.tiedUp.toFixed(1)} tied up in open wagers).`
              : null}
          </span>
        </div>
      ) : !currentPlayerId && event.status === "planned" ? (
        <p className="text-muted-foreground text-sm">
          Pick who you are on Setup to place a bet.
        </p>
      ) : null}
    </div>
  );
}
