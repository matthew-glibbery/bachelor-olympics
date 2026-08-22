"use client";

import { useMemo } from "react";

import { assignPlayerColors } from "@/lib/chartColors";
import { PlayerName } from "@/components/player-name";
import { cn } from "@/lib/utils";
import type { SeriesPoint } from "@/lib/scoring/cumulativeSeries";
import type { PlayerRow } from "@/lib/data/database.types";

/**
 * The weekend's story as a rank ladder — one row per player, their position
 * after each point-awarding moment drawn as a run of chunky segments.
 *
 * Why this exists alongside `progress-chart.tsx` rather than replacing it:
 * the line chart is a good desktop object and a bad phone one. At 430px it
 * is ~300px wide carrying eight series that bunch into an unreadable clump
 * as soon as the field tightens, plus an eight-item wrapping legend that
 * eats roughly 15% of the viewport. It also answers the wrong question —
 * the axis is quantitative, but what a player opens this screen to find out
 * is ordinal: *did I move up?* This renders below `sm`, the line chart from
 * `sm` up, so each width gets the form that suits it.
 *
 * The encoding: each segment's filled height is the player's rank at that
 * moment (rank 1 fills the cell, last place barely registers), so a row's
 * silhouette IS its story — climbing, sliding, or flat — readable at a
 * glance without decoding a legend. Rows are labelled with the player's own
 * name, which is what lets the legend disappear entirely.
 *
 * Colour is never the only channel, per the note in `chartColors.ts` and
 * the palette work recorded in docs/HANDOFF.md — eight simultaneous
 * categorical hues is past what any palette reliably separates. Here colour
 * is genuinely redundant: every row is named, ordered by current rank, and
 * carries its rank number as a figure. Someone who cannot tell two hues
 * apart loses nothing.
 */

export type RankLadderProps = {
  players: PlayerRow[];
  series: SeriesPoint[];
  currentPlayerId?: string | null;
  className?: string;
};

type Row = {
  player: PlayerRow;
  color: string;
  /** Rank at each moment, 1-based; null where that player had no total yet. */
  ranks: (number | null)[];
  current: number;
  /** Places gained (+) or lost (-) in the most recent scored moment. */
  swing: number | null;
};

