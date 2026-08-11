import { useState } from "react";
import { AlertTriangle, Lock, Pencil, Play, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PlayerName } from "@/components/player-name";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  cancelEvent,
  setEventStatus,
  upsertEventResults,
} from "@/lib/data/mutations";
import type { EventResultRow, EventRow, PlayerRow } from "@/lib/data/database.types";

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
  groomUnlocked: boolean;
}

export function EventCard({ event, players, results, groomUnlocked }: EventCardProps) {
  const [editing, setEditing] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      players.map((p) => {
        const existing = results.find((r) => r.player_id === p.id);
        const value = event.scoring_mode === "placement" ? existing?.position : existing?.raw;
        return [p.id, value != null ? String(value) : ""];
      }),
    ),
  );

  const client = getSupabaseBrowserClient();

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
      const entries = players
        .map((p) => {
          const raw = draft[p.id]?.trim();
          if (!raw) return null;
          const num = Number(raw);
          if (!Number.isFinite(num)) return null;
          return event.scoring_mode === "placement"
            ? { player_id: p.id, position: num }
            : { player_id: p.id, raw: num };
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
        setEditing(false);
      }
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

  return (
    <Card>
      <CardHeader>
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
            {event.scoring_mode === "placement" ? "Placement" : "Absolute"}
          </Badge>
          {event.safety_check ? (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="size-3" />
              Sobriety check
            </Badge>
          ) : null}
        </CardTitle>
        {event.notes ? <CardDescription>{event.notes}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error ? <p className="text-destructive text-sm">{error}</p> : null}

        {!groomUnlocked ? null : (
          <div className="flex flex-wrap gap-2">
            {event.status === "planned" ? (
              <Button size="sm" onClick={startScoring} disabled={busy}>
                <Play className="size-4" />
                Start scoring
              </Button>
            ) : null}
            {(event.status === "scoring" || event.status === "resolved") && !editing ? (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="size-4" />
                {event.status === "resolved" ? "Edit results" : "Enter results"}
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
          <div className="flex flex-col gap-2 border-t pt-3">
            {players.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3">
                <PlayerName name={p.name} state={p.state ?? "??"} size="sm" />
                <Input
                  type="number"
                  step="any"
                  className="w-24"
                  placeholder={event.scoring_mode === "placement" ? "place" : "result"}
                  value={draft[p.id] ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [p.id]: e.target.value }))
                  }
                />
              </div>
            ))}
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
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-sm">
            {players.map((p) => {
              const r = results.find((x) => x.player_id === p.id);
              const value = event.scoring_mode === "placement" ? r?.position : r?.raw;
              return (
                <span
                  key={p.id}
                  className={cn(
                    "flex items-center gap-1",
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

        {!groomUnlocked && event.status === "planned" ? (
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <Lock className="size-3" />
            Groom tools required to manage this event.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
