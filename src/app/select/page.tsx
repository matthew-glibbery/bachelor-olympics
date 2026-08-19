"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { CharacterRender } from "@/components/n64/character-render";
import { Nameplate } from "@/components/n64/nameplate";
import { Starfield } from "@/components/n64/starfield";
import { useMenuNav } from "@/hooks/use-menu-nav";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";
import { assignPlayerColors } from "@/lib/chartColors";
import { cn } from "@/lib/utils";

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
  const { players, connect, ready } = useGameStore();
  const { selectedPlayerId, selectPlayer } = useSessionStore();

  useEffect(() => {
    connect();
  }, [connect]);

  // Set once "Let's go" is hit, if the chosen player has a confirm clip —
  // plays full-bleed before actually routing into the app.
  const [confirmingPlayerId, setConfirmingPlayerId] = useState<string | null>(null);

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

  const onConfirm = useCallback(
    (i: number) => {
      const player = players[i];
      if (!player) return;
      selectPlayer(player.id);
      if (player.character_confirm_video_url) {
        setConfirmingPlayerId(player.id);
      } else {
        router.push("/");
      }
    },
    [players, selectPlayer, router],
  );

  const onBack = useCallback(() => router.push("/start"), [router]);

  const confirmingPlayer = players.find((p) => p.id === confirmingPlayerId) ?? null;

  const { index, setIndex, getItemProps } = useMenuNav({
    count: players.length,
    columns: 1,
    initialIndex,
    onConfirm,
    onBack,
    enabled: players.length > 0 && !confirmingPlayer,
  });

  const focused = players[index] ?? null;

  if (confirmingPlayer) {
    return (
      <ConfirmClip videoUrl={confirmingPlayer.character_confirm_video_url!} onDone={() => router.push("/")} />
    );
  }

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden">
      <Starfield className="opacity-60" />

      <div className="relative flex min-h-dvh flex-col gap-4 px-4 py-6 sm:px-8">
        <div className="flex items-center justify-center">
          <h1 className="extruded text-lg sm:text-2xl">Choose your character</h1>
        </div>

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
            {/* Roster strip. */}
            <ul className="mx-auto grid w-full max-w-4xl grid-cols-4 gap-2 sm:grid-cols-8 sm:gap-3">
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
                      <span
                        className="block aspect-square w-full overflow-hidden rounded-sm"
                        style={{
                          background: `linear-gradient(180deg, color-mix(in oklab, ${color} 35%, transparent), transparent)`,
                        }}
                      >
                        <CharacterRender
                          name={p.name}
                          nickname={p.nickname}
                          photoUrl={p.photo_url}
                          videoUrl={p.character_select_video_url}
                          playing={isActive}
                          color={color}
                          pose="bust"
                        />
                      </span>
                      <span
                        className={cn(
                          "font-display mt-1 block truncate text-[10px] tracking-wider uppercase",
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

            {/* Centre stage. */}
            <div className="flex flex-1 flex-col items-center justify-center gap-4">
              {focused ? (
                <>
                  <div className="relative h-56 w-full max-w-sm sm:h-80">
                    {/* Spotlight pooling under the character. */}
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `radial-gradient(ellipse at 50% 92%, color-mix(in oklab, ${colorByPlayer[focused.id]} 45%, transparent) 0%, transparent 65%)`,
                      }}
                      aria-hidden
                    />
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
                    className="anim-pop-in"
                  />

                  {/* The one deliberate confirm action (also what A/Enter
                      triggers via useMenuNav's onConfirm) — plays the
                      player's confirm clip if they have one, then routes
                      in. */}
                  <button
                    type="button"
                    onClick={() => onConfirm(index)}
                    className="bevel-raised is-cursor bg-primary text-primary-foreground font-display mt-1 rounded-md px-8 py-3 text-sm tracking-widest uppercase focus-visible:outline-none"
                  >
                    Let&apos;s go ▶
                  </button>
                </>
              ) : null}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

/**
 * Full-bleed "you're playing as ___" clip (character_confirm_video_url),
 * plays once right after hitting confirm — routes into the app when it
 * ends, or immediately on tap/keypress (skippable, doesn't trap anyone).
 */
function ConfirmClip({ videoUrl, onDone }: { videoUrl: string; onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    function onKey() {
      onDone();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // Same mobile-autoplay fix as start/page.tsx's boot video and
    // character-render.tsx's clips: `autoPlay` alone isn't reliable on
    // mobile Safari/Chrome, so set `muted` as a real DOM property and call
    // `.play()` imperatively.
    v.muted = true;
    v.play().catch(() => {});
  }, [videoUrl]);

  return (
    <button
      type="button"
      onClick={onDone}
      aria-label="Skip"
      className="bg-background fixed inset-0 z-50 flex h-dvh w-dvw cursor-pointer items-center justify-center overflow-hidden"
    >
      <video
        ref={videoRef}
        src={videoUrl}
        autoPlay
        muted
        playsInline
        onEnded={onDone}
        className="h-full w-full object-cover"
      />
    </button>
  );
}
