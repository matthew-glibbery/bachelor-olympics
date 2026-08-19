"use client";

import { useState } from "react";
import { Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { eventWinnerIds } from "@/lib/scoring/eventWinner";
import type { EventResultRow, EventRow, PlayerRow } from "@/lib/data/database.types";

/**
 * "Replay" button on a resolved event's card (docs/VISUAL_SPEC.md →
 * Victory videos) — plays the winning player's one-per-player victory clip.
 * Renders nothing if the event isn't resolved, has no winner yet, or the
 * winner has no victory clip uploaded.
 *
 * Mobile-first playback: full-screen, faded to black, no frame/title/close
 * button — just the clip. Closes itself the moment the video ends; tapping
 * or Escape still works too (Radix's default dialog dismissal), it's just
 * not shown as a visible control.
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
  const winnerIds = eventWinnerIds(event, results);
  const winner = players.find(
    (p) => winnerIds.includes(p.id) && p.character_victory_video_url,
  );
  if (!winner) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Trophy className="size-4" />
        Replay
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
          {winner.name} wins {event.name}
        </DialogTitle>
        <video
          key={winner.id}
          src={winner.character_victory_video_url!}
          autoPlay
          muted
          playsInline
          onEnded={() => setOpen(false)}
          className="h-full w-full object-contain"
        />
      </DialogContent>
    </Dialog>
  );
}
