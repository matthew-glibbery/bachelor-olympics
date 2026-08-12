"use client";

import { useEffect } from "react";
import { CalendarDays } from "lucide-react";

import { AppNav } from "@/components/app-nav";
import { EventCard } from "@/components/event-card";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";

export default function EventsPage() {
  const { players, events, eventResults, connect, loading, error, ready } = useGameStore();
  const { groomUnlocked, hydrate } = useSessionStore();

  useEffect(() => {
    hydrate();
    connect();
  }, [hydrate, connect]);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 pt-12 pb-28 sm:pb-12">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Events</h1>
          <p className="text-muted-foreground text-sm">
            Start scoring, enter results, or cancel an event.
          </p>
        </div>
        <AppNav />
      </header>

      {error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : !ready && loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : events.length === 0 ? (
        <p className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <CalendarDays className="size-4" />
          No events configured yet.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {events.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              players={players}
              results={eventResults.filter((r) => r.event_id === event.id)}
              groomUnlocked={groomUnlocked}
            />
          ))}
        </div>
      )}
    </main>
  );
}
