"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ListOrdered, Trophy, TrendingUp } from "lucide-react";
import Link from "next/link";

import { CatchUpBadge } from "@/components/event-card";
import { CharacterRender } from "@/components/n64/character-render";
import { GameScreen } from "@/components/n64/game-screen";
import { Panel } from "@/components/n64/panel";
import { PlayerName } from "@/components/player-name";
import { ProgressChart } from "@/components/progress-chart";
import { useGameInput } from "@/hooks/use-game-input";
import { assignPlayerColors } from "@/lib/chartColors";
import { applyBonusAwards } from "@/lib/bonus/bonusEvent";
import { cumulativeSeries } from "@/lib/scoring/cumulativeSeries";
import { deriveScoreLines, upcomingCatchUp } from "@/lib/scoring/fromRows";
import { standings } from "@/lib/scoring/total";
import { playSfx } from "@/lib/sfx";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";
import { cn } from "@/lib/utils";

const MEDAL_COLOR = ["var(--medal-gold)", "var(--medal-silver)", "var(--medal-bronze)"];

/**
 * The leaderboard (docs/VISUAL_SPEC.md — renamed from "medal table" per a
 * later product decision, see src/components/medal-table.tsx). Live all
 * weekend, visible to everyone: there are only competitors here, no
 * spectators, so nothing is hidden for suspense.
 *
 * Computes standings directly from the same functions the plain
 * `MedalTable` component uses internally (src/lib/scoring/total.ts,
 * src/lib/bonus/bonusEvent.ts) rather than rendering that component, so
 * this screen can carry the N64 podium/segmented-table treatment without
 * changing `MedalTable` itself (kept around undisturbed in case anything
 * else wants the plain version later).
 */
/** 1st..8th, for the standings readout under the title. Eight players is
 *  the whole field (PRODUCT_SPEC.md), so a table beats a suffix rule. */
const ORDINALS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"] as const;

