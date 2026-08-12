"use client";

import { useEffect } from "react";
import { Medal, TrendingUp } from "lucide-react";
import Link from "next/link";

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { AppNav } from "@/components/app-nav";
import { MedalTable } from "@/components/medal-table";
import type { MedalTablePlayer } from "@/components/medal-table";
import { ProgressChart } from "@/components/progress-chart";
import { useGameStore } from "@/store/gameStore";
import { deriveScoreLines } from "@/lib/scoring/fromRows";
import { cumulativeSeries } from "@/lib/scoring/cumulativeSeries";

export default function Home() {
  const {
    players,
    events,
    eventResults,
    multipliers,
    bonusEvents,
    overallBets,
    connect,
    loading,
    error,
    ready,
  } = useGameStore();

  useEffect(() => {
    connect();
  }, [connect]);

  const medalPlayers: MedalTablePlayer[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    nickname: p.nickname,
    state: p.state ?? "??",
    photoUrl: p.photo_url,
  }));
  const scoreLines = deriveScoreLines(events, eventResults, multipliers);
  const bonusAwards = [
    ...bonusEvents
      .filter((b) => b.winner_player_id)
      .map((b) => ({ playerId: b.winner_player_id as string, points: b.points })),
    // A won overall bet's payout goes to the BETTOR, not their pick.
    ...overallBets
      .filter((b) => b.status === "won" && b.payout != null)
      .map((b) => ({ playerId: b.player_id, points: b.payout as number })),
  ];
  const series = cumulativeSeries(
    events,
    eventResults,
    multipliers,
    players.map((p) => p.id),
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 pt-12 pb-28 sm:pb-12">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Bachelor Olympics</h1>
          <p className="text-muted-foreground text-sm">
            Eight events. Eight competitors. One medal table.
          </p>
        </div>
        <AppNav />
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="text-primary size-5" />
            Progress
          </CardTitle>
          <CardDescription>
            Cumulative points after each event. Hover a point for details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : !ready && loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : (
            <ProgressChart players={players} series={series} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Medal className="text-chart-3 size-5" />
            Medal Table
          </CardTitle>
          <CardDescription>
            Live standings — raw event points and multiplier-adjusted totals,
            plus any bonus-event points and settled overall-bet winnings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : !ready && loading ? (
            <p className="text-muted-foreground text-sm">Loading…</p>
          ) : medalPlayers.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No competitors yet —{" "}
              <Link href="/setup" className="underline">
                add players in Setup
              </Link>{" "}
              to get started.
            </p>
          ) : (
            <MedalTable players={medalPlayers} scoreLines={scoreLines} bonusAwards={bonusAwards} />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
