import { useState } from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { addPlayer } from "@/lib/data/mutations";
import { stateOptions } from "@/lib/states";

const STATE_OPTIONS = stateOptions();

/**
 * Inline "add a player" row at the top of "Manage players" — collapsed to a
 * single button, expands to the same field layout as `ManagePlayerRow`'s
 * edit form, since add and edit should feel like the same interaction.
 */
export function AddPlayerRow() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [state, setState] = useState(STATE_OPTIONS[0]?.code ?? "");
  const [isGroom, setIsGroom] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setName("");
    setNickname("");
    setState(STATE_OPTIONS[0]?.code ?? "");
    setIsGroom(false);
    setError(null);
  }

  async function save() {
    if (!name.trim() || !state) return;
    setBusy(true);
    setError(null);
    try {
      await addPlayer(getSupabaseBrowserClient(), {
        name: name.trim(),
        nickname: nickname.trim() || null,
        state,
        is_groom: isGroom,
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
      <Button
        size="sm"
        variant="outline"
        className="w-fit"
        onClick={() => setOpen(true)}
      >
        <Plus className="size-4" />
        Add player
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-b py-3 last:border-b-0">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Nickname</Label>
          <Input value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>State</Label>
        <select
          value={state}
          onChange={(e) => setState(e.target.value)}
          className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        >
          {STATE_OPTIONS.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name} ({s.code})
            </option>
          ))}
        </select>
      </div>
      <Label className="flex items-center gap-2 text-sm font-normal">
        <input
          type="checkbox"
          checked={isGroom}
          onChange={(e) => setIsGroom(e.target.checked)}
          className="size-4"
        />
        This player is the groom
      </Label>
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
