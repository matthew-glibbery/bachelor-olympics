import { useState, type ChangeEvent } from "react";
import Image from "next/image";
import { Flame, ImageUp, Pencil, Play, RotateCcw, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlayerName } from "@/components/player-name";
import { VictoryReplayButton } from "@/components/victory-replay-button";
import { RankedResultsEditor } from "@/components/ranked-results-editor";
import { EventOddsBetting } from "@/components/event-odds-betting";
import { EventBetsList } from "@/components/event-bets-list";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
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
import type { RankingEntry } from "@/lib/odds/ranking";
import type { BettingReserve } from "@/lib/betting/reserve";
import type {
  EventResultRow,
  EventRow,
  MultiplierRow,
  PerEventBetRow,
  PlayerRow,
} from "@/lib/data/database.types";

const MULTIPLIER_DEFAULT = 1.0;

const STATUS_LABEL: Record<EventRow["status"], string> = {
  planned: "Not started",
  scoring: "In progress",
  resolved: "Resolved",
  cancelled: "Cancelled",
};

/** "+30%" style badge next to a trailing player's name — see EventCardProps.catchUpBonuses. */
function CatchUpBadge({ bonus }: { bonus: number }) {
  return (
    <Badge variant="outline" className="text-primary border-primary/40 gap-1">
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
  groomUnlocked,
  catchUpBonuses,
  currentPlayerId,
  reserve,
}: EventCardProps) {
  const isPlacement = event.scoring_mode === "placement";
  const playerIds = players.map((p) => p.id);
  const playerById = new Map(players.map((p) => [p.id, p]));
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
  const multiplierFor = (playerId: string): number =>
    multipliers.find((m) => m.player_id === playerId)?.value ?? MULTIPLIER_DEFAULT;
  // Betting closes once the event leaves "planned" — bets stay a secret
  // until then (src/app/bets/page.tsx handles placement while planned).
  const bettingClosed = event.status !== "planned";
  const myBet = bets.find((b) => b.player_id === currentPlayerId);

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
        if (isPlacement) {
          await resolvePerEventBets(client, event.id, entries);
        }
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
      <div className="flex items-start gap-3">
        {event.photo_url ? (
          <Image
            src={event.photo_url}
            alt=""
            width={64}
            height={64}
            className="border-bevel-dark shrink-0 rounded-md border-2 object-cover"
            style={{ width: 64, height: 64 }}
          />
        ) : null}
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-extruded text-lg sm:text-xl">{event.name}</h2>
            <Badge
              variant={
                event.status === "resolved"
                  ? "default"
                  : event.status === "scoring"
                    ? "outline"
                    : "secondary"
              }
            >
              {STATUS_LABEL[event.status]}
            </Badge>
            <Badge variant="outline">
              {isPlacement ? "Placement" : "Absolute"}
            </Badge>
          </div>
          {event.notes ? <p className="text-muted-foreground text-sm">{event.notes}</p> : null}
          {event.status === "planned" && catchUpBonuses && catchUpBonuses.size > 0 ? (
            <div className="flex flex-col gap-1 text-xs">
              <span className="font-display text-muted-foreground tracking-wide uppercase">
                Catch-up bonus this event:
              </span>
              <div className="flex flex-col gap-1">
                {[...catchUpBonuses.entries()].map(([playerId, bonus]) => {
                  const p = playerById.get(playerId);
                  if (!p) return null;
                  return (
                    <span key={playerId} className="flex items-center justify-between gap-2">
                      <PlayerName name={p.name} size="sm" />
                      <CatchUpBadge bonus={bonus} />
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}
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

      <Tabs defaultValue="results">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <TabsList className="bevel-sunken h-auto w-fit gap-1 rounded-md bg-transparent p-1">
            <TabsTrigger
              value="results"
              className="font-display data-[state=active]:bevel-raised rounded-sm px-3 py-1.5 text-xs tracking-wide uppercase shadow-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Results
            </TabsTrigger>
            <TabsTrigger
              value="odds"
              className="font-display data-[state=active]:bevel-raised rounded-sm px-3 py-1.5 text-xs tracking-wide uppercase shadow-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
            >
              Odds
            </TabsTrigger>
            {bettingClosed ? (
              <TabsTrigger
                value="bets"
                className="font-display data-[state=active]:bevel-raised rounded-sm px-3 py-1.5 text-xs tracking-wide uppercase shadow-none data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                Bets
              </TabsTrigger>
            ) : null}
          </TabsList>
          {event.status === "resolved" ? (
            <VictoryReplayButton event={event} results={results} players={players} />
          ) : null}
        </div>

        <TabsContent value="results" className="flex flex-col gap-3 pt-3">
          {error ? <p className="text-destructive text-sm">{error}</p> : null}

          {!groomUnlocked ? null : (
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
          )}

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
          ) : event.status !== "planned" ? (
            <div className="bevel-sunken overflow-x-auto rounded-md px-3 py-2">
              <div className="grid min-w-[26rem] grid-cols-[1.5rem_1fr_auto_auto_auto] items-center gap-x-3 gap-y-1.5 text-sm">
                <span className="font-display text-muted-foreground text-[10px] uppercase">#</span>
                <span className="font-display text-muted-foreground text-[10px] uppercase">Player</span>
                <span className="font-display text-muted-foreground text-right text-[10px] uppercase">Pts</span>
                <span className="font-display text-muted-foreground text-right text-[10px] uppercase">×</span>
                <span className="font-display text-muted-foreground text-right text-[10px] uppercase">
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
                        <PlayerName name={p.name} size="sm" />
                        {catchUpBonuses?.has(p.id) ? <CatchUpBadge bonus={catchUpBonus} /> : null}
                      </span>
                      <span className="font-score text-right tabular-nums">
                        {points != null ? Math.round(points) : "—"}
                      </span>
                      <span className="font-score text-right tabular-nums">
                        {multiplier.toFixed(1)}×
                      </span>
                      <span className="font-score text-primary text-right font-medium tabular-nums">
                        {total != null ? Math.round(total) : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="odds" className="pt-3">
          <EventOddsBetting
            event={event}
            ranking={ranking}
            players={playerById}
            currentPlayerId={currentPlayerId}
            myBet={myBet}
            reserve={reserve}
          />
        </TabsContent>

        {bettingClosed ? (
          <TabsContent value="bets" className="pt-3">
            <EventBetsList bets={bets} players={playerById} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
