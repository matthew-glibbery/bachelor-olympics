"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ListOrdered, Trophy, TrendingUp } from "lucide-react";
import Link from "next/link";

import { CatchUpBadge } from "@/components/event-card";
import { CharacterRender } from "@/components/n64/character-render";
import { GameScreen } from "@/components/n64/game-screen";
import { Panel } from "@/components/n64/panel";
import { RankBadge, ROSTER_CELL, ROSTER_HEAD_CELL, ROSTER_HEAD_ROW, rosterRowClass } from "@/components/n64/roster-table";
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

  return (
    // No screen title or standing-line subtitle — the nav's own
    // highlighted "Leaderboard" tab already says which screen this is, and
    // the podium immediately below answers "where do I stand" faster than a
    // sentence would.
    <GameScreen>
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
                    {/* "Competitor" and "Points" labelled what a name and a
                        bold right-aligned number already say for themselves;
                        "Raw" stays since a bare secondary figure next to the
                        real score would otherwise read as a second point
                        total rather than the pre-multiplier one. */}
                    <tr className={ROSTER_HEAD_ROW}>
                      {["", "", "Raw", ""].map((h, i) => (
                        <th
                          key={i}
                          scope="col"
                          className={cn(
                            ROSTER_HEAD_CELL,
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
                          className={rosterRowClass(
                            i,
                            // A flat 70%-opacity card tint was barely
                            // distinguishable from the zebra striping the row
                            // already has, so "your" row instead gets a left
                            // border in your own colour (same colour as your
                            // rank badge and chart line elsewhere on this
                            // screen) plus a real background tint on top,
                            // which reads unambiguously as "different" rather
                            // than "next in the stripe."
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
                          <td className={ROSTER_CELL}>
                            <RankBadge rank={i + 1} color={color} />
                          </td>
                          <td className={ROSTER_CELL}>
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
                          <td className={cn(ROSTER_CELL, "font-score text-muted-foreground hidden text-right text-sm tabular-nums sm:table-cell")}>
                            {Math.round(total.raw)}
                          </td>
                          <td
                            className={cn(
                              ROSTER_CELL,
                              "font-score text-right text-base tabular-nums",
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
