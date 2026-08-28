import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import Image from "next/image";
import { Flame, ImageUp, Pencil, Play, RotateCcw, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlayerName } from "@/components/player-name";
import { assignPlayerColors } from "@/lib/chartColors";
import { VictoryReplayButton } from "@/components/victory-replay-button";
import { RankedResultsEditor } from "@/components/ranked-results-editor";
import { BracketSeedEditor } from "@/components/bracket-seed-editor";
import { BracketEditor } from "@/components/bracket-editor";
import { RoundRobinSchedule } from "@/components/round-robin-schedule";
import { PlacementRoundsEditor } from "@/components/placement-rounds-editor";
import { EventOddsBetting } from "@/components/event-odds-betting";
import { EventBetsList } from "@/components/event-bets-list";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  bracketRowToMatch,
  cancelEvent,
  resetEvent,
  resolvePerEventBets,
  settleOverallBetsIfWeekendOver,
  setEventStatus,
  updateEventPhoto,
  upsertEventResults,
} from "@/lib/data/mutations";
import { uploadPhoto } from "@/lib/supabase/storage";
import { orderFromResults, positionsFromOrder } from "@/lib/scoring/rankedOrder";
import { scorePlacement, type PlacementEntry } from "@/lib/scoring/placement";
import { scoreAbsolute, type AbsoluteEntry } from "@/lib/scoring/absolute";
import { finalEventScore } from "@/lib/scoring/total";
import { winCounts } from "@/lib/scoring/roundRobinScore";
import type { RankingEntry } from "@/lib/odds/ranking";
import type { BettingReserve } from "@/lib/betting/reserve";
import type {
  BracketMatchRow,
  BracketSeedRow,
  EventResultRow,
  EventRow,
  MultiplierRow,
  PerEventBetRow,
  PlacementRoundRow,
  PlayerRow,
  RoundRobinMatchRow,
} from "@/lib/data/database.types";

const MULTIPLIER_DEFAULT = 1.0;

const STATUS_LABEL: Record<EventRow["status"], string> = {
  planned: "Not started",
  scoring: "In progress",
  resolved: "Resolved",
  cancelled: "Cancelled",
};

const FORMAT_LABEL: Record<EventRow["format"], string> = {
  standard: "Standard",
  bracket: "Bracket",
  round_robin: "Round-robin",
  best_of_rounds: "Best of rounds",
};

/* Tag colour per status. Two things this fixes: "in progress" and "not
   started" were previously two different neutral variants that, once the
   tags became flat tints, rendered as the same grey — so the card stopped
   distinguishing an event being played right now from one that hasn't
   started. And the event TILE already marks that same state with a red
   "Live" chip, so the card calling it neutral was the two views disagreeing
   about how urgent the same fact is. */
const STATUS_VARIANT: Record<
  EventRow["status"],
  "default" | "secondary" | "destructive" | "outline"
> = {
  planned: "secondary",
  scoring: "destructive",
  resolved: "default",
  cancelled: "outline",
};

/** "+30%" style badge next to a trailing player's name — see
 * EventCardProps.catchUpBonuses. Exported: the standalone catch-up-bonus
 * section on /events (src/app/events/page.tsx) uses the same badge, since
 * it moved out of this card. */
export function CatchUpBadge({ bonus }: { bonus: number }) {
  return (
    <Badge variant="default">
      <Flame className="size-3" />+{Math.round(bonus * 100)}%
    </Badge>
  );
}

