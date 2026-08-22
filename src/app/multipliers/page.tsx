"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { RotateCcw, Sliders } from "lucide-react";

import { CharacterRender } from "@/components/n64/character-render";
import { GameScreen } from "@/components/n64/game-screen";
import { MultiplierBar } from "@/components/n64/multiplier-bar";
import { Nameplate } from "@/components/n64/nameplate";
import { Panel } from "@/components/n64/panel";
import { useGameInput } from "@/hooks/use-game-input";
import { assignPlayerColors } from "@/lib/chartColors";
import { bettingReserve } from "@/lib/betting/reserve";
import { upsertMultipliers } from "@/lib/data/mutations";
import {
  MULTIPLIER_DEFAULT,
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
  /** Briefly true right after a successful write, so the button can confirm
   *  it. Without this a save was completely silent — the button flicked back
   *  to its idle label and nothing on screen changed (the values were
   *  already showing the draft), which is indistinguishable from a save that
   *  did nothing at all. */
  const [justSaved, setJustSaved] = useState(false);
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
      // Only the sliders that actually moved — writing every planned event
      // every save (even ones still sitting at their already-committed
      // value) meant a single click could upsert 6-8 unchanged rows. Each
      // row Postgres touches fires its own realtime event, so that turned
      // one save into a burst of redundant refetches app-wide — most of
      // what made saving feel slow (see gameStore.ts's scheduleRefetch).
      const entries = events
        .filter((e) => e.status === "planned")
        .map((e) => ({ event_id: e.id, value: draft[e.id] ?? MULTIPLIER_DEFAULT }))
        .filter((e) => e.value !== (committed[e.event_id] ?? MULTIPLIER_DEFAULT))
        .map((e) => ({ player_id: player.id, ...e }));
      if (entries.length > 0) {
        await upsertMultipliers(getSupabaseBrowserClient(), entries);
      }
      setJustSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  // Clear the confirmation on the next edit, or after a couple of seconds if
  // they just leave it sitting there.
  useEffect(() => {
    if (!justSaved) return;
    const t = window.setTimeout(() => setJustSaved(false), 2200);
    return () => window.clearTimeout(t);
  }, [justSaved]);

  // Autosave: every change to `draft` (a slider move, or Reset to even)
  // reschedules a debounced write, so there's nothing left to click. The
  // debounce is what stops a burst of segment clicks from firing a save per
  // click; `handleSave` itself already only writes the sliders that ended
  // up differing from `committed`, so a hydrate-triggered `draft` change (on
  // mount, or switching player) that leaves everything equal to `committed`
  // is a harmless no-op here, not a real write. Runs from an effect (not a
  // handler-local timer) specifically so the closure it fires always has
  // this render's fresh `draft`/`validation`, not a stale one from whichever
  // render happened to call `setDraft`.
  useEffect(() => {
    if (!player || !validation.valid) return;
    const t = window.setTimeout(() => void handleSave(), 500);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, player, validation.valid]);

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

  useGameInput({
    enabled: Boolean(player),
    onDirection: (dir) => {
      if (dir === "up") moveCursor(-1);
      else if (dir === "down") moveCursor(1);
      // Left/right belong to the focused bar, which handles them itself.
    },
  });

  // Both pre-content states keep the full screen shell rather than a bare
  // centered line — losing the title and nav on the way in made the app feel
  // like it had dropped you somewhere else entirely.
  if (!ready) {
    return (
      <GameScreen title="Set Your Multipliers" width="wide">
        <p className="text-muted-foreground text-center text-sm">Loading…</p>
      </GameScreen>
    );
  }

  if (!player) {
    return (
      <GameScreen title="Set Your Multipliers" width="wide">
        <p className="text-muted-foreground text-center text-sm">
          Pick who you are on the{" "}
          <Link href="/setup" className="text-foreground underline">
            Setup
          </Link>{" "}
          screen first.
        </p>
      </GameScreen>
    );
  }

  const playerColor = colorByPlayer[player.id]!;

  return (
    <GameScreen
      title="Set Your Multipliers"
      subtitle="Raising one event has to come from another — spend up to your full budget, not over it"
      width="wide"
    >
      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
          {/* Character, carried over from /select and still idling. */}
          <aside className="flex flex-col items-center gap-3">
            <div className="relative aspect-[9/16] w-full max-w-36 sm:max-w-52">
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

            {/* Budget counter + betting reserve, side by side rather than
                stacked — two short readouts, no reason to spend a whole
                screen-height's worth of vertical space on them,
                particularly on a phone. */}
            <div className="flex w-full gap-3">
              <div
                className={cn(
                  // `bevel-sunken` is shadow-only and `bg-sunken` is its
                  // matching fill — always use the pair (see globals.css).
                  "bevel-sunken bg-sunken flex-1 rounded-md px-3 py-3 text-center",
                  validation.budgetRemaining < 0 && "is-cursor",
                )}
              >
                <p className="hud-label text-muted-foreground">Budget remaining</p>
                <p
                  className={cn(
                    "font-score text-2xl tabular-nums",
                    validation.budgetRemaining >= 0 ? "text-primary" : "text-destructive",
                  )}
                >
                  {validation.budgetRemaining > 0 ? "+" : ""}
                  {validation.budgetRemaining.toFixed(1)}
                </p>
                <p className="hud-label text-muted-foreground mt-1 opacity-80">
                  {validation.budgetRemaining > 0
                    ? "Unspent — becomes reserve"
                    : validation.budgetRemaining === 0
                      ? "Fully allocated"
                      : "Over budget"}
                </p>
              </div>

              {/* Betting reserve — same sunken-readout shape as the budget
                  counter, and in the same column, instead of a
                  differently-styled full-width panel further down the page.
                  Only "tied up" is shown: "available to wager" is always
                  exactly the budget-remaining figure once everything's
                  saved (same underlying number, see reserve.ts), so showing
                  both was just the same fact printed twice. */}
              {reserve ? (
                <div className="bevel-sunken bg-sunken flex-1 rounded-md px-3 py-3 text-center">
                  <p className="hud-label text-muted-foreground">Tied up in open wagers</p>
                  <p className="font-score text-2xl tabular-nums">{reserve.tiedUp.toFixed(1)}</p>
                </div>
              ) : null}
            </div>

            {reserve ? (
              <p className="hud-label text-muted-foreground text-center">
                See{" "}
                <Link href="/bets" className="text-foreground underline">
                  Bets
                </Link>{" "}
                to place a per-event wager
              </p>
            ) : null}
          </aside>

          {/* Event rows. In its own raised-card Panel — this used to be a
              bare sunken list straight on the page background, a different
              bevel treatment than every other section of the app. */}
          <section className="flex flex-col gap-3">
            <Panel
              title="Event multipliers"
              icon={Sliders}
              action={
                <span className="hud-label text-muted-foreground">
                  {saving
                    ? "Saving…"
                    : justSaved
                      ? "Saved ✓"
                      : !validation.valid
                        ? "Not saved — over budget"
                        : "Autosaves as you adjust"}
                </span>
              }
            >
              <div className="bevel-sunken bg-sunken rounded-md py-2">
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
                          locked ? "bg-black/25" : i === cursor && "bg-card/60",
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
                            setJustSaved(false);
                          }}
                        />
                      </li>
                    );
                  })}
                </ul>
              </div>

              {error ? <p className="text-destructive text-sm">{error}</p> : null}

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
                  setJustSaved(false);
                }}
                className="hud-label bevel-raised bg-card flex w-fit items-center gap-2 rounded-md px-4 py-2 focus-visible:is-cursor focus-visible:outline-none"
              >
                <RotateCcw className="size-3.5" />
                Reset to even
              </button>
            </Panel>
          </section>
        </div>
    </GameScreen>
  );
}
