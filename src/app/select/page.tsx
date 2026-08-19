"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ButtonLegend } from "@/components/n64/button-legend";
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

  const { index, getItemProps } = useMenuNav({
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
        <div className="flex items-center justify-between">
          <Link
            href="/start"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium tracking-wide uppercase transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </Link>
          <h1 className="extruded text-lg sm:text-2xl">Select Your Competitor</h1>
          <span className="w-10" aria-hidden />
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
                </>
              ) : null}
            </div>

            <ButtonLegend
              className="pb-2"
              entries={[
                { button: "↔", action: "Choose" },
                { button: "A", action: "Confirm", tone: "a" },
                { button: "B", action: "Back", tone: "b" },
              ]}
            />
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
  useEffect(() => {
    function onKey() {
      onDone();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  return (
    <button
      type="button"
      onClick={onDone}
      aria-label="Skip"
      className="bg-background fixed inset-0 z-50 flex h-dvh w-dvw cursor-pointer items-center justify-center overflow-hidden"
    >
      <video
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
