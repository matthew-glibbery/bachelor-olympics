import { PlayerName } from "@/components/player-name";
import { payoutMultipliers, type RankingEntry } from "@/lib/odds/ranking";
import type { PlayerRow } from "@/lib/data/database.types";

/** Read-only win/place payout odds for one event's own ranking. Ranking
 * editing lives on Setup → Groom tools; this is just the display. */
export function EventOddsTable({
  ranking,
  players,
}: {
  ranking: RankingEntry[];
  players: Map<string, PlayerRow>;
}) {
  if (ranking.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        The groom hasn&apos;t ranked this event yet — no odds until then.
      </p>
    );
  }

  const payouts = payoutMultipliers(ranking);
  const order = [...ranking].sort((a, b) => a.rank - b.rank);

  return (
    <div className="flex flex-col gap-1.5">
      {order.map(({ playerId }) => {
        const player = players.get(playerId);
        const mult = payouts.get(playerId);
        if (!player || !mult) return null;
        return (
          <div
            key={playerId}
            className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
          >
            <PlayerName
              name={player.name}
              state={player.state ?? "??"}
              size="sm"
              photoUrl={player.photo_url}
            />
            <div className="flex gap-3 text-right tabular-nums">
              <span>win {mult.win.toFixed(1)}x</span>
              <span>place {mult.top3.toFixed(1)}x</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
