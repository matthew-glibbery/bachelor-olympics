/**
 * Absolute-score-based scoring (PRODUCT_SPEC.md → Scoring).
 *
 * Used where there's a real measurable result (golf strokes, a timed event).
 * The best raw performance in the group is scaled to 100 points; everyone else
 * is scaled proportionally to how close their raw result was to the best one —
 * not just by rank. A blowout should look like a blowout in the points.
 *
 * Interpretation note (the spec is deliberately loose on the exact curve):
 * we use a linear ratio to the best result, which keeps best = 100, is
 * monotonic, never bottoms out at zero for real results, and makes the size of
 * a gap show up proportionally. For higher-is-better metrics the score is
 * `100 * raw / best`; for lower-is-better (golf) it's `100 * best / raw`.
 */

export interface AbsoluteEntry {
  playerId: string;
  /** The raw measured result (strokes, seconds, points, …). */
  raw: number;
}

export interface AbsoluteOptions {
  /** True when a lower raw result is better (golf strokes). Default false. */
  lowerIsBetter?: boolean;
}

/** Scale raw results into points with the best performance pinned at 100. */
export function scoreAbsolute(
  entries: AbsoluteEntry[],
  options: AbsoluteOptions = {},
): Map<string, number> {
  const points = new Map<string, number>();
  if (entries.length === 0) return points;

  const { lowerIsBetter = false } = options;
  const raws = entries.map((e) => e.raw);
  const best = lowerIsBetter ? Math.min(...raws) : Math.max(...raws);

  if (!Number.isFinite(best) || best <= 0) {
    // Degenerate input (all zero / non-positive) — can't form a meaningful
    // ratio. Award everyone the same top score rather than divide by zero.
    for (const { playerId } of entries) points.set(playerId, 100);
    return points;
  }

  for (const { playerId, raw } of entries) {
    const ratio = lowerIsBetter ? best / raw : raw / best;
    points.set(playerId, 100 * ratio);
  }
  return points;
}
