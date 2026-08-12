import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { createEvent } from "@/lib/data/mutations";

const SELECT_CLASS =
  "border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]";

/**
 * Inline "add an event" row at the top of "Manage events" — same shape as
 * `AddPlayerRow`: collapsed to a button, expands to the same field layout
 * as `ManageEventRow`'s edit form.
 */
export function AddEventRow({ nextSortOrder }: { nextSortOrder: number }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [scoringMode, setScoringMode] = useState<"placement" | "absolute">("placement");
  const [lowerIsBetter, setLowerIsBetter] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setNotes("");
    setScoringMode("placement");
    setLowerIsBetter(false);
    setError(null);
  }

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createEvent(getSupabaseBrowserClient(), {
        name: name.trim(),
        notes: notes.trim() || null,
        scoring_mode: scoringMode,
        lower_is_better: lowerIsBetter,
        sort_order: nextSortOrder,
      });
      reset();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" className="w-fit" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Add event
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-b py-3 last:border-b-0">
      <div className="flex flex-col gap-1.5">
        <Label>Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Description</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>Scoring type</Label>
        <select
          className={SELECT_CLASS}
          value={scoringMode}
          onChange={(e) => setScoringMode(e.target.value as "placement" | "absolute")}
        >
          <option value="placement">Placement (ranked finish)</option>
          <option value="absolute">Absolute (measured result, e.g. strokes/time)</option>
        </select>
      </div>
      {scoringMode === "absolute" ? (
        <Label className="flex items-center gap-2 text-sm font-normal">
          <input
            type="checkbox"
            checked={lowerIsBetter}
            onChange={(e) => setLowerIsBetter(e.target.checked)}
            className="size-4"
          />
          Lower result is better (e.g. golf strokes)
        </Label>
      ) : null}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={busy || !name.trim()}>
          Save
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          <X className="size-4" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