export default function Home() {
  const router = useRouter();
  const { players, events, eventResults, multipliers, bonusEvents, overallBets, connect, loading, error, ready } =
    useGameStore();
  const { selectedPlayerId } = useSessionStore();

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    playSfx("medal");
  }, []);

  useGameInput({
    onConfirm: () => {
      playSfx("confirm");
      router.push("/select");
    },
    onBack: () => {
      playSfx("back");
      router.push("/multipliers");
    },
  });

  const colorByPlayer = useMemo(() => {
    const stable = [...players].sort((a, b) => a.id.localeCompare(b.id));
    return assignPlayerColors(stable.map((p) => ({ id: p.id, state: p.state ?? "" })), "dark");
  }, [players]);

  const scoreLines = deriveScoreLines(
    events,
    eventResults,
    multipliers,
    players.map((p) => p.id),
  );
  const bonusAwards = [
    ...bonusEvents
      .filter((b) => b.winner_player_id)
      .map((b) => ({ playerId: b.winner_player_id as string, points: b.points })),
    // A won overall bet's payout goes to the BETTOR, not their pick.
    ...overallBets
      .filter((b) => b.status === "won" && b.payout != null)
      .map((b) => ({ playerId: b.player_id, points: b.payout as number })),
  ];
  const ranked = applyBonusAwards(standings(scoreLines), bonusAwards);
  const series = cumulativeSeries(events, eventResults, multipliers, players.map((p) => p.id), bonusEvents);

  const podium = ranked.slice(0, 3);

  // Catch-up bonus preview (PRODUCT_SPEC.md → Multipliers → Catch-up
  // bonus): who'd get the +X% on whichever event is currently being scored,
  // or — before that — on whichever planned event comes next. This used to
  // live in its own section on /events; it's the standings' job now, since
  // "who currently has the multiplier" is a fact about the whole field, not
  // about whichever event tile you happen to have open.
  // Folds in the same bonusAwards used just above for `ranked` — without
  // this, "who's behind" here could pick different players than the
  // standings actually show (a bonus-event win or a won overall bet moves
  // someone's real rank but wasn't otherwise visible to this calculation).
  const catchUp = upcomingCatchUp(
    events,
    eventResults,
    multipliers,
    players.map((p) => p.id),
    bonusAwards,
  );

  // The subtitle slot on this screen used to repeat `/start`'s marketing
  // tagline verbatim ("Eight events · Eight competitors · One leaderboard").
  // On the title screen that line is doing a job; here it was spending the
  // most valuable 40px of the app's primary screen — directly under the
  // title, above the fold — saying something the player already knew and
  // could not act on. Replaced with the one thing they actually open this
  // screen to find out: where they stand right now.
  //
  // Falls back to the tagline before anyone has been picked or scored,
  // since there is genuinely no standing to report yet.
  const myIndex = ranked.findIndex((t) => t.playerId === selectedPlayerId);
  const me = myIndex >= 0 ? ranked[myIndex] : undefined;
  const leader = ranked[0];
  const standingLine = (() => {
    if (!me || !leader) return "Eight events · Eight competitors · One leaderboard";
    const place = ORDINALS[myIndex] ?? `${myIndex + 1}th`;
    const pts = `${Math.round(me.adjusted)} pts`;
    if (myIndex === 0) {
      const chaser = ranked[1];
      if (!chaser) return `${place} · ${pts}`;
      return `${place} · ${pts} · ${Math.round(me.adjusted - chaser.adjusted)} ahead`;
    }
    const ahead = players.find((pl) => pl.id === ranked[myIndex - 1]!.playerId);
    const gap = Math.round(ranked[myIndex - 1]!.adjusted - me.adjusted);
    return `${place} · ${pts} · ${gap} behind${ahead ? ` ${ahead.name}` : ""}`;
  })();

  return (
    <GameScreen title="Leaderboard" tone="gold" subtitle={standingLine}>
      {error ? (
          <p className="text-destructive text-center text-sm">{error}</p>
        ) : !ready && loading ? (
          <p className="text-muted-foreground text-center text-sm">Loading…</p>
        ) : players.length === 0 ? (
          <p className="text-muted-foreground text-center text-sm">
            No competitors yet —{" "}
            <Link href="/setup" className="text-foreground underline">
              add players in Setup
            </Link>{" "}
            to get started.
          </p>
        ) : (
          <>
            {/* Podium — one shared frame around the whole top three (same
                `Panel` shell as Standings below it, so the two sections read
                as the same width and the same kind of thing), 1st/2nd/3rd
                left to right rather than a stepped stand. Each
                `CharacterRender` opts out of its own individual bevel
                (`framed={false}`) since the group already has one; a
                gradient scrim overlaid on the bottom of each clip carries
                the rank number and name, rather than a separate plate below
                it competing with the group's own frame. */}
            <Panel title="Podium" icon={Trophy}>
              <div className="grid grid-cols-3 gap-2 sm:gap-4" aria-label="Top three">
                {podium.map((total, i) => {
                  if (!total) return null;
                  const player = players.find((p) => p.id === total.playerId);
                  if (!player) return null;
                  const place = i + 1;
                  const medal = MEDAL_COLOR[place - 1]!;
                  const color = colorByPlayer[player.id]!;

                  return (
                    <div key={player.id} className="relative aspect-[3/4] overflow-hidden rounded-lg">
                      <CharacterRender
                        name={player.name}
                        nickname={player.nickname}
                        photoUrl={player.photo_url}
                        videoUrl={player.character_fullbody_video_url}
                        color={color}
                        pose="full"
                        idle={place === 1}
                        framed={false}
                      />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-0.5 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-1 pt-8 pb-1.5 sm:pt-10 sm:pb-2">
                        <span className="font-display text-xl leading-none sm:text-2xl" style={{ color: medal }}>
                          {place}
                        </span>
                        <span className="hud-label max-w-full truncate px-1 text-white">
                          {player.name}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            {/* Full standings, in the same raised-card `Panel` frame as the
                Progress chart below it — this used to be a bare
                `bevel-sunken` table sitting directly on the page background,
                one bevel treatment for this section and a different one for
                the very next section down. Now both read as the same kind
                of thing. The table used to be `min-w-[30rem]` inside a
                horizontal scroller, which on a 390–430px phone — the device
                this is actually used on — pushed "Adjusted" off the right
                edge. That's the one number that decides the game, hidden
                behind a sideways scroll nobody would think to try. "Raw" is
                the expendable column (it's only interesting next to the
                adjusted figure), so it drops out below `sm` instead. */}
            <Panel title="Standings" icon={ListOrdered}>
              <div className="bevel-sunken bg-sunken rounded-md">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-bevel-dark border-b-2">
                      {["", "Competitor", "Raw", "Points"].map((h, i) => (
                        <th
                          key={h || i}
                          scope="col"
                          className={cn(
                            "hud-label text-muted-foreground px-3 py-2",
                            i >= 2 ? "text-right" : "text-left",
                            i === 2 && "hidden sm:table-cell",
                          )}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.map((total, i) => {
                      const player = players.find((p) => p.id === total.playerId);
                      if (!player) return null;
                      const isYou = player.id === selectedPlayerId;
                      const color = colorByPlayer[player.id]!;

                      return (
                        <tr
                          key={player.id}
                          className={cn(
                            "border-bevel-dark/40 border-b-2 last:border-b-0",
                            i % 2 === 1 && !isYou && "bg-black/15",
                            // The previous highlight was a flat 70%-opacity
                            // card tint — barely distinguishable from the
                            // zebra striping already on the table. A left
                            // border in the player's own colour (same colour
                            // as their rank badge and chart line elsewhere on
                            // this screen) plus a real background tint reads
                            // unambiguously as "this row is different."
                            isYou && "border-l-4",
                          )}
                          style={
                            isYou
                              ? {
                                  backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`,
                                  borderLeftColor: color,
                                }
                              : undefined
                          }
                        >
                          <td className="px-3 py-2">
                            <span
                              className="font-display flex size-7 items-center justify-center rounded-sm text-sm"
                              style={{ backgroundColor: color, color: "oklch(0.14 0.04 275)" }}
                            >
                              {i + 1}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="flex items-center gap-2">
                              <PlayerName
                                name={player.name}
                                state={player.state ?? "??"}
                                nickname={player.nickname}
                                photoUrl={player.photo_url}
                                color={color}
                              />
                              {isYou ? (
                                <span className="hud-label text-primary shrink-0">
                                  You
                                </span>
                              ) : null}
                              {catchUp?.bonuses.has(player.id) ? (
                                <CatchUpBadge bonus={catchUp.bonuses.get(player.id)!} />
                              ) : null}
                            </span>
                          </td>
                          {/* Whole numbers, not 1dp. PRODUCT_SPEC.md →
                              Scoring is explicit that "no scoring currency in
                              this app ever shows a fraction, full stop" — and
                              the same figure already rendered as a whole
                              number on the event card, so the leaderboard was
                              both off-spec and disagreeing with another
                              screen about the same player's score. */}
                          <td className="font-score text-muted-foreground hidden px-3 py-2 text-right text-sm tabular-nums sm:table-cell">
                            {Math.round(total.raw)}
                          </td>
                          <td
                            className={cn(
                              "font-score px-3 py-2 text-right text-base tabular-nums",
                              i === 0 ? "text-primary" : "text-foreground",
                            )}
                          >
                            {Math.round(total.adjusted)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>

            {/* Progress: the line chart, on every width. A rank-ladder
                variant briefly replaced this below `sm` (one row per
                player, position after each event as stepped segments) on
                the reasoning that a phone-width line chart with 8 clumped
                series was hard to read — direct feedback was that the
                ladder wasn't actually more helpful in practice, so this is
                back to the chart everywhere. rank-ladder.tsx and the
                --status-up/--status-down tokens it needed are removed
                entirely rather than left as unused dead code. */}
            <Panel title="Progress" icon={TrendingUp}>
              <ProgressChart players={players} series={series} currentPlayerId={selectedPlayerId} />
            </Panel>
          </>
      )}
    </GameScreen>
  );
}
