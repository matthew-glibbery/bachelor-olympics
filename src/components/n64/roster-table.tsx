import { cn } from "@/lib/utils";

/**
 * The shared row language for every roster-shaped table in the app —
 * Standings on the leaderboard, the Odds tab's win/place list, and the
 * overall-bet roster/picks lists. All four used to be their own thing (a
 * real `<table>` on the leaderboard, `bevel-raised border` divs everywhere
 * else), which is what made the leaderboard the one table anyone would call
 * "the good one": alternating row tint, a `border-bevel-dark/40 border-b-2`
 * rule between rows, and `px-3 py-2` padding tall enough that a button sits
 * in a row comfortably instead of looking wedged in. These are that
 * language, factored out so every table gets it for free instead of each
 * screen re-deriving it slightly differently.
 *
 * Deliberately just class strings and one small badge component, not a
 * generic `<Table columns={...} rows={...}>` — the four call sites disagree
 * enough on column shape (rank badges, odds buttons, avatar stacks, status
 * badges) that a fully generic table would need more escape hatches than
 * the columns it standardizes, and the tables further from this file
 * (`placed-bets-table.tsx`) fit a different, narrower phone-first shape
 * anyway.
 */

/** The `<tr>` a header row sits in. */
export const ROSTER_HEAD_ROW = "border-bevel-dark border-b-2";

/** A header `<th>`. */
export const ROSTER_HEAD_CELL = "hud-label text-muted-foreground px-3 py-2";

/** A body `<tr>` — pass the row's index for the alternating tint. */
export function rosterRowClass(index: number, extra?: string | false): string {
  return cn(
    "border-bevel-dark/40 border-b-2 last:border-b-0",
    index % 2 === 1 && "bg-black/15",
    extra,
  );
}

/** A body `<td>`. */
export const ROSTER_CELL = "px-3 py-2";

/** The coloured square rank/order chip every roster row leads with on the
 *  leaderboard — same shape here so a rank reads the same way wherever a
 *  roster is rank-ordered. */
export function RankBadge({ rank, color }: { rank: number; color: string }) {
  return (
    <span
      className="font-display flex size-7 items-center justify-center rounded-sm text-sm"
      style={{ backgroundColor: color, color: "oklch(0.14 0.04 275)" }}
    >
      {rank}
    </span>
  );
}
