"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";

import { GroomRankingEditor } from "@/components/groom-ranking-editor";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { setEventRanking } from "@/lib/data/mutations";
import type { EventRankingRow, EventRow, PlayerRow } from "@/lib/data/database.types";

const SELECT_CLASS =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

/**
 * Groom-tools sub-section: set the private strength ranking FOR ONE EVENT AT
 * A TIME (PRODUCT_SPEC.md → Overall betting → Odds source — one ranking per
 * event, not one overall ranking). Drives both that event's own odds and,
 * via src/lib/odds/aggregate.ts, the overall win/top3 odds shown on /bets.
 */
export function EventOddsEditor({
  players,
  events,
  eventRankings,
}: {
  players: PlayerRow[];
  events: EventRow[];
  eventRankings: EventRankingRow[];
}) {
  const rankable = events.filter((e) => e.status !== "cancelled");
  const [selectedEventId, setSelectedEventId] = useState(rankable[0]?.id ?? "");
  const selectedEvent = rankable.find((e) => e.id === selectedEventId);
  const locked = selectedEvent ? selectedEvent.status !== "planned" : false;

  const committedOrder = eventRankings
    .filter((r) => r.event_id === selectedEventId)
    .sort((a, b) => a.rank - b.rank)
    .map((r) => r.player_id)
    .filter((id) => players.some((p) => p.id === id));
  const defaultOrder = [
    ...committedOrder,
    ...players.map((p) => p.id).filter((id) => !committedOrder.includes(id)),
  ];

  const [draftOrder, setDraftOrder] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraftOrder(null);
    setError(null);
  }, [selectedEventId]);

  const editingOrder = draftOrder ?? defaultOrder;
  const dirty = draftOrder !== null && JSON.stringify(draftOrder) !== JSON.stringify(committedOrder);
  const playersById = new Map(players.map((p) => [p.id, p]));

  async function handleSave() {
    if (draftOrder === null || !selectedEventId) return;
    setSaving(true);
    setError(null);
    try {
      await setEventRanking(
        getSupabaseBrowserClient(),
        selectedEventId,
        draftOrder.map((player_id, i) => ({ player_id, rank: i + 1 })),
      );
      setDraftOrder(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (rankable.length === 0) {
    return <p className="text-muted-foreground text-sm">No events to rank yet.</p>;
  }
  if (players.length < 2) {
    return (
      <p className="text-muted-foreground text-sm">Add at least two players first.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <select
        className={SELECT_CLASS}
        value={selectedEventId}
        onChange={(e) => setSelectedEventId(e.target.value)}
      >
        {rankable.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>

      {locked ? (
        <div className="flex flex-col gap-1.5">
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Lock className="size-3.5" />
            Locked — this event has already started.
          </p>
          {committedOrder.length === 0 ? (
            <p className="text-muted-foreground text-sm">No ranking was ever set for this event.</p>
          ) : (
            committedOrder.map((playerId, i) => {
              const player = playersById.get(playerId);
              if (!player) return null;
              return (
                <div
                  key={playerId}
                  className="bg-card flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
                >
                  <span className="w-5 text-right font-semibold tabular-nums">{i + 1}</span>
                  {player.name}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <>
          <GroomRankingEditor
            order={editingOrder}
            players={playersById}
            onReorder={setDraftOrder}
          />
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          <Button size="sm" onClick={handleSave} disabled={!dirty || saving} className="w-fit">
            Save ranking for this event
          </Button>
        </>
      )}
    </div>
  );
}
