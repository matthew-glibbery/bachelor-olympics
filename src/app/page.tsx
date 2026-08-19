"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp } from "lucide-react";
import Link from "next/link";

import { CharacterRender } from "@/components/n64/character-render";
import { GameScreen } from "@/components/n64/game-screen";
import { Panel } from "@/components/n64/panel";
import { PlayerName } from "@/components/player-name";
import { ProgressChart } from "@/components/progress-chart";
import { useGameInput } from "@/hooks/use-game-input";
import { assignPlayerColors } from "@/lib/chartColors";
import { applyBonusAwards } from "@/lib/bonus/bonusEvent";
import { cumulativeSeries } from "@/lib/scoring/cumulativeSeries";
import { deriveScoreLines } from "@/lib/scoring/fromRows";
import { standings } from "@/lib/scoring/total";
import { playSfx } from "@/lib/sfx";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";
import { cn } from "@/lib/utils";

const MEDAL_COLOR = ["var(--medal-gold)", "var(--medal-silver)", "var(--medal-bronze)"];
// 1st / 2nd / 3rd step heights. 2nd and 3rd were both `sm:h-28`, so above
// the `sm` breakpoint the podium had two equal-height steps and stopped
// reading as a podium at all — the one shape this whole section exists to
// make. Each step is now visibly shorter than the one before it.
const PODIUM_HEIGHT = ["min-h-28 sm:h-36", "min-h-22 sm:h-28", "min-h-18 sm:h-22"];

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

  return (
    <GameScreen
      title="Leaderboard"
      tone="gold"
      subtitle="Eight events · Eight competitors · One leaderboard"
      legend={
        players.length > 0
          ? [
              { button: "A", action: "Change competitor", tone: "a" },
              { button: "B", action: "Multipliers", tone: "b" },
            ]
          : undefined
      }
    >
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
            {/* Progress panel — same ProgressChart as before, reskinned frame. */}
            <Panel
              title="Progress"
              icon={TrendingUp}
              description="Cumulative points after each event or bonus event, in the order they actually happened."
            >
              <ProgressChart players={players} series={series} />
            </Panel>

            {/* Podium. Order is 2–1–3 so first place stands in the middle. */}
            <section className="flex items-end justify-center gap-2 sm:gap-4" aria-label="Top three">
              {[podium[1], podium[0], podium[2]].map((total, slot) => {
                if (!total) return null;
                const player = players.find((p) => p.id === total.playerId);
                if (!player) return null;
                const place = slot === 1 ? 1 : slot === 0 ? 2 : 3;
                const medal = MEDAL_COLOR[place - 1]!;
                const color = colorByPlayer[player.id]!;

                return (
                  <div key={player.id} className="flex flex-col items-center">
                    <div className={cn("w-16 sm:w-24", place === 1 ? "h-28 sm:h-36" : "h-20 sm:h-28")}>
                      <CharacterRender
                        name={player.name}
                        nickname={player.nickname}
                        photoUrl={player.photo_url}
                        color={color}
                        pose="full"
                        idle={place === 1}
                      />
                    </div>
                    <div
                      className={cn(
                        "bevel-raised bg-card flex w-20 flex-col items-center justify-start rounded-t-md border-t-4 px-1 pt-2 pb-2 sm:w-28",
                        PODIUM_HEIGHT[place - 1],
                      )}
                      style={{ borderTopColor: medal }}
                    >
                      <span className="font-display text-2xl leading-none" style={{ color: medal }}>
                        {place}
                      </span>
                      <span className="font-display mt-1 max-w-full truncate px-1 text-[10px] tracking-wider uppercase">
                        {player.name}
                      </span>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* Full standings. The table used to be `min-w-[30rem]` inside a
                horizontal scroller, which on a 390–430px phone — the device
                this is actually used on — pushed "Adjusted" off the right
                edge. That's the one number that decides the game, hidden
                behind a sideways scroll nobody would think to try. "Raw" is
                the expendable column (it's only interesting next to the
                adjusted figure), so it drops out below `sm` instead. */}
            <div className="bevel-sunken rounded-md">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-bevel-dark border-b-2">
                    {["", "Competitor", "Raw", "Adjusted"].map((h, i) => (
                      <th
                        key={h || i}
                        scope="col"
                        className={cn(
                          "font-display text-muted-foreground px-3 py-2 text-[10px] tracking-[0.15em] uppercase",
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
                          "border-bevel-dark/40 border-b last:border-b-0",
                          i % 2 === 1 && "bg-black/15",
                          isYou && "bg-card/70",
                        )}
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
                          <PlayerName
                            name={player.name}
                            state={player.state ?? "??"}
                            nickname={player.nickname}
                            photoUrl={player.photo_url}
                          />
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
                        <td className="font-score text-primary px-3 py-2 text-right text-base tabular-nums">
                          {Math.round(total.adjusted)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="font-display text-muted-foreground text-center text-[9px] tracking-[0.15em] uppercase">
              Adjusted = raw points × that event&apos;s multiplier, plus any bonus-event or overall-bet points
            </p>

          </>
      )}
    </GameScreen>
  );
}
