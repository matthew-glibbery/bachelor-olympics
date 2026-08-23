"use client";

import { Fragment, useMemo, useState } from "react";
import Image from "next/image";
import { UserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import { assignPlayerColors } from "@/lib/chartColors";
import { PlayerName } from "@/components/player-name";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RankBadge,
  ROSTER_CELL,
  ROSTER_HEAD_CELL,
  ROSTER_HEAD_ROW,
  rosterRowClass,
} from "@/components/n64/roster-table";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { placeOverallBet, switchOverallBetPick } from "@/lib/data/mutations";
import {
  isPickAlive,
  overallPayoutValue,
  type EliminationInput,
  type OverallBetType,
} from "@/lib/betting/overall";
import type { PayoutMultipliers } from "@/lib/odds/ranking";
import type { OverallBetRow, PlayerRow } from "@/lib/data/database.types";

const BET_TYPES: { type: OverallBetType; label: string }[] = [
  { type: "win", label: "Win outright" },
  { type: "top3", label: "Top 3" },
];

/** Small overlapping avatar stack — who's picked this candidate for this
 * bet type, once picks are revealed. `-ml-2` overlap with a background ring
 * keeps overlapping photos visually separated instead of blending. */
function PickerAvatars({ pickers }: { pickers: PlayerRow[] }) {
  if (pickers.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  return (
    <span className="flex items-center">
      {pickers.map((p, i) => (
        <span
          key={p.id}
          title={p.name}
          className="border-background bg-muted relative -ml-2 flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 first:ml-0"
          style={{ zIndex: pickers.length - i }}
        >
          {p.photo_url ? (
            <Image src={p.photo_url} alt="" fill sizes="24px" className="object-cover" />
          ) : (
            <UserRound className="text-muted-foreground size-3" />
          )}
        </span>
      ))}
    </span>
  );
}

/** Overall betting — PRODUCT_SPEC.md → Overall betting. Before the weekend
 * starts, this is the pick mechanic itself: a roster list with a Win and a
 * Place column, each cell a button carrying that player's odds (mirrors the
 * Odds tab's per-event win/place buttons, event-odds-betting.tsx). Once the
 * first event starts, placement locks and the same list re-sorts by total
 * picks received, with each column swapping from a button to the photos of
 * whoever picked that row — the "everyone's bets" reveal folded directly
 * into the roster instead of a separate list of bettor→pick rows. */
export function OverallBetting({
  players,
  currentPlayerId,
  overallBets,
  payouts,
  weekendStarted,
  eliminationField,
}: {
  players: PlayerRow[];
  currentPlayerId: string | null;
  overallBets: OverallBetRow[];
  payouts: Map<string, PayoutMultipliers> | null;
  weekendStarted: boolean;
  eliminationField: EliminationInput[];
}) {
  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const colorByPlayer = useMemo(() => {
    const stable = [...players].sort((a, b) => a.id.localeCompare(b.id));
    return assignPlayerColors(stable.map((p) => ({ id: p.id, state: p.state ?? "" })), "dark");
  }, [players]);

  const myBets = useMemo(() => {
    const map = {} as Record<OverallBetType, OverallBetRow | undefined>;
    for (const { type } of BET_TYPES) {
      map[type] = overallBets.find((b) => b.player_id === currentPlayerId && b.bet_type === type);
    }
    return map;
  }, [overallBets, currentPlayerId]);

  const votesByPlayer = useMemo(() => {
    const map = new Map<string, number>();
    for (const bet of overallBets) {
      map.set(bet.pick_player_id, (map.get(bet.pick_player_id) ?? 0) + 1);
    }
    return map;
  }, [overallBets]);

  const orderedPlayers = useMemo(() => {
    if (!weekendStarted) {
      return [...players].sort((a, b) => a.name.localeCompare(b.name));
    }
    return [...players].sort((a, b) => {
      const diff = (votesByPlayer.get(b.id) ?? 0) - (votesByPlayer.get(a.id) ?? 0);
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });
  }, [players, weekendStarted, votesByPlayer]);

  const [busyType, setBusyType] = useState<OverallBetType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [switchPick, setSwitchPick] = useState<Record<OverallBetType, string>>({
    win: "",
    top3: "",
  });

  async function handlePick(type: OverallBetType, pickId: string) {
    if (!currentPlayerId) return;
    setBusyType(type);
    setError(null);
    try {
      await placeOverallBet(getSupabaseBrowserClient(), {
        player_id: currentPlayerId,
        bet_type: type,
        pick_player_id: pickId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyType(null);
    }
  }

  async function handleSwitch(type: OverallBetType) {
    const bet = myBets[type];
    const newPick = switchPick[type];
    if (!bet || !newPick) return;
    setBusyType(type);
    setError(null);
    try {
      await switchOverallBetPick(getSupabaseBrowserClient(), bet.id, newPick);
      setSwitchPick((d) => ({ ...d, [type]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyType(null);
    }
  }

  if (!payouts) {
    return (
      <p className="text-muted-foreground text-sm">
        No odds yet — the groom needs to finish ranking at least one event on
        Setup first.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      {/* Same row language as the leaderboard's Standings table and the
          Odds tab (roster-table.tsx) — a real `<table>`, the colour rank
          chip, alternating row tint, rows tall enough for a button. This
          used to be its own bordered-div thing, styled like neither. The
          chip here is list position, not a competitive rank the way it is
          on Standings/Odds — still worth keeping visually, since the point
          is "this app has one roster-row look," not "every badge means the
          exact same fact." */}
      <div className="bevel-sunken bg-sunken rounded-md">
        <table className="w-full border-collapse">
          <thead>
            <tr className={ROSTER_HEAD_ROW}>
              <th scope="col" className={cn(ROSTER_HEAD_CELL, "text-left")} />
              <th scope="col" className={cn(ROSTER_HEAD_CELL, "text-left")} />
              {BET_TYPES.map(({ type, label }) => (
                <th key={type} scope="col" className={cn(ROSTER_HEAD_CELL, "text-right")}>
                  {label === "Win outright" ? "Win" : "Place"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {orderedPlayers.map((candidate, i) => {
              const mult = payouts.get(candidate.id);
              if (!mult) return null;

              return (
                <tr key={candidate.id} className={rosterRowClass(i)}>
                  <td className={ROSTER_CELL}>
                    <RankBadge rank={i + 1} color={colorByPlayer[candidate.id] ?? "var(--muted)"} />
                  </td>
                  <td className={ROSTER_CELL}>
                    <PlayerName
                      name={candidate.name}
                      state={candidate.state ?? "??"}
                      size="sm"
                      photoUrl={candidate.photo_url}
                      color={colorByPlayer[candidate.id]}
                    />
                  </td>
                  {BET_TYPES.map(({ type }) => {
                    const oddsValue = type === "win" ? mult.win : mult.top3;
                    const myBet = myBets[type];
                    const isMine = myBet?.pick_player_id === candidate.id;

                    if (weekendStarted) {
                      const pickers = overallBets
                        .filter((b) => b.bet_type === type && b.pick_player_id === candidate.id)
                        .map((b) => playersById.get(b.player_id))
                        .filter((p): p is PlayerRow => !!p);
                      return (
                        <td key={type} className={cn(ROSTER_CELL, "text-right")}>
                          <span className="flex justify-end">
                            <PickerAvatars pickers={pickers} />
                          </span>
                        </td>
                      );
                    }

                    // Can't bet on yourself to win or place — same reasoning
                    // as any pick-the-winner pool.
                    const canPick = !!currentPlayerId && !myBet && candidate.id !== currentPlayerId;
                    return (
                      <td key={type} className={cn(ROSTER_CELL, "text-right")}>
                        {canPick ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePick(type, candidate.id)}
                            disabled={busyType === type}
                          >
                            {oddsValue.toFixed(1)}x
                          </Button>
                        ) : (
                          <span
                            className={cn(
                              "text-xs",
                              isMine ? "text-primary font-medium" : "text-muted-foreground",
                            )}
                          >
                            {isMine ? "Your pick" : `${oddsValue.toFixed(1)}x`}
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {currentPlayerId && (myBets.win || myBets.top3) ? (
        // Same roster-row language as the picker table above, not its own
        // bordered-div shape with the odd label-then-badge line this used to
        // be — Player / Bet / To win / Status, one row per pick.
        <div className="bevel-sunken bg-sunken flex flex-col gap-1 rounded-md p-3">
          <span className="hud-label text-muted-foreground">Your picks</span>
          <table className="w-full border-collapse">
            <thead>
              <tr className={ROSTER_HEAD_ROW}>
                <th scope="col" className={cn(ROSTER_HEAD_CELL, "text-left")}>
                  Player
                </th>
                <th scope="col" className={cn(ROSTER_HEAD_CELL, "text-center")}>
                  Bet
                </th>
                <th scope="col" className={cn(ROSTER_HEAD_CELL, "text-right")}>
                  To win
                </th>
                <th scope="col" className={cn(ROSTER_HEAD_CELL, "text-right")}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {BET_TYPES.map(({ type, label }, i) => {
                const bet = myBets[type];
                if (!bet) return null;
                const pick = playersById.get(bet.pick_player_id);
                if (!pick) return null;
                const alive =
                  bet.status === "open"
                    ? isPickAlive(type, bet.pick_player_id, eliminationField)
                    : null;
                const aliveCandidates = players.filter(
                  (p) =>
                    p.id !== bet.pick_player_id &&
                    p.id !== currentPlayerId &&
                    isPickAlive(type, p.id, eliminationField),
                );
                const toWin =
                  bet.status === "won" ? bet.payout : overallPayoutValue(type, bet.switches);
                const canSwitch = bet.status === "open" && !alive;

                return (
                  <Fragment key={type}>
                    <tr className={rosterRowClass(i)}>
                      <td className={ROSTER_CELL}>
                        <PlayerName
                          name={pick.name}
                          state={pick.state ?? "??"}
                          size="sm"
                          photoUrl={pick.photo_url}
                          color={colorByPlayer[pick.id]}
                        />
                      </td>
                      <td className={cn(ROSTER_CELL, "text-center")}>
                        <Badge variant={type === "win" ? "default" : "secondary"}>
                          {label === "Win outright" ? "Win" : "Top 3"}
                        </Badge>
                      </td>
                      <td
                        className={cn(
                          ROSTER_CELL,
                          "font-score text-right tabular-nums",
                          bet.status === "won" && "text-primary",
                        )}
                      >
                        {toWin} pts
                      </td>
                      <td className={cn(ROSTER_CELL, "text-right")}>
                        {bet.status !== "open" ? (
                          <Badge variant={bet.status === "won" ? "default" : "destructive"}>
                            {bet.status === "won" ? "Won" : "Lost"}
                          </Badge>
                        ) : (
                          <Badge
                            // Alive is good news opposite a red "Eliminated",
                            // so it takes the positive tag colour rather than
                            // the neutral one — a grey "Alive" against a red
                            // "Eliminated" read as though only one state
                            // actually mattered.
                            variant={alive ? "default" : "destructive"}
                          >
                            {alive ? "Alive" : "Eliminated"}
                          </Badge>
                        )}
                      </td>
                    </tr>
                    {canSwitch ? (
                      <tr className={rosterRowClass(i)}>
                        <td colSpan={4} className={cn(ROSTER_CELL, "pt-0")}>
                          <div className="flex items-end gap-2">
                            <select
                              className="bevel-sunken bg-sunken text-foreground h-9 w-full rounded-md border-0 px-3 text-sm outline-none focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2"
                              value={switchPick[type]}
                              onChange={(e) =>
                                setSwitchPick((d) => ({ ...d, [type]: e.target.value }))
                              }
                            >
                              <option value="">Switch to…</option>
                              {aliveCandidates.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                            <Button
                              size="sm"
                              onClick={() => handleSwitch(type)}
                              disabled={!switchPick[type] || busyType === type}
                            >
                              Switch pick
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
