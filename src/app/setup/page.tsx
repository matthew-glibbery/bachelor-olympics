"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clapperboard,
  Dices,
  Loader2,
  RotateCcw,
  Ruler,
  Trophy,
  TriangleAlert,
  UserRound,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlayerName } from "@/components/player-name";
import { ManagePlayerRow } from "@/components/manage-player-row";
import { AddPlayerRow } from "@/components/add-player-row";
import { ManageEventsCard } from "@/components/manage-events-card";
import { EventOddsEditor } from "@/components/event-odds-editor";
import { BootVideoUploader } from "@/components/boot-video-uploader";
import { WeekendAwardsSection } from "@/components/weekend-awards";
import { GameScreen } from "@/components/n64/game-screen";
import { Panel } from "@/components/n64/panel";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { endGameNow, resetWeekend, settleOverallBetsNow } from "@/lib/data/mutations";

export default function SetupPage() {
  const {
    players,
    events,
    eventRankings,
    eventResults,
    multipliers,
    perEventBets,
    overallBets,
    bonusEvents,
    appSettings,
    connect,
    ready,
  } = useGameStore();
  const { selectedPlayerId, groomUnlocked, hydrate, selectPlayer, clearSelectedPlayer } =
    useSessionStore();

  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [settlingBets, setSettlingBets] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);
  const [settleDone, setSettleDone] = useState(false);
  const [confirmingEndGame, setConfirmingEndGame] = useState(false);
  const [endingGame, setEndingGame] = useState(false);
  const [endGameError, setEndGameError] = useState<string | null>(null);

  useEffect(() => {
    hydrate();
    connect();
  }, [hydrate, connect]);

  const selectedPlayer = players.find((p) => p.id === selectedPlayerId);

  const unresolvedEvents = events.filter((e) => e.status !== "resolved");
  const weekendOver = events.length > 0 && unresolvedEvents.length === 0;
  const endedEarly = !!appSettings?.weekend_ended_at && !weekendOver;
  const weekendEnded = weekendOver || !!appSettings?.weekend_ended_at;
  const openOverallBets = overallBets.filter((b) => b.status === "open").length;

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

  async function handleSettleOverallBets() {
    setSettlingBets(true);
    setSettleError(null);
    setSettleDone(false);
    try {
      await settleOverallBetsNow(getSupabaseBrowserClient());
      setSettleDone(true);
    } catch (err) {
      setSettleError(err instanceof Error ? err.message : String(err));
    } finally {
      setSettlingBets(false);
    }
  }

  async function handleEndGame() {
    setEndingGame(true);
    setEndGameError(null);
    try {
      await endGameNow(getSupabaseBrowserClient());
      setConfirmingEndGame(false);
    } catch (err) {
      setEndGameError(err instanceof Error ? err.message : String(err));
    } finally {
      setEndingGame(false);
    }
  }

  return (
    <GameScreen
      title="Player Settings"
      subtitle="Pick which competitor this device is acting as, or add a player"
      width="narrow"
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

      {groomUnlocked ? (
        <Panel
          title="Viewport diagnostics"
          icon={Ruler}
          description="Measures what this device reports its screen to be. Open this from the INSTALLED app (home-screen icon), not a Safari tab — the numbers differ, and the installed one is the only one that matters for the full-screen bug. Send the readout if the start screen still has dead space."
        >
          {/* A real link rather than a button: this has to be openable from
              inside the installed PWA, which is the whole reason it exists —
              /debug is deliberately unlinked everywhere else, and typing a
              URL is exactly what an installed app gives you no way to do. */}
          <Link
            href="/debug"
            className="bevel-raised bg-card inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm active:translate-y-px"
          >
            <Ruler className="size-4" />
            Open diagnostics
          </Link>
        </Panel>
      ) : null}

      {groomUnlocked ? (
        <Panel
          title="End the game"
          icon={Trophy}
          description={
            weekendEnded
              ? "Overall bets settle automatically once the weekend's over — this is just a manual backstop in case that ever needs re-running."
              : "Settles overall bets against the standings as they stand right now and unlocks the final weekend awards, without touching whatever's still unfinished."
          }
        >
          <>
            {!weekendEnded ? (
              <>
                <p className="text-muted-foreground text-sm">
                  Still waiting on: {unresolvedEvents.map((e) => e.name).join(", ")}.
                </p>
                <Button
                  variant="destructive"
                  className="w-fit"
                  onClick={() => setConfirmingEndGame(true)}
                >
                  <Trophy className="size-4" />
                  End the game
                </Button>
              </>
            ) : (
              <>
                {endedEarly ? (
                  <p className="text-muted-foreground text-sm">
                    Ended early — left unfinished: {unresolvedEvents.map((e) => e.name).join(", ")}.
                  </p>
                ) : null}
                {settleError ? <p className="text-destructive text-sm">{settleError}</p> : null}
                <div className="flex flex-wrap items-center gap-2">
                  <Button size="sm" onClick={handleSettleOverallBets} disabled={settlingBets}>
                    {settlingBets ? <Loader2 className="size-3.5 animate-spin" /> : null}
                    Settle overall bets
                  </Button>
                  <span className="text-muted-foreground text-sm">
                    {openOverallBets} still open
                    {settleDone ? " — settled." : ""}
                  </span>
                </div>

                <WeekendAwardsSection
                  players={players}
                  events={events}
                  eventResults={eventResults}
                  multipliers={multipliers}
                  perEventBets={perEventBets}
                  overallBets={overallBets}
                  bonusEvents={bonusEvents}
                />
              </>
            )}
          </>
        </Panel>
      ) : null}

      <Dialog open={confirmingEndGame} onOpenChange={(open) => !endingGame && setConfirmingEndGame(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>End the game now?</DialogTitle>
            <DialogDescription>
              {unresolvedEvents.map((e) => e.name).join(", ")} will be left exactly as they
              are — no results get recorded for them, and nothing about them changes later. Overall
              bets settle against the standings as they stand right now, and you&apos;ll be able to
              hand out the final weekend awards. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          {endGameError ? <p className="text-destructive text-sm">{endGameError}</p> : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmingEndGame(false)}
              disabled={endingGame}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleEndGame} disabled={endingGame}>
              {endingGame ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Yes, end the game
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {groomUnlocked ? (
        <Panel
          title={<span className="text-destructive">Danger zone</span>}
          icon={TriangleAlert}
          iconClassName="text-destructive"
          // A border, not a ring: `ring-*` is implemented as box-shadow,
          // which the panel's own `bevel-raised` already owns at the same
          // specificity — the ring silently rendered nothing.
          className="border-destructive/50 border-2"
          description="Resetting per event happens on the Events screen. This wipes the whole weekend — every result, multiplier, bet, bonus event, and every event's ranking — back to a fresh start. Players are kept. No undo."
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
