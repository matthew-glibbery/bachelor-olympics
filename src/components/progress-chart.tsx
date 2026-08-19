"use client";

import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

import { assignPlayerColors } from "@/lib/chartColors";
import { PlayerName } from "@/components/player-name";
import type { SeriesPoint } from "@/lib/scoring/cumulativeSeries";
import type { PlayerRow } from "@/lib/data/database.types";

/**
 * Live progress chart — cumulative multiplier-adjusted points per player
 * across the weekend. Follows the dataviz skill's method: categorical color
 * (src/lib/chartColors.ts, validated against this app's actual surfaces),
 * 2px lines, hairline recessive grid, an always-visible line-key legend (the
 * light-mode contrast WARN on 3 of the 8 slots requires this relief channel),
 * a crosshair tooltip listing every player at that event, and player-photo
 * dot markers with a surface ring + native hover title.
 *
 * Event names are long ("Super Smash Bros. (N64)") and there can be up to 9
 * of them — on a phone-width chart (this is mostly used on mobile) full
 * names on the x-axis would collide. Ticks show the event's number instead;
 * the tooltip and legend carry the full names.
 */

// App token hex, converted from globals.css's :root oklch values. Recharts/
// SVG props need literal color values, not CSS-variable-backed Tailwind
// classes, so these are a manual mirror rather than a live read — the app
// now has exactly one fixed (dark) identity, so unlike before there's no
// second light-mode variant these could silently drift out of sync with.
// Recomputed for the blue/purple palette (globals.css :root, oklch → hex).
const GRID = "#3d528d"; // --border
const AXIS_TEXT = "#9fabc5"; // --muted-foreground
const SURFACE = "#141b40"; // --card / --popover

// Reserved status colors for the tooltip's rank-change/points-gained
// indicators — deliberately NOT the categorical palette's own green/red
// slots (chartColors.ts), which are tied to specific players' identity;
// reusing them here would make a status badge look like it belongs to
// whichever player happens to be on that slot. Both re-checked against the
// new dark #241e1a tooltip surface (green 8.80:1, red 5.75:1 — both clear
// WCAG AA for small text), and always ship with a +/− sign or ▲/▼ glyph
// alongside the color, never color alone.
const STATUS_GOOD = "#4cd676";
const STATUS_BAD = "#ff6759";

// 22px markers fused into an unreadable clump wherever several players were
// close on points — which is most of a tight leaderboard. 16 still carries a
// recognisable face/initial while letting neighbouring lines resolve.
const DOT_SIZE = 16;

interface ChartRow {
  key: string;
  label: string;
  tick: string;
  [playerId: string]: string | number | null;
}

export interface ProgressChartProps {
  players: PlayerRow[];
  series: SeriesPoint[];
}

export function ProgressChart({ players, series }: ProgressChartProps) {
  const playerById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  const colorByPlayer = useMemo(() => {
    const stable = [...players].sort((a, b) => a.id.localeCompare(b.id));
    return assignPlayerColors(
      stable.map((p) => ({ id: p.id, state: p.state ?? "" })),
      "dark",
    );
  }, [players]);

  const data = useMemo<ChartRow[]>(
    () => {
      const rows: ChartRow[] = series.map((point, i) => ({
        key: point.key,
        label: point.label,
        tick: i === 0 ? "" : String(i),
        ...point.totals,
      }));
      // `cumulativeSeries` deliberately trails every not-yet-resolved event at
      // the end of the series (see its own docs), which meant the chart
      // reserved an x-column for each one and drew nothing in it — with 3 of
      // 8 events played, over half the plot was empty columns and it read as
      // a broken chart rather than an unfinished weekend. Drop trailing rows
      // where no player has a value yet; the moment one resolves it comes
      // back on its own. Display-only — the pure series function is untouched.
      const playerIds = players.map((p) => p.id);
      let end = rows.length;
      while (end > 2 && playerIds.every((id) => rows[end - 1]![id] == null)) end--;
      return rows.slice(0, end);
    },
    [series, players],
  );

  if (players.length === 0 || series.length < 2) {
    return (
      <p className="text-muted-foreground text-sm">
        Progress will appear here once players are set up and the first event resolves.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 16, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
            <XAxis
              dataKey="tick"
              tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: GRID }}
            />
            <YAxis
              tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={40}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ stroke: GRID, strokeWidth: 1 }}
              offset={28}
              content={(props) => (
                <ProgressTooltip
                  {...props}
                  data={data}
                  playerById={playerById}
                  colorByPlayer={colorByPlayer}
                />
              )}
            />
            {players.map((p) => (
              <Line
                key={p.id}
                dataKey={p.id}
                stroke={colorByPlayer[p.id]}
                strokeWidth={2}
                connectNulls={false}
                isAnimationActive={false}
                dot={(dotProps) => (
                  <PlayerDot
                    key={`${p.id}-${dotProps.index}`}
                    {...dotProps}
                    player={p}
                    color={colorByPlayer[p.id]!}
                  />
                )}
                activeDot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ProgressLegend players={players} colorByPlayer={colorByPlayer} />
    </div>
  );
}

function PlayerDot(props: {
  cx?: number;
  cy?: number;
  value?: number | null;
  player: PlayerRow;
  color: string;
}) {
  const { cx, cy, value, player, color } = props;
  if (cx == null || cy == null || value == null) return null;

  const r = DOT_SIZE / 2;
  const clipId = `dot-clip-${player.id}-${Math.round(cx)}-${Math.round(cy)}`;

  return (
    <g>
      <title>
        {player.name}
        {player.nickname ? ` "${player.nickname}"` : ""} — {Math.round(value)} pts
      </title>
      {/* Surface ring so overlapping/crossing markers stay legible (marks-and-anatomy.md). */}
      <circle cx={cx} cy={cy} r={r + 2} fill={SURFACE} />
      <circle cx={cx} cy={cy} r={r} fill={color} />
      {player.photo_url ? (
        <>
          <clipPath id={clipId}>
            <circle cx={cx} cy={cy} r={r - 1.5} />
          </clipPath>
          <image
            href={player.photo_url}
            x={cx - r + 1.5}
            y={cy - r + 1.5}
            width={(r - 1.5) * 2}
            height={(r - 1.5) * 2}
            clipPath={`url(#${clipId})`}
            preserveAspectRatio="xMidYMid slice"
          />
        </>
      ) : (
        // Players without a photo used to get a bare coloured disc, leaving
        // identity carried by hue alone. Eight simultaneous categorical
        // series is past what a palette can keep separable — checked by
        // running this app's own line colours (src/lib/chartColors.ts,
        // DARK_HEX) through the dataviz skill's validate_palette.js in its
        // strict `--pairs all` mode, which fails on colour-vision-deficient
        // separation; re-stepping to evenly spaced hues fails it too, so
        // it's a limit rather than a bad palette. Hence a letter as well as
        // a colour: the secondary encoding that skill requires whenever
        // separation is at its floor. Re-run the validator before changing
        // these colours.
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={r}
          fontWeight={700}
          fill={SURFACE}
          style={{ fontFamily: "var(--font-display)", pointerEvents: "none" }}
        >
          {player.name.slice(0, 1).toUpperCase()}
        </text>
      )}
    </g>
  );
}

function ProgressLegend({
  players,
  colorByPlayer,
}: {
  players: PlayerRow[];
  colorByPlayer: Record<string, string>;
}) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {players.map((p) => (
        <span key={p.id} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-0.5 w-4 shrink-0 rounded-full"
            style={{ backgroundColor: colorByPlayer[p.id] }}
          />
          <PlayerName name={p.name} state={p.state ?? "??"} photoUrl={p.photo_url} size="sm" />
        </span>
      ))}
    </div>
  );
}

