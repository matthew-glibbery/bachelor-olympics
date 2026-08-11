"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Lock, Sliders as SlidersIcon } from "lucide-react";

import { AppNav } from "@/components/app-nav";
import { PlayerName } from "@/components/player-name";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { upsertMultipliers } from "@/lib/data/mutations";
import {
  MULTIPLIER_DEFAULT,
  MULTIPLIER_MAX,
  MULTIPLIER_MIN,
  MULTIPLIER_STEP,
  validateAllocations,
  type MultiplierAllocation,
} from "@/lib/multipliers/budget";
import Link from "next/link";

export default function MultipliersPage() {
  const { players, events, multipliers, connect, ready } = useGameStore();
  const { selectedPlayerId, hydrate } = useSessionStore();

  useEffect(() => {
    hydrate();
    connect();
  }, [hydrate, connect]);

  const player = players.find((p) => p.id === selectedPlayerId);

  const committed = useMemo(
    () =>
      Object.fromEntries(
        events.map((e) => {
          const row = multipliers.find(
            (m) => m.player_id === selectedPlayerId && m.event_id === e.id,
          );
          return [e.id, row?.value ?? MULTIPLIER_DEFAULT];
        }),
      ),
    [events, multipliers, selectedPlayerId],
  );

  const [draft, setDraft] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(committed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlayerId, events.length]);

  const allocations: MultiplierAllocation[] = events.map((e) => ({
    eventId: e.id,
    value: (e.status === "planned" ? draft[e.id] : committed[e.id]) ?? MULTIPLIER_DEFAULT,
    locked: e.status !== "planned",
  }));
  const validation = validateAllocations(allocations, events.length);

  async function handleSave() {
    if (!player || !validation.valid) return;
    setSaving(true);
    setError(null);
    try {
      const entries = events
        .filter((e) => e.status === "planned")
        .map((e) => ({
          player_id: player.id,
          event_id: e.id,
          value: draft[e.id] ?? MULTIPLIER_DEFAULT,
        }));
      await upsertMultipliers(getSupabaseBrowserClient(), entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 pt-12 pb-28 sm:pb-12">
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">Multipliers</h1>
          <p className="text-muted-foreground text-sm">
            Raising one event has to lower others by the same total — budget
            must balance to exactly zero to save.
          </p>
        </div>
        <AppNav />
      </header>

      {!ready ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : !player ? (
        <p className="text-muted-foreground text-sm">
          Pick who you are on the{" "}
          <Link href="/setup" className="underline">
            Setup
          </Link>{" "}
          screen first.
        </p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <SlidersIcon className="text-primary size-5" />
                  <PlayerName
                    name={player.name}
                    state={player.state ?? "??"}
                    photoUrl={player.photo_url}
                  />
                </span>
                <Badge
                  variant={validation.budgetRemaining === 0 ? "default" : "destructive"}
                  className="gap-1"
                >
                  {validation.budgetRemaining === 0 ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : null}
                  Budget remaining: {validation.budgetRemaining.toFixed(1)}
                </Badge>
              </CardTitle>
              <CardDescription>
                Every event starts at 1.0×, range 0.5–1.5 in steps of 0.1.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {events.map((e) => {
                const locked = e.status !== "planned";
                const value =
                  (locked ? committed[e.id] : draft[e.id]) ?? MULTIPLIER_DEFAULT;
                return (
                  <div key={e.id} className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5 font-medium">
                        {locked ? <Lock className="text-muted-foreground size-3.5" /> : null}
                        {e.name}
                      </span>
                      <span className="tabular-nums">{value.toFixed(1)}×</span>
                    </div>
                    <Slider
                      value={[value]}
                      min={MULTIPLIER_MIN}
                      max={MULTIPLIER_MAX}
                      step={MULTIPLIER_STEP}
                      disabled={locked}
                      onValueChange={([v]) => {
                        if (v == null) return;
                        setDraft((d) => ({ ...d, [e.id]: Math.round(v * 10) / 10 }));
                      }}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}
          {!validation.valid && validation.budgetRemaining !== 0 ? (
            <p className="text-muted-foreground text-sm">
              {validation.budgetRemaining > 0
                ? `You have ${validation.budgetRemaining.toFixed(1)} left to allocate.`
                : `You're over budget by ${Math.abs(validation.budgetRemaining).toFixed(1)} — lower another event first.`}
            </p>
          ) : null}
          <Button onClick={handleSave} disabled={!validation.valid || saving} className="w-fit">
            Save multipliers
          </Button>
        </>
      )}
    </main>
  );
}
