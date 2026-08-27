"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlayerName } from "@/components/player-name";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { recordRoundRobinMatchResult, setRoundRobinSchedule } from "@/lib/data/mutations";
import { generateRoundRobinSchedule, type TeamSize } from "@/lib/scoring/roundRobinSchedule";
import type { PlayerRow, RoundRobinMatchRow } from "@/lib/data/database.types";

/**
 * Round-robin event format's schedule + per-match win/loss recorder
 * (PRODUCT_SPEC.md → Event formats → Round-robin). Generates a rotating-team
 * schedule (src/lib/scoring/roundRobinSchedule.ts), then lets the groom tap
 * each match's winning team as games are actually played.
 */
export function RoundRobinSchedule({
  eventId,
  players,
  matches,
}: {
  eventId: string;
  players: Map<string, PlayerRow>;
  matches: RoundRobinMatchRow[];
}) {
  const [teamSize, setTeamSize] = useState<TeamSize>(2);
  const [roundCount, setRoundCount] = useState(6);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = getSupabaseBrowserClient();

  const hasResults = matches.some((m) => m.winner != null);
  const maxRound = matches.length > 0 ? Math.max(...matches.map((m) => m.round)) : 0;
  const rounds = Array.from({ length: maxRound }, (_, i) => i + 1);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const allPlayers = [...players.keys()];
      const schedule = generateRoundRobinSchedule(allPlayers, teamSize, roundCount);
      await setRoundRobinSchedule(
        client,
        eventId,
        schedule.flatMap((round) =>
          round.matches.map((matchup) => ({
            round: round.round,
            teamA: round.teams.find((t) => t.team === matchup.teamA)!.playerIds,
            teamB: round.teams.find((t) => t.team === matchup.teamB)!.playerIds,
          })),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function pick(matchId: string, winner: "a" | "b") {
    setBusy(true);
    setError(null);
    try {
      await recordRoundRobinMatchResult(client, eventId, matchId, winner);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const minPlayers = teamSize * 2;
  const notEnoughPlayers = players.size < minPlayers;

  return (
    <div className="flex flex-col gap-4">
      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Team size</Label>
          <select
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
            value={teamSize}
            onChange={(e) => setTeamSize(Number(e.target.value) as TeamSize)}
          >
            <option value={2}>2</option>
            <option value={4}>4</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Rounds</Label>
          <Input
            type="number"
            className="w-20"
            min={1}
            value={roundCount}
            onChange={(e) => setRoundCount(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
        <Button size="sm" onClick={generate} disabled={busy || notEnoughPlayers}>
          {matches.length > 0 ? "Regenerate schedule" : "Generate schedule"}
        </Button>
      </div>
      {notEnoughPlayers ? (
        <p className="text-destructive text-xs">
          Need at least {minPlayers} players for {teamSize}-person teams.
        </p>
      ) : hasResults ? (
        <p className="text-muted-foreground text-xs">
          Regenerating replaces the whole schedule, including any recorded results.
        </p>
      ) : null}

      {rounds.map((round) => (
        <div key={round} className="flex flex-col gap-1.5">
          <p className="text-muted-foreground font-display text-[10px] tracking-wider uppercase">
            Round {round}
          </p>
          {matches
            .filter((m) => m.round === round)
            .map((m) => (
              <div key={m.id} className="bevel-sunken bg-sunken flex items-center gap-2 rounded-md p-2">
                <TeamSide team={m.team_a} players={players} won={m.winner === "a"} onPick={() => pick(m.id, "a")} disabled={busy} />
                <span className="text-muted-foreground text-xs">vs</span>
                <TeamSide team={m.team_b} players={players} won={m.winner === "b"} onPick={() => pick(m.id, "b")} disabled={busy} />
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}

function TeamSide({
  team,
  players,
  won,
  onPick,
  disabled,
}: {
  team: string[];
  players: Map<string, PlayerRow>;
  won: boolean;
  onPick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      className={cn(
        "flex flex-1 flex-col gap-0.5 rounded-sm px-2 py-1 text-left",
        won ? "bg-primary text-primary-foreground" : "bg-card hover:opacity-80",
      )}
    >
      {team.map((id) => (
        <span key={id} className="flex items-center justify-between gap-1.5">
          <PlayerName name={players.get(id)?.name ?? "?"} size="sm" />
          {won ? <Check className="size-3 shrink-0" /> : null}
        </span>
      ))}
    </button>
  );
}
