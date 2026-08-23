"use client";

import { Fragment } from "react";
import { Pencil, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { PlayerName } from "@/components/player-name";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PerEventBetRow, PlayerRow } from "@/lib/data/database.types";

const TARGET_LABEL: Record<PerEventBetRow["target"], string> = {
  win: "Win",
  place: "Place",
};

export type PlacedBet = {
  id: string;
  /** Small line above the pick — the event name, on a screen that lists
   *  bets across several events. Omitted where the surrounding UI already
   *  says which event this is. */
  context?: string | null;
  /** Who placed the bet. Only rendered when `showBettor` is on (the reveal
   *  of everyone's bets on one event); elsewhere every row is "yours" and a
   *  column repeating that would be dead width on a phone. */
  bettor?: PlayerRow | null;
  pick: PlayerRow | null;
  target: PerEventBetRow["target"];
  /** Payout multiplier for this pick/target. Null when the groom hasn't
   *  ranked the event, so there are no odds to quote yet. */
  odds: number | null;
  wager: number;
  status: PerEventBetRow["status"];
  /** Settled payout, once the event resolved. */
  payout: number | null;
  /** Whether this row's bet can still be changed (open, event not started). */
  canEdit?: boolean;
  busy?: boolean;
};

/**
 * Every placed bet, everywhere, as one table.
 *
 * Bets used to render as a different hand-written sentence on each of the
 * three screens that show them ("Josh to place top 3 — wagered 1.5", "Matthew
 * wagered 1.5 on Josh to place", a two-column list on the Odds tab) — three
 * shapes for one fact, none of which let you compare two bets by scanning a
 * column. A wager is a row of numbers; numbers in columns is a table.
 *
 * Sized for the phone this is actually played on: the pick column is the
 * only flexible one and truncates, every figure column is fixed and narrow,
 * and the edit/cancel controls are icons rather than the two word-buttons
 * that used to push the row into a horizontal scroll at 390px.
 */
