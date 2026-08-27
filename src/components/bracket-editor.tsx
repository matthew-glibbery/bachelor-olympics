"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PlayerName } from "@/components/player-name";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  recordBracketMatchResult,
  setBracketMatches,
  setConsolationMatch,
} from "@/lib/data/mutations";
import { generateMainBracket, seedBracket, type BracketMatch } from "@/lib/scoring/bracket";
import type { BracketSeedRow, PlayerRow } from "@/lib/data/database.types";

/**
 * Bracket event format's match-tree editor (PRODUCT_SPEC.md → Event formats
 * → Bracket). Round-by-round columns; tap a match's unresolved participant
 * to record the winner, tap again to change it (cascades forward — see
 * src/lib/scoring/bracket.ts → applyMatchResult). The two optional
 * consolation matches are opt-in checkboxes — existence of that match row
 * IS the opt-in.
 */
export function BracketEditor({
  eventId,
  players,
  colorByPlayer,
  seeds,
  matches,
}: {
  eventId: string;
  players: Map<string, PlayerRow>;
  colorByPlayer: Record<string, string>;
  seeds: BracketSeedRow[];
  matches: BracketMatch[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = getSupabaseBrowserClient();

  const main = matches.filter((m) => m.track === "main").sort((a, b) => a.slot - b.slot);
  const maxRound = main.length > 0 ? Math.max(...main.map((m) => m.round)) : 0;
  const seedOf = new Map(seeds.map((s) => [s.player_id, s.seed]));

  async function generate() {
    const ordered = [...seeds].sort((a, b) => a.seed - b.seed).map((s) => s.player_id);
    if (ordered.length < 2) {
      setError("Set the seed order first (at least 2 players).");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const tree = generateMainBracket(seedBracket(ordered));
      await setBracketMatches(client, eventId, tree);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function pickWinner(matchId: string, winnerId: string) {
    setBusy(true);
    setError(null);
    try {
      await recordBracketMatchResult(client, eventId, matchId, winnerId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const semifinalRound = maxRound - 1;
  const semifinalLosers = main
    .filter((m) => m.round === semifinalRound && m.winnerId && !m.isBye)
    .map((m) => (m.winnerId === m.playerAId ? m.playerBId : m.playerAId))
    .filter((id): id is string => id != null);

  const quarterRound = maxRound - 2;
  const quarterLosers = main
    .filter((m) => m.round === quarterRound && m.winnerId && !m.isBye)
    .map((m) => (m.winnerId === m.playerAId ? m.playerBId : m.playerAId))
    .filter((id): id is string => id != null)
    .sort((a, b) => (seedOf.get(a) ?? Infinity) - (seedOf.get(b) ?? Infinity));
  const topTwoQuarterLosers = quarterLosers.slice(0, 2);

  const thirdPlaceMatch = matches.find((m) => m.track === "third_place");
  const fifthPlaceMatch = matches.find((m) => m.track === "fifth_place");

  async function toggleThirdPlace(enabled: boolean) {
    setBusy(true);
    setError(null);
    try {
      await setConsolationMatch(
        client,
        eventId,
        "third_place",
        enabled && semifinalLosers.length === 2
          ? { playerAId: semifinalLosers[0]!, playerBId: semifinalLosers[1]! }
          : null,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleFifthPlace(enabled: boolean) {
    setBusy(true);
    setError(null);
    try {
      await setConsolationMatch(
        client,
        eventId,
        "fifth_place",
        enabled && topTwoQuarterLosers.length === 2
          ? { playerAId: topTwoQuarterLosers[0]!, playerBId: topTwoQuarterLosers[1]! }
          : null,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (main.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground text-sm">
          No bracket generated yet — set the seed order above, then generate the tree.
        </p>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <Button size="sm" onClick={generate} disabled={busy} className="w-fit">
          Generate bracket
        </Button>
      </div>
    );
  }

  const rounds = Array.from({ length: maxRound }, (_, i) => i + 1);

  return (
    <div className="flex flex-col gap-4">
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <div className="flex gap-4 overflow-x-auto pb-2">
        {rounds.map((round) => (
          <div key={round} className="flex min-w-40 flex-col justify-around gap-3">
            <p className="text-muted-foreground font-display text-center text-[10px] tracking-wider uppercase">
              {round === maxRound ? "Final" : `Round ${round}`}
            </p>
            {main
              .filter((m) => m.round === round)
              .map((m) => (
                <MatchBox
                  key={m.id}
                  match={m}
                  players={players}
                  colorByPlayer={colorByPlayer}
                  disabled={busy}
                  onPick={(winnerId) => pickWinner(m.id, winnerId)}
                />
              ))}
          </div>
        ))}
      </div>

      {semifinalRound >= 1 && semifinalLosers.length === 2 ? (
        <ConsolationToggle
          label="Play a 3rd place match"
          match={thirdPlaceMatch ?? null}
          players={players}
          colorByPlayer={colorByPlayer}
          disabled={busy}
          onToggle={toggleThirdPlace}
          onPick={(winnerId) => pickWinner(thirdPlaceMatch!.id, winnerId)}
        />
      ) : null}

      {quarterRound >= 1 && topTwoQuarterLosers.length === 2 ? (
        <ConsolationToggle
          label="Play a 5th place match"
          match={fifthPlaceMatch ?? null}
          players={players}
          colorByPlayer={colorByPlayer}
          disabled={busy}
          onToggle={toggleFifthPlace}
          onPick={(winnerId) => pickWinner(fifthPlaceMatch!.id, winnerId)}
        />
      ) : null}
    </div>
  );
}

function MatchBox({
  match,
  players,
  colorByPlayer,
  disabled,
  onPick,
}: {
  match: BracketMatch;
  players: Map<string, PlayerRow>;
  colorByPlayer: Record<string, string>;
  disabled: boolean;
  onPick: (winnerId: string) => void;
}) {
  return (
    <div className="bevel-sunken bg-sunken flex flex-col gap-1 rounded-md p-1.5">
      {([match.playerAId, match.playerBId] as const).map((id, i) =>
        id ? (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(id)}
            className={cn(
              "flex items-center justify-between gap-1.5 rounded-sm px-1.5 py-1 text-left text-xs",
              match.winnerId === id ? "bg-primary text-primary-foreground" : "bg-card hover:opacity-80",
            )}
          >
            <PlayerName
              name={players.get(id)?.name ?? "?"}
              size="sm"
              photoUrl={players.get(id)?.photo_url}
              color={colorByPlayer[id]}
            />
            {match.winnerId === id ? <Check className="size-3 shrink-0" /> : null}
          </button>
        ) : (
          <span key={i} className="text-muted-foreground px-1.5 py-1 text-xs italic">
            {match.isBye ? "Bye" : "TBD"}
          </span>
        ),
      )}
    </div>
  );
}

function ConsolationToggle({
  label,
  match,
  players,
  colorByPlayer,
  disabled,
  onToggle,
  onPick,
}: {
  label: string;
  match: BracketMatch | null;
  players: Map<string, PlayerRow>;
  colorByPlayer: Record<string, string>;
  disabled: boolean;
  onToggle: (enabled: boolean) => void;
  onPick: (winnerId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex w-fit items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={match != null}
          disabled={disabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="size-4"
        />
        {label}
      </label>
      {match ? (
        <div className="w-40">
          <MatchBox match={match} players={players} colorByPlayer={colorByPlayer} disabled={disabled} onPick={onPick} />
        </div>
      ) : null}
    </div>
  );
}
