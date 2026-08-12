"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CharacterBust } from "@/components/character-bust";
import { Flag } from "@/components/flag";
import { Button } from "@/components/ui/button";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";
import { assignPlayerColors } from "@/lib/chartColors";
import { cn } from "@/lib/utils";

/**
 * Character-select screen (docs/visual_spec.md) — Mario Kart 64-style: a
 * roster strip of every player up top, a big centered idling render of
 * whoever's focused, their name plate below, and a confirm step that's the
 * real `selectPlayer` mechanism (src/store/sessionStore.ts) underneath the
 * game-boot skin, not a fake mock — this IS how you tell the app which
 * competitor this device is, just re-skinned. Same dark-stage token trick as
 * /start (bg-foreground, so it follows whatever app theme is active).
 */
export default function SelectPage() {
  const router = useRouter();
  const { players, connect, ready } = useGameStore();
  const { selectedPlayerId, selectPlayer } = useSessionStore();

  useEffect(() => {
    connect();
  }, [connect]);

  const [focusedId, setFocusedId] = useState<string | null>(null);

  useEffect(() => {
    if (focusedId && players.some((p) => p.id === focusedId)) return;
    setFocusedId(selectedPlayerId ?? players[0]?.id ?? null);
    // Only re-run when the roster itself changes, not on every focus change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players, selectedPlayerId]);

  const colorByPlayer = useMemo(() => {
    const stable = [...players].sort((a, b) => a.id.localeCompare(b.id));
    return assignPlayerColors(
      stable.map((p) => ({ id: p.id, state: p.state ?? "" })),
      "dark",
    );
  }, [players]);

  const focused = players.find((p) => p.id === focusedId) ?? null;
  const focusedIndex = focused ? players.findIndex((p) => p.id === focused.id) : -1;

  function step(delta: number) {
    if (players.length === 0) return;
    const next = (((focusedIndex + delta) % players.length) + players.length) % players.length;
    setFocusedId(players[next]!.id);
  }

  function confirm() {
    if (!focused) return;
    selectPlayer(focused.id);
    router.push("/");
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
      else if (e.key === "Enter" || e.key === " ") confirm();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedIndex, players, focused]);

  return (
    <main className="bg-foreground flex min-h-screen w-full flex-col items-center gap-8 overflow-hidden px-4 pt-8 pb-10">
      <div className="flex w-full max-w-2xl items-center justify-between">
        <Link
          href="/start"
          className="text-background/50 hover:text-background/80 inline-flex items-center gap-1 text-xs font-medium tracking-wide uppercase transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Link>
        <p className="text-background/50 text-xs font-semibold tracking-[0.3em] uppercase">
          Choose your competitor
        </p>
        <span className="w-10" aria-hidden />
      </div>

      {!ready ? (
        <p className="text-background/60 mt-20 text-sm">Loading roster…</p>
      ) : players.length === 0 ? (
        <p className="text-background/60 mt-20 max-w-xs text-center text-sm">
          No competitors yet —{" "}
          <Link href="/setup" className="text-background underline">
            add players in Setup
          </Link>{" "}
          to get started.
        </p>
      ) : (
        <>
          {/* Roster strip */}
          <div className="flex w-full max-w-3xl flex-wrap items-start justify-center gap-3 sm:gap-4">
            {players.map((p) => {
              const active = p.id === focusedId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setFocusedId(p.id)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <CharacterBust
                    name={p.name}
                    photoUrl={p.photo_url}
                    color={colorByPlayer[p.id]!}
                    size="sm"
                    idle={false}
                    className={cn(
                      "border-2 transition-transform",
                      active ? "scale-110" : "opacity-60 hover:opacity-90",
                    )}
                  />
                  <span
                    className={cn(
                      "max-w-16 truncate text-[10px] font-semibold tracking-wide uppercase",
                      active ? "text-background" : "text-background/50",
                    )}
                  >
                    {p.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Centered focused character */}
          <div className="flex flex-1 flex-col items-center justify-center gap-6 py-4">
            {focused ? (
              <>
                <CharacterBust
                  key={focused.id}
                  name={focused.name}
                  photoUrl={focused.photo_url}
                  color={colorByPlayer[focused.id]!}
                  size="xl"
                />
                <div
                  className="bg-card flex items-center gap-2 rounded-xl border-4 px-6 py-2.5"
                  style={{ borderColor: colorByPlayer[focused.id] }}
                >
                  <Flag state={focused.state ?? "??"} size="lg" />
                  <span className="text-card-foreground text-2xl font-black tracking-tight uppercase">
                    {focused.name}
                  </span>
                  {focused.nickname ? (
                    <span className="text-muted-foreground text-base font-medium">
                      &ldquo;{focused.nickname}&rdquo;
                    </span>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>

          <Button size="lg" onClick={confirm} className="w-full max-w-xs text-base font-bold">
            Let&apos;s go
          </Button>
        </>
      )}
    </main>
  );
}
