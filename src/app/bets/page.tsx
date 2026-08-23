"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Coins, Percent } from "lucide-react";

import { GameScreen } from "@/components/n64/game-screen";
import { Panel } from "@/components/n64/panel";
import { Stat } from "@/components/n64/stat";
import { OverallBetting } from "@/components/overall-betting";
import { PlacedBetsTable } from "@/components/placed-bets-table";
import { WagerStepper } from "@/components/wager-stepper";
import { Button } from "@/components/ui/button";
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
  perEventPayoutMultiplierOrNull,
  type RankingEntry,
} from "@/lib/odds/ranking";
import { allocatedMultiplierTotal, fitsBudget } from "@/lib/multipliers/budget";
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

  const [wagerDraft, setWagerDraft] = useState<Record<string, number>>({});
  const [targetDraft, setTargetDraft] = useState<Record<string, "win" | "place">>({});
  const [pickDraft, setPickDraft] = useState<Record<string, string>>({});
  // Keyed by BET id, not event id — the editor and the table row are both
  // bet-scoped. It was set to an event id on save and a bet id on cancel,
  // which meant every consumer's `=== bet.id` check silently never matched
  // during a save: the Save button stayed live and a second tap fired a
  // second `updatePerEventBet`.
  const [busyBetId, setBusyBetId] = useState<string | null>(null);
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

  // Whichever bet's pencil was tapped, plus the figures its editor needs.
  // Editing doesn't cost anything on top of the existing wager — it replaces
  // it rather than adding to it — so that bet's own current wager goes back
  // into what's available before capping the new amount.
  const editingRow = myPerEventBets.find((r) => r.bet.id === editingBetId) ?? null;
  const editWager = editingRow ? (wagerDraft[editingRow.event.id] ?? 0) : 0;
  const editMaxWager = editingRow
    ? Math.max(0, reserve?.available ?? 0) + editingRow.bet.wager
    : 0;
  const editPick = editingRow ? (pickDraft[editingRow.event.id] ?? "") : "";
  const editRanking = editingRow ? (rankingByEvent.get(editingRow.event.id) ?? []) : [];
  const editOdds =
    editingRow && editPick && editRanking.length > 0
      ? perEventPayoutMultiplierOrNull(
          editRanking,
          editPick,
          targetDraft[editingRow.event.id] ?? "win",
        )
      : null;

  function startEditingPerEvent(eventId: string, bet: PerEventBetRow) {
    setPerEventError(null);
    setEditingBetId(bet.id);
    setWagerDraft((d) => ({ ...d, [eventId]: bet.wager }));
    setPickDraft((d) => ({ ...d, [eventId]: bet.pick_player_id }));
    setTargetDraft((d) => ({ ...d, [eventId]: bet.target }));
  }

  function discardPerEventEdit(eventId: string) {
    setEditingBetId(null);
    setWagerDraft((d) => ({ ...d, [eventId]: 0 }));
    setPickDraft((d) => ({ ...d, [eventId]: "" }));
  }

  async function handleUpdatePerEvent(eventId: string, betId: string) {
    const wager = wagerDraft[eventId] ?? 0;
    const pickPlayerId = pickDraft[eventId];
    if (wager <= 0 || !pickPlayerId) return;
    setBusyBetId(betId);
    setPerEventError(null);
    try {
      await updatePerEventBet(getSupabaseBrowserClient(), betId, {
        pick_player_id: pickPlayerId,
        target: targetDraft[eventId] ?? "win",
        wager,
      });
      setEditingBetId(null);
      setWagerDraft((d) => ({ ...d, [eventId]: 0 }));
      setPickDraft((d) => ({ ...d, [eventId]: "" }));
    } catch (err) {
      setPerEventError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyBetId(null);
    }
  }

  async function handleCancelPerEvent(betId: string) {
    setBusyBetId(betId);
    setPerEventError(null);
    try {
      await cancelPerEventBet(getSupabaseBrowserClient(), betId);
    } catch (err) {
      setPerEventError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyBetId(null);
    }
  }

  return (
    <GameScreen
      title="Bets"
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
          {/* No description line on either panel. The rules they spelled out
              (payout amounts, the halving on a switch, where per-event bets
              get placed) are all either visible as live numbers in the list
              below or belong in the rules doc — as three lines of small
              tracked prose above the fold on a phone, they were the first
              thing on screen and the last thing anyone read. */}
          <Panel title="Overall bets" icon={Coins} contentClassName="gap-4">
            <OverallBetting
              players={players}
              currentPlayerId={player.id}
              overallBets={overallBets}
              payouts={overallPayouts}
              weekendStarted={weekendStarted}
              eliminationField={eliminationFieldValue}
            />
          </Panel>

          <Panel title="Per-event bets" icon={Percent} contentClassName="gap-4">
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
                /* The same `PlacedBetsTable` the Odds tab and the per-event
                   reveal use. This list is the one place a player sees every
                   wager they have running at once, which is exactly the case
                   the old per-event stack of sentences served worst: each bet
                   was its own bordered block with its numbers written into
                   prose, so comparing two of them meant reading rather than
                   scanning. The event name rides along as the row's context
                   line, since here — unlike on an event's own card — the
                   surrounding UI doesn't say which event a bet belongs to. */
                <PlacedBetsTable
                  colorByPlayer={colorByPlayer}
                  onEdit={(betId) => {
                    const row = myPerEventBets.find((r) => r.bet.id === betId);
                    if (row) startEditingPerEvent(row.event.id, row.bet);
                  }}
                  onDelete={handleCancelPerEvent}
                  bets={myPerEventBets.map(({ event, bet }) => {
                    const ranking = rankingByEvent.get(event.id) ?? [];
                    return {
                      id: bet.id,
                      context: event.name,
                      pick: playersById.get(bet.pick_player_id) ?? null,
                      target: bet.target,
                      odds: perEventPayoutMultiplierOrNull(ranking, bet.pick_player_id, bet.target),
                      wager: bet.wager,
                      status: bet.status,
                      payout: bet.payout,
                      canEdit: bet.status === "open" && event.status === "planned",
                      busy: busyBetId === bet.id,
                    };
                  })}
                />
              )}

              {/* One editor, below the table, for whichever row's pencil was
                  tapped — rather than the previous arrangement where every
                  row carried its own dormant form. */}
              {editingRow ? (
                <div className="bevel-sunken bg-sunken flex flex-col gap-3 rounded-md p-3">
                  <span className="hud-label text-muted-foreground">
                    Editing your bet on {editingRow.event.name}
                  </span>

                  <div className="flex flex-col gap-2 sm:flex-row">
                    <select
                      className={SELECT_CLASS}
                      value={pickDraft[editingRow.event.id] ?? ""}
                      onChange={(e) =>
                        setPickDraft((d) => ({ ...d, [editingRow.event.id]: e.target.value }))
                      }
                    >
                      <option value="">Pick a player…</option>
                      {players.map((pl) => (
                        <option key={pl.id} value={pl.id}>
                          {pl.name}
                        </option>
                      ))}
                    </select>
                    <select
                      className={SELECT_CLASS}
                      value={targetDraft[editingRow.event.id] ?? "win"}
                      onChange={(e) =>
                        setTargetDraft((d) => ({
                          ...d,
                          [editingRow.event.id]: e.target.value as "win" | "place",
                        }))
                      }
                    >
                      {PER_EVENT_TARGETS.map((t) => (
                        <option key={t.target} value={t.target}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <span className="hud-label text-muted-foreground">Stake</span>
                      <WagerStepper
                        value={editWager}
                        max={editMaxWager}
                        onChange={(next) =>
                          setWagerDraft((d) => ({ ...d, [editingRow.event.id]: next }))
                        }
                        disabled={busyBetId === editingRow.bet.id}
                      />
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="hud-label text-muted-foreground">Odds</span>
                        <span className="font-score text-base leading-9 tabular-nums">
                          {editOdds != null ? `${editOdds.toFixed(1)}×` : "—"}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="hud-label text-muted-foreground">To win</span>
                        <span className="font-score text-primary text-base leading-9 tabular-nums">
                          {editOdds != null && editWager > 0
                            ? (editWager * editOdds).toFixed(1)
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      className="flex-1"
                      onClick={() =>
                        handleUpdatePerEvent(editingRow.event.id, editingRow.bet.id)
                      }
                      disabled={
                        busyBetId === editingRow.bet.id ||
                        !pickDraft[editingRow.event.id] ||
                        editWager <= 0 ||
                        !fitsBudget(editWager, editMaxWager)
                      }
                    >
                      Save changes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => discardPerEventEdit(editingRow.event.id)}
                    >
                      Discard
                    </Button>
                  </div>
                </div>
              ) : null}
            </>
          </Panel>
        </>
      )}
    </GameScreen>
  );
}
