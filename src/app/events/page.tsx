"use client";

import { useEffect } from "react";
import { CalendarDays, Flame, PartyPopper } from "lucide-react";
import Image from "next/image";

import { BonusEventsCard } from "@/components/bonus-events-card";
import { CatchUpBadge, EventCard } from "@/components/event-card";
import { GameScreen } from "@/components/n64/game-screen";
import { Panel } from "@/components/n64/panel";
import { PlayerName } from "@/components/player-name";
import { useMenuNav } from "@/hooks/use-menu-nav";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";
import { deriveScoreLines, upcomingCatchUp } from "@/lib/scoring/fromRows";
import { bettingReserve } from "@/lib/betting/reserve";
import { allocatedMultiplierTotal } from "@/lib/multipliers/budget";
import { cn } from "@/lib/utils";

/**
 * Events (docs/VISUAL_SPEC.md) — the /select roster-strip pattern applied to
 * events instead of players: every event visible at once as a thumbnail
 * strip up top, one focused event's full detail below. Unlike /select
 * there's no separate "confirm" step — moving the cursor (D-pad, click, or
 * Tab) is itself the selection, since this screen doesn't route anywhere.
 *
 * The detail panel is the real EventCard (src/components/event-card.tsx,
 * reskinned in place — same groom-tool logic as before: start scoring,
 * enter/edit results, cancel/reset, photo upload, odds, bets, victory
 * replay), just showing one event at a time instead of all of them stacked.
 *
 * Bonus events (BonusEventsCard) get one more tile at the end of the strip
 * rather than a permanently-visible card below everything — they're
 * spontaneous and outside core scoring, but the *screen grammar* here is
 * "one strip, one focused thing," and a card that's always on screen
 * regardless of the cursor breaks that. Its content only shows when that
 * tile is the one selected.
 *
 * Selection is click/tap/D-pad only, not hover (`selectOnHover: false`) —
 * this is a content-heavy admin list where someone's mouse legitimately
 * passes back and forth over the strip while reading, unlike /select's
 * roster where "look at a portrait, it lights up" is the point.
 */
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
  const { groomUnlocked, selectedPlayerId, hydrate } = useSessionStore();

  useEffect(() => {
    hydrate();
    connect();
  }, [hydrate, connect]);

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
  const preview = upcomingCatchUp(events, eventResults, multipliers, playerIds);
  if (preview && preview.bonuses.size > 0) {
    catchUpByEvent.set(preview.eventId, preview.bonuses);
  }
  const previewEvent = preview ? (events.find((e) => e.id === preview.eventId) ?? null) : null;

  // The bonus-events tile is one more strip entry, appended after the real
  // events — only offered once there's a roster to award points to, same
  // guard BonusEventsCard itself used to have.
  const showBonusTile = players.length > 0;
  const bonusIndex = events.length;
  const itemCount = events.length + (showBonusTile ? 1 : 0);

  const { index, getItemProps } = useMenuNav({
    count: itemCount,
    columns: 1,
    selectOnHover: false,
  });
  const focused = index < events.length ? (events[index] ?? null) : null;
  const bonusSelected = showBonusTile && index === bonusIndex;

  return (
    <GameScreen
      title="Events"
      subtitle="Start scoring, enter results, or cancel an event"
    >
      {error ? (
          <p className="text-destructive text-center text-sm">{error}</p>
        ) : !ready && loading ? (
          <p className="text-muted-foreground text-center text-sm">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-muted-foreground flex items-center justify-center gap-1.5 text-sm">
            <CalendarDays className="size-4" />
            No events configured yet.
          </p>
        ) : (
          <>
            {/* Event strip. */}
            <ul className="mx-auto grid w-full max-w-4xl grid-cols-4 gap-2 sm:grid-cols-8 sm:gap-3">
              {events.map((event, i) => {
                const isActive = i === index;
                return (
                  <li key={event.id} className="min-w-0">
                    <button
                      type="button"
                      {...getItemProps(i)}
                      aria-pressed={isActive}
                      className={cn(
                        "bevel-raised bg-card group w-full min-w-0 rounded-md p-1 transition-transform duration-75 focus:outline-none",
                        isActive && "is-cursor -translate-y-1",
                      )}
                    >
                      <span className="block aspect-square w-full overflow-hidden rounded-sm bg-black/20">
                        {event.photo_url ? (
                          <Image
                            src={event.photo_url}
                            alt=""
                            width={96}
                            height={96}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center">
                            <CalendarDays className="text-muted-foreground size-6" />
                          </span>
                        )}
                      </span>
                      {/* Two lines, not `truncate`: a third of the real
                          event names ("Super Smash Bros. (N64)", "Settlers
                          of Catan", "Nine Holes of Golf") were clipped to
                          "SUPER SMA…" on a phone, and the game's name is
                          the entire content of a game-select tile. Fixed
                          two-line box so the grid rows stay aligned whether
                          a name wraps or not. */}
                      <span
                        className={cn(
                          "font-display mt-1 line-clamp-2 block h-[2.2em] text-[10px] leading-[1.1] tracking-wider uppercase",
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
                      "bevel-raised bg-card group w-full min-w-0 rounded-md p-1 transition-transform duration-75 focus:outline-none",
                      bonusSelected && "is-cursor -translate-y-1",
                    )}
                  >
                    <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-sm bg-black/20">
                      <PartyPopper className="text-primary size-6" />
                    </span>
                    <span
                      className={cn(
                        "font-display mt-1 block truncate text-[10px] tracking-wider uppercase",
                        bonusSelected ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      Bonus
                    </span>
                  </button>
                </li>
              ) : null}
            </ul>

            {/* Catch-up bonus — its own section, always present, between
                the strip and the focused event's detail, rather than living
                inside whichever event card happens to be focused (it used
                to, and would disappear/reappear depending on cursor
                position). Targets the event actually being scored once
                one's underway (upcomingCatchUp, src/lib/scoring/fromRows.ts);
                before that, it falls back to the lowest-sort_order planned
                event as a best-guess preview — `preview.confirmed`
                distinguishes the two so the wording doesn't overclaim. Not
                whichever tile the cursor is on, and not gated behind
                "has bonuses" — three states below, so the section not
                rendering never reads as a missing feature. */}
            <Panel title="Catch-up bonus" icon={Flame}>
              {previewEvent && preview && preview.bonuses.size > 0 ? (
                <>
                  <p className="text-muted-foreground -mt-1 text-xs">
                    Applies to <span className="text-foreground font-medium">{previewEvent.name}</span>
                    {preview.confirmed
                      ? ", the event currently being scored."
                      : ", up next going by the current running order — may change if the groom plays out of order."}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {[...preview.bonuses.entries()].map(([playerId, bonus]) => {
                      const p = players.find((pl) => pl.id === playerId);
                      if (!p) return null;
                      return (
                        <span key={playerId} className="flex items-center justify-between gap-2 text-sm">
                          <PlayerName name={p.name} size="sm" />
                          <CatchUpBadge bonus={bonus} />
                        </span>
                      );
                    })}
                  </div>
                </>
              ) : previewEvent ? (
                <p className="text-muted-foreground -mt-1 text-xs">
                  {preview?.confirmed ? "Scoring" : "Up next:"}{" "}
                  <span className="text-foreground font-medium">{previewEvent.name}</span> — no catch-up
                  bonus applies this time (it only kicks in once someone&apos;s actually behind).
                </p>
              ) : (
                <p className="text-muted-foreground -mt-1 text-xs">
                  No events left to score. Whoever&apos;s trailing gets +30%/+20%/+10% on whichever event
                  starts next, however it&apos;s reached.
                </p>
              )}
            </Panel>

            {/* Focused tile's full detail — the real event's card, or the
                bonus-events card, never both at once. */}
            {bonusSelected ? (
              <BonusEventsCard players={players} bonusEvents={bonusEvents} groomUnlocked={groomUnlocked} />
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
                groomUnlocked={groomUnlocked}
                catchUpBonuses={catchUpByEvent.get(focused.id) ?? null}
                currentPlayerId={selectedPlayerId}
                reserve={reserve}
              />
          ) : null}
        </>
      )}
    </GameScreen>
  );
}
