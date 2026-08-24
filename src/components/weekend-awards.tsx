"use client";

import { useMemo, useState } from "react";
import { Award, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PlayerName } from "@/components/player-name";
import { assignPlayerColors } from "@/lib/chartColors";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { createBonusEvent } from "@/lib/data/mutations";
import { computeWeekendAwards, type WeekendAwardCategory } from "@/lib/awards/weekendAwards";
import type {
  BonusEventRow,
  EventResultRow,
  EventRow,
  MultiplierRow,
  OverallBetRow,
  PerEventBetRow,
  PlayerRow,
} from "@/lib/data/database.types";

/**
 * Groom-only: a handful of light, fun, flat-points categories computed live
 * from the weekend so far (bets placed/lost, who's finished last most,
 * who's had the single biggest one-event rank climb) — see
 * src/lib/awards/weekendAwards.ts for the categories, point values, and the
 * reasoning behind both.
 *
 * Deliberately not a separate "mark the weekend finished" flag — awarding a
 * category here is just creating a normal bonus_events row (same
 * createBonusEvent BonusEventsCard's own manual form uses), so the act of
 * awarding these *is* the "the weekend's basically done" moment, and they
 * show up under Bonus events like anything else. Each category is awarded
 * independently (own button) so the groom can hand them out whenever makes
 * sense, not all-or-nothing, and a category already matching an existing
 * bonus event's name is treated as already awarded — re-clicking is a
 * no-op guard against accidental duplicates, not a hard lock (delete the
 * existing bonus event first if it genuinely needs re-awarding).
 */
export function WeekendAwardsSection({
  players,
  events,
  eventResults,
  multipliers,
  perEventBets,
  overallBets,
  bonusEvents,
}: {
  players: PlayerRow[];
  events: EventRow[];
  eventResults: EventResultRow[];
  multipliers: MultiplierRow[];
  perEventBets: PerEventBetRow[];
  overallBets: OverallBetRow[];
  bonusEvents: BonusEventRow[];
}) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const colorByPlayer = useMemo(() => {
    const stable = [...players].sort((a, b) => a.id.localeCompare(b.id));
    return assignPlayerColors(stable.map((p) => ({ id: p.id, state: p.state ?? "", name: p.name })), "dark");
  }, [players]);

  const categories = useMemo(
    () =>
      computeWeekendAwards({
        events,
        eventResults,
        multipliers,
        playerIds: players.map((p) => p.id),
        perEventBets,
        overallBets,
      }),
    [events, eventResults, multipliers, players, perEventBets, overallBets],
  );

  const alreadyAwardedNames = new Set(bonusEvents.map((b) => b.name));

  async function award(category: WeekendAwardCategory) {
    setBusyKey(category.key);
    setError(null);
    try {
      const client = getSupabaseBrowserClient();
      for (const winner of category.winners) {
        await createBonusEvent(client, {
          name: category.name,
          winner_player_id: winner.playerId,
          points: category.points,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyKey(null);
    }
  }

  const awardable = categories.filter((c) => c.winners.length > 0 && !alreadyAwardedNames.has(c.name));

  return (
    <div className="flex flex-col gap-2 border-b pb-4">
      <div className="flex flex-col gap-1">
        <p className="font-display flex items-center gap-2 text-sm tracking-wide uppercase">
          <Award className="text-primary size-4" />
          Weekend awards
        </p>
        <p className="text-muted-foreground text-sm">
          A few fun categories, computed live from results and bets so far. Award whenever it
          feels like the weekend&apos;s winding down — each one becomes a normal bonus event below.
        </p>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <div className="flex flex-col gap-1.5">
        {categories.map((category) => {
          const alreadyAwarded = alreadyAwardedNames.has(category.name);
          const busy = busyKey === category.key;
          return (
            <div
              key={category.key}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
            >
              <span className="flex flex-col gap-1">
                <span className="flex items-center gap-2">
                  <span className="font-medium">{category.name}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">+{category.points}</span>
                </span>
                {category.winners.length === 0 ? (
                  <span className="text-muted-foreground text-xs">Not enough data yet.</span>
                ) : (
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    {category.winners.map((winner) => {
                      const player = players.find((p) => p.id === winner.playerId);
                      if (!player) return null;
                      return (
                        <span key={winner.playerId} className="flex items-center gap-1.5">
                          <PlayerName
                            name={player.name}
                            size="sm"
                            photoUrl={player.photo_url}
                            color={colorByPlayer[player.id]}
                          />
                          <span className="text-muted-foreground text-xs">— {winner.detail}</span>
                        </span>
                      );
                    })}
                  </span>
                )}
              </span>
              {alreadyAwarded ? (
                <Badge variant="secondary">Awarded</Badge>
              ) : category.winners.length > 0 ? (
                <Button size="sm" variant="outline" onClick={() => award(category)} disabled={busy}>
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Award
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>

      {awardable.length > 1 ? (
        <Button
          size="sm"
          onClick={async () => {
            for (const category of awardable) await award(category);
          }}
          disabled={busyKey !== null}
          className="w-fit"
        >
          Award all ({awardable.length})
        </Button>
      ) : null}
    </div>
  );
}
