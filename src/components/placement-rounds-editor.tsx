"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RankedResultsEditor } from "@/components/ranked-results-editor";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { recordPlacementRound } from "@/lib/data/mutations";
import { orderFromResults, positionsFromOrder } from "@/lib/scoring/rankedOrder";
import type { PlacementRoundRow, PlayerRow } from "@/lib/data/database.types";

/**
 * Optional extra rounds for a placement event (PRODUCT_SPEC.md → Scoring →
 * Multiple rounds) — not a separate format, just something any "standard"
 * placement event can use if there's time for more than one ranking.
 * Round 1 itself is owned by the event's normal "Enter/Edit results" flow
 * (event-card.tsx); this component only manages rounds from `minRound` on
 * (2 by default), each a full drag-order + tie ranking, same editor as the
 * main results flow. "Add another round" opens a fresh one without
 * touching earlier rounds, and editing an already-recorded round only
 * replaces that round's own rows (recordPlacementRound). The final
 * event_results.position (the SUM of every round a player's been ranked
 * in) is derived and auto-synced server-side on every save — this
 * component only ever writes one round at a time.
 */
export function PlacementRoundsEditor({
  eventId,
  players,
  playerRounds,
  minRound = 2,
}: {
  eventId: string;
  players: PlayerRow[];
  playerRounds: PlacementRoundRow[];
  minRound?: number;
}) {
  const playerIds = players.map((p) => p.id);
  const playerById = new Map(players.map((p) => [p.id, p]));
  const roundNumbers = [...new Set(playerRounds.filter((r) => r.round >= minRound).map((r) => r.round))].sort(
    (a, b) => a - b,
  );

  const [editingRound, setEditingRound] = useState<number | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [tied, setTied] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = getSupabaseBrowserClient();

  function openRound(round: number) {
    const existing = playerRounds
      .filter((r) => r.round === round)
      .map((r) => ({ player_id: r.player_id, position: r.position }));
    const { order: initialOrder, tied: initialTied } = orderFromResults(playerIds, existing);
    setOrder(initialOrder);
    setTied(initialTied);
    setEditingRound(round);
    setError(null);
  }

  function toggleTie(playerId: string) {
    setTied((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  }

  async function save() {
    if (editingRound == null) return;
    setBusy(true);
    setError(null);
    try {
      const positions = positionsFromOrder(order, tied);
      await recordPlacementRound(
        client,
        eventId,
        editingRound,
        Object.entries(positions).map(([player_id, position]) => ({ player_id, position })),
      );
      setEditingRound(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  // Include the in-progress new round (not yet saved, so not in
  // roundNumbers yet) in the render list so it shows in place rather than
  // needing a separate block below.
  const displayRounds =
    editingRound != null && !roundNumbers.includes(editingRound)
      ? [...roundNumbers, editingRound]
      : roundNumbers;

  return (
    <div className="flex flex-col gap-3">
      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      {displayRounds.map((round) => (
        <div key={round} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground font-display text-[10px] tracking-wider uppercase">
              Round {round}
            </p>
            {editingRound !== round ? (
              <Button size="sm" variant="ghost" onClick={() => openRound(round)}>
                <Pencil className="size-3.5" />
                Edit
              </Button>
            ) : null}
          </div>
          {editingRound === round ? (
            <>
              <RankedResultsEditor
                order={order}
                tied={tied}
                players={playerById}
                onReorder={setOrder}
                onToggleTie={toggleTie}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={save} disabled={busy}>
                  Save round {round}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditingRound(null)} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-xs">
              {playerRounds
                .filter((r) => r.round === round)
                .sort((a, b) => a.position - b.position)
                .map((r) => `${r.position}. ${playerById.get(r.player_id)?.name ?? "?"}`)
                .join(", ")}
            </p>
          )}
        </div>
      ))}

      {editingRound == null && players.length > 0 ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => openRound(Math.max(minRound - 1, roundNumbers[roundNumbers.length - 1] ?? 0) + 1)}
          className="w-fit"
        >
          <Plus className="size-4" />
          Add {roundNumbers.length === 0 ? "a" : "another"} round
        </Button>
      ) : null}
    </div>
  );
}
