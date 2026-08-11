"use client";

import { useEffect, useState } from "react";
import { Lock, ShieldCheck, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PlayerName } from "@/components/player-name";
import { ManagePlayerRow } from "@/components/manage-player-row";
import { AppNav } from "@/components/app-nav";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { addPlayer } from "@/lib/data/mutations";
import { stateOptions } from "@/lib/states";

const STATE_OPTIONS = stateOptions();

export default function SetupPage() {
  const { players, connect, ready } = useGameStore();
  const {
    selectedPlayerId,
    groomUnlocked,
    hydrate,
    selectPlayer,
    clearSelectedPlayer,
    unlockGroom,
  } = useSessionStore();

  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNickname, setNewNickname] = useState("");
  const [newState, setNewState] = useState(STATE_OPTIONS[0]?.code ?? "");
  const [newIsGroom, setNewIsGroom] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
    connect();
  }, [hydrate, connect]);

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId);

  async function handleUnlock() {
    const ok = await unlockGroom(pin);
    setPinError(!ok);
    if (ok) setPin("");
  }

  async function handleAddPlayer() {
    if (!newName.trim() || !newState) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await addPlayer(getSupabaseBrowserClient(), {
        name: newName.trim(),
        nickname: newNickname.trim() || null,
        state: newState,
        is_groom: newIsGroom,
      });
      setNewName("");
      setNewNickname("");
      setNewIsGroom(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 pt-12 pb-28 sm:pb-12">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Player Settings</h1>
          <p className="text-muted-foreground text-sm">
            Pick which competitor this device is acting as, or add a player.
          </p>
        </div>
        <AppNav />
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Who are you?</CardTitle>
          <CardDescription>
            {ready ? `${players.length} competitor${players.length === 1 ? "" : "s"} set up so far.` : "Loading…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {selectedPlayer ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">
                Acting as{" "}
                <PlayerName
                  name={selectedPlayer.name}
                  state={selectedPlayer.state ?? "??"}
                  nickname={selectedPlayer.nickname}
                  photoUrl={selectedPlayer.photo_url}
                />
              </span>
              <Button variant="outline" size="sm" onClick={clearSelectedPlayer}>
                Not you?
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {players.map((p) => (
                <Button
                  key={p.id}
                  variant="secondary"
                  size="sm"
                  className="h-auto py-1.5"
                  onClick={() => selectPlayer(p.id)}
                >
                  <PlayerName
                    name={p.name}
                    state={p.state ?? "??"}
                    size="sm"
                    photoUrl={p.photo_url}
                  />
                </Button>
              ))}
              {ready && players.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No players yet — the groom can add the first one below.
                </p>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {groomUnlocked ? (
              <ShieldCheck className="text-primary size-4" />
            ) : (
              <Lock className="text-muted-foreground size-4" />
            )}
            Groom tools
          </CardTitle>
          <CardDescription>
            {groomUnlocked
              ? "Unlocked on this device."
              : "Enter the groom PIN to add or manage players."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!groomUnlocked ? (
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="groom-pin">PIN</Label>
                <Input
                  id="groom-pin"
                  type="password"
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-32"
                />
              </div>
              <Button onClick={handleUnlock} disabled={!pin}>
                Unlock
              </Button>
              {pinError ? (
                <Badge variant="destructive">Wrong PIN</Badge>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-name">Name</Label>
                  <Input
                    id="new-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="new-nickname">Nickname (optional)</Label>
                  <Input
                    id="new-nickname"
                    value={newNickname}
                    onChange={(e) => setNewNickname(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-state">State</Label>
                <select
                  id="new-state"
                  value={newState}
                  onChange={(e) => setNewState(e.target.value)}
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
                  checked={newIsGroom}
                  onChange={(e) => setNewIsGroom(e.target.checked)}
                  className="size-4"
                />
                This player is the groom
              </Label>
              {submitError ? (
                <p className="text-destructive text-sm">{submitError}</p>
              ) : null}
              <Button
                onClick={handleAddPlayer}
                disabled={submitting || !newName.trim()}
                className="w-fit"
              >
                <UserPlus className="size-4" />
                Add player
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {groomUnlocked && players.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Manage players</CardTitle>
            <CardDescription>Edit or remove a competitor.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col">
            {players.map((p) => (
              <ManagePlayerRow key={p.id} player={p} />
            ))}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
