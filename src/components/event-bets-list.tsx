import { PlacedBetsTable } from "@/components/placed-bets-table";
import { perEventPayoutMultiplierOrNull, type RankingEntry } from "@/lib/odds/ranking";
import type { PerEventBetRow, PlayerRow } from "@/lib/data/database.types";

/** Read-only reveal of every bet placed on one event — shown only once
 * betting has closed (the event left "planned"), so picks stay a surprise
 * until then.
 *
 * Same `PlacedBetsTable` every other bet listing in the app now uses, with
 * the bettor column switched on: this view's question is "who backed whom",
 * where the Odds tab's and `/bets`' is "what have I got riding". */
export function EventBetsList({
  bets,
  players,
  colorByPlayer,
  ranking,
}: {
  bets: PerEventBetRow[];
  players: Map<string, PlayerRow>;
  colorByPlayer: Record<string, string>;
  /** This event's ranking, for quoting each bet's odds. Empty if the groom
   *  never ranked it — the odds column then reads "—" rather than lying. */
  ranking: RankingEntry[];
}) {
  if (bets.length === 0) {
    return <p className="text-muted-foreground text-sm">No bets were placed on this event.</p>;
  }

  return (
    <PlacedBetsTable
      showBettor
      colorByPlayer={colorByPlayer}
      bets={bets.map((bet) => ({
        id: bet.id,
        bettor: players.get(bet.player_id) ?? null,
        pick: players.get(bet.pick_player_id) ?? null,
        target: bet.target,
        odds: perEventPayoutMultiplierOrNull(ranking, bet.pick_player_id, bet.target),
        wager: bet.wager,
        status: bet.status,
        payout: bet.payout,
      }))}
    />
  );
}
