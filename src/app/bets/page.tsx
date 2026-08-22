"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Coins, Percent } from "lucide-react";

import { GameScreen } from "@/components/n64/game-screen";
import { Panel } from "@/components/n64/panel";
import { Stat } from "@/components/n64/stat";
import { OverallBetting } from "@/components/overall-betting";
import { PlayerName } from "@/components/player-name";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";
import { assignPlayerColors } from "@/lib/chartColors";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  cancelPerEventBet,
  updatePerEventBet,
} from "@/lib/data/mutations";
import { eliminationField } from "@/lib/betting/fromRows";
import { bettingReserve } from "@/lib/betting/reserve";
import { aggregateRanking } from "@/lib/odds/aggregate";
import {
  payoutMultipliers,
  perEventPayoutMultiplier,
  type RankingEntry,
} from "@/lib/odds/ranking";
import { allocatedMultiplierTotal, MULTIPLIER_STEP } from "@/lib/multipliers/budget";
import type { PerEventBetRow } from "@/lib/data/database.types";

// A native <select> can't be beveled convincingly (the popup is the OS's),
// but the closed control is ours — so it gets the same recessed well every
// other input-shaped thing in this app sits in, rather than the flat
// hairline border it had, which was the last visibly-shadcn control left on
// this screen.
// `outline`, not `ring`: a ring is a box-shadow, and it would replace the
// sunken bevel wholesale on focus, so the control visibly changed shape as
// you tabbed onto it. An outline sits outside the box and leaves the bevel
// alone. `text-foreground` is explicit because a native select over a dark
// fill otherwise inherits the OS's own (often black) option colour.
const SELECT_CLASS =
  "bevel-sunken bg-sunken text-foreground h-9 w-full rounded-md border-0 px-3 text-sm outline-none focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2";

const PER_EVENT_TARGETS: { target: "win" | "place"; label: string }[] = [
  { target: "win", label: "to win" },
  { target: "place", label: "to place top 3" },
];

