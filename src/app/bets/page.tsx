"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Coins, Percent } from "lucide-react";

import { AppNav } from "@/components/app-nav";
import { PlayerName } from "@/components/player-name";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  placeOverallBet,
  placePerEventBet,
  switchOverallBetPick,
} from "@/lib/data/mutations";
import { eliminationField } from "@/lib/betting/fromRows";
import { isPickAlive, overallPayoutValue } from "@/lib/betting/overall";
import { aggregateRanking } from "@/lib/odds/aggregate";
import {
  impliedProbabilities,
  payoutMultipliers,
  perEventPayoutMultiplier,
  type RankingEntry,
} from "@/lib/odds/ranking";
import { MULTIPLIER_DEFAULT, MULTIPLIER_STEP } from "@/lib/multipliers/budget";
import type { OverallBetRow } from "@/lib/data/database.types";

const SELECT_CLASS =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

type OverallBetType = "win" | "top3";

const OVERALL_BET_TYPES: { type: OverallBetType; label: string; description: string }[] = [
  { type: "win", label: "Win outright", description: "Pick the overall winner." },
  { type: "top3", label: "Top 3", description: "Pick anyone who finishes top 3." },
];

const PER_EVENT_TARGETS: { target: "win" | "place"; label: string }[] = [
  { target: "win", label: "Win this event" },
  { target: "place", label: "Top 3 this event" },
];

/** Betting — PRODUCT_SPEC.md → Overall betting + Per-event multiplier
 * betting. Both live here together: overall win/top3 picks against the
 * aggregated odds, and per-event win/place wagers against that event's own
 * odds, right next to where each bet gets placed. */
