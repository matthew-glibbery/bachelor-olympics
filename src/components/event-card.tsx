import { useState, type ChangeEvent } from "react";
import Image from "next/image";
import { ImageUp, Pencil, Play, RotateCcw, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlayerName } from "@/components/player-name";
import { RankedResultsEditor } from "@/components/ranked-results-editor";
import { EventOddsTable } from "@/components/event-odds-table";
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
import type { RankingEntry } from "@/lib/odds/ranking";
import type {
  EventResultRow,
  EventRow,
  PerEventBetRow,
  PlayerRow,
} from "@/lib/data/database.types";

const STATUS_LABEL: Record<EventRow["status"], string> = {
  planned: "Not started",
  scoring: "In progress",
  resolved: "Resolved",
  cancelled: "Cancelled",
};

interface EventCardProps {
  event: EventRow;
  players: PlayerRow[];
  results: EventResultRow[];
  ranking: RankingEntry[];
  bets: PerEventBetRow[];
  groomUnlocked: boolean;
}

export function EventCard({
  event,
  players,
  results,
  ranking,
  bets,
  groomUnlocked,
}: EventCardProps) {
  const isPlacement = event.scoring_mode === "placement";
  const playerIds = players.map((p) => p.id);
  const playerById = new Map(players.map((p) => [p.id, p]));
  // Betting closes once the event leaves "planned" — bets stay a secret
  // until then (src/app/bets/page.tsx handles placement while planned).
  const bettingClosed = event.status !== "planned";

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
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          {event.photo_url ? (
            <Image
              src={event.photo_url}
              alt=""
              width={56}
              height={56}
              className="shrink-0 rounded-md object-cover"
              style={{ width: 56, height: 56 }}
            />
          ) : null}
          <div className="flex flex-col gap-1.5">
            <CardTitle className="flex flex-wrap items-center gap-2">
              {event.name}
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
            </CardTitle>
            {event.notes ? <CardDescription>{event.notes}</CardDescription> : null}
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
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="results">
          <TabsList>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="odds">Odds</TabsTrigger>
            {bettingClosed ? <TabsTrigger value="bets">Bets</TabsTrigger> : null}
          </TabsList>

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
              <div className="flex flex-col gap-3 border-t pt-3">
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
              <div className="flex flex-col gap-1 border-t pt-3 text-sm">
                {players.map((p) => {
                  const r = results.find((x) => x.player_id === p.id);
                  const value = isPlacement ? r?.position : r?.raw;
                  return (
                    <span
                      key={p.id}
                      className={cn(
                        "flex items-center justify-between gap-2",
                        value == null && "text-muted-foreground",
                      )}
                    >
                      <PlayerName name={p.name} state={p.state ?? "??"} size="sm" />
                      <span className="tabular-nums">{value ?? "—"}</span>
                    </span>
                  );
                })}
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="odds" className="pt-3">
            <EventOddsTable ranking={ranking} players={playerById} />
          </TabsContent>

          {bettingClosed ? (
            <TabsContent value="bets" className="pt-3">
              <EventBetsList bets={bets} players={playerById} />
            </TabsContent>
          ) : null}
        </Tabs>
      </CardContent>
    </Card>
  );
}
