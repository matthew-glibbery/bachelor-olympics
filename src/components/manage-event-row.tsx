import { useState, type ChangeEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Lock, Pencil, Trash2, Upload, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { cancelEvent, updateEvent } from "@/lib/data/mutations";
import { uploadPhoto } from "@/lib/supabase/storage";
import type { EventRow } from "@/lib/data/database.types";

const SELECT_CLASS =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

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
};

/** One draggable, editable row in the groom's "Manage events" list — same
 * edit/delete interaction as `ManagePlayerRow`, plus a drag handle (only
 * while collapsed) for reordering. */
export function ManageEventRow({ event }: { event: EventRow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: event.id,
  });

  const [editing, setEditing] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    name: event.name,
    notes: event.notes ?? "",
    scoring_mode: event.scoring_mode,
    lower_is_better: event.lower_is_better,
    format: event.format,
  });

  const scoringLocked = event.status !== "planned";

  async function save() {
    if (!draft.name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await updateEvent(getSupabaseBrowserClient(), event.id, {
        name: draft.name.trim(),
        notes: draft.notes.trim() || null,
        ...(scoringLocked
          ? {}
          : {
              scoring_mode: draft.scoring_mode,
              lower_is_better: draft.lower_is_better,
              format: draft.format,
            }),
      });
      setEditing(false);
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
      const client = getSupabaseBrowserClient();
      const url = await uploadPhoto(client, "events", event.id, file);
      await updateEvent(client, event.id, { photo_url: url });
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
      await cancelEvent(getSupabaseBrowserClient(), event.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  const style = { transform: CSS.Transform.toString(transform), transition };

  if (!editing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          "flex flex-col gap-1 border-b py-2 last:border-b-0",
          isDragging && "opacity-60",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="text-muted-foreground touch-none active:cursor-grabbing"
              aria-label={`Drag to reorder ${event.name}`}
            >
              <GripVertical className="size-4" />
            </button>
            <span className="text-sm font-medium">{event.name}</span>
            <Badge variant="outline">
              {STATUS_LABEL[event.status]}
            </Badge>
          </span>
          <div className="flex items-center gap-1">
            {confirmingRemove ? (
              <>
                <span className="text-muted-foreground text-xs">Delete?</span>
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
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmingRemove(true)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </>
            )}
          </div>
        </div>
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-b py-3 last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{event.name}</span>
        <Label className="text-muted-foreground inline-flex cursor-pointer items-center gap-1.5 text-xs">
          <Upload className="size-3.5" />
          {event.photo_url ? "Replace photo" : "Upload photo"}
          <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} disabled={busy} />
        </Label>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Name</Label>
        <Input
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Description</Label>
        <Input
          value={draft.notes}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="flex items-center gap-1.5">
          {scoringLocked ? <Lock className="text-muted-foreground size-3.5" /> : null}
          Format
        </Label>
        {scoringLocked ? (
          <p className="text-muted-foreground text-xs">
            Locked — this event has already started. {FORMAT_LABEL[draft.format]}.
          </p>
        ) : (
          <select
            className={SELECT_CLASS}
            value={draft.format}
            onChange={(e) => {
              const format = e.target.value as EventRow["format"];
              setDraft((d) => ({
                ...d,
                format,
                // Bracket/round-robin are always placement-scored (DB
                // constraint) — force it so the scoring-type select below
                // doesn't offer an invalid combination.
                scoring_mode: format === "standard" ? d.scoring_mode : "placement",
              }));
            }}
          >
            <option value="standard">Standard (final order, optionally over multiple rounds)</option>
            <option value="bracket">Bracket (single elimination)</option>
            <option value="round_robin">Round-robin (rotating teams)</option>
          </select>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="flex items-center gap-1.5">
          {scoringLocked ? <Lock className="text-muted-foreground size-3.5" /> : null}
          Scoring type
        </Label>
        {scoringLocked ? (
          <p className="text-muted-foreground text-xs">
            Locked — this event has already started. {draft.scoring_mode === "placement" ? "Placement" : "Absolute"}.
          </p>
        ) : draft.format !== "standard" ? (
          <p className="text-muted-foreground text-xs">Placement — required for this format.</p>
        ) : (
          <select
            className={SELECT_CLASS}
            value={draft.scoring_mode}
            onChange={(e) =>
              setDraft((d) => ({ ...d, scoring_mode: e.target.value as "placement" | "absolute" }))
            }
          >
            <option value="placement">Placement (ranked finish)</option>
            <option value="absolute">Absolute (measured result, e.g. strokes/time)</option>
          </select>
        )}
      </div>
      {!scoringLocked && draft.format === "standard" && draft.scoring_mode === "absolute" ? (
        <Label className="flex items-center gap-2 text-sm font-normal">
          <input
            type="checkbox"
            checked={draft.lower_is_better}
            onChange={(e) => setDraft((d) => ({ ...d, lower_is_better: e.target.checked }))}
            className="size-4"
          />
          Lower result is better (e.g. golf strokes)
        </Label>
      ) : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={busy || !draft.name.trim()}>
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
