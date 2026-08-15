"use client";

import { Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { eventWinnerIds } from "@/lib/scoring/eventWinner";
import type { EventResultRow, EventRow, PlayerRow } from "@/lib/data/database.types";

/**
 * "Replay" button on a resolved event's card (docs/VISUAL_SPEC.md →
 * Victory videos) — plays the winning player's one-per-player victory clip.
 * Renders nothing if the event isn't resolved, has no winner yet, or the
 * winner has no victory clip uploaded.
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
  const winnerIds = eventWinnerIds(event, results);
  const winner = players.find(
    (p) => winnerIds.includes(p.id) && p.character_victory_video_url,
  );
  if (!winner) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Trophy className="size-4" />
          Replay
        </Button>
      </DialogTrigger>
      <DialogContent className="p-0 sm:max-w-md">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>{winner.name} wins {event.name}!</DialogTitle>
        </DialogHeader>
        <video
          key={winner.id}
          src={winner.character_victory_video_url!}
          controls
          autoPlay
          muted
          playsInline
          className="w-full rounded-b-lg"
        />
      </DialogContent>
    </Dialog>
  );
}
