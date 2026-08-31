"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { eventWinnerIds } from "@/lib/scoring/eventWinner";
import type { EventResultRow, EventRow, PlayerRow } from "@/lib/data/database.types";

/**
 * "Victory video" button on a resolved event's card (docs/VISUAL_SPEC.md →
 * Victory videos) — plays each winner's one-per-player victory clip in
 * turn. Usually just one player, but a tie (`eventWinnerIds` returns every
 * tied player, deliberately leaving "how to handle more than one" to this
 * caller) plays all of them back to back, one at a time — this is a single
 * full-screen clip experience, not a split screen. A tied player with no
 * clip uploaded is skipped rather than leaving a gap in the sequence.
 * Renders nothing if the event isn't resolved, has no winner yet, or none
 * of the winners have a victory clip uploaded.
 *
 * Mobile-first playback: full-screen, faded to black, no frame/title/close
 * button — just the clip(s). Each clip closes itself and advances to the
 * next the moment it ends, closing the dialog entirely after the last one;
 * tapping or Escape still works too (Radix's default dialog dismissal),
 * it's just not shown as a visible control.
 */
export function VictoryReplayButton({
  event,
  results,
  players,
}: {
  event: EventRow;
  results: EventResultRow[];
  players: PlayerRow[];
}) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const winnerIds = eventWinnerIds(event, results);
  const winners = players.filter(
    (p) => winnerIds.includes(p.id) && p.character_victory_video_url,
  );
  const current = winners[Math.min(index, winners.length - 1)];
  if (!current) return null;

  function openReplay() {
    setIndex(0);
    setOpen(true);
  }

  function handleEnded() {
    if (index + 1 < winners.length) {
      setIndex(index + 1);
    } else {
      setOpen(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" onClick={openReplay}>
        <Trophy className="size-4" />
        {winners.length > 1 ? "Victory videos" : "Victory video"}
      </Button>
      <DialogContent
        showCloseButton={false}
        // `bevel-none!`, not `shadow-none`: this is a full-bleed video, not a
        // plate, and DialogContent applies `bevel-raised` by default. All
        // three are utilities of equal specificity in one layer and Tailwind
        // emits `.bevel-none` before `.bevel-raised`, so the important
        // modifier is what actually wins here — see globals.css.
        className="bevel-none! inset-0 top-0 left-0 h-dvh w-dvw max-w-none translate-x-0 translate-y-0 rounded-none bg-black p-0"
      >
        <DialogTitle className="sr-only">
          {current.name} wins {event.name}
        </DialogTitle>
        <video
          key={current.id}
          src={current.character_victory_video_url!}
          autoPlay
          muted
          playsInline
          onEnded={handleEnded}
          className="h-full w-full object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}
