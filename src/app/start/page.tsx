"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

import { useGameStore } from "@/store/gameStore";

/**
 * App name (docs/VISUAL_SPEC.md → Open decisions) — decided: "Bachelor
 * Party." Kept as one named constant so a future rename stays a one-line
 * change; nothing else in the app references it.
 */
const GAME_TITLE = "Bachelor Party";

/**
 * N64 cartridge-boot style title screen (docs/visual_spec.md "Start
 * screen"), not a conventional web landing page — a chunky beveled logo and
 * a "press start" prompt rather than a button. `bg-foreground`/`text-*`
 * tokens (not hardcoded colors) so this screen's "dark stage" automatically
 * follows whichever app theme is active — see src/lib/themes.ts.
 *
 * If the groom has uploaded a real boot video (`app_settings.boot_video_url`,
 * Setup → Groom tools → Boot video), it plays full-bleed behind the logo,
 * muted/autoplay/once, holding its last frame — same "press start" overlay
 * either way. Falls back to the plain gradient-and-text treatment below
 * when none is set yet.
 */
export default function StartPage() {
  const router = useRouter();
  const { appSettings, connect } = useGameStore();
  const enter = useCallback(() => router.push("/select"), [router]);

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    window.addEventListener("keydown", enter);
    return () => window.removeEventListener("keydown", enter);
  }, [enter]);

  const bootVideoUrl = appSettings?.boot_video_url ?? null;

  return (
    <button
      type="button"
      onClick={enter}
      className="bg-foreground relative flex min-h-screen w-full cursor-pointer flex-col items-center justify-center gap-10 overflow-hidden px-6 text-center"
    >
      {bootVideoUrl ? (
        <video
          src={bootVideoUrl}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}

      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 45% at 50% 42%, color-mix(in oklch, var(--primary) 35%, transparent), transparent 70%)",
        }}
      />

      <div className="relative flex flex-col items-center gap-3">
        <h1
          className="text-background text-6xl font-black tracking-tighter uppercase italic sm:text-8xl"
          style={{
            textShadow:
              "4px 4px 0 var(--primary), 8px 8px 0 var(--accent), 0 2px 24px color-mix(in oklch, var(--primary) 50%, transparent)",
          }}
        >
          {GAME_TITLE}
        </h1>
      </div>

      <p className="text-accent relative animate-pulse text-lg font-bold tracking-[0.2em] uppercase sm:text-xl">
        Press Start
      </p>

      <p className="text-background/40 relative text-[11px] tracking-wide">
        Tap anywhere, or press any key
      </p>
    </button>
  );
}
