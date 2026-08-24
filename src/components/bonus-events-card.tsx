"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { Pencil, PartyPopper, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlayerName } from "@/components/player-name";
import { WeekendAwardsSection } from "@/components/weekend-awards";
import { cn } from "@/lib/utils";
import { assignPlayerColors } from "@/lib/chartColors";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { createBonusEvent, removeBonusEvent, updateBonusEvent } from "@/lib/data/mutations";
import { BONUS_EVENT_POINTS } from "@/lib/bonus/bonusEvent";
import type {
  BonusEventRow,
  EventResultRow,
  EventRow,
  MultiplierRow,
  OverallBetRow,
  PerEventBetRow,
  PlayerRow,
} from "@/lib/data/database.types";

const SELECT_CLASS =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

/**
 * On-the-fly bonus events (PRODUCT_SPEC.md → Event-specific structure) —
 * spontaneous, not pre-planned, deliberately outside the core scoring/
 * betting system (no odds, no multiplier, no elimination-math effect), so
 * this lives as its own card rather than inside the tabbed planned-event
 * list on this page. Award points on the spot: name it, pick the player,
 * done — points can also be negative (a deduction), same flat mechanism,
 * for something like a groom-assessed penalty.
 */
export function BonusEventsCard({
  players,
  bonusEvents,
  groomUnlocked,
  events,
  eventResults,
  multipliers,
  perEventBets,
  overallBets,
}: {
  players: PlayerRow[];
  bonusEvents: BonusEventRow[];
  groomUnlocked: boolean;
  /** Only needed for the Weekend awards sub-section — omit (or leave
   * undefined) and that section just doesn't render, same "degrade
   * gracefully" pattern the rest of this app uses for optional data. */
  events?: EventRow[];
  eventResults?: EventResultRow[];
  multipliers?: MultiplierRow[];
  perEventBets?: PerEventBetRow[];
  overallBets?: OverallBetRow[];
}) {
  const [name, setName] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [points, setPoints] = useState(String(BONUS_EVENT_POINTS));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playersById = new Map(players.map((p) => [p.id, p]));
  // Same sort-by-id + "dark" mode convention as every other screen
  // (chartColors.ts's own doc comment) — a player's avatar ring here always
  // matches their rank badge/chart line elsewhere in the app.
  const colorByPlayer = useMemo(() => {
    const stable = [...players].sort((a, b) => a.id.localeCompare(b.id));
    return assignPlayerColors(stable.map((p) => ({ id: p.id, state: p.state ?? "", name: p.name })), "dark");
  }, [players]);

  async function handleAward() {
    const pts = Math.round(Number(points));
    if (!name.trim() || !playerId || !Number.isFinite(pts) || pts === 0) return;
    setBusy(true);
    setError(null);
    try {
      await createBonusEvent(getSupabaseBrowserClient(), {
        name: name.trim(),
        winner_player_id: playerId,
        points: pts,
      });
      setName("");
      setPlayerId("");
      setPoints(String(BONUS_EVENT_POINTS));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bevel-raised bg-card flex flex-col gap-4 rounded-md p-4">
      <div className="flex flex-col gap-1">
        <p className="font-display flex items-center gap-2 text-sm tracking-wide uppercase">
          <PartyPopper className="text-primary size-4" />
          Bonus events
        </p>
        <p className="text-muted-foreground text-sm">
          Spontaneous, on-the-fly extras — flat points straight onto the
          leaderboard, outside the main scoring and betting system entirely.
          Points can be negative (a deduction).
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {groomUnlocked && events && eventResults && multipliers && perEventBets && overallBets ? (
          <WeekendAwardsSection
            players={players}
            events={events}
            eventResults={eventResults}
            multipliers={multipliers}
            perEventBets={perEventBets}
            overallBets={overallBets}
            bonusEvents={bonusEvents}
          />
        ) : null}
        {groomUnlocked ? (
          <div className="flex flex-col gap-2 border-b pb-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bonus-name">What happened</Label>
                <Input
                  id="bonus-name"
                  placeholder="e.g. Cornhole showdown"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bonus-points">Points (negative to deduct)</Label>
                <Input
                  id="bonus-points"
                  type="number"
                  step={1}
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bonus-player">Player</Label>
              <select
                id="bonus-player"
                className={SELECT_CLASS}
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
              >
                <option value="">Pick a player…</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            <Button
              size="sm"
              onClick={handleAward}
              disabled={busy || !name.trim() || !playerId}
              className="w-fit"
            >
              Award
            </Button>
          </div>
        ) : null}

        {bonusEvents.length === 0 ? (
          <p className="text-muted-foreground text-sm">No bonus events yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {bonusEvents.map((b) => (
              <BonusEventItem
                key={b.id}
                bonusEvent={b}
                players={players}
                colorByPlayer={colorByPlayer}
                playerName={
                  b.winner_player_id ? (playersById.get(b.winner_player_id)?.name ?? null) : null
                }
                groomUnlocked={groomUnlocked}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function BonusEventItem({
  bonusEvent,
  players,
  colorByPlayer,
  playerName,
  groomUnlocked,
}: {
  bonusEvent: BonusEventRow;
  players: PlayerRow[];
  colorByPlayer: Record<string, string>;
  playerName: string | null;
  groomUnlocked: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    name: bonusEvent.name,
    winner_player_id: bonusEvent.winner_player_id ?? "",
    points: String(bonusEvent.points),
  });

  const player = bonusEvent.winner_player_id
    ? players.find((p) => p.id === bonusEvent.winner_player_id)
    : undefined;

  function handlePointsChange(e: ChangeEvent<HTMLInputElement>) {
    setDraft((d) => ({ ...d, points: e.target.value }));
  }

  async function save() {
    const pts = Math.round(Number(draft.points));
    if (!draft.name.trim() || !draft.winner_player_id || !Number.isFinite(pts) || pts === 0) return;
    setBusy(true);
    setError(null);
    try {
      await updateBonusEvent(getSupabaseBrowserClient(), bonusEvent.id, {
        name: draft.name.trim(),
        winner_player_id: draft.winner_player_id,
        points: pts,
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await removeBonusEvent(getSupabaseBrowserClient(), bonusEvent.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-md border px-2 py-2 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <Input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="What happened"
          />
          <Input type="number" step={1} value={draft.points} onChange={handlePointsChange} />
        </div>
        <select
          className={SELECT_CLASS}
          value={draft.winner_player_id}
          onChange={(e) => setDraft((d) => ({ ...d, winner_player_id: e.target.value }))}
        >
          <option value="">Pick a player…</option>
          {players.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={busy}>
            Save
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
            <X className="size-4" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 rounded-md border px-2 py-1.5 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium">{bonusEvent.name}</span>
          {player ? (
            <>
              <span className="text-muted-foreground">
                {bonusEvent.points < 0 ? "deducted from" : "won by"}
              </span>
              <PlayerName name={player.name} size="sm" photoUrl={player.photo_url} color={colorByPlayer[player.id]} />
            </>
          ) : playerName ? (
            <span className="text-muted-foreground">— {playerName}</span>
          ) : null}
        </span>
        <span className="flex items-center gap-1">
          <span
            className={cn(
              "tabular-nums",
              bonusEvent.points < 0 ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {bonusEvent.points > 0 ? "+" : ""}
            {bonusEvent.points}
          </span>
          {groomUnlocked ? (
            confirmingRemove ? (
              <>
                <span className="text-muted-foreground text-xs">Remove?</span>
                <Button size="sm" variant="destructive" onClick={remove} disabled={busy}>
                  Yes
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmingRemove(false)}>
                  No
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => setConfirmingRemove(true)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </>
            )
          ) : null}
        </span>
      </div>
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
