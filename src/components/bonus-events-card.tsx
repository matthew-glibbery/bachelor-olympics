"use client";

import { useState } from "react";
import { PartyPopper } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlayerName } from "@/components/player-name";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { createBonusEvent } from "@/lib/data/mutations";
import { BONUS_EVENT_POINTS } from "@/lib/bonus/bonusEvent";
import type { BonusEventRow, PlayerRow } from "@/lib/data/database.types";

const SELECT_CLASS =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

/**
 * On-the-fly bonus events (PRODUCT_SPEC.md → Event-specific structure) —
 * spontaneous, not pre-planned, deliberately outside the core scoring/
 * betting system (no odds, no multiplier, no elimination-math effect), so
 * this lives as its own card rather than inside the tabbed planned-event
 * list on this page. Flat winner-take-all, awarded on the spot: name it,
 * pick the winner, done.
 */
export function BonusEventsCard({
  players,
  bonusEvents,
  groomUnlocked,
}: {
  players: PlayerRow[];
  bonusEvents: BonusEventRow[];
  groomUnlocked: boolean;
}) {
  const [name, setName] = useState("");
  const [winnerId, setWinnerId] = useState("");
  const [points, setPoints] = useState(String(BONUS_EVENT_POINTS));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playersById = new Map(players.map((p) => [p.id, p]));

  async function handleAward() {
    const pts = Number(points);
    if (!name.trim() || !winnerId || !Number.isFinite(pts) || pts <= 0) return;
    setBusy(true);
    setError(null);
    try {
      await createBonusEvent(getSupabaseBrowserClient(), {
        name: name.trim(),
        winner_player_id: winnerId,
        points: pts,
      });
      setName("");
      setWinnerId("");
      setPoints(String(BONUS_EVENT_POINTS));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PartyPopper className="text-primary size-5" />
          Bonus events
        </CardTitle>
        <CardDescription>
          Spontaneous, on-the-fly extras — flat winner-take-all points, outside
          the main scoring and betting system entirely.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {groomUnlocked ? (
          <div className="flex flex-col gap-2 border-b pb-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bonus-name">What happened</Label>
                <Input
                  id="bonus-name"
                  placeholder="e.g. Cornhole showdown"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bonus-points">Points</Label>
                <Input
                  id="bonus-points"
                  type="number"
                  min={1}
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bonus-winner">Winner</Label>
              <select
                id="bonus-winner"
                className={SELECT_CLASS}
                value={winnerId}
                onChange={(e) => setWinnerId(e.target.value)}
              >
                <option value="">Pick a player…</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <Button
              size="sm"
              onClick={handleAward}
              disabled={busy || !name.trim() || !winnerId}
              className="w-fit"
            >
              Award bonus
            </Button>
          </div>
        ) : null}

        {bonusEvents.length === 0 ? (
          <p className="text-muted-foreground text-sm">No bonus events yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {bonusEvents.map((b) => {
              const winner = b.winner_player_id ? playersById.get(b.winner_player_id) : undefined;
              return (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
                >
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">{b.name}</span>
                    {winner ? (
                      <>
                        <span className="text-muted-foreground">won by</span>
                        <PlayerName name={winner.name} state={winner.state ?? "??"} size="sm" />
                      </>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground tabular-nums">+{b.points}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
