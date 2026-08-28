"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, CheckCircle2, ChevronLeft, PartyPopper } from "lucide-react";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { BonusEventsCard } from "@/components/bonus-events-card";
import { EventCard } from "@/components/event-card";
import { GameScreen } from "@/components/n64/game-screen";
import { useGameInput } from "@/hooks/use-game-input";
import { useMenuNav } from "@/hooks/use-menu-nav";
import { useGameStore } from "@/store/gameStore";
import { useSettleStrandedBets } from "@/hooks/use-settle-stranded-bets";
import { useSessionStore } from "@/store/sessionStore";
import { deriveScoreLines, upcomingCatchUp } from "@/lib/scoring/fromRows";
import { bettingReserve } from "@/lib/betting/reserve";
import { allocatedMultiplierTotal } from "@/lib/multipliers/budget";
import { cn } from "@/lib/utils";

/**
 * Events (docs/VISUAL_SPEC.md) — a two-step flow: every event visible at
 * once as a grid of big tiles, then picking one (click, Enter/A, or Tab+
 * confirm) enters that event's own full-screen detail — big photo up top
 * (EventCard, src/components/event-card.tsx), the Results/Odds/Bets tabs
 * below. `entered` gates which of the two is on screen; there's no partial
 * state showing both, matching the "big tiles, then dive into one" ask.
 *
 * The detail view is the real EventCard — same groom-tool logic as before
 * (start scoring, enter/edit results, cancel/reset, photo upload, odds,
 * bets, victory replay).
 *
 * Bonus events (BonusEventsCard) get one more tile at the end of the grid
 * rather than a permanently-visible card below everything — they're
 * spontaneous and outside core scoring, but the *screen grammar* here is
 * "one grid, or one focused thing," and a card that's always on screen
 * breaks that.
 *
 * Selection is click/tap/D-pad only, not hover (`selectOnHover: false`) —
 * this is a content-heavy admin list where someone's mouse legitimately
 * passes back and forth over the grid while reading, unlike /select's
 * roster where "look at a portrait, it lights up" is the point.
 */
export default function EventsPage() {
  // Which event (if any) is open lives in the URL (`?open=<id>` or
  // `?open=bonus`), not local component state — a plain `useState` couldn't
  // tell AppNav's "Events" tab apart from any other click while already on
  // this route, so tapping it while a detail view was open silently did
  // nothing (same URL, no navigation, nothing to react to). Reading it from
  // `useSearchParams` means AppNav's href="/events" (no query) really is a
  // different URL whenever a detail view is open, so it actually navigates
  // and clears back to the grid — same mechanism that also makes Back
  // (browser gesture, not just the on-screen button) work correctly.
  // `useSearchParams` requires a Suspense boundary around it.
  return (
    <Suspense fallback={null}>
      <EventsPageInner />
    </Suspense>
  );
}

function EventsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openParam = searchParams.get("open");

  const {
    players,
    events,
    eventResults,
    eventRankings,
    perEventBets,
    bonusEvents,
    overallBets,
    multipliers,
    bracketSeeds,
    bracketMatches,
    roundRobinMatches,
    placementRounds,
    connect,
    loading,
    error,
    ready,
  } = useGameStore();
  const { groomUnlocked, selectedPlayerId, hydrate } = useSessionStore();

  useEffect(() => {
    hydrate();
    connect();
  }, [hydrate, connect]);

  // Repair path for bets stranded "open" on an already-resolved event —
  // see the hook for why that happened and why it's safe here.
  useSettleStrandedBets(ready);

  const playerIds = players.map((p) => p.id);

  // Odds tab's per-event betting form needs the session player's unallocated
  // multiplier reserve — same derivation as src/app/bets/page.tsx.
  const reserve = selectedPlayerId
    ? bettingReserve(
        events.length,
        allocatedMultiplierTotal(events, multipliers, selectedPlayerId),
        perEventBets
          .filter((b) => b.player_id === selectedPlayerId)
          .map((b) => ({ wager: b.wager, status: b.status, payout: b.payout })),
      )
    : null;

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
  // upcomingCatchUp still feeds catchUpByEvent (so the entered EventCard's
  // results tab keeps showing a live badge on whoever's actually scoring
  // right now) — only the standalone preview *section* on this page is
  // gone. The leaderboard (src/app/page.tsx) is now where players see the
  // preview before an event starts. Same bonusAwards folding as the
  // leaderboard's own preview — without it, this could disagree with the
  // leaderboard about who's actually in the bottom three.
  const bonusAwards = [
    ...bonusEvents
      .filter((b) => b.winner_player_id)
      .map((b) => ({ playerId: b.winner_player_id as string, points: b.points })),
    ...overallBets
      .filter((b) => b.status === "won" && b.payout != null)
      .map((b) => ({ playerId: b.player_id, points: b.payout as number })),
  ];
  const preview = upcomingCatchUp(events, eventResults, multipliers, playerIds, bonusAwards);
  if (preview && preview.bonuses.size > 0) {
    catchUpByEvent.set(preview.eventId, preview.bonuses);
  }

  // The bonus-events tile is one more grid entry, appended after the real
  // events — only offered once there's a roster to award points to, same
  // guard BonusEventsCard itself used to have.
  const showBonusTile = players.length > 0;
  const bonusIndex = events.length;
  const itemCount = events.length + (showBonusTile ? 1 : 0);

  // Two-step flow: the grid is a menu, "confirming" an item pushes
  // `?open=<id>` instead of routing anywhere new (this screen has no
  // sub-routes of its own). `enabled: !entered` keeps the D-pad from moving
  // the grid cursor while a detail view is open; a separate useGameInput
  // below handles Back (B/Escape) the same way the on-screen button does.
  const entered = openParam != null;
  const { index, getItemProps } = useMenuNav({
    count: itemCount,
    columns: 1,
    selectOnHover: false,
    enabled: !entered,
    onConfirm: (i) => {
      const id = i < events.length ? events[i]?.id : "bonus";
      if (id) router.push(`/events?open=${id}`);
    },
  });
  useGameInput({ enabled: entered, onBack: () => router.push("/events") });

  const focused = entered ? (events.find((e) => e.id === openParam) ?? null) : null;
  const bonusSelected = entered ? openParam === "bonus" : showBonusTile && index === bonusIndex;

  return (
    // No screen title on either step, deliberately. The grid step sat under
    // an "EVENTS" plate with the nav's own highlighted "Events" tab directly
    // beneath it, and the detail step repeated the event's name as a subtitle
    // immediately above the event card's own heading — two labels, one fact,
    // both times. The tiles and the card are self-evidently what they are.
    <GameScreen>
      {error ? (
          <p className="text-destructive text-center text-sm">{error}</p>
        ) : !ready && loading ? (
          <p className="text-muted-foreground text-center text-sm">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-sm">
            <CalendarDays className="size-4" />
            No events configured yet.
          </p>
        ) : !entered ? (
          /* Step 1: every event as a big tile. Picking one (click, tap, or
             D-pad + confirm) enters its detail view below. */
          <ul className="mx-auto grid w-full max-w-3xl grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
            {events.map((event, i) => {
              const isActive = i === index;
              return (
                <li key={event.id} className="min-w-0">
                  <button
                    type="button"
                    {...getItemProps(i)}
                    aria-pressed={isActive}
                    className={cn(
                      "bevel-raised bg-card group flex w-full min-w-0 flex-col gap-2 rounded-md p-2 transition-transform duration-75 focus:outline-none",
                      isActive && "is-cursor -translate-y-1",
                    )}
                  >
                    <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-sm bg-black/20">
                      {event.status === "scoring" ? (
                        <Badge variant="destructive" className="absolute top-1 right-1 z-10">
                          <span className="size-1.5 animate-pulse rounded-full bg-current" />
                          Live
                        </Badge>
                      ) : event.status === "resolved" ? (
                        <Badge variant="secondary" className="absolute top-1 right-1 z-10">
                          <CheckCircle2 className="size-3" />
                          Done
                        </Badge>
                      ) : null}
                      {event.photo_url ? (
                        <Image
                          src={event.photo_url}
                          alt=""
                          width={320}
                          height={240}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center">
                          <CalendarDays className="text-muted-foreground size-8" />
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "hud-label block text-center",
                        isActive ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {event.name}
                    </span>
                  </button>
                </li>
              );
            })}

            {showBonusTile ? (
              <li className="min-w-0">
                <button
                  type="button"
                  {...getItemProps(bonusIndex)}
                  aria-pressed={bonusSelected}
                  className={cn(
                    "bevel-raised bg-card group flex w-full min-w-0 flex-col gap-2 rounded-md p-2 transition-transform duration-75 focus:outline-none",
                    bonusSelected && "is-cursor -translate-y-1",
                  )}
                >
                  <span className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-sm bg-black/20">
                    <PartyPopper className="text-primary size-8" />
                  </span>
                  <span
                    className={cn(
                      "hud-label block text-center",
                      bonusSelected ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    Bonus
                  </span>
                </button>
              </li>
            ) : null}
          </ul>
        ) : (
          /* Step 2: the picked tile's full detail — the real event's card,
             or the bonus-events card, never both, and never alongside the
             grid. */
          /* gap-5, not gap-3: with the screen title gone this small back
             link is the only thing above the event card, and at gap-3 it read
             as part of the card's own frame rather than as the way out of it. */
          <div className="flex flex-col gap-5">
            <button
              type="button"
              onClick={() => router.push("/events")}
              className="hud-label text-muted-foreground hover:text-foreground -mb-1 inline-flex w-fit items-center gap-1.5 rounded-sm py-1"
            >
              <ChevronLeft className="size-4" />
              Back to events
            </button>
            {bonusSelected ? (
              <BonusEventsCard
                players={players}
                bonusEvents={bonusEvents}
                groomUnlocked={groomUnlocked}
                events={events}
                eventResults={eventResults}
                multipliers={multipliers}
                perEventBets={perEventBets}
                overallBets={overallBets}
              />
            ) : focused ? (
              <EventCard
                key={focused.id}
                event={focused}
                players={players}
                results={eventResults.filter((r) => r.event_id === focused.id)}
                multipliers={multipliers.filter((m) => m.event_id === focused.id)}
                ranking={eventRankings
                  .filter((r) => r.event_id === focused.id)
                  .map((r) => ({ playerId: r.player_id, rank: r.rank }))}
                bets={perEventBets.filter((b) => b.event_id === focused.id)}
                bracketSeeds={bracketSeeds.filter((s) => s.event_id === focused.id)}
                bracketMatches={bracketMatches.filter((m) => m.event_id === focused.id)}
                roundRobinMatches={roundRobinMatches.filter((m) => m.event_id === focused.id)}
                placementRounds={placementRounds.filter((r) => r.event_id === focused.id)}
                groomUnlocked={groomUnlocked}
                catchUpBonuses={catchUpByEvent.get(focused.id) ?? null}
                currentPlayerId={selectedPlayerId}
                reserve={reserve}
              />
            ) : null}
          </div>
        )}
    </GameScreen>
  );
}
