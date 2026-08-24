/**
 * Absolute-score-based scoring (PRODUCT_SPEC.md → Scoring).
 *
 * Used where there's a real measurable result (golf strokes, a timed event).
 * The field is scaled onto the SAME range a placement event spans: the best
 * raw performance is worth 100, the worst is worth exactly what last place
 * is worth on the placement curve for a field this size (15 with 7 players),
 * and everyone else lands proportionally to where their raw result fell
 * between those two. A blowout still looks like a blowout in the points,
 * because the spacing follows the raw numbers rather than the ranking.
 *
 * This replaced a "ratio to the best result" version (2026-08-24), which
 * pinned best = 100 and then scored everyone at `100 × raw / best`. Two
 * problems, both real rather than theoretical:
 *
 *   - The bottom of the range was arbitrary and metric-dependent. Nine holes
 *     of golf where the best round is 40 and the worst is 60 compressed the
 *     whole field into 100-67, while a raw count where the best is 10 and
 *     the worst is 2 spread the same relative field across 100-20. The same
 *     finishing order was worth wildly different amounts depending only on
 *     what the numbers happened to be measuring.
 *   - It made absolute events silently worth more than placement ones. Last
 *     place in a placement event scores 15; last place at golf could score
 *     67, more than 3rd place. Pegging both ends fixes that: an absolute
 *     event now awards between 100 and 15, the same as everything else.
 *
 * Rounded to the nearest whole number, per explicit product decision — no
 * scoring currency in this app awards fractional points, placement or
 * absolute. (Earlier spec language argued fractions here preserved
 * close-result detail; overridden — whole numbers everywhere wins.)
 */
import { PLACEMENT_BASE, placementPoints } from "./placement";

export interface AbsoluteEntry {
  playerId: string;
  /** The raw measured result (strokes, seconds, points, …). */
  raw: number;
}

export interface AbsoluteOptions {
  /** True when a lower raw result is better (golf strokes). Default false. */
  lowerIsBetter?: boolean;
}

/**
 * The points a fully-tied field of `size` shares out, per player.
 *
 * Every raw result being identical is a tie for every place at once, so it
 * resolves the way placement scoring resolves any tie: pool the places being
 * spanned and split evenly (PRODUCT_SPEC.md → Ties). Awarding 100 each — what
 * the old ratio version did, since every result was trivially "the best" —
 * paid a field that did nothing to separate itself as if all of them had won.
 */
function fullTieShare(size: number): number {
  let pooled = 0;
  for (let place = 1; place <= size; place++) pooled += placementPoints(place);
  return Math.round(pooled / size);
}

/**
 * Scale raw results onto the placement curve's own range: best = 100, worst =
 * `placementPoints(fieldSize)`, everyone else proportional to their raw
 * result's position between the two.
 *
 * `fieldSize` is the number of entries actually scored, not the roster size —
 * the same field the placement curve would have been applied to.
 */
export function scoreAbsolute(
  entries: AbsoluteEntry[],
  options: AbsoluteOptions = {},
): Map<string, number> {
  const points = new Map<string, number>();
  if (entries.length === 0) return points;

  const { lowerIsBetter = false } = options;
  const raws = entries.map((e) => e.raw).filter((r) => Number.isFinite(r));

  // A single scored player has no field to be spread across, and nothing to
  // interpolate between — they were the best result there was.
  if (entries.length === 1 || raws.length === 0) {
    for (const { playerId } of entries) points.set(playerId, PLACEMENT_BASE);
    return points;
  }

  const best = lowerIsBetter ? Math.min(...raws) : Math.max(...raws);
  const worst = lowerIsBetter ? Math.max(...raws) : Math.min(...raws);
  const floor = placementPoints(entries.length);

  if (best === worst) {
    const share = fullTieShare(entries.length);
    for (const { playerId } of entries) points.set(playerId, share);
    return points;
  }

  const spread = Math.abs(best - worst);
  for (const { playerId, raw } of entries) {
    if (!Number.isFinite(raw)) {
      points.set(playerId, floor);
      continue;
    }
    // How far this result travelled from the worst in the field toward the
    // best, 0..1 — written off `worst` so the same expression works for both
    // directions without a branch.
    const progress = Math.abs(raw - worst) / spread;
    points.set(playerId, Math.round(floor + (PLACEMENT_BASE - floor) * progress));
  }
  return points;
}
