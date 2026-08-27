"use client";

import { useState } from "react";

import { GroomRankingEditor } from "@/components/groom-ranking-editor";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { setBracketSeeds } from "@/lib/data/mutations";
import type { BracketSeedRow, PlayerRow } from "@/lib/data/database.types";
import type { RankingEntry } from "@/lib/odds/ranking";

/**
 * Adjust a bracket event's seed order — pre-filled from the groom's
 * per-event ranking (`event_rankings`) the first time it's opened for this
 * event, then edited independently (PRODUCT_SPEC.md → Event formats →
 * Bracket): tweaking bracket seeding must never silently change betting
 * odds. Thin wrapper around the same drag list `EventOddsEditor` already
 * uses — no changes needed to `GroomRankingEditor` itself.
 */
export function BracketSeedEditor({
  eventId,
  players,
  bracketSeeds,
  eventRanking,
}: {
  eventId: string;
  players: PlayerRow[];
  bracketSeeds: BracketSeedRow[];
  eventRanking: RankingEntry[];
}) {
  const committedOrder = [...bracketSeeds]
    .sort((a, b) => a.seed - b.seed)
    .map((s) => s.player_id)
    .filter((id) => players.some((p) => p.id === id));

  const rankingOrder = [...eventRanking]
    .sort((a, b) => a.rank - b.rank)
    .map((r) => r.playerId)
    .filter((id) => players.some((p) => p.id === id));

  const baseOrder = committedOrder.length > 0 ? committedOrder : rankingOrder;
  const defaultOrder = [
    ...baseOrder,
    ...players.map((p) => p.id).filter((id) => !baseOrder.includes(id)),
  ];

  const [draftOrder, setDraftOrder] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editingOrder = draftOrder ?? defaultOrder;
  const dirty = draftOrder !== null && JSON.stringify(draftOrder) !== JSON.stringify(committedOrder);
  const playersById = new Map(players.map((p) => [p.id, p]));

  async function handleSave() {
    const order = draftOrder ?? defaultOrder;
    setSaving(true);
    setError(null);
    try {
      await setBracketSeeds(
        getSupabaseBrowserClient(),
        eventId,
        order.map((player_id, i) => ({ player_id, seed: i + 1 })),
      );
      setDraftOrder(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (players.length < 2) {
    return <p className="text-muted-foreground text-sm">Add at least two players first.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-xs">
        {committedOrder.length === 0
          ? "Starting from the event ranking — adjust and save to set the bracket seed order."
          : "Seed order (independent of the betting-odds ranking)."}
      </p>
      <GroomRankingEditor order={editingOrder} players={playersById} onReorder={setDraftOrder} />
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button size="sm" onClick={handleSave} disabled={saving || (!dirty && committedOrder.length > 0)} className="w-fit">
        Save seed order
      </Button>
    </div>
  );
}
