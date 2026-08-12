"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ManageEventRow } from "@/components/manage-event-row";
import { AddEventRow } from "@/components/add-event-row";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { reorderEvents } from "@/lib/data/mutations";
import type { EventRow } from "@/lib/data/database.types";

/**
 * Groom-tools "Manage events" card: create, edit, delete, and drag-to-
 * reorder events. `events` is already sorted by `sort_order`
 * (src/lib/data/queries.ts → fetchEvents), and every other screen reads
 * events straight from the store in that same order, so persisting a new
 * order here is all that's needed to make it show up everywhere.
 */
export function ManageEventsCard({ events }: { events: EventRow[] }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  // Optimistic local order so the drag feels instant instead of waiting on
  // a round-trip + Realtime refetch before the list visually reorders.
  //
  // The write itself resolves faster than the Realtime round-trip that
  // updates `events` in the store — clearing this the moment the write
  // succeeded (rather than once `events` actually reflects it) made the
  // list visibly snap back to the OLD order for a beat, since `events`
  // was still stale at that instant. Instead, hang onto the optimistic
  // order until `events` genuinely matches it.
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const orderedIds = localOrder ?? events.map((e) => e.id);
  const eventsById = new Map(events.map((e) => [e.id, e]));

  useEffect(() => {
    if (!localOrder) return;
    const liveOrder = events.map((e) => e.id);
    if (liveOrder.length === localOrder.length && liveOrder.every((id, i) => id === localOrder[i])) {
      setLocalOrder(null);
    }
  }, [events, localOrder]);

  function handleDragEnd(dragEvent: DragEndEvent) {
    const { active, over } = dragEvent;
    if (!over || active.id === over.id) return;
    const from = orderedIds.indexOf(String(active.id));
    const to = orderedIds.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    const next = arrayMove(orderedIds, from, to);
    setLocalOrder(next);
    reorderEvents(getSupabaseBrowserClient(), next).catch(() => setLocalOrder(null));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage events</CardTitle>
        <CardDescription>
          Add, edit, delete, or drag to reorder. The order here is the order
          every screen shows events in.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <AddEventRow nextSortOrder={events.length} />
        {events.length > 0 ? (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
              <div className="flex flex-col">
                {orderedIds.map((id) => {
                  const event = eventsById.get(id);
                  if (!event) return null;
                  return <ManageEventRow key={id} event={event} />;
                })}
              </div>
            </SortableContext>
          </DndContext>
        ) : null}
      </CardContent>
    </Card>
  );
}