export function RankLadder({
  players,
  series,
  currentPlayerId = null,
  className,
}: RankLadderProps) {
  const colorByPlayer = useMemo(() => {
    const stable = [...players].sort((a, b) => a.id.localeCompare(b.id));
    return assignPlayerColors(
      stable.map((p) => ({ id: p.id, state: p.state ?? "" })),
      "dark",
    );
  }, [players]);

  // Two filters, both load-bearing.
  //
  // 1. Drop the synthetic "start" point: it has every player tied on zero,
  //    so competition ranking makes all eight joint-first and the ladder
  //    would open with a meaningless full-height row for everyone. The line
  //    chart needs that origin to anchor its lines; a ladder doesn't.
  // 2. Drop TRAILING moments nobody has scored yet. `cumulativeSeries`
  //    deliberately appends every not-yet-resolved event with null totals so
  //    the chart's lines stop at the frontier. In a ladder those render as
  //    zero-height cells, i.e. a stretch of empty track — with 8 events and
  //    3 played, over half of every row read as broken rather than as
  //    "unplayed". The chart already learned this lesson (see HANDOFF,
  //    2026-08-18: "dropped trailing not-yet-played events").
  const moments = useMemo(() => {
    const real = series.filter((p) => p.key !== "start");
    let last = -1;
    real.forEach((p, i) => {
      if (Object.values(p.totals).some((t) => t !== null)) last = i;
    });
    return real.slice(0, last + 1);
  }, [series]);

  const rows = useMemo<Row[]>(() => {
    if (players.length === 0 || moments.length === 0) return [];

    // Rank every player at each moment. Standard competition ranking, so a
    // genuine tie shares a place (1,1,3) rather than inventing an order —
    // the same convention the standings table uses.
    const ranksByMoment = moments.map((point) => {
      const scored = players
        .map((p) => ({ id: p.id, total: point.totals[p.id] ?? null }))
        .filter((e): e is { id: string; total: number } => e.total !== null)
        .sort((a, b) => b.total - a.total);

      const out = new Map<string, number>();
      scored.forEach((entry, i) => {
        const prev = i > 0 ? scored[i - 1]! : null;
        out.set(entry.id, prev && prev.total === entry.total ? out.get(prev.id)! : i + 1);
      });
      return out;
    });

    const built = players.map((player) => {
      const ranks = ranksByMoment.map((m) => m.get(player.id) ?? null);
      const real = ranks.filter((r): r is number => r !== null);
      const current = real.length ? real[real.length - 1]! : players.length;

      // Movement in the MOST RECENT moment, not since the beginning.
      //
      // First-to-last looked like the obvious choice and is wrong: at the
      // opening moment only the players in that one event have any points,
      // so everyone else is tied on zero and competition ranking compresses
      // them all into a single joint place. Measuring from there manufactured
      // huge phantom drops — the first run of this showed +1 and then -1, -1,
      // -2, -3, -4, -5, -6, summing to -21, when rank changes across a fixed
      // field must sum to roughly zero. Nobody had actually fallen six
      // places; they had merely stopped being joint-second-by-default.
      // (Same family of bug as the chart tooltip's manufactured "down"
      // arrows off the synthetic start point — see HANDOFF 2026-08-18 (5).)
      //
      // The last hop is also just the more useful number: "did I move up?"
      // is a question about the event that was actually played, and it is
      // immune to the tied-baseline artifact. Still guarded on the previous
      // moment being a real position for THIS player — a rank you only held
      // because you had not scored yet isn't somewhere you moved from.
      const prevIdx = ranks.length - 2;
      const prevRank = prevIdx >= 0 ? (ranks[prevIdx] ?? null) : null;
      const prevScored =
        prevIdx >= 0 && (moments[prevIdx]!.totals[player.id] ?? 0) > 0;

      return {
        player,
        color: colorByPlayer[player.id] ?? "#888",
        ranks,
        current,
        // Rank numbers shrink as you improve, so previous-minus-current is
        // places GAINED.
        swing: prevRank !== null && prevScored ? prevRank - current : null,
      };
    });

    return built.sort((a, b) => a.current - b.current || a.player.name.localeCompare(b.player.name));
  }, [players, moments, colorByPlayer]);

  if (rows.length === 0) return null;

  const field = players.length;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* The ladder's columns are otherwise unlabelled, and "-1" in the last
          column is meaningless without knowing what it measures. */}
      <div className="hud-label text-muted-foreground flex items-center gap-2.5 px-2">
        <span className="size-6 shrink-0" aria-hidden />
        <span className="shrink-0 basis-24">Competitor</span>
        <span className="min-w-0 flex-1">Position after each event</span>
        <span className="w-9 shrink-0 text-right">Last</span>
      </div>

      {rows.map((row) => {
        const isYou = row.player.id === currentPlayerId;

        return (
          <div
            key={row.player.id}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2 py-1.5",
              isYou && "bevel-sunken bg-sunken",
            )}
            style={
              isYou
                ? { boxShadow: `inset 3px 0 0 0 ${row.color}` }
                : undefined
            }
          >
            <span
              className="hud-label grid size-6 shrink-0 place-items-center rounded-sm"
              style={{ backgroundColor: row.color, color: "oklch(0.14 0.04 275)" }}
            >
              {row.current}
            </span>

            <span className="flex min-w-0 shrink-0 basis-24 items-center gap-1.5">
              <PlayerName
                name={row.player.name}
                state={row.player.state ?? "??"}
                nickname={row.player.nickname}
                photoUrl={row.player.photo_url}
                color={row.color}
              />
            </span>

            {/* The ladder itself. `aria-hidden` because the visually-hidden
                table below carries the same information in a form a screen
                reader can actually navigate — a run of unlabelled bars is
                noise read aloud. */}
            <span className="bevel-sunken bg-sunken flex h-8 min-w-0 flex-1 items-end gap-[2px] rounded-sm p-[3px]" aria-hidden>
              {row.ranks.map((rank, i) => {
                // Rank 1 fills the cell; last place keeps a visible stub so
                // a bad position still reads as a value rather than as
                // missing data.
                const height = rank === null ? 0 : ((field - rank + 1) / field) * 100;
                return (
                  <span
                    key={moments[i]!.key}
                    className="relative flex h-full flex-1 items-end"
                    title={rank === null ? moments[i]!.label : `${moments[i]!.label}: ${rank}`}
                  >
                    <span
                      className="w-full rounded-[1px]"
                      style={{
                        height: `${Math.max(height, rank === null ? 0 : 12)}%`,
                        backgroundColor: rank === null ? "transparent" : row.color,
                        opacity: rank === null ? 0 : i === row.ranks.length - 1 ? 1 : 0.75,
                      }}
                    />
                  </span>
                );
              })}
            </span>

            <span
              className={cn(
                "font-score w-9 shrink-0 text-right text-xs tabular-nums",
                row.swing === null || row.swing === 0
                  ? "text-muted-foreground"
                  : row.swing > 0
                    ? "text-status-up"
                    : "text-status-down",
              )}
            >
              {/* Always a sign or a dash alongside the colour, never colour
                  alone — same rule the chart tooltip already follows. */}
              {row.swing === null || row.swing === 0
                ? "—"
                : row.swing > 0
                  ? `+${row.swing}`
                  : `${row.swing}`}
            </span>
          </div>
        );
      })}

      {/* The real accessible representation of the ladder above. */}
      <table className="sr-only">
        <caption>Rank after each scored event</caption>
        <thead>
          <tr>
            <th scope="col">Competitor</th>
            {moments.map((m) => (
              <th scope="col" key={m.key}>
                {m.label}
              </th>
            ))}
            <th scope="col">Places gained</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.player.id}>
              <th scope="row">{row.player.name}</th>
              {row.ranks.map((rank, i) => (
                <td key={moments[i]!.key}>{rank === null ? "not yet scored" : rank}</td>
              ))}
              <td>{row.swing === null ? "no change yet" : row.swing}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
