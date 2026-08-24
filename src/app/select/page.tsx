"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { CharacterRender } from "@/components/n64/character-render";
import { Nameplate } from "@/components/n64/nameplate";
import { Starfield } from "@/components/n64/starfield";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Play } from "lucide-react";
import { useMenuNav } from "@/hooks/use-menu-nav";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";
import { assignPlayerColors } from "@/lib/chartColors";
import { cn } from "@/lib/utils";
import type { PlayerRow } from "@/lib/data/database.types";

/** Matthew is the groom — the one player identity that doubles as "this
 * device also gets groom tools." Same hardcoded-by-name convention the
 * character-gen pipeline already uses for the same reason (see
 * scripts/character-gen/README.md's composite-scene gating). */
function isGroom(player: PlayerRow): boolean {
  return player.name === "Matthew";
}

/**
 * Character-select screen (docs/VISUAL_SPEC.md) — the Mario Kart 64
 * arrangement: the whole roster visible at once as busts along the top, one
 * big render centre stage, name plate under it. Driven by a menu cursor
 * (D-pad/gamepad/keyboard via useMenuNav, src/hooks/) rather than a pointer
 * landing on arbitrary pixels — mouse/touch still work everywhere, they
 * just move the same cursor.
 *
 * Confirming is the real `selectPlayer` mechanism (src/store/sessionStore.ts)
 * underneath the game-boot skin, not a fake mock — this IS how you tell the
 * app which competitor this device is, just re-skinned.
 */
