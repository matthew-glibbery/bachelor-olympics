"use client";

import { useEffect } from "react";
import { Medal } from "lucide-react";
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
import { useGameStore } from "@/store/gameStore";
import { deriveScoreLines } from "@/lib/scoring/fromRows";

export default function Home() {
  const { players, events, eventResults, multipliers, connect, loading, error, ready } =
    useGameStore();

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

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12">
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
            <Medal className="text-chart-3 size-5" />
            Medal Table
          </CardTitle>
          <CardDescription>
            Live standings — raw event points and multiplier-adjusted totals.
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
            <MedalTable players={medalPlayers} scoreLines={scoreLines} />
          )}
        </CardContent>
      </Card>
    </main>
  );
}
