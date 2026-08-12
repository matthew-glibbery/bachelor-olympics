"use client";

import { useEffect, useState } from "react";
import { Lock, RotateCcw, ShieldCheck } from "lucide-react";

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
import { AddPlayerRow } from "@/components/add-player-row";
import { ManageEventsCard } from "@/components/manage-events-card";
import { ThemePicker } from "@/components/theme-picker";
import { EventOddsEditor } from "@/components/event-odds-editor";
import { PowerMoveCard } from "@/components/power-move-card";
import { AppNav } from "@/components/app-nav";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { resetWeekend } from "@/lib/data/mutations";
import { DEFAULT_THEME_ID } from "@/lib/themes";

export default function SetupPage() {
  const { players, events, eventRankings, appSettings, powerMove, connect, ready } = useGameStore();
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
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

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

  async function handleResetWeekend() {
    setResetting(true);
    setResetError(null);
    try {
      await resetWeekend(getSupabaseBrowserClient());
      setConfirmingReset(false);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : String(err));
    } finally {
      setResetting(false);
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
              : "Enter the groom PIN to add or manage players and events."}
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
            <p className="text-muted-foreground text-sm">
              Unlocked. Manage players and events below.
            </p>
          )}
        </CardContent>
      </Card>

      {groomUnlocked ? (
        <Card>
          <CardHeader>
            <CardTitle>Manage players</CardTitle>
            <CardDescription>Add, edit, or remove a competitor.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <AddPlayerRow />
            {players.map((p) => (
              <ManagePlayerRow key={p.id} player={p} />
            ))}
          </CardContent>
        </Card>
      ) : null}

      {groomUnlocked ? <ManageEventsCard events={events} /> : null}

      {groomUnlocked ? (
        <Card>
          <CardHeader>
            <CardTitle>Set the odds</CardTitle>
            <CardDescription>
              Rank all competitors strongest-to-weakest for one event at a
              time — private, drives that event&apos;s bet odds plus the
              overall win/top3 odds. Locks once the event starts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EventOddsEditor players={players} events={events} eventRankings={eventRankings} />
          </CardContent>
        </Card>
      ) : null}

      {groomUnlocked ? (
        <Card>
          <CardHeader>
            <CardTitle>App theme</CardTitle>
            <CardDescription>
              Picks the look for everyone, live — tweakcn presets.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ThemePicker activeThemeId={appSettings?.theme_id ?? DEFAULT_THEME_ID} />
          </CardContent>
        </Card>
      ) : null}

      {groomUnlocked ? <PowerMoveCard powerMove={powerMove} /> : null}

      {groomUnlocked ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Danger zone</CardTitle>
            <CardDescription>
              Resetting per event happens on the Events screen. This wipes the
              whole weekend — every result, multiplier, bet, bonus event, the
              power move, and every event&apos;s ranking — back to a fresh
              start. Players and the theme are kept. No undo.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {resetError ? <p className="text-destructive text-sm">{resetError}</p> : null}
            {confirmingReset ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm">Reset the entire weekend? This can&apos;t be undone.</span>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleResetWeekend}
                  disabled={resetting}
                >
                  Yes, reset everything
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmingReset(false)}
                  disabled={resetting}
                >
                  No
                </Button>
              </div>
            ) : (
              <Button
                variant="destructive"
                className="w-fit"
                onClick={() => setConfirmingReset(true)}
              >
                <RotateCcw className="size-4" />
                Reset the weekend
              </Button>
            )}
          </CardContent>
        </Card>
      ) : null}
    </main>
  );
}