/** Standard competition ranking (1,2,2,4 — a tie doesn't consume the next
 * rank number), same technique as settleOverallBets.ts. */
function computeRanks(row: ChartRow, playerIds: string[]): Map<string, number> {
  const values = playerIds
    .map((id) => ({ id, v: row[id] }))
    .filter((x): x is { id: string; v: number } => typeof x.v === "number");
  const ranks = new Map<string, number>();
  for (const { id, v } of values) {
    ranks.set(id, 1 + values.filter((o) => o.v > v).length);
  }
  return ranks;
}

function ProgressTooltip({
  active,
  payload,
  data,
  playerById,
  colorByPlayer,
}: TooltipContentProps & {
  data: ChartRow[];
  playerById: Map<string, PlayerRow>;
  colorByPlayer: Record<string, string>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0]?.payload as ChartRow | undefined;
  if (!point) return null;

  const index = data.findIndex((d) => d.key === point.key);
  if (index === -1) return null;
  const previous = index > 0 ? data[index - 1] : null;

  const playerIds = [...playerById.keys()];
  const currentRanks = computeRanks(point, playerIds);
  const previousRanks = previous ? computeRanks(previous, playerIds) : null;

  const rows = playerIds
    .map((playerId) => ({ playerId, value: point[playerId] }))
    .filter((r): r is { playerId: string; value: number } => typeof r.value === "number")
    .sort((a, b) => b.value - a.value);

  if (rows.length === 0) return null;

  return (
    <div className="bg-popover text-popover-foreground rounded-md border p-2.5 text-sm shadow-md">
      <p className="text-muted-foreground mb-1.5 text-xs font-medium">{point.label}</p>
      {/* Grid (not flex) so rank / rank-change / name / total / points-change
       * each form their own left-aligned column across rows, per the ask —
       * a flex row with justify-between only aligns within a row. */}
      <div className="grid grid-cols-[auto_auto_1fr_auto_auto] items-center gap-x-2.5 gap-y-1">
        {rows.map(({ playerId, value }) => {
          const player = playerById.get(playerId);
          if (!player) return null;

          const rank = currentRanks.get(playerId);
          const prevRank = previousRanks?.get(playerId);
          // Positive = moved toward 1st (fewer places to go = improvement).
          const rankChange = prevRank != null && rank != null ? prevRank - rank : null;
          const prevValue = previous ? previous[playerId] : null;
          const pointsGained =
            typeof prevValue === "number" ? Math.round(value - prevValue) : null;

          return (
            <div key={playerId} className="contents">
              <span className="text-muted-foreground text-left text-xs tabular-nums">
                {rank != null ? `#${rank}` : ""}
              </span>
              <span
                className="text-left text-xs font-medium tabular-nums"
                style={rankChange ? { color: rankChange > 0 ? STATUS_GOOD : STATUS_BAD } : undefined}
              >
                {rankChange ? `${rankChange > 0 ? "▲" : "▼"}${Math.abs(rankChange)}` : ""}
              </span>
              <span className="flex items-center gap-1.5 text-left">
                <span
                  aria-hidden
                  className="h-0.5 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: colorByPlayer[playerId] }}
                />
                <PlayerName name={player.name} state={player.state ?? "??"} size="sm" />
              </span>
              <span className="text-left font-semibold tabular-nums">{Math.round(value)}</span>
              <span
                className="text-left text-xs font-medium tabular-nums"
                style={{ color: STATUS_GOOD }}
              >
                {pointsGained ? `+${pointsGained}` : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
