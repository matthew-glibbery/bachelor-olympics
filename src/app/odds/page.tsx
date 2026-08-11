"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Lock, Percent, ShieldCheck } from "lucide-react";

import { AppNav } from "@/components/app-nav";
import { GroomRankingEditor } from "@/components/groom-ranking-editor";
import { PlayerName } from "@/components/player-name";
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
import { setGroomRanking } from "@/lib/data/mutations";
import { impliedProbabilities, payoutMultipliers } from "@/lib/odds/ranking";

/** win/top3/last odds derived from the groom's ranking (PRODUCT_SPEC.md →
 * Overall betting). Set once, upfront — no live updates once any event has
 * left "planned", same lock convention as the multiplier sliders. */
export default function OddsPage() {
  const { players, events, groomRanking, connect, ready } = useGameStore();
  const { groomUnlocked, hydrate } = useSessionStore();

  useEffect(() => {
    hydrate();
    connect();
  }, [hydrate, connect]);

  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const committedOrder = useMemo(
    () => groomRanking.map((r) => r.player_id).filter((id) => playersById.has(id)),
    [groomRanking, playersById],
  );
  const locked = events.some((e) => e.status !== "planned");

  const [draftOrder, setDraftOrder] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraftOrder(null);
  }, [groomUnlocked]);

  // Committed ranking plus any players added since (e.g. a late addition
  // before the ranking was ever finalized) appended at the bottom.
  const defaultOrder = [
    ...committedOrder,
    ...players.map((p) => p.id).filter((id) => !committedOrder.includes(id)),
  ];
  const editingOrder = draftOrder ?? defaultOrder;
  const dirty = draftOrder !== null && JSON.stringify(draftOrder) !== JSON.stringify(committedOrder);

  const ranking = useMemo(
    () =>
      committedOrder.length === players.length && players.length > 0
        ? committedOrder.map((playerId, i) => ({ playerId, rank: i + 1 }))
        : null,
    [committedOrder, players.length],
  );
  const probabilities = ranking ? impliedProbabilities(ranking) : null;
  const payouts = ranking ? payoutMultipliers(ranking) : null;

  async function handleSave() {
    if (draftOrder === null) return;
    setSaving(true);
    setError(null);
    try {
      await setGroomRanking(
        getSupabaseBrowserClient(),
        draftOrder.map((player_id, i) => ({ player_id, rank: i + 1 })),
      );
      setDraftOrder(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 pt-12 pb-28 sm:pb-12">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Odds</h1>
          <p className="text-muted-foreground text-sm">
            Win / top-3 / last payout multipliers, from the groom&apos;s one private
            pre-weekend ranking.
          </p>
        </div>
        <AppNav />
      </header>

      {!ready ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="text-primary size-5" />
                Payout odds
              </CardTitle>
              <CardDescription>
                Favorites pay close to 1:1, longshots pay much more — fair odds
                from the ranking below, computed once.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!probabilities || !payouts ? (
                <p className="text-muted-foreground text-sm">
                  {players.length === 0
                    ? "Add players on Setup first."
                    : "The groom hasn't set a ranking yet — no odds until then."}
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {committedOrder.map((playerId) => {
                    const player = playersById.get(playerId);
                    if (!player) return null;
                    const p = probabilities.get(playerId)!;
                    const m = payouts.get(playerId)!;
                    return (
                      <div
                        key={playerId}
                        className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
                      >
                        <PlayerName
                          name={player.name}
                          state={player.state ?? "??"}
                          size="sm"
                          photoUrl={player.photo_url}
                        />
                        <div className="flex gap-3 text-right tabular-nums">
                          <span title={`${(p.win * 100).toFixed(0)}% chance to win`}>
                            win {m.win.toFixed(1)}x
                          </span>
                          <span title={`${(p.top3 * 100).toFixed(0)}% chance top 3`}>
                            top3 {m.top3.toFixed(1)}x
                          </span>
                          <span title={`${(p.last * 100).toFixed(0)}% chance last`}>
                            last {m.last.toFixed(1)}x
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {groomUnlocked ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {locked ? (
                    <Lock className="text-muted-foreground size-4" />
                  ) : (
                    <ShieldCheck className="text-primary size-4" />
                  )}
                  Set the ranking
                </CardTitle>
                <CardDescription>
                  {locked
                    ? "Locked — the weekend has already started, this is set once upfront."
                    : "Drag to order everyone strongest (top) to weakest (bottom). Private — only used to generate the odds above."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {players.length < 2 ? (
                  <p className="text-muted-foreground text-sm">
                    Add at least two players on Setup first.
                  </p>
                ) : locked ? (
                  <div className="flex flex-col gap-1.5">
                    {committedOrder.map((playerId, i) => {
                      const player = playersById.get(playerId);
                      if (!player) return null;
                      return (
                        <div
                          key={playerId}
                          className="bg-card flex items-center gap-2 rounded-md border px-2 py-1.5"
                        >
                          <span className="w-5 text-right text-sm font-semibold tabular-nums">
                            {i + 1}
                          </span>
                          <PlayerName
                            name={player.name}
                            state={player.state ?? "??"}
                            size="sm"
                            photoUrl={player.photo_url}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <GroomRankingEditor
                      order={editingOrder}
                      players={playersById}
                      onReorder={setDraftOrder}
                    />
                    {error ? <p className="text-destructive text-sm">{error}</p> : null}
                    <Button
                      onClick={handleSave}
                      disabled={!dirty || saving}
                      className="w-fit"
                    >
                      Save ranking
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <p className="text-muted-foreground text-sm">
              <Link href="/setup" className="underline">
                Unlock groom tools
              </Link>{" "}
              to set or change the ranking.
            </p>
          )}
        </>
      )}
    </main>
  );
}
