import { useState, type ChangeEvent } from "react";
import { Pencil, Trash2, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlayerName } from "@/components/player-name";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { removePlayer, updatePlayer } from "@/lib/data/mutations";
import { uploadPhoto } from "@/lib/supabase/storage";
import { stateOptions } from "@/lib/states";
import type { PlayerRow } from "@/lib/data/database.types";

const STATE_OPTIONS = stateOptions();

/** One editable row in the groom's "Manage players" list — edit or remove. */
export function ManagePlayerRow({ player }: { player: PlayerRow }) {
  const [editing, setEditing] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    name: player.name,
    nickname: player.nickname ?? "",
    state: player.state ?? STATE_OPTIONS[0]?.code ?? "",
    is_groom: player.is_groom,
  });

  async function save() {
    if (!draft.name.trim() || !draft.state) return;
    setBusy(true);
    setError(null);
    try {
      await updatePlayer(getSupabaseBrowserClient(), player.id, {
        name: draft.name.trim(),
        nickname: draft.nickname.trim() || null,
        state: draft.state,
        is_groom: draft.is_groom,
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
      const url = await uploadPhoto(client, "players", player.id, file);
      await updatePlayer(client, player.id, { photo_url: url });
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
      await removePlayer(getSupabaseBrowserClient(), player.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-1 border-b py-2 last:border-b-0">
        <div className="flex items-center justify-between gap-3">
          <PlayerName
            name={player.name}
            state={player.state ?? "??"}
            nickname={player.nickname}
            photoUrl={player.photo_url}
          />
          <div className="flex items-center gap-1">
            {confirmingRemove ? (
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
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
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
        <PlayerName name={player.name} state={player.state ?? "??"} photoUrl={player.photo_url} />
        <Label className="text-muted-foreground inline-flex cursor-pointer items-center gap-1.5 text-xs">
          <Upload className="size-3.5" />
          {player.photo_url ? "Replace photo" : "Upload photo"}
          <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} disabled={busy} />
        </Label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Name</Label>
          <Input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Nickname</Label>
          <Input
            value={draft.nickname}
            onChange={(e) => setDraft((d) => ({ ...d, nickname: e.target.value }))}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>State</Label>
        <select
          value={draft.state}
          onChange={(e) => setDraft((d) => ({ ...d, state: e.target.value }))}
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
          checked={draft.is_groom}
          onChange={(e) => setDraft((d) => ({ ...d, is_groom: e.target.checked }))}
          className="size-4"
        />
        This player is the groom
      </Label>
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
