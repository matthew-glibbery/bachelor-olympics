import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";
import { PlayerName } from "@/components/player-name";
import type { PlayerRow } from "@/lib/data/database.types";

/**
 * Drag-to-reorder the groom's private strength ranking, top = strongest
 * (rank 1). No ties — PRODUCT_SPEC.md → Overall betting → Odds source
 * requires a strict 1..N ordering, it's the only odds input. Same
 * PointerSensor pattern as RankedResultsEditor so it works on touch.
 */

export interface GroomRankingEditorProps {
  order: string[];
  players: Map<string, PlayerRow>;
  onReorder: (order: string[]) => void;
}

export function GroomRankingEditor({ order, players, onReorder }: GroomRankingEditorProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = order.indexOf(String(active.id));
    const to = order.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onReorder(arrayMove(order, from, to));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={order} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-1.5">
          {order.map((playerId, i) => {
            const player = players.get(playerId);
            if (!player) return null;
            return <RankRow key={playerId} id={playerId} rank={i + 1} player={player} />;
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function RankRow({ id, rank, player }: { id: string; rank: number; player: PlayerRow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "bg-card flex items-center gap-2 rounded-md border px-2 py-1.5",
        isDragging && "opacity-60",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="text-muted-foreground touch-none active:cursor-grabbing"
        aria-label={`Drag to reorder ${player.name}`}
      >
        <GripVertical className="size-4" />
      </button>
      <span className="w-5 text-right text-sm font-semibold tabular-nums">{rank}</span>
      <PlayerName
        name={player.name}
        state={player.state ?? "??"}
        size="sm"
        photoUrl={player.photo_url}
        className="flex-1"
      />
    </div>
  );
}