interface EventCardProps {
  event: EventRow;
  players: PlayerRow[];
  results: EventResultRow[];
  /** This event's own multiplier rows only (pre-filtered by the caller,
   * same convention as `results`/`ranking`/`bets`). */
  multipliers: MultiplierRow[];
  ranking: RankingEntry[];
  bets: PerEventBetRow[];
  /** This event's own bracket seeds/matches / round-robin matches only
   * (pre-filtered by the caller, same convention as `results`). Empty
   * arrays for events not using that format. */
  bracketSeeds: BracketSeedRow[];
  bracketMatches: BracketMatchRow[];
  roundRobinMatches: RoundRobinMatchRow[];
  placementRounds: PlacementRoundRow[];
  groomUnlocked: boolean;
  /** playerId -> catch-up bonus fraction (e.g. 0.3 for +30%) for THIS event
   * only — either already applied (resolved/scoring) or a live preview of
   * what will apply once it resolves (still planned). See
   * PRODUCT_SPEC.md → Multipliers → Catch-up bonus. Null if this isn't the
   * one event catch-up currently touches. */
  catchUpBonuses: Map<string, number> | null;
  /** Session player, for the Odds tab's per-event betting form. Null if
   * nobody's selected yet on this device. */
  currentPlayerId: string | null;
  /** currentPlayerId's unallocated multiplier reserve — what's available to
   * wager on this (or any other) event right now. Null alongside
   * currentPlayerId. */
  reserve: BettingReserve | null;
}

