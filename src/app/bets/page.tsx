"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Coins } from "lucide-react";

import { AppNav } from "@/components/app-nav";
import { PlayerName } from "@/components/player-name";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { placeOverallBet, switchOverallBetPick } from "@/lib/data/mutations";
import { eliminationField } from "@/lib/betting/fromRows";
import { isPickAlive, overallPayoutValue, type OverallBetType } from "@/lib/betting/overall";
import type { OverallBetRow } from "@/lib/data/database.types";

const SELECT_CLASS =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

const BET_TYPES: { type: OverallBetType; label: string; description: string }[] = [
  { type: "win", label: "Win outright", description: "Pick the overall winner." },
  { type: "top3", label: "Top 3", description: "Pick anyone who finishes top 3." },
  {
    type: "last",
    label: "Last place",
    description: "The joke bet — pick who finishes last.",
  },
];

/** Overall ("who wins it all") bets — PRODUCT_SPEC.md → Overall betting.
 * Flat 100-pt payout regardless of pick, halved per switch, switching only
 * offered once a pick is mathematically eliminated. */
export default function BetsPage() {
  const { players, events, eventResults, multipliers, overallBets, connect, ready } =
    useGameStore();
  const { selectedPlayerId, hydrate } = useSessionStore();

  useEffect(() => {
    hydrate();
    connect();
  }, [hydrate, connect]);

  const player = players.find((p) => p.id === selectedPlayerId);
  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const field = useMemo(
    () =>
      players.length > 0
        ? eliminationField(
            players.map((p) => p.id),
            events,
            eventResults,
            multipliers,
          )
        : [],
    [players, events, eventResults, multipliers],
  );

  const [pendingPick, setPendingPick] = useState<Record<OverallBetType, string>>({
    win: "",
    top3: "",
    last: "",
  });
  const [busyType, setBusyType] = useState<OverallBetType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePlace(betType: OverallBetType) {
    if (!player) return;
    const pickId = pendingPick[betType];
    if (!pickId) return;
    setBusyType(betType);
    setError(null);
    try {
      await placeOverallBet(getSupabaseBrowserClient(), {
        player_id: player.id,
        bet_type: betType,
        pick_player_id: pickId,
      });
      setPendingPick((d) => ({ ...d, [betType]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyType(null);
    }
  }

  async function handleSwitch(bet: OverallBetRow) {
    const betType = bet.bet_type as OverallBetType;
    const newPick = pendingPick[betType];
    if (!newPick) return;
    setBusyType(betType);
    setError(null);
    try {
      await switchOverallBetPick(getSupabaseBrowserClient(), bet.id, newPick);
      setPendingPick((d) => ({ ...d, [betType]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyType(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 pt-12 pb-28 sm:pb-12">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Overall bets</h1>
          <p className="text-muted-foreground text-sm">
            Flat 100 points if you&apos;re right, whoever you pick. Switching a pick
            after it&apos;s eliminated halves the payout each time.
          </p>
        </div>
        <AppNav />
      </header>

      {!ready ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : !player ? (
        <p className="text-muted-foreground text-sm">
          Pick who you are on the{" "}
          <Link href="/setup" className="underline">
            Setup
          </Link>{" "}
          screen first.
        </p>
      ) : (
        <>
          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          {BET_TYPES.map(({ type, label, description }) => {
            const bet = overallBets.find(
              (b) => b.player_id === player.id && b.bet_type === type,
            );
            const pick = bet ? playersById.get(bet.pick_player_id) : undefined;
            const alive = bet && pick ? isPickAlive(type, bet.pick_player_id, field) : null;
            const aliveCandidates = players.filter(
              (p) => !bet || p.id === bet.pick_player_id || isPickAlive(type, p.id, field),
            );

            return (
              <Card key={type}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coins className="text-primary size-5" />
                    {label}
                  </CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {bet && pick ? (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <PlayerName
                          name={pick.name}
                          state={pick.state ?? "??"}
                          size="sm"
                          photoUrl={pick.photo_url}
                        />
                        <Badge variant={alive ? "default" : "destructive"}>
                          {alive ? "Alive" : "Eliminated"}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground text-sm">
                        Worth {overallPayoutValue(bet.switches)} pts if it lands
                        {bet.switches > 0 ? ` (switched ${bet.switches}×)` : ""}.
                      </p>
                      {!alive ? (
                        <div className="flex items-end gap-2">
                          <select
                            className={SELECT_CLASS}
                            value={pendingPick[type]}
                            onChange={(e) =>
                              setPendingPick((d) => ({ ...d, [type]: e.target.value }))
                            }
                          >
                            <option value="">Switch to…</option>
                            {aliveCandidates
                              .filter((p) => p.id !== bet.pick_player_id)
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                          </select>
                          <Button
                            size="sm"
                            onClick={() => handleSwitch(bet)}
                            disabled={!pendingPick[type] || busyType === type}
                          >
                            Switch pick
                          </Button>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="flex items-end gap-2">
                      <select
                        className={SELECT_CLASS}
                        value={pendingPick[type]}
                        onChange={(e) =>
                          setPendingPick((d) => ({ ...d, [type]: e.target.value }))
                        }
                      >
                        <option value="">Pick a player…</option>
                        {players.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        size="sm"
                        onClick={() => handlePlace(type)}
                        disabled={!pendingPick[type] || busyType === type}
                      >
                        Place bet
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          <Card>
            <CardHeader>
              <CardTitle>Everyone&apos;s bets</CardTitle>
              <CardDescription>No suspense here — visible to everyone.</CardDescription>
            </CardHeader>
            <CardContent>
              {overallBets.length === 0 ? (
                <p className="text-muted-foreground text-sm">No bets placed yet.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {overallBets.map((bet) => {
                    const bettor = playersById.get(bet.player_id);
                    const pick = playersById.get(bet.pick_player_id);
                    if (!bettor || !pick) return null;
                    const alive = isPickAlive(
                      bet.bet_type as OverallBetType,
                      bet.pick_player_id,
                      field,
                    );
                    return (
                      <div
                        key={bet.id}
                        className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
                      >
                        <span className="flex items-center gap-1.5">
                          <PlayerName name={bettor.name} state={bettor.state ?? "??"} size="sm" />
                          <span className="text-muted-foreground">
                            {BET_TYPES.find((b) => b.type === bet.bet_type)?.label ?? bet.bet_type}:
                          </span>
                          <PlayerName name={pick.name} state={pick.state ?? "??"} size="sm" />
                        </span>
                        <Badge variant={alive ? "outline" : "destructive"}>
                          {alive ? "Alive" : "Eliminated"}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
