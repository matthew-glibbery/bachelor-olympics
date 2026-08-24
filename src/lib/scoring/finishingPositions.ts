/**
 * Who finished where at one event, for BOTH scoring modes.
 *
 * A placement event stores a finishing position directly; an absolute event
 * stores only a raw measurement (strokes, seconds, a count) and the position
 * has to be derived from it. Anything asking "did this player win / did they
 * make the top 3" needs the same answer regardless of which mode the event
 * used — per-event bet settlement above all.
 *
 * That gap was a real bug: per-event bets were only ever settled for
 * placement events (`if (isPlacement)` in event-card.tsx), so a winning bet
 * on the golf — the one absolute-scored event on the card — sat "open"
 * forever with the player's stake escrowed and unusable, even after the
 * event resolved. Deriving positions here, once, is what lets settlement
 * treat both modes identically.
 *
 * Competition ranking ("1224"), not dense ranking: two players tied for 1st
 * both hold position 1 and the next player holds 3, so "top 3" means the
 * three finishers a spectator would actually call the top 3. This is
 * deliberately NOT the dense re-grouping scorePlacement uses internally —
 * that exists to pool point values across the places a tie spans, which is a
 * different question from where someone finished.
 */

export interface EventResultLike {
  player_id: string;
  position: number | null;
  raw: number | null;
}

export interface ScoredEventLike {
  scoring_mode: "placement" | "absolute";
  lower_is_better: boolean;
}

/**
 * playerId -> finishing position (1-indexed, ties share the better position),
 * or null for anyone with no usable result.
 */
export function finishingPositions(
  event: ScoredEventLike,
  results: EventResultLike[],
): Map<string, number | null> {
  const positions = new Map<string, number | null>();

  // The value each player is ranked BY, and whether a smaller one is better.
  const usePlacement = event.scoring_mode === "placement";
  const smallerIsBetter = usePlacement || event.lower_is_better;

  const ranked: { playerId: string; value: number }[] = [];
  for (const r of results) {
    const value = usePlacement ? r.position : r.raw;
    if (value == null || !Number.isFinite(value)) {
      positions.set(r.player_id, null);
      continue;
    }
    ranked.push({ playerId: r.player_id, value });
  }

  ranked.sort((a, b) => (smallerIsBetter ? a.value - b.value : b.value - a.value));

  let position = 0;
  let previousValue: number | null = null;
  ranked.forEach((entry, index) => {
    // A tie holds the position of the first player in its group; the next
    // distinct value skips past the whole group (competition ranking).
    if (previousValue === null || entry.value !== previousValue) {
      position = index + 1;
      previousValue = entry.value;
    }
    positions.set(entry.playerId, position);
  });

  return positions;
}
