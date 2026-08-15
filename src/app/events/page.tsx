"use client";

import { useEffect } from "react";
import { CalendarDays } from "lucide-react";

import { AppNav } from "@/components/app-nav";
import { EventCard } from "@/components/event-card";
import { BonusEventsCard } from "@/components/bonus-events-card";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";
import { deriveScoreLines, upcomingCatchUp } from "@/lib/scoring/fromRows";

export default function EventsPage() {
  const {
    players,
    events,
    eventResults,
    eventRankings,
    perEventBets,
    bonusEvents,
    multipliers,
    connect,
    loading,
    error,
    ready,
  } = useGameStore();
  const { groomUnlocked, hydrate } = useSessionStore();

  useEffect(() => {
    hydrate();
    connect();
  }, [hydrate, connect]);

  const playerIds = players.map((p) => p.id);

  // Catch-up bonus per event (PRODUCT_SPEC.md → Multipliers → Catch-up
  // bonus): actual bonuses baked into already-resolved events' score lines,
  // plus a live preview of what the next planned event will award once it
  // resolves — both keyed by event id -> playerId -> bonus fraction.
  const catchUpByEvent = new Map<string, Map<string, number>>();
  for (const line of deriveScoreLines(events, eventResults, multipliers, playerIds)) {
    if (!line.catchUpBonus) continue;
    const forEvent = catchUpByEvent.get(line.eventId) ?? new Map<string, number>();
    forEvent.set(line.playerId, line.catchUpBonus);
    catchUpByEvent.set(line.eventId, forEvent);
  }
  const preview = upcomingCatchUp(events, eventResults, multipliers, playerIds);
  if (preview && preview.bonuses.size > 0) {
    catchUpByEvent.set(preview.eventId, preview.bonuses);
  }

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
      ) : (
        <>
          {events.length === 0 ? (
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
                  ranking={eventRankings
                    .filter((r) => r.event_id === event.id)
                    .map((r) => ({ playerId: r.player_id, rank: r.rank }))}
                  bets={perEventBets.filter((b) => b.event_id === event.id)}
                  groomUnlocked={groomUnlocked}
                  catchUpBonuses={catchUpByEvent.get(event.id) ?? null}
                />
              ))}
            </div>
          )}

          {players.length > 0 ? (
            <BonusEventsCard
              players={players}
              bonusEvents={bonusEvents}
              groomUnlocked={groomUnlocked}
            />
          ) : null}
        </>
      )}
    </main>
  );
}