export default function SelectPage() {
  const router = useRouter();
  const { players: rosterFromStore, connect, ready } = useGameStore();
  const { selectedPlayerId, selectPlayer, groomUnlocked, unlockGroom } = useSessionStore();

  useEffect(() => {
    connect();
  }, [connect]);

  // Alphabetical roster order for display and menu navigation — independent
  // of `stable` below (id-sorted, for color/number assignment), which
  // deliberately doesn't follow display order.
  const players = useMemo(
    () => [...rosterFromStore].sort((a, b) => a.name.localeCompare(b.name)),
    [rosterFromStore],
  );

  // Picking Matthew (the groom) asks for the groom PIN first — this is
  // what a device needs to also get groom tools (AppNav's "Tools" tab),
  // not just a separate unlock step buried on /setup. Skipped if this
  // device already unlocked groom tools before.
  const [pinPromptPlayer, setPinPromptPlayer] = useState<PlayerRow | null>(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [checkingPin, setCheckingPin] = useState(false);

  // Stable per-player color and jersey number, independent of roster
  // display order (chartColors.ts: color follows the entity, never its
  // on-screen rank).
  const stable = useMemo(() => [...players].sort((a, b) => a.id.localeCompare(b.id)), [players]);
  const colorByPlayer = useMemo(
    () => assignPlayerColors(stable.map((p) => ({ id: p.id, state: p.state ?? "" })), "dark"),
    [stable],
  );
  const numberByPlayer = useMemo(() => {
    const map: Record<string, number> = {};
    stable.forEach((p, i) => (map[p.id] = i + 1));
    return map;
  }, [stable]);

  const initialIndex = useMemo(() => {
    const i = players.findIndex((p) => p.id === selectedPlayerId);
    return i >= 0 ? i : 0;
  }, [players, selectedPlayerId]);

  const finalizeSelect = useCallback(
    (player: PlayerRow) => {
      selectPlayer(player.id);
      router.push("/");
    },
    [selectPlayer, router],
  );

  const onConfirm = useCallback(
    (i: number) => {
      const player = players[i];
      if (!player) return;
      if (isGroom(player) && !groomUnlocked) {
        setPin("");
        setPinError(false);
        setPinPromptPlayer(player);
        return;
      }
      finalizeSelect(player);
    },
    [players, groomUnlocked, finalizeSelect],
  );

  async function handlePinSubmit() {
    if (!pinPromptPlayer) return;
    setCheckingPin(true);
    const ok = await unlockGroom(pin);
    setCheckingPin(false);
    if (!ok) {
      setPinError(true);
      return;
    }
    const player = pinPromptPlayer;
    setPinPromptPlayer(null);
    finalizeSelect(player);
  }

  const onBack = useCallback(() => router.push("/start"), [router]);

  const { index, setIndex, getItemProps } = useMenuNav({
    count: players.length,
    columns: 1,
    initialIndex,
    onConfirm,
    onBack,
    enabled: players.length > 0 && !pinPromptPlayer,
  });

  const focused = players[index] ?? null;

  return (
    // Fixed and pinned to the top: this screen is tuned to fit exactly one
    // screen (roster at top, "Let's go" at the bottom, no scroll). Height
    // comes from `--app-height` rather than the viewport, so an installed
    // iOS PWA that under-reports its viewport still fills the real screen —
    // see layout.tsx's status-bar note and src/components/viewport-floor.tsx.
    <main className="fixed inset-x-0 top-0 flex h-[var(--app-height)] flex-col overflow-hidden">
      <Starfield className="opacity-60" />

      <div className="relative flex min-h-0 flex-1 flex-col gap-3 px-4 pt-[calc(1rem+var(--safe-top))] pb-[calc(1rem+var(--safe-bottom))] sm:gap-4 sm:px-8">
        {!ready ? (
          <p className="text-muted-foreground mt-20 text-center text-sm">Loading roster…</p>
        ) : players.length === 0 ? (
          <p className="text-muted-foreground mx-auto mt-20 max-w-xs text-center text-sm">
            No competitors yet —{" "}
            <Link href="/setup" className="text-foreground underline">
              add players in Setup
            </Link>{" "}
            to get started.
          </p>
        ) : (
          <>
            {/* Roster strip. `shrink-0`: this is a flex column now sized to
                exactly one screen (no scroll), so every sibling has to
                agree on how the fixed vertical space splits — the grid
                keeps its natural height and the centre stage below it
                absorbs whatever's left. */}
            <ul className="mx-auto grid w-full max-w-4xl shrink-0 grid-cols-4 gap-2 sm:grid-cols-8 sm:gap-3">
              {players.map((p, i) => {
                const isActive = i === index;
                const color = colorByPlayer[p.id]!;
                return (
                  // min-w-0: grid items default to min-width:auto, and the
                  // truncated name below is whitespace-nowrap, so without
                  // this the longest name sets the column's floor and the
                  // strip overflows the viewport on a phone.
                  <li key={p.id} className="min-w-0">
                    <button
                      type="button"
                      {...getItemProps(i)}
                      // Override the default click-to-confirm: on a
                      // console menu, moving the cursor here (D-pad, or
                      // hovering with a mouse) already previews the
                      // character centre-stage, but a touch tap has no
                      // separate "hover" step — without this override,
                      // the very first tap on a roster tile locked in that
                      // pick immediately, with no chance to browse first
                      // and no visible way to undo it. Tapping now only
                      // previews, same as hover/D-pad; "Let's go" below
                      // the focused character is the one deliberate
                      // confirm action, for every input method.
                      onClick={() => setIndex(i)}
                      aria-pressed={isActive}
                      className={cn(
                        "group w-full min-w-0 rounded-md p-1 transition-transform duration-75 focus:outline-none",
                        "bevel-raised bg-card",
                        isActive && "is-cursor -translate-y-1",
                      )}
                    >
                      <span className="block aspect-square w-full overflow-hidden rounded-sm">
                        <CharacterRender
                          name={p.name}
                          nickname={p.nickname}
                          photoUrl={p.photo_url}
                          color={color}
                          pose="bust"
                        />
                      </span>
                      <span
                        className={cn(
                          "hud-label mt-1 block truncate",
                          isActive ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {p.name}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {/* Centre stage. `min-h-0` is load-bearing: a flex child's
                default `min-height: auto` lets it overflow its allotted
                space rather than shrink into it, which is exactly what
                broke "fits on one screen" here — the character render
                below was a fixed h-96 (384px) regardless of how much room
                was actually left once the roster strip and safe-area
                padding took their share, so a short iPhone scrolled. */}
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 sm:gap-4">
              {focused ? (
                <>
                  {/* `flex-1 min-h-0` (not a fixed height): this box is a
                      flex item alongside the nameplate and button below it,
                      so it only claims whatever vertical space THOSE don't
                      need — `aspect-[9/16]` then derives its width from
                      that resolved height, so the whole thing shrinks
                      correctly on a short viewport instead of forcing a
                      scroll.

                      The `max-h-[28rem]` this used to carry unconditionally
                      was a real, measured bug, not just an aesthetic choice
                      revisited: on a tall phone (an installed iOS PWA
                      standalone shows MORE usable height than the same
                      device in a Safari tab, since there's no address bar to
                      reserve any of it) the render hit that ceiling and
                      stopped growing while the flex column still had height
                      left over — `justify-center` then split that leftover
                      as equal padding above and below the whole group, which
                      is exactly the "dead space" reported on a real
                      installed PWA and never visible in a browser tab or in
                      this sandbox's own headless-Chrome testing, since
                      neither exposes that extra height. Measured directly at
                      five heights via CDP before fixing this: zero slack up
                      to 852px, ~70px at 932px, ~140px at 1000px, tracking
                      the cap exactly.

                      `max-w-full` is what makes dropping the cap safe rather
                      than replacing one overflow with another: on a real
                      phone (narrow, tall) the container's actual width binds
                      long before an ever-growing height could make this
                      "comically large" the old comment worried about — a
                      portrait phone is never wide enough for that to happen.
                      Desktop is the one case width doesn't self-limit (a
                      browser window can be arbitrarily wide AND tall), so
                      the height cap comes back at `lg`. */}
                  <div className="relative min-h-0 w-auto max-w-full flex-1 aspect-[9/16] lg:max-h-[28rem]">
                    {/* Keyed on player id so the pop-in replays on every swap. */}
                    <div key={focused.id} className="anim-pop-in relative h-full w-full">
                      <CharacterRender
                        name={focused.name}
                        nickname={focused.nickname}
                        photoUrl={focused.photo_url}
                        videoUrl={focused.character_fullbody_video_url}
                        color={colorByPlayer[focused.id]!}
                        number={numberByPlayer[focused.id]}
                        pose="full"
                        idle
                      />
                    </div>
                  </div>

                  <Nameplate
                    key={focused.id}
                    name={focused.name}
                    nickname={focused.nickname}
                    color={colorByPlayer[focused.id]!}
                    className="anim-pop-in shrink-0"
                  />

                  {/* The one deliberate confirm action (also what A/Enter
                      triggers via useMenuNav's onConfirm) — routes straight
                      into the app. */}
                  <button
                    type="button"
                    onClick={() => onConfirm(index)}
                    className="font-display bevel-raised is-cursor bg-primary text-primary-foreground mt-1 flex shrink-0 items-center gap-2 rounded-md px-8 py-3 text-sm tracking-widest uppercase focus-visible:outline-none"
                  >
                    Let&apos;s go
                    {/* A lucide glyph, not a literal "\u25B6" character. iOS
                        renders that codepoint with its colour emoji font, so
                        the arrow arrived on phones as a blue-and-white emoji
                        triangle that matched nothing else on screen. */}
                    <Play className="size-4 shrink-0" fill="currentColor" strokeWidth={0} />
                  </button>
                </>
              ) : null}
            </div>
          </>
        )}
      </div>

      <Dialog
        open={!!pinPromptPlayer}
        onOpenChange={(open) => {
          if (!open) setPinPromptPlayer(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Groom code required</DialogTitle>
            <DialogDescription>
              Matthew&apos;s the groom — enter the groom PIN to play as him and unlock groom
              tools on this device.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="select-groom-pin">PIN</Label>
            <Input
              id="select-groom-pin"
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setPinError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && pin) handlePinSubmit();
              }}
            />
            {pinError ? <p className="text-destructive text-sm">Wrong PIN</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPinPromptPlayer(null)}>
              Cancel
            </Button>
            <Button onClick={handlePinSubmit} disabled={!pin || checkingPin}>
              Unlock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