/** Betting — PRODUCT_SPEC.md → Overall betting + Per-event multiplier
 * betting. Overall picks live in `OverallBetting`, the roster-list pick
 * mechanic itself. Per-event bets are placement-only from the Odds tab on
 * `/events` (event-odds-betting.tsx) — this page is a read view of all of
 * this player's per-event bets, past and future, with edit/cancel for
 * whichever ones are still on a "planned" event. */
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
  const colorByPlayer = useMemo(() => {
    const stable = [...players].sort((a, b) => a.id.localeCompare(b.id));
    return assignPlayerColors(stable.map((p) => ({ id: p.id, state: p.state ?? "" })), "dark");
  }, [players]);

  // Once any event leaves "planned," the weekend has effectively started —
  // that's when new overall-bet placement locks (existing bets can still be
  // switched if eliminated) and when the reveal of everyone's overall bets
  // opens up.
  const weekendStarted = events.some((e) => e.status !== "planned");

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

  // Every event that has a bet from this player, in the event board's own
  // order — that naturally reads as past-then-future since events proceed
  // in order, no separate sort needed.
  const myPerEventBets = events
    .map((event) => ({
      event,
      bet: perEventBets.find((b) => b.player_id === player?.id && b.event_id === event.id),
    }))
    .filter((row): row is { event: (typeof events)[number]; bet: PerEventBetRow } => !!row.bet);

  const [wagerDraft, setWagerDraft] = useState<Record<string, string>>({});
  const [targetDraft, setTargetDraft] = useState<Record<string, "win" | "place">>({});
  const [pickDraft, setPickDraft] = useState<Record<string, string>>({});
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [perEventError, setPerEventError] = useState<string | null>(null);
  // The bet currently being edited (PRODUCT_SPEC.md doesn't forbid it, and
  // there's no reason to make someone cancel-then-replace by hand) — null
  // means every event's per-event section shows its normal place/awaiting
  // state. Only ever one at a time; picking a different bet to edit or
  // saving/discarding clears it.
  const [editingBetId, setEditingBetId] = useState<string | null>(null);

  const reserve = player
    ? bettingReserve(
        events.length,
        allocatedMultiplierTotal(events, multipliers, player.id),
        perEventBets
          .filter((b) => b.player_id === player.id)
          .map((b) => ({ wager: b.wager, status: b.status, payout: b.payout })),
      )
    : null;

  function startEditingPerEvent(eventId: string, bet: PerEventBetRow) {
    setPerEventError(null);
    setEditingBetId(bet.id);
    setWagerDraft((d) => ({ ...d, [eventId]: String(bet.wager) }));
    setPickDraft((d) => ({ ...d, [eventId]: bet.pick_player_id }));
    setTargetDraft((d) => ({ ...d, [eventId]: bet.target }));
  }

  function discardPerEventEdit(eventId: string) {
    setEditingBetId(null);
    setWagerDraft((d) => ({ ...d, [eventId]: "" }));
    setPickDraft((d) => ({ ...d, [eventId]: "" }));
  }

  async function handleUpdatePerEvent(eventId: string, betId: string) {
    const raw = wagerDraft[eventId];
    const wager = raw ? Number(raw) : NaN;
    const pickPlayerId = pickDraft[eventId];
    if (!Number.isFinite(wager) || wager <= 0 || !pickPlayerId) return;
    setBusyEventId(eventId);
    setPerEventError(null);
    try {
      await updatePerEventBet(getSupabaseBrowserClient(), betId, {
        pick_player_id: pickPlayerId,
        target: targetDraft[eventId] ?? "win",
        wager,
      });
      setEditingBetId(null);
      setWagerDraft((d) => ({ ...d, [eventId]: "" }));
      setPickDraft((d) => ({ ...d, [eventId]: "" }));
    } catch (err) {
      setPerEventError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyEventId(null);
    }
  }

  async function handleCancelPerEvent(betId: string) {
    setBusyEventId(betId);
    setPerEventError(null);
    try {
      await cancelPerEventBet(getSupabaseBrowserClient(), betId);
    } catch (err) {
      setPerEventError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyEventId(null);
    }
  }

  return (
    <GameScreen
      title="Bets"
      // U+2011 (non-breaking hyphen), not a plain "-": the subtitle is
      // tracked uppercase and was breaking as "PER-" / "EVENT" across two
      // lines. text-balance doesn't prevent that -- a real hyphen is a valid
      // break opportunity, so the character itself has to be the unbreakable
      // one.
      subtitle={"Overall picks, plus every per\u2011event wager you've got open"}
      // Both these screens are stacked prose-and-form panels, not a grid —
      // they were `max-w-2xl` before the shared shell existed and reading
      // measure is the reason, so keep it rather than inheriting the
      // leaderboard's wider default.
      width="narrow"
    >
      {!ready ? (
        <p className="text-muted-foreground text-center text-sm">Loading…</p>
      ) : !player ? (
        <p className="text-muted-foreground text-center text-sm">
          Pick who you are on the{" "}
          <Link href="/setup" className="text-foreground underline">
            Setup
          </Link>{" "}
          screen first.
        </p>
      ) : (
        <>
          <Panel
            title="Overall bets"
            icon={Coins}
            contentClassName="gap-4"
            description={
              <>
                Flat 100 points for a win pick, 20 for top 3, whoever you
                choose. Switching a pick after it&apos;s eliminated halves
                the payout each time.{" "}
                {weekendStarted
                  ? "Picks are locked in — everyone's are visible below."
                  : "Locks once the first event starts."}
              </>
            }
          >
            <OverallBetting
              players={players}
              currentPlayerId={player.id}
              overallBets={overallBets}
              payouts={overallPayouts}
              weekendStarted={weekendStarted}
              eliminationField={eliminationFieldValue}
            />
          </Panel>

          <Panel
            title="Per-event bets"
            icon={Percent}
            contentClassName="gap-4"
            description={
              <>
                Your wagers on other players&apos; win/place outcomes, wherever
                they land on the calendar — place new ones from an
                event&apos;s Odds tab. Edit or cancel here up until that event
                starts.{" "}
                <Link href="/multipliers" className="text-foreground underline">
                  See the reserve breakdown on Multipliers
                </Link>
                .
              </>
            }
          >
            {reserve ? (
              <div className="flex gap-3">
                <Stat
                  label="Available to wager"
                  value={reserve.available.toFixed(1)}
                  tone="primary"
                />
                <Stat label="Tied up in open wagers" value={reserve.tiedUp.toFixed(1)} />
              </div>
            ) : null}
            <>
              {perEventError ? <p className="text-destructive text-sm">{perEventError}</p> : null}
              {myPerEventBets.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No per-event bets yet — place one from an event&apos;s Odds
                  tab on{" "}
                  <Link href="/events" className="text-foreground underline">
                    Events
                  </Link>
                  .
                </p>
              ) : (
                myPerEventBets.map(({ event, bet: myBet }) => {
                  const ranking = rankingByEvent.get(event.id) ?? [];
                  const target = targetDraft[event.id] ?? "win";
                  const pickId = pickDraft[event.id] ?? "";
                  const odds =
                    ranking.length > 0 && pickId
                      ? perEventPayoutMultiplier(ranking, pickId, target)
                      : null;
                  const isEditing = editingBetId === myBet.id;
                  const canEdit = myBet.status === "open" && event.status === "planned";
                  // Editing doesn't cost anything on top of the existing
                  // wager — it's replacing it, not adding to it — so add
                  // this bet's own current wager back to what's otherwise
                  // available before capping the new amount.
                  const maxWager = reserve
                    ? Math.max(0, reserve.available) + (isEditing ? myBet.wager : 0)
                    : 0;

                  return (
                    <div key={event.id} className="flex flex-col gap-2 border-t pt-3 first:border-t-0 first:pt-0">
                      <span className="text-sm font-medium">{event.name}</span>

                      {!isEditing ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <PlayerName
                              name={playersById.get(myBet.pick_player_id)?.name ?? "?"}
                              state={playersById.get(myBet.pick_player_id)?.state ?? "??"}
                              size="sm"
                              photoUrl={playersById.get(myBet.pick_player_id)?.photo_url}
                              color={colorByPlayer[myBet.pick_player_id]}
                            />
                            <span className="text-muted-foreground">
                              {PER_EVENT_TARGETS.find((t) => t.target === myBet.target)?.label} —
                              wagered {myBet.wager.toFixed(1)}
                            </span>
                          </span>
                          <div className="flex items-center gap-2">
                            {myBet.status === "won" ? (
                              <Badge>Won {myBet.payout} pts</Badge>
                            ) : myBet.status === "lost" ? (
                              <Badge variant="destructive">Lost</Badge>
                            ) : myBet.status === "void" ? (
                              <Badge variant="outline">Voided — event cancelled</Badge>
                            ) : (
                              <Badge variant="outline">Awaiting result</Badge>
                            )}
                            {canEdit ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => startEditingPerEvent(event.id, myBet)}
                                  disabled={busyEventId === myBet.id}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => handleCancelPerEvent(myBet.id)}
                                  disabled={busyEventId === myBet.id}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-end gap-2">
                          <select
                            className={SELECT_CLASS + " w-40"}
                            value={pickId}
                            onChange={(e) =>
                              setPickDraft((d) => ({ ...d, [event.id]: e.target.value }))
                            }
                          >
                            <option value="">Pick a player…</option>
                            {players.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <select
                            className={SELECT_CLASS + " w-36"}
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
                            max={maxWager}
                            placeholder={`up to ${maxWager.toFixed(1)}`}
                            className="w-24"
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
                            onClick={() => handleUpdatePerEvent(event.id, myBet.id)}
                            disabled={
                              busyEventId === event.id ||
                              !pickId ||
                              !wagerDraft[event.id] ||
                              Number(wagerDraft[event.id]) > maxWager
                            }
                          >
                            Save changes
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => discardPerEventEdit(event.id)}>
                            Discard
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </>
          </Panel>
        </>
      )}
    </GameScreen>
  );
}
