"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Coins, RotateCcw } from "lucide-react";

import { AppNav } from "@/components/app-nav";
import { ButtonLegend } from "@/components/n64/button-legend";
import { CharacterRender } from "@/components/n64/character-render";
import { MultiplierBar } from "@/components/n64/multiplier-bar";
import { Nameplate } from "@/components/n64/nameplate";
import { useGameInput } from "@/hooks/use-game-input";
import { assignPlayerColors } from "@/lib/chartColors";
import { bettingReserve } from "@/lib/betting/reserve";
import { upsertMultipliers } from "@/lib/data/mutations";
import {
  MULTIPLIER_DEFAULT,
  MULTIPLIER_MAX,
  validateAllocations,
  type MultiplierAllocation,
} from "@/lib/multipliers/budget";
import { playSfx } from "@/lib/sfx";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";
import { cn } from "@/lib/utils";

/**
 * Multiplier allocation — the strategic heart of the game (docs/
 * PRODUCT_SPEC.md → Multipliers). All the actual budget/save logic here is
 * unchanged from the pre-N64 version of this screen; only the skin and the
 * D-pad navigation are new (docs/VISUAL_SPEC.md).
 *
 * The D-pad splits across two axes: up/down picks an event row, left/right
 * (handled inside MultiplierBar) adjusts its value — a console settings
 * screen convention that means the whole thing is operable without ever
 * moving a pointer. Mouse/touch still work everywhere.
 */
