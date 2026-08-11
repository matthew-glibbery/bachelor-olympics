import * as React from "react";
import { Medal } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlayerName } from "@/components/player-name";
import { standings, type EventScoreLine } from "@/lib/scoring/total";

/**
 * The live "medal table" (PRODUCT_SPEC.md → Live standings / Theming). Shows
 * every competitor's raw event points and their multiplier-adjusted total, in
 * standings order, with a podium treatment for the top three.
 *
 * Pure presentation over the Phase-0 domain layer: it takes score lines +
 * player metadata and calls `standings()`. Once the Phase-1 store lands, feed it
 * live data — no change to this component.
 */

export interface MedalTablePlayer {
  id: string;
  name: string;
  nickname?: string | null;
  state: string;
  photoUrl?: string | null;
}

export interface MedalTableProps {
  players: MedalTablePlayer[];
  scoreLines: EventScoreLine[];
}

/** Podium tint for ranks 1–3 (gold/silver/bronze), transparent otherwise. */
const PODIUM_ICON = ["text-chart-3", "text-muted-foreground", "text-primary"];

const round1 = (n: number) => Math.round(n * 10) / 10;

export function MedalTable({ players, scoreLines }: MedalTableProps) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const ranked = standings(scoreLines);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12 text-center">#</TableHead>
          <TableHead>Competitor</TableHead>
          <TableHead className="text-right">Raw</TableHead>
          <TableHead className="text-right">Adjusted</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ranked.map((total, i) => {
          const player = byId.get(total.playerId);
          const rank = i + 1;
          const onPodium = rank <= 3;
          return (
            <TableRow key={total.playerId}>
              <TableCell className="text-center">
                <span className="inline-flex items-center justify-center gap-1 font-semibold tabular-nums">
                  {onPodium ? (
                    <Medal className={cn("size-4", PODIUM_ICON[i])} />
                  ) : null}
                  {rank}
                </span>
              </TableCell>
              <TableCell>
                {player ? (
                  <PlayerName
                    name={player.name}
                    state={player.state}
                    nickname={player.nickname}
                    photoUrl={player.photoUrl}
                  />
                ) : (
                  total.playerId
                )}
              </TableCell>
              <TableCell className="text-muted-foreground text-right tabular-nums">
                {round1(total.raw)}
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {round1(total.adjusted)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
