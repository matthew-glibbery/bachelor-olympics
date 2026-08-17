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
 * Static background artwork for the boot screen, e.g. a designed title-card
 * image (as opposed to `app_settings.boot_video_url` below, which is a real
 * uploaded-by-the-groom feature). Drop the file at this exact path —
 * `public/start-background.jpg` — and it appears automatically; nothing else
 * needs to change. Referencing a path with no file there yet is safe: a
 * missing CSS `background-image` just doesn't render, no broken-image icon,
 * so this degrades to the plain gradient below until the file exists.
 */
const BOOT_BACKGROUND_IMAGE = "/start-background.jpg";

/**
 * N64 cartridge-boot style title screen (docs/visual_spec.md "Start
 * screen"), not a conventional web landing page — just the logo and a "press
 * start" prompt rather than a button or any instructional copy. `bg-foreground`
 * /`text-*` tokens (not hardcoded colors) so this screen's "dark stage"
 * automatically follows whichever app theme is active — see
 * src/lib/themes.ts — for whichever of the two fallback layers below is
 * actually showing.
 *
 * Three background layers, most to least specific:
 *   1. `app_settings.boot_video_url` — a real groom-uploaded video (Setup →
 *      Groom tools → Boot video), plays full-bleed behind the logo.
 *   2. `BOOT_BACKGROUND_IMAGE` — a static design asset, once one exists.
 *   3. The plain radial-gradient treatment, as a fallback that always works.
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
      style={{
        backgroundImage: `url(${BOOT_BACKGROUND_IMAGE})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
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
    </button>
  );
}
