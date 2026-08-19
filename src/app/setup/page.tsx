"use client";

import { useEffect, useState } from "react";
import {
  Clapperboard,
  Dices,
  Lock,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { PlayerName } from "@/components/player-name";
import { ManagePlayerRow } from "@/components/manage-player-row";
import { AddPlayerRow } from "@/components/add-player-row";
import { ManageEventsCard } from "@/components/manage-events-card";
import { EventOddsEditor } from "@/components/event-odds-editor";
import { PowerMoveCard } from "@/components/power-move-card";
import { BootVideoUploader } from "@/components/boot-video-uploader";
import { GameScreen } from "@/components/n64/game-screen";
import { Panel } from "@/components/n64/panel";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { resetWeekend } from "@/lib/data/mutations";

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
    <GameScreen
      title="Player Settings"
      subtitle="Pick which competitor this device is acting as, or add a player"
    >
      <Panel
        title="Who are you?"
        icon={UserRound}
        description={
          ready
            ? `${players.length} competitor${players.length === 1 ? "" : "s"} set up so far.`
            : "Loading…"
        }
      >
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
      </Panel>

      <Panel
        title="Groom tools"
        icon={groomUnlocked ? ShieldCheck : Lock}
        description={
          groomUnlocked
            ? "Unlocked on this device."
            : "Enter the groom PIN to add or manage players and events."
        }
      >
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
      </Panel>

      {groomUnlocked ? (
        <Panel
          title="Manage players"
          icon={Users}
          description="Add, edit, or remove a competitor."
          contentClassName="gap-2"
        >
          <AddPlayerRow />
          {[...players]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((p) => (
              <ManagePlayerRow key={p.id} player={p} />
            ))}
        </Panel>
      ) : null}

      {groomUnlocked ? <ManageEventsCard events={events} /> : null}

      {groomUnlocked ? (
        <Panel
          title="Set the odds"
          icon={Dices}
          description="Rank all competitors strongest-to-weakest for one event at a time — private, drives that event's bet odds plus the overall win/top3 odds. Locks once the event starts."
        >
          <EventOddsEditor players={players} events={events} eventRankings={eventRankings} />
        </Panel>
      ) : null}

      {groomUnlocked ? (
        <Panel
          title="Boot video"
          icon={Clapperboard}
          description="Plays once on the N64-style start screen, before character select. One shared clip for the whole app."
        >
          <BootVideoUploader currentUrl={appSettings?.boot_video_url ?? null} />
        </Panel>
      ) : null}

      {groomUnlocked ? <PowerMoveCard powerMove={powerMove} /> : null}

      {groomUnlocked ? (
        <Panel
          title={<span className="text-destructive">Danger zone</span>}
          icon={TriangleAlert}
          className="ring-destructive/40 ring-2"
          description="Resetting per event happens on the Events screen. This wipes the whole weekend — every result, multiplier, bet, bonus event, the power move, and every event's ranking — back to a fresh start. Players are kept. No undo."
        >
          <>
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
          </>
        </Panel>
      ) : null}
    </GameScreen>
  );
}
