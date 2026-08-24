"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { GameLogo } from "@/components/n64/game-logo";
import { Starfield } from "@/components/n64/starfield";
import { ScreenProbe } from "@/components/screen-probe";
import { useGameInput } from "@/hooks/use-game-input";
import { playSfx, unlockAudio } from "@/lib/sfx";
import { useGameStore } from "@/store/gameStore";

/** Beat at which PRESS START appears — after the logo has settled. */
const PROMPT_DELAY_MS = 1500;

/**
 * N64 cartridge-boot title screen (docs/VISUAL_SPEC.md "Start screen") — a
 * logo slams in, PRESS START starts blinking, and *any* input gets you in
 * (keyboard, gamepad, tap, click), because there wasn't a button to aim at
 * in 1998, there was a cartridge.
 *
 * This is also where audio gets unlocked: browsers only allow an
 * AudioContext to start from a real user gesture, and PRESS START is the
 * one gesture this flow guarantees, so the era-correct entry point and the
 * technical constraint want exactly the same thing.
 *
 * Background layers, most to least specific:
 *   1. `app_settings.boot_video_url` — a real groom-uploaded video (Setup →
 *      Groom tools → Boot video), plays full-bleed behind the logo.
 *   2. The starfield (src/components/n64/starfield.tsx) — always renders,
 *      so the screen never depends on an uploaded asset to look finished.
 *
 * `main` is `fixed inset-0` with a `--app-height` FLOOR — both, deliberately,
 * because the two cover different failure modes and neither is redundant:
 * `inset-0` pins it to whatever the browser says the viewport is, and the
 * `min-height` extends it when we have reason to believe the browser is
 * under-reporting (an installed iOS PWA — see viewport-floor.tsx, which
 * derives that height from `window.screen`, the one source that isn't
 * itself a viewport reading). An earlier version used `height:
 * var(--app-height)` ALONE, dropping `inset-0`, which meant a screen where
 * the floor didn't apply fell back to plain `100dvh` — strictly worse than
 * the `inset-0` it replaced. Keep both.
 *
 * Every background layer below is `absolute inset-0`, so it stretches to
 * whichever of the two won: an absolutely-positioned child resolves against
 * the parent's used height, min-height included.
 */
export default function StartPage() {
  const router = useRouter();
  const { appSettings, connect } = useGameStore();
  const [promptVisible, setPromptVisible] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    connect();
  }, [connect]);

  useEffect(() => {
    const t = window.setTimeout(() => setPromptVisible(true), PROMPT_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  const start = useCallback(() => {
    if (starting) return;
    setStarting(true);
    unlockAudio();
    playSfx("start");
    // Let the fanfare land before the screen changes — cutting it off
    // mid-arpeggio is the kind of detail that makes a thing feel cheap.
    window.setTimeout(() => router.push("/select"), 480);
  }, [starting, router]);

  // Before the prompt shows, input skips the intro rather than starting the
  // game — mashing through a boot sequence shouldn't cost you a screen.
  const skipOrStart = useCallback(() => {
    if (!promptVisible) {
      setPromptVisible(true);
      return;
    }
    start();
  }, [promptVisible, start]);

  useGameInput({ onStart: skipOrStart, onConfirm: skipOrStart });

  const bootVideoUrl = appSettings?.boot_video_url ?? null;

  const bootVideoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = bootVideoRef.current;
    if (!v) return;
    // The `autoPlay`/`muted`/`playsInline` JSX attributes alone are
    // unreliable on mobile Safari/Chrome, and reportedly more so for a PWA
    // launched from the home screen than the same page in a normal Safari
    // tab — same base fix already used for character clips
    // (character-render.tsx): explicitly set the DOM properties (not just
    // the JSX attributes) and call `.play()` imperatively. This goes
    // further than that fallback for the one screen that actually gets
    // reported as not autoplaying: `.play()` here fires as soon as the ref
    // exists, which can be BEFORE the browser has actually buffered enough
    // to start (a silent no-op, no rejection to catch), so `loadeddata`
    // and `canplay` each get their own retry, and `pageshow` covers the
    // case where iOS suspends the video after backgrounding a standalone
    // app and resuming it doesn't resume playback on its own.
    v.muted = true;
    v.playsInline = true;
    const tryPlay = () => v.play().catch(() => {});
    tryPlay();
    v.addEventListener("loadeddata", tryPlay);
    v.addEventListener("canplay", tryPlay);
    window.addEventListener("pageshow", tryPlay);
    return () => {
      v.removeEventListener("loadeddata", tryPlay);
      v.removeEventListener("canplay", tryPlay);
      window.removeEventListener("pageshow", tryPlay);
    };
  }, [bootVideoUrl]);

  return (
    <>
      {/* Background, bled 6rem past the top and bottom of the viewport.

          This is the belt-and-braces answer to the installed-PWA bottom
          band, and it is deliberately not a measurement: whatever the fixed
          containing block turns out to be — the full screen, inset below the
          status bar, or short by the home indicator — a layer that extends
          well beyond both edges paints across the difference. It cannot be
          a child of <main>, which clips to its own box (`overflow-hidden`),
          so it's a sibling behind it.

          The device readout (2026-08-24) says the fixed box already IS the
          full screen, in which case this bleed changes nothing visible and
          costs one composited layer. That's the point: it can only help. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 -top-24 -bottom-24 -z-10 overflow-hidden"
      >
        {bootVideoUrl ? (
          <video
            ref={bootVideoRef}
            src={bootVideoUrl}
            autoPlay
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <Starfield />
        )}
      </div>

      <main
        onClick={skipOrStart}
        className="fixed inset-0 flex min-h-[var(--app-height)] cursor-pointer flex-col items-center justify-center overflow-hidden px-6"
      >
        {/* Horizon glow, so the logo sits on something rather than floating.
            Stays inside <main>, unlike the fill layers above: it's anchored
            to the bottom EDGE, so bleeding it would push the glow off the
            screen. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2"
          style={{
            background:
              "radial-gradient(ellipse at 50% 100%, color-mix(in oklch, var(--primary) 30%, transparent) 0%, transparent 70%)",
          }}
          aria-hidden
        />

        <div className="relative flex w-full max-w-3xl flex-col items-center gap-8">
          <div className="anim-logo-settle w-full">
            <GameLogo />
          </div>

          {/* A real button for keyboard and screen-reader users, styled as
              the blinking prompt rather than as a control. */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              skipOrStart();
            }}
            className="focus-visible:is-cursor mt-6 rounded-sm px-4 py-2 focus-visible:outline-none"
          >
            <span
              className={
                starting
                  ? "marquee text-xl sm:text-2xl"
                  : "anim-blink marquee text-xl sm:text-2xl"
              }
              style={{ visibility: promptVisible ? "visible" : "hidden" }}
            >
              Press Start
            </span>
          </button>
        </div>
      </main>

      <ScreenProbe />
    </>
  );
}
