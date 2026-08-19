import { Badge } from "@/components/ui/badge";
import { PlayerName } from "@/components/player-name";
import type { PerEventBetRow, PlayerRow } from "@/lib/data/database.types";

const TARGET_LABEL: Record<PerEventBetRow["target"], string> = {
  win: "to win",
  place: "to place",
};

const STATUS_VARIANT: Record<PerEventBetRow["status"], "outline" | "default" | "destructive" | "secondary"> = {
  open: "outline",
  won: "default",
  lost: "destructive",
  void: "secondary",
};

/** Read-only reveal of every bet placed on one event — shown only once
 * betting has closed (the event left "planned"), so picks stay a surprise
 * until then. */
export function EventBetsList({
  bets,
  players,
}: {
  bets: PerEventBetRow[];
  players: Map<string, PlayerRow>;
}) {
  if (bets.length === 0) {
    return <p className="text-muted-foreground text-sm">No bets were placed on this event.</p>;
  }

  return (
    <div className="bevel-sunken bg-sunken flex flex-col gap-1.5 rounded-md p-2">
      {bets.map((bet) => {
        const bettor = players.get(bet.player_id);
        const pick = players.get(bet.pick_player_id);
        if (!bettor || !pick) return null;
        return (
          <div
            key={bet.id}
            className="bevel-raised bg-card flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm"
          >
            <span className="flex flex-wrap items-center gap-1.5">
              <PlayerName name={bettor.name} state={bettor.state ?? "??"} size="sm" />
              <span className="text-muted-foreground">
                wagered {bet.wager.toFixed(1)} on
              </span>
              <PlayerName name={pick.name} state={pick.state ?? "??"} size="sm" />
              <span className="text-muted-foreground">{TARGET_LABEL[bet.target]}</span>
            </span>
            <Badge variant={STATUS_VARIANT[bet.status]}>
              {bet.status === "open"
                ? "Open"
                : bet.status === "won"
                  ? `Won ${bet.payout?.toFixed(1)}×`
                  : bet.status === "lost"
                    ? "Lost"
                    : "Voided"}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
