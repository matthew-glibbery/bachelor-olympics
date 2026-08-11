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
 * Drag-to-reorder finishing order for placement events. Top-to-bottom = 1st
 * to last. Uses PointerSensor (not just mouse) so it works with touch —
 * this gets used on phones at the actual event.
 */

export interface RankedResultsEditorProps {
  order: string[];
  tied: ReadonlySet<string>;
  players: Map<string, PlayerRow>;
  onReorder: (order: string[]) => void;
  onToggleTie: (playerId: string) => void;
}

export function RankedResultsEditor({
  order,
  tied,
  players,
  onReorder,
  onToggleTie,
}: RankedResultsEditorProps) {
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
            return (
              <RankedRow
                key={playerId}
                id={playerId}
                rank={i + 1}
                tied={i > 0 && tied.has(playerId)}
                canTie={i > 0}
                player={player}
                onToggleTie={() => onToggleTie(playerId)}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function RankedRow({
  id,
  rank,
  tied,
  canTie,
  player,
  onToggleTie,
}: {
  id: string;
  rank: number;
  tied: boolean;
  canTie: boolean;
  player: PlayerRow;
  onToggleTie: () => void;
}) {
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
      {canTie ? (
        <label className="text-muted-foreground flex items-center gap-1 text-xs">
          <input type="checkbox" checked={tied} onChange={onToggleTie} className="size-3.5" />
          tie
        </label>
      ) : null}
    </div>
  );
}