export function EventCard({
  event,
  players,
  results,
  multipliers,
  ranking,
  bets,
  bracketSeeds,
  bracketMatches,
  roundRobinMatches,
  placementRounds,
  groomUnlocked,
  catchUpBonuses,
  currentPlayerId,
  reserve,
}: EventCardProps) {
  const isPlacement = event.scoring_mode === "placement";
  const isStandard = event.format === "standard";
  const playerIds = players.map((p) => p.id);
  const playerById = new Map(players.map((p) => [p.id, p]));
  // Same sort-by-id + "dark" mode convention as every other screen
  // (chartColors.ts's own doc comment) — computed from the same full
  // `players` list the caller passes everywhere else, so a player's ring
  // color here always matches their rank badge/chart line elsewhere.
  const colorByPlayer = useMemo(() => {
    const stable = [...players].sort((a, b) => a.id.localeCompare(b.id));
    return assignPlayerColors(stable.map((p) => ({ id: p.id, state: p.state ?? "", name: p.name })), "dark");
  }, [players]);
  // Once results exist, show players in the order they actually finished —
  // position ascending for placement events, raw value ordered by
  // lower_is_better for absolute ones — not roster order. Players with no
  // result yet trail at the end.
  const finishingOrder = [...players].sort((a, b) => {
    const ra = results.find((r) => r.player_id === a.id);
    const rb = results.find((r) => r.player_id === b.id);
    const va = isPlacement ? ra?.position : ra?.raw;
    const vb = isPlacement ? rb?.position : rb?.raw;
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (isPlacement) return va - vb;
    return event.lower_is_better ? va - vb : vb - va;
  });
  // Scored points per player for THIS event (before multiplier/catch-up) —
  // the same placement/absolute formula the store uses once resolved, computed
  // straight from `results` so it's also available live while still "scoring"
  // (not officially resolved yet, so it isn't in the store's derived score lines).
  const pointsByPlayer = isPlacement
    ? scorePlacement(
        results
          .filter((r) => r.position != null)
          .map((r): PlacementEntry => ({ playerId: r.player_id, position: r.position as number })),
      )
    : scoreAbsolute(
        results
          .filter((r) => r.raw != null)
          .map((r): AbsoluteEntry => ({ playerId: r.player_id, raw: r.raw as number })),
        { lowerIsBetter: event.lower_is_better },
      );
  // Win tally per player, round-robin events only — shown as its own
  // column in the results table alongside the derived points, since
  // "wins" is the number a groom/players actually want to see at a
  // glance for this format, not just the points it converts to.
  const winsByPlayer =
    event.format === "round_robin"
      ? winCounts(roundRobinMatches.map((m) => ({ teamA: m.team_a, teamB: m.team_b, winner: m.winner })))
      : null;
  const multiplierFor = (playerId: string): number =>
    multipliers.find((m) => m.player_id === playerId)?.value ?? MULTIPLIER_DEFAULT;
  // Betting closes once the event leaves "planned" — bets stay a secret
  // until then (src/app/bets/page.tsx handles placement while planned).
  const bettingClosed = event.status !== "planned";
  // Nothing to put in a Results tab until the event has actually been
  // started — see the tab strip below.
  const hasResults = event.status !== "planned";
  // Odds is always there; Results and Bets come and go with the event's
  // state. A tab strip holding exactly one tab is a control that can't do
  // anything — for a planned event that's what it had become, one lone
  // "Odds" plate sitting above the only panel there is — so it isn't drawn.
  const tabCount = 1 + (hasResults ? 1 : 0) + (bettingClosed ? 1 : 0);
  const myBet = bets.find((b) => b.player_id === currentPlayerId);

  /**
   * The tab strip is CONTROLLED, not `defaultValue`. Two things go wrong the
   * moment tabs can appear and disappear under an uncontrolled Radix Tabs,
   * and this card is keyed on the event id so it never remounts to reset:
   *
   *  1. Reset a resolved event while the Results tab is open and `hasResults`
   *     flips false — Results and Bets both unmount and the (now single-tab)
   *     strip is hidden, while Radix still holds "results" internally. That
   *     matches no panel, so the card renders its header and nothing else,
   *     with no way back to Odds short of navigating away.
   *  2. "Enter results" lives above the strip now, but the editor it opens is
   *     inside the Results panel — which Radix unmounts while Odds is
   *     selected. Clicking it from Odds set `editing` and put nothing on
   *     screen, and hid the button too, so the control looked broken.
   *
   * Owning the value fixes both: the effect below keeps it pointing at a
   * panel that actually exists, and `openEditing` sends you to Results.
   */
  const [tab, setTab] = useState<string>(hasResults ? "results" : "odds");

  useEffect(() => {
    if ((tab === "results" && !hasResults) || (tab === "bets" && !bettingClosed)) {
      setTab("odds");
    }
  }, [tab, hasResults, bettingClosed]);

  const [editing, setEditing] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Placement mode: drag-ordered ranking + tie toggles.
  const [order, setOrder] = useState<string[]>([]);
  const [tied, setTied] = useState<Set<string>>(new Set());

  // Absolute mode: raw numeric value per player.
  const [rawDraft, setRawDraft] = useState<Record<string, string>>({});

  const client = getSupabaseBrowserClient();

  function openEditing() {
    if (isPlacement) {
      const { order: initialOrder, tied: initialTied } = orderFromResults(playerIds, results);
      setOrder(initialOrder);
      setTied(initialTied);
    } else {
      setRawDraft(
        Object.fromEntries(
          players.map((p) => {
            const existing = results.find((r) => r.player_id === p.id);
            return [p.id, existing?.raw != null ? String(existing.raw) : ""];
          }),
        ),
      );
    }
    // The editor renders inside the Results panel, so make sure that's the
    // panel on screen — this button is reachable from any tab now.
    setTab("results");
    setEditing(true);
  }

  async function startScoring() {
    setBusy(true);
    setError(null);
    try {
      await setEventStatus(client, event.id, "scoring");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveResults(finalize: boolean) {
    setBusy(true);
    setError(null);
    try {
      const entries = isPlacement
        ? Object.entries(positionsFromOrder(order, tied)).map(([player_id, position]) => ({
            player_id,
            position,
          }))
        : players
            .map((p) => {
              const raw = rawDraft[p.id]?.trim();
              if (!raw) return null;
              const num = Number(raw);
              return Number.isFinite(num) ? { player_id: p.id, raw: num } : null;
            })
            .filter((e): e is NonNullable<typeof e> => e !== null);

      if (finalize && entries.length !== players.length) {
        setError("Every competitor needs a result before finalizing.");
        setBusy(false);
        return;
      }

      await upsertEventResults(client, event.id, entries);
      if (finalize) {
        await setEventStatus(client, event.id, "resolved");
        // Both scoring modes, not just placement. This used to be guarded by
        // `if (isPlacement)`, which meant a winning bet on an absolute-scored
        // event (the golf) never settled: it stayed "open" with the stake
        // escrowed even after the result was in. resolvePerEventBets now
        // takes the event itself and derives finishing positions from raw
        // scores where there are no stored positions.
        await resolvePerEventBets(client, event, entries);
        await settleOverallBetsIfWeekendOver(client);
        setEditing(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handlePhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const url = await uploadPhoto(client, "events", event.id, file);
      await updateEventPhoto(client, event.id, url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function doCancel() {
    setBusy(true);
    setError(null);
    try {
      await cancelEvent(client, event.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function doReset() {
    setBusy(true);
    setError(null);
    try {
      await resetEvent(client, event.id);
      setConfirmingReset(false);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function toggleTie(playerId: string) {
    setTied((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  return (
    <div className="bevel-raised bg-card flex flex-col gap-4 rounded-md p-4">
      {/* Photo big at top, banner-style — this card is now the sole
          per-event view (events/page.tsx enters it after a tile is picked,
          rather than showing it small alongside a thumbnail strip), so the
          photo gets the same "hero image" treatment the event itself earns
          once you've actually opened it. */}
      {event.photo_url ? (
        <div className="border-bevel-dark relative -mx-4 -mt-4 aspect-[16/9] w-[calc(100%+2rem)] overflow-hidden rounded-t-md border-b-2 sm:aspect-[21/9]">
          <Image src={event.photo_url} alt="" fill sizes="100vw" className="object-cover" />
        </div>
      ) : null}
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="extruded text-lg sm:text-xl">{event.name}</h2>
            <Badge variant={STATUS_VARIANT[event.status]}>
              {STATUS_LABEL[event.status]}
            </Badge>
            <Badge variant="secondary">
              {isPlacement ? "Placement" : "Absolute"}
            </Badge>
            {!isStandard ? <Badge variant="secondary">{FORMAT_LABEL[event.format]}</Badge> : null}
          </div>
          {/* `event.notes` ("Scored on strokes, lowest wins", and so on) is
              deliberately not rendered. It's groom-authored setup copy that
              mostly restates the scoring-mode badge sitting next to the title,
              and on a phone it pushed the tabs — the thing anyone actually
              opens an event to reach — below the fold. Still editable in
              groom tools (manage-event-row.tsx); just not on this card. */}
          {groomUnlocked ? (
            <Label className="text-muted-foreground inline-flex w-fit cursor-pointer items-center gap-1.5 text-xs">
              <ImageUp className="size-3.5" />
              {event.photo_url ? "Replace photo" : "Add photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhoto}
                disabled={busy}
              />
            </Label>
          ) : null}
        </div>
      </div>

      {/* The groom's own controls for this event — start scoring, enter or
          edit results, reset, cancel. These used to live inside the Results
          tab, which is the only reason that tab had to exist for an event
          that hadn't been played yet. Above the tab strip they're reachable
          in every state, and Results gets to be only about results. */}
      {groomUnlocked ? (
        <div className="flex flex-wrap items-center gap-2">
          {event.status === "planned" ? (
            <Button size="sm" onClick={startScoring} disabled={busy}>
              <Play className="size-4" />
              Start scoring
            </Button>
          ) : null}
          {(event.status === "scoring" || event.status === "resolved") && !editing ? (
            <Button size="sm" variant="outline" onClick={openEditing}>
              <Pencil className="size-4" />
              {event.status === "resolved" ? "Edit results" : "Enter results"}
            </Button>
          ) : null}
          {confirmingReset ? (
            <>
              <span className="text-sm">Clear results and reset to not started?</span>
              <Button size="sm" variant="destructive" onClick={doReset} disabled={busy}>
                Yes, reset
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmingReset(false)}>
                No
              </Button>
            </>
          ) : event.status !== "planned" ? (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setConfirmingReset(true)}
            >
              <RotateCcw className="size-4" />
              Reset event
            </Button>
          ) : null}
          {confirmingCancel ? (
            <>
              <span className="text-sm">Cancel this event?</span>
              <Button size="sm" variant="destructive" onClick={doCancel} disabled={busy}>
                Yes, cancel
              </Button>
              <Button size="sm" variant="outline" onClick={() => setConfirmingCancel(false)}>
                No
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => setConfirmingCancel(true)}
            >
              <X className="size-4" />
              Cancel event
            </Button>
          )}
        </div>
      ) : null}

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <Tabs value={tab} onValueChange={setTab}>
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-2",
            tabCount < 2 && "hidden",
          )}
        >
          <TabsList className="bevel-sunken bg-sunken h-auto w-fit gap-1 rounded-md p-1">
            {/* An event nobody has played has no results, and this tab used
                to open onto an empty panel — worse than no tab at all, since
                a tab is a promise that something is behind it. */}
            {hasResults ? (
              <TabsTrigger
                value="results"
                className="hud-label data-[state=active]:bevel-raised rounded-sm px-3 py-1.5 shadow-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Results
              </TabsTrigger>
            ) : null}
            <TabsTrigger
              value="odds"
              className="hud-label data-[state=active]:bevel-raised rounded-sm px-3 py-1.5 shadow-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Odds
            </TabsTrigger>
            {bettingClosed ? (
              <TabsTrigger
                value="bets"
                className="hud-label data-[state=active]:bevel-raised rounded-sm px-3 py-1.5 shadow-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Bets
              </TabsTrigger>
            ) : null}
          </TabsList>
          {event.status === "resolved" ? (
            <VictoryReplayButton event={event} results={results} players={players} />
          ) : null}
        </div>

        {hasResults ? (
          <TabsContent value="results" className="flex flex-col gap-3 pt-3">
            {!isStandard ? (
              <div className="border-bevel-dark/40 flex flex-col gap-3 border-b pb-3">
                {event.format === "bracket" ? (
                  <>
                    <BracketSeedEditor
                      eventId={event.id}
                      players={players}
                      bracketSeeds={bracketSeeds}
                      eventRanking={ranking}
                    />
                    <BracketEditor
                      eventId={event.id}
                      players={playerById}
                      colorByPlayer={colorByPlayer}
                      seeds={bracketSeeds}
                      matches={bracketMatches.map(bracketRowToMatch)}
                    />
                  </>
                ) : event.format === "round_robin" ? (
                  <RoundRobinSchedule
                    eventId={event.id}
                    players={playerById}
                    colorByPlayer={colorByPlayer}
                    matches={roundRobinMatches}
                  />
                ) : (
                  <PlacementRoundsEditor eventId={event.id} players={players} playerRounds={placementRounds} />
                )}
                <p className="text-muted-foreground text-xs">
                  {event.format === "best_of_rounds"
                    ? "Each player's best round feeds the Results table below automatically — use “Enter/Edit results” to manually adjust the final order before finalizing."
                    : "Results above feed the Results table below automatically as matches are decided — use “Enter/Edit results” to manually adjust the final order before finalizing."}
                </p>
              </div>
            ) : null}
            {editing ? (
              <div className="border-bevel-dark/40 flex flex-col gap-3 border-t pt-3">
                {isPlacement ? (
                  <RankedResultsEditor
                    order={order}
                    tied={tied}
                    players={playerById}
                    onReorder={setOrder}
                    onToggleTie={toggleTie}
                  />
                ) : (
                  <div className="flex flex-col gap-2">
                    {players.map((p) => (
                      <div key={p.id} className="flex items-center justify-between gap-3">
                        <PlayerName
                          name={p.name}
                          state={p.state ?? "??"}
                          size="sm"
                          photoUrl={p.photo_url}
                          color={colorByPlayer[p.id]}
                        />
                        <Input
                          type="number"
                          step="any"
                          className="w-24"
                          placeholder="result"
                          value={rawDraft[p.id] ?? ""}
                          onChange={(e) =>
                            setRawDraft((d) => ({ ...d, [p.id]: e.target.value }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" onClick={() => saveResults(false)} disabled={busy}>
                    Save draft
                  </Button>
                  <Button size="sm" onClick={() => saveResults(true)} disabled={busy}>
                    Finalize
                  </Button>
                </div>
              </div>
            ) : (
              // Raw, the applied multiplier, and Total are the three
              // figures this table exists to show — what you actually
              // scored, what it's worth per point, and what that comes out
              // to — all three visible at every width, including on the
              // mobile PWA (direct feedback: the multiplier used to drop
              // below `sm`, but it's the whole "working out" behind Total,
              // not an optional extra). Real spacer columns between the
              // number groups so they don't read as one squeezed-together
              // figure.
              <div className="bevel-sunken bg-sunken rounded-md px-3 py-2">
                {/* Column gap is padding on the cells, not `gap-x`: these rows
                    are `display: contents`, so the zebra stripe has to be
                    painted per-cell, and a real gap left unpainted vertical
                    slots through every striped row — it read as a rendering
                    fault rather than a stripe. The empty spans are spacer
                    columns for the same reason. */}
                <div
                  className={cn(
                    "grid items-center gap-y-1.5 text-sm [&>*]:px-1",
                    winsByPlayer
                      ? "grid-cols-[2rem_1fr_auto_0.75rem_auto_0.75rem_auto_0.75rem_auto]"
                      : "grid-cols-[2rem_1fr_auto_0.75rem_auto_0.75rem_auto]",
                  )}
                >
                  <span className="hud-label text-muted-foreground">#</span>
                  <span className="hud-label text-muted-foreground">Player</span>
                  {winsByPlayer ? (
                    <>
                      <span className="hud-label text-muted-foreground text-right">Wins</span>
                      <span aria-hidden />
                    </>
                  ) : null}
                  <span className="hud-label text-muted-foreground text-right">Raw</span>
                  <span aria-hidden />
                  <span className="hud-label text-muted-foreground text-right">×</span>
                  <span aria-hidden />
                  <span className="hud-label text-muted-foreground text-right">
                    Total
                  </span>
                  {finishingOrder.map((p, i) => {
                    const r = results.find((x) => x.player_id === p.id);
                    const hasResult = (isPlacement ? r?.position : r?.raw) != null;
                    const points = pointsByPlayer.get(p.id);
                    const multiplier = multiplierFor(p.id);
                    const catchUpBonus = catchUpBonuses?.get(p.id) ?? 0;
                    const total = points != null ? finalEventScore(points, multiplier, catchUpBonus) : null;
                    return (
                      <div
                        key={p.id}
                        className={cn(
                          "contents",
                          !hasResult && "text-muted-foreground",
                          "[&>*]:py-1",
                          i % 2 === 1 && "[&>*]:bg-black/15",
                        )}
                      >
                        <span className="font-score tabular-nums">{hasResult ? i + 1 : "—"}</span>
                        <span className="inline-flex min-w-0 items-center gap-1.5">
                          <PlayerName name={p.name} size="sm" photoUrl={p.photo_url} color={colorByPlayer[p.id]} />
                          {catchUpBonuses?.has(p.id) ? <CatchUpBadge bonus={catchUpBonus} /> : null}
                        </span>
                        {winsByPlayer ? (
                          <>
                            <span className="font-score text-right tabular-nums">
                              {winsByPlayer.get(p.id) ?? 0}
                            </span>
                            <span aria-hidden />
                          </>
                        ) : null}
                        <span className="font-score text-right tabular-nums">
                          {points != null ? Math.round(points) : "—"}
                        </span>
                        <span aria-hidden />
                        <span className="font-score text-right tabular-nums">
                          {multiplier.toFixed(1)}×
                        </span>
                        <span aria-hidden />
                        <span className="font-score text-primary text-right font-medium tabular-nums">
                          {total != null ? Math.round(total) : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>
        ) : null}

        <TabsContent value="odds" className="pt-3">
          <EventOddsBetting
            event={event}
            ranking={ranking}
            players={playerById}
            colorByPlayer={colorByPlayer}
            currentPlayerId={currentPlayerId}
            myBet={myBet}
            reserve={reserve}
          />
        </TabsContent>

        {bettingClosed ? (
          <TabsContent value="bets" className="pt-3">
            <EventBetsList
              bets={bets}
              players={playerById}
              colorByPlayer={colorByPlayer}
              ranking={ranking}
            />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