export function PlacedBetsTable({
  bets,
  colorByPlayer,
  onEdit,
  onDelete,
  showBettor = false,
  framed = true,
  className,
}: {
  bets: PlacedBet[];
  colorByPlayer: Record<string, string>;
  /** Omit to render read-only (no controls column at all). */
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  showBettor?: boolean;
  /** Set false where the surrounding panel is already a sunken well — two
   *  nested bevels read as a rendering fault, and the inner one's inset
   *  shadow ate into the controls column. */
  framed?: boolean;
  className?: string;
}) {
  const showControls = Boolean(onEdit || onDelete);
  const columnCount = 5 + (showControls || bets.some((b) => b.status !== "open") ? 1 : 0);
  // A resolved bet's outcome has nowhere else to go once the controls column
  // is icon-only, so it takes that column's place per row.
  const showOutcome = bets.some((b) => b.status !== "open");

  return (
    <div className={cn(framed && "bevel-sunken bg-sunken rounded-md", className)}>
      {/* `table-fixed` with an explicit width on every column except the
          first. Six columns have to fit inside a 4rem-padded panel on a
          390px phone, and auto layout spends the width on whichever cell
          happens to hold the longest string — which pushed the edit/cancel
          controls off the right edge into a horizontal scroll nobody would
          think to try. Fixed layout means the figures get exactly what they
          need and the name column absorbs the remainder and truncates, which
          is the right thing to lose. */}
      <Table className="table-fixed text-xs">
        <TableHeader>
          <TableRow className="border-bevel-dark hover:bg-transparent border-b-2">
            <Th className="text-left">{showBettor ? "Bettor" : "Player"}</Th>
            <Th className="w-12">Bet</Th>
            <Th className="w-10">Odds</Th>
            <Th className="w-9">Stake</Th>
            <Th className="w-12">To win</Th>
            {showControls || showOutcome ? <Th className="w-16 text-right"> </Th> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {bets.map((bet, i) => {
            // An open bet quotes what it *would* pay; a settled one shows
            // what it actually did, since "would win" stops being the
            // interesting number the moment the event resolves.
            const toWin =
              bet.status === "won"
                ? bet.payout
                : bet.status === "open" && bet.odds != null
                  ? bet.wager * bet.odds
                  : null;

            // A context line ("Settlers of Catan") inside the name cell had
            // ~110px to live in and truncated to "SETTLER…", which names
            // nothing. As a full-width row above the group it belongs to it
            // gets the whole table width, and the name column gets its space
            // back. Only emitted when the context actually changes, so a run
            // of bets on one event is labelled once.
            const groupLabel =
              bet.context && bet.context !== bets[i - 1]?.context ? bet.context : null;

            return (
              <Fragment key={bet.id}>
                {groupLabel ? (
                  <TableRow className="hover:bg-transparent border-b-0">
                    <TableCell
                      colSpan={columnCount}
                      className="hud-label text-muted-foreground truncate px-1 pt-3 pb-1"
                    >
                      {groupLabel}
                    </TableCell>
                  </TableRow>
                ) : null}
              <TableRow
                className={cn(
                  "border-bevel-dark/40 hover:bg-transparent border-b-2 last:border-b-0",
                  i % 2 === 1 && "bg-black/15",
                  bet.status === "lost" && "text-muted-foreground",
                )}
              >
                <TableCell className="max-w-0 px-1 py-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {(() => {
                      const who = showBettor ? bet.bettor : bet.pick;
                      if (!who) return <span className="text-muted-foreground">—</span>;
                      return (
                        <PlayerName
                          name={who.name}
                          state={who.state ?? "??"}
                          size="sm"
                          photoUrl={who.photo_url}
                          color={colorByPlayer[who.id]}
                        />
                      );
                    })()}
                  </span>
                  {/* On the reveal view the pick is the point of the row, so
                      it gets its own line under the bettor rather than a
                      sixth column the phone has no room for. */}
                  {showBettor && bet.pick ? (
                    <span className="text-muted-foreground mt-0.5 block truncate">
                      on {bet.pick.name}
                    </span>
                  ) : null}
                </TableCell>

                <Td className="text-center">
                  <Badge
                    className="px-1.5 text-[10px]"
                    variant={bet.target === "win" ? "default" : "secondary"}
                  >
                    {TARGET_LABEL[bet.target]}
                  </Badge>
                </Td>
                <Td className="font-score tabular-nums">
                  {bet.odds != null ? `${bet.odds.toFixed(1)}×` : "—"}
                </Td>
                <Td className="font-score tabular-nums">{bet.wager.toFixed(1)}</Td>
                <Td
                  className={cn(
                    "font-score tabular-nums",
                    bet.status === "won" ? "text-primary" : undefined,
                  )}
                >
                  {toWin != null ? toWin.toFixed(1) : "—"}
                </Td>

                {showControls || showOutcome ? (
                  <TableCell className="px-1 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {bet.canEdit && showControls ? (
                        <>
                          {onEdit ? (
                            <IconControl
                              label="Edit this bet"
                              onClick={() => onEdit(bet.id)}
                              disabled={bet.busy}
                            >
                              <Pencil className="size-3" />
                            </IconControl>
                          ) : null}
                          {onDelete ? (
                            <IconControl
                              label="Cancel this bet"
                              tone="destructive"
                              onClick={() => onDelete(bet.id)}
                              disabled={bet.busy}
                            >
                              <Trash2 className="size-3" />
                            </IconControl>
                          ) : null}
                        </>
                      ) : bet.status === "won" ? (
                        <Badge>Won</Badge>
                      ) : bet.status === "lost" ? (
                        <Badge variant="destructive">Lost</Badge>
                      ) : bet.status === "void" ? (
                        <Badge variant="outline">Void</Badge>
                      ) : (
                        <span className="hud-label text-muted-foreground">Open</span>
                      )}
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function Th({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <TableHead
      className={cn(
        // `whitespace-normal`: the default nowrap on TableHead made "To win"
        // set a wider column than the figure under it ever needs.
        "hud-label text-muted-foreground h-8 px-1 text-[9px] tracking-[0.04em] text-right leading-tight whitespace-normal",
        className,
      )}
    >
      {children}
    </TableHead>
  );
}

function Td({ className, children }: { className?: string; children: React.ReactNode }) {
  return <TableCell className={cn("px-1 py-2 text-right", className)}>{children}</TableCell>;
}

/** A 28px icon plate. Same bevel language as `Button`, but sized to sit
 *  inside a compact table row without setting the row height. */
function IconControl({
  label,
  onClick,
  disabled,
  tone = "default",
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "destructive";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "bevel-raised grid size-6 shrink-0 place-items-center rounded-md transition-all active:translate-y-px",
        "focus-visible:is-cursor focus-visible:outline-none",
        "disabled:bg-muted disabled:text-muted-foreground disabled:pointer-events-none",
        tone === "destructive"
          ? "bg-secondary text-destructive hover:bg-destructive hover:text-white"
          : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      )}
    >
      {children}
    </button>
  );
}