export default function BetsPage() {
  const {
    players,
    events,
    eventResults,
    multipliers,
    eventRankings,
    overallBets,
    perEventBets,
    connect,
    ready,
  } = useGameStore();
  const { selectedPlayerId, hydrate } = useSessionStore();

  useEffect(() => {
    hydrate();
    connect();
  }, [hydrate, connect]);

  const player = players.find((p) => p.id === selectedPlayerId);
  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const eventsById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const rankingByEvent = useMemo(() => {
    const map = new Map<string, RankingEntry[]>();
    for (const event of events) {
      map.set(
        event.id,
        eventRankings
          .filter((r) => r.event_id === event.id)
          .map((r) => ({ playerId: r.player_id, rank: r.rank })),
      );
    }
    return map;
  }, [events, eventRankings]);

  const overallRanking = useMemo(() => {
    const complete = events
      .map((e) => rankingByEvent.get(e.id) ?? [])
      .filter((r) => r.length === players.length && players.length > 0);
    return aggregateRanking(complete);
  }, [events, rankingByEvent, players.length]);
  const overallProbabilities = overallRanking.length > 0 ? impliedProbabilities(overallRanking) : null;
  const overallPayouts = overallRanking.length > 0 ? payoutMultipliers(overallRanking) : null;

  const eliminationFieldValue = useMemo(
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
  });
  const [busyOverall, setBusyOverall] = useState<OverallBetType | null>(null);
  const [overallError, setOverallError] = useState<string | null>(null);

  async function handlePlaceOverall(betType: OverallBetType) {
    if (!player) return;
    const pickId = pendingPick[betType];
    if (!pickId) return;
    setBusyOverall(betType);
    setOverallError(null);
    try {
      await placeOverallBet(getSupabaseBrowserClient(), {
        player_id: player.id,
        bet_type: betType,
        pick_player_id: pickId,
      });
      setPendingPick((d) => ({ ...d, [betType]: "" }));
    } catch (err) {
      setOverallError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyOverall(null);
    }
  }

  async function handleSwitchOverall(bet: OverallBetRow) {
    const betType = bet.bet_type;
    const newPick = pendingPick[betType];
    if (!newPick) return;
    setBusyOverall(betType);
    setOverallError(null);
    try {
      await switchOverallBetPick(getSupabaseBrowserClient(), bet.id, newPick);
      setPendingPick((d) => ({ ...d, [betType]: "" }));
    } catch (err) {
      setOverallError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyOverall(null);
    }
  }

  // Placement events only for now: resolution keys off the finishing
  // `position`, which absolute-scored events (golf, etc.) don't record —
  // see docs/HANDOFF.md for the open question on extending this.
  const scoringEvents = events.filter(
    (e) => e.status === "scoring" && e.scoring_mode === "placement",
  );
  const [wagerDraft, setWagerDraft] = useState<Record<string, string>>({});
  const [targetDraft, setTargetDraft] = useState<Record<string, "win" | "place">>({});
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [perEventError, setPerEventError] = useState<string | null>(null);

  async function handlePlacePerEvent(eventId: string) {
    if (!player) return;
    const raw = wagerDraft[eventId];
    const wager = raw ? Number(raw) : NaN;
    if (!Number.isFinite(wager) || wager <= 0) return;
    setBusyEventId(eventId);
    setPerEventError(null);
    try {
      await placePerEventBet(getSupabaseBrowserClient(), {
        player_id: player.id,
        event_id: eventId,
        target: targetDraft[eventId] ?? "win",
        wager,
      });
      setWagerDraft((d) => ({ ...d, [eventId]: "" }));
    } catch (err) {
      setPerEventError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyEventId(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 pt-12 pb-28 sm:pb-12">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Bets</h1>
          <p className="text-muted-foreground text-sm">
            Overall picks and live per-event wagers, with the odds right next
            to where you place them.
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="text-primary size-5" />
                Overall bets
              </CardTitle>
              <CardDescription>
                Flat 100 points if you&apos;re right, whoever you pick.
                Switching a pick after it&apos;s eliminated halves the payout
                each time.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {overallError ? <p className="text-destructive text-sm">{overallError}</p> : null}
              {!overallProbabilities || !overallPayouts ? (
                <p className="text-muted-foreground text-sm">
                  No odds yet — the groom needs to finish ranking at least one
                  event on Setup first.
                </p>
              ) : null}

              {OVERALL_BET_TYPES.map(({ type, label, description }) => {
                const bet = overallBets.find(
                  (b) => b.player_id === player.id && b.bet_type === type,
                );
                const pick = bet ? playersById.get(bet.pick_player_id) : undefined;
                const alive =
                  bet && pick ? isPickAlive(type, bet.pick_player_id, eliminationFieldValue) : null;
                const aliveCandidates = players.filter(
                  (p) => !bet || p.id === bet.pick_player_id || isPickAlive(type, p.id, eliminationFieldValue),
                );

                return (
                  <div key={type} className="flex flex-col gap-2 border-t pt-3 first:border-t-0 first:pt-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{label}</span>
                      <span className="text-muted-foreground text-xs">{description}</span>
                    </div>

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
                              onClick={() => handleSwitchOverall(bet)}
                              disabled={!pendingPick[type] || busyOverall === type}
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
                          {players.map((p) => {
                            const odds = overallPayouts?.get(p.id);
                            return (
                              <option key={p.id} value={p.id}>
                                {p.name}
                                {odds ? ` — ${(type === "win" ? odds.win : odds.top3).toFixed(1)}x` : ""}
                              </option>
                            );
                          })}
                        </select>
                        <Button
                          size="sm"
                          onClick={() => handlePlaceOverall(type)}
                          disabled={!pendingPick[type] || busyOverall === type}
                        >
                          Place bet
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Everyone&apos;s overall bets</CardTitle>
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
                      bet.bet_type,
                      bet.pick_player_id,
                      eliminationFieldValue,
                    );
                    return (
                      <div
                        key={bet.id}
                        className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
                      >
                        <span className="flex items-center gap-1.5">
                          <PlayerName name={bettor.name} state={bettor.state ?? "??"} size="sm" />
                          <span className="text-muted-foreground">
                            {OVERALL_BET_TYPES.find((b) => b.type === bet.bet_type)?.label ??
                              bet.bet_type}
                            :
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="text-primary size-5" />
                Per-event bets
              </CardTitle>
              <CardDescription>
                Wager a slice of your already-locked multiplier on your own
                finish in an event that&apos;s currently underway. Win = the
                wager pays out scaled by that event&apos;s odds and returns to
                your pool; lose = it&apos;s gone.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {perEventError ? <p className="text-destructive text-sm">{perEventError}</p> : null}
              {scoringEvents.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No event is in progress right now.
                </p>
              ) : (
                scoringEvents.map((event) => {
                  const ranking = rankingByEvent.get(event.id) ?? [];
                  const rankingComplete = ranking.length === players.length && players.length > 0;
                  const myMultiplier =
                    multipliers.find((m) => m.player_id === player.id && m.event_id === event.id)
                      ?.value ?? MULTIPLIER_DEFAULT;
                  const myBet = perEventBets.find(
                    (b) => b.player_id === player.id && b.event_id === event.id,
                  );
                  const target = targetDraft[event.id] ?? "win";
                  const odds = rankingComplete
                    ? perEventPayoutMultiplier(ranking, player.id, target)
                    : null;

                  return (
                    <div key={event.id} className="flex flex-col gap-2 border-t pt-3 first:border-t-0 first:pt-0">
                      <span className="text-sm font-medium">{event.name}</span>

                      {myBet ? (
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span>
                            {PER_EVENT_TARGETS.find((t) => t.target === myBet.target)?.label} —
                            wagered {myBet.wager.toFixed(1)}×
                          </span>
                          <Badge
                            variant={
                              myBet.status === "open"
                                ? "outline"
                                : myBet.status === "won"
                                  ? "default"
                                  : myBet.status === "lost"
                                    ? "destructive"
                                    : "secondary"
                            }
                          >
                            {myBet.status === "open"
                              ? "Awaiting result"
                              : myBet.status === "won"
                                ? `Won ${myBet.payout?.toFixed(1)}×`
                                : myBet.status === "lost"
                                  ? "Lost"
                                  : "Voided"}
                          </Badge>
                        </div>
                      ) : !rankingComplete ? (
                        <p className="text-muted-foreground text-sm">
                          Odds not set for this event yet.
                        </p>
                      ) : (
                        <div className="flex flex-wrap items-end gap-2">
                          <select
                            className={SELECT_CLASS + " w-40"}
                            value={target}
                            onChange={(e) =>
                              setTargetDraft((d) => ({
                                ...d,
                                [event.id]: e.target.value as "win" | "place",
                              }))
                            }
                          >
                            {PER_EVENT_TARGETS.map((t) => (
                              <option key={t.target} value={t.target}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                          <Input
                            type="number"
                            step={MULTIPLIER_STEP}
                            min={MULTIPLIER_STEP}
                            max={myMultiplier}
                            placeholder={`up to ${myMultiplier.toFixed(1)}`}
                            className="w-28"
                            value={wagerDraft[event.id] ?? ""}
                            onChange={(e) =>
                              setWagerDraft((d) => ({ ...d, [event.id]: e.target.value }))
                            }
                          />
                          <span className="text-muted-foreground text-xs">
                            {odds ? `pays ${odds.toFixed(1)}×` : ""}
                          </span>
                          <Button
                            size="sm"
                            onClick={() => handlePlacePerEvent(event.id)}
                            disabled={
                              busyEventId === event.id ||
                              !wagerDraft[event.id] ||
                              Number(wagerDraft[event.id]) > myMultiplier
                            }
                          >
                            Wager
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Everyone&apos;s per-event bets</CardTitle>
              <CardDescription>No suspense here either.</CardDescription>
            </CardHeader>
            <CardContent>
              {perEventBets.length === 0 ? (
                <p className="text-muted-foreground text-sm">No wagers placed yet.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {perEventBets.map((bet) => {
                    const bettor = playersById.get(bet.player_id);
                    const event = eventsById.get(bet.event_id);
                    if (!bettor || !event) return null;
                    return (
                      <div
                        key={bet.id}
                        className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
                      >
                        <span className="flex items-center gap-1.5">
                          <PlayerName name={bettor.name} state={bettor.state ?? "??"} size="sm" />
                          <span className="text-muted-foreground">
                            {event.name} ({bet.target}, {bet.wager.toFixed(1)}×):
                          </span>
                        </span>
                        <Badge
                          variant={
                            bet.status === "open"
                              ? "outline"
                              : bet.status === "won"
                                ? "default"
                                : bet.status === "lost"
                                  ? "destructive"
                                  : "secondary"
                          }
                        >
                          {bet.status === "open"
                            ? "Open"
                            : bet.status === "won"
                              ? `Won ${bet.payout?.toFixed(1)}×`
                              : bet.status === "lost"
                                ? "Lost"
                                : "Voided"}
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