export default function MultipliersPage() {
  const { players, events, multipliers, perEventBets, connect, ready } = useGameStore();
  const { selectedPlayerId, hydrate } = useSessionStore();

  useEffect(() => {
    hydrate();
    connect();
  }, [hydrate, connect]);

  const player = players.find((p) => p.id === selectedPlayerId);

  const colorByPlayer = useMemo(() => {
    const stable = [...players].sort((a, b) => a.id.localeCompare(b.id));
    return assignPlayerColors(stable.map((p) => ({ id: p.id, state: p.state ?? "" })), "dark");
  }, [players]);

  const committed = useMemo(
    () =>
      Object.fromEntries(
        events.map((e) => {
          const row = multipliers.find((m) => m.player_id === selectedPlayerId && m.event_id === e.id);
          return [e.id, row?.value ?? MULTIPLIER_DEFAULT];
        }),
      ),
    [events, multipliers, selectedPlayerId],
  );

  const [draft, setDraft] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Bumped on every change, to retrigger the character's reaction pop. */
  const [reactionKey, setReactionKey] = useState(0);

  useEffect(() => {
    setDraft(committed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlayerId, events.length]);

  // Budget already escrowed in this player's open per-event bets — not
  // free to reallocate to a multiplier while the bet is open (PRODUCT_SPEC.md
  // → Per-event multiplier betting; see validateAllocations' own doc comment).
  const tiedUpInBets = player
    ? perEventBets
        .filter((b) => b.player_id === player.id && b.status === "open")
        .reduce((sum, b) => sum + b.wager, 0)
    : 0;

  const allocations: MultiplierAllocation[] = events.map((e) => ({
    eventId: e.id,
    value: (e.status === "planned" ? draft[e.id] : committed[e.id]) ?? MULTIPLIER_DEFAULT,
    locked: e.status !== "planned",
  }));
  const validation = validateAllocations(allocations, events.length, tiedUpInBets);

  const reserve = player
    ? bettingReserve(
        events.length,
        events.reduce((sum, e) => sum + ((e.status === "planned" ? draft[e.id] : committed[e.id]) ?? MULTIPLIER_DEFAULT), 0),
        perEventBets.filter((b) => b.player_id === player.id).map((b) => ({ wager: b.wager, status: b.status, payout: b.payout })),
      )
    : null;

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

  // ── D-pad row cursor ──
  const unlockedIndices = useMemo(
    () => events.flatMap((e, i) => (e.status === "planned" ? [i] : [])),
    [events],
  );
  const [cursor, setCursor] = useState(0);
  const rowRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (unlockedIndices.length === 0) return;
    setCursor((c) => (unlockedIndices.includes(c) ? c : (unlockedIndices[0] ?? 0)));
  }, [unlockedIndices]);

  const moveCursor = useCallback(
    (delta: number) => {
      if (unlockedIndices.length === 0) return;
      const at = unlockedIndices.indexOf(cursor);
      const nextPos = at === -1 ? 0 : (at + delta + unlockedIndices.length) % unlockedIndices.length;
      const next = unlockedIndices[nextPos];
      if (next === undefined || next === cursor) return;
      playSfx("move");
      setCursor(next);
      rowRefs.current[next]?.focus({ preventScroll: true });
      rowRefs.current[next]?.scrollIntoView({ block: "nearest" });
    },
    [cursor, unlockedIndices],
  );

  const confirmSave = useCallback(() => {
    if (!validation.valid) {
      playSfx("deny");
      return;
    }
    playSfx("lock");
    void handleSave();
    // handleSave already closes over the latest draft/player/validation via
    // component scope, so it doesn't need to be in this callback's deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validation.valid]);

  useGameInput({
    enabled: Boolean(player),
    onDirection: (dir) => {
      if (dir === "up") moveCursor(-1);
      else if (dir === "down") moveCursor(1);
      // Left/right belong to the focused bar, which handles them itself.
    },
    onConfirm: confirmSave,
  });

  if (!ready) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center px-6">
        <p className="text-muted-foreground text-sm">Loading…</p>
        <AppNav />
      </main>
    );
  }

  if (!player) {
    return (
      <main className="relative flex min-h-dvh items-center justify-center px-6 text-center">
        <p className="text-muted-foreground text-sm">
          Pick who you are on the{" "}
          <Link href="/setup" className="text-foreground underline">
            Setup
          </Link>{" "}
          screen first.
        </p>
        <AppNav />
      </main>
    );
  }

  const playerColor = colorByPlayer[player.id]!;
  // The character's "power" reading: how far the biggest single multiplier
  // goes above baseline. Feeds the aura behind them, so stacking a
  // multiplier visibly charges them up.
  const peak = Math.max(...allocations.map((a) => a.value), MULTIPLIER_DEFAULT);
  const charge = Math.max(0, (peak - MULTIPLIER_DEFAULT) / (MULTIPLIER_MAX - MULTIPLIER_DEFAULT));

  return (
    <main className="relative min-h-dvh px-4 py-6 pb-28 sm:px-8 sm:pb-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="flex flex-col items-center gap-3 text-center">
          <h1 className="text-extruded text-xl sm:text-2xl">Set Your Multipliers</h1>
          <p className="font-display text-muted-foreground text-[10px] tracking-[0.2em] uppercase">
            Raising one event has to come from another — spend up to your full budget, not over it
          </p>
          <AppNav />
        </header>

        <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          {/* Character, carried over from /select and still idling. */}
          <aside className="flex flex-col items-center gap-3">
            <div className="relative h-56 w-full max-w-52">
              <div
                className="absolute inset-0 transition-opacity duration-300"
                style={{
                  opacity: 0.35 + charge * 0.65,
                  background: `radial-gradient(ellipse at 50% 80%, color-mix(in oklab, ${playerColor} 60%, transparent) 0%, transparent 68%)`,
                }}
                aria-hidden
              />
              {/* Re-keyed on each adjustment so the character reacts to the
                  bars rather than just sitting there. */}
              <div key={reactionKey} className="anim-pop-in relative h-full w-full">
                <CharacterRender
                  name={player.name}
                  nickname={player.nickname}
                  photoUrl={player.photo_url}
                  videoUrl={player.character_fullbody_video_url}
                  color={playerColor}
                  pose="full"
                  idle
                />
              </div>
            </div>

            <Nameplate name={player.name} nickname={player.nickname} color={playerColor} className="w-full" />

            {/* The budget counter. The whole constraint, in one number. */}
            <div
              className={cn(
                "bevel-sunken bg-card w-full rounded-md px-4 py-3 text-center",
                validation.budgetRemaining < 0 && "is-cursor",
              )}
            >
              <p className="font-display text-muted-foreground text-[10px] tracking-[0.2em] uppercase">
                Budget remaining
              </p>
              <p
                className={cn(
                  "font-score text-3xl tabular-nums",
                  validation.budgetRemaining >= 0 ? "text-primary" : "text-destructive",
                )}
              >
                {validation.budgetRemaining > 0 ? "+" : ""}
                {validation.budgetRemaining.toFixed(1)}
              </p>
              <p className="font-display text-muted-foreground mt-1 text-[9px] tracking-wider uppercase">
                {validation.budgetRemaining > 0
                  ? "Unspent — becomes your betting reserve"
                  : validation.budgetRemaining === 0
                    ? "Fully allocated"
                    : "Over budget"}
              </p>
            </div>
          </aside>

          {/* Event rows. */}
          <section className="flex flex-col gap-3">
            <div className="bevel-sunken rounded-md py-2">
              <ul>
                {events.map((e, i) => {
                  const locked = e.status !== "planned";
                  const value = (locked ? committed[e.id] : draft[e.id]) ?? MULTIPLIER_DEFAULT;
                  return (
                    <li
                      key={e.id}
                      ref={(el) => {
                        // The focusable element is the bar inside, so hold
                        // the row and reach in when moving the cursor.
                        rowRefs.current[i] = el?.querySelector<HTMLElement>('[role="slider"]') ?? null;
                      }}
                      className={cn(
                        "border-b-2 border-bevel-dark/40 last:border-b-0",
                        i === cursor && !locked && "bg-card/60",
                      )}
                    >
                      <MultiplierBar
                        label={e.name}
                        value={value}
                        color={playerColor}
                        locked={locked}
                        onChange={(next) => {
                          setDraft((d) => ({ ...d, [e.id]: next }));
                          setCursor(i);
                          setReactionKey((k) => k + 1);
                        }}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>

            {error ? <p className="text-destructive text-sm">{error}</p> : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  playSfx("back");
                  setDraft((d) => {
                    const next = { ...d };
                    for (const e of events) {
                      if (e.status === "planned") next[e.id] = MULTIPLIER_DEFAULT;
                    }
                    return next;
                  });
                  setReactionKey((k) => k + 1);
                }}
                className="bevel-raised bg-card font-display flex items-center gap-2 rounded-md px-4 py-2 text-xs tracking-wider uppercase focus-visible:is-cursor focus-visible:outline-none"
              >
                <RotateCcw className="size-3.5" />
                Reset to even
              </button>

              <button
                type="button"
                onClick={confirmSave}
                disabled={saving}
                aria-disabled={!validation.valid}
                className={cn(
                  "font-display rounded-md px-6 py-2.5 text-sm tracking-widest uppercase focus-visible:outline-none",
                  validation.valid
                    ? "bevel-raised is-cursor bg-primary text-primary-foreground"
                    : "bevel-sunken text-muted-foreground cursor-not-allowed",
                )}
              >
                {saving ? "Saving…" : validation.valid ? "Save multipliers ▶" : "Over budget — adjust first"}
              </button>
            </div>
          </section>
        </div>

        {reserve ? (
          <div className="bevel-raised bg-card rounded-md p-4">
            <p className="font-display flex items-center gap-2 text-sm tracking-wide uppercase">
              <Coins className="text-primary size-4" />
              Betting reserve
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              What&apos;s left of your budget after events and open per-event wagers — see{" "}
              <Link href="/bets" className="text-foreground underline">
                Bets
              </Link>
              .
            </p>
            <div className="mt-3 flex gap-6">
              <div className="flex flex-col">
                <span className="text-muted-foreground text-[10px] uppercase">Available to wager</span>
                <span className="font-score text-lg tabular-nums">{reserve.available.toFixed(1)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-muted-foreground text-[10px] uppercase">Tied up in open wagers</span>
                <span className="font-score text-lg tabular-nums">{reserve.tiedUp.toFixed(1)}</span>
              </div>
            </div>
          </div>
        ) : null}

        <ButtonLegend
          className="pb-2"
          entries={[
            { button: "↑↓", action: "Pick event" },
            { button: "←→", action: "Adjust" },
            { button: "A", action: "Save", tone: "a" },
          ]}
        />
      </div>
    </main>
  );
}
