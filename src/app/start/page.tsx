"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { GameLogo } from "@/components/n64/game-logo";
import { Starfield } from "@/components/n64/starfield";
import { useAppViewportHeight } from "@/hooks/use-app-viewport-height";
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
 * `main` is `fixed`, not `min-h-dvh` — a fix for a real bug, not a style
 * choice. `min-h-dvh` only sets a FLOOR, which is what first showed up as a
 * band of unfilled space at the bottom on an installed PWA instead of the
 * boot video reaching the true screen edge. Switching to `position: fixed`
 * addressed the general case, but that same gap was reported again on a
 * real installed iOS PWA — `bottom: 0` on a fixed box still resolves
 * against however the browser computes "the viewport," and on iOS
 * standalone specifically that computation has a known history of being a
 * few pixels off from what's actually rendered. No CSS unit (`vh`, `dvh`,
 * `svh`, or `inset: 0`'s own implied height) is guaranteed to dodge that,
 * because they're all the browser's own idea of the viewport — exactly the
 * thing apparently in question. `useAppViewportHeight` (src/hooks/) measures
 * `window.visualViewport` directly instead of trusting any of them, and its
 * `--app-vh` feeds the explicit `height` below; `100dvh` is only the
 * pre-hydration fallback for the one frame before that effect runs.
 */
export default function StartPage() {
  const router = useRouter();
  const { appSettings, connect } = useGameStore();
  const [promptVisible, setPromptVisible] = useState(false);
  const [starting, setStarting] = useState(false);

  useAppViewportHeight();

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
    <main
      onClick={skipOrStart}
      // `top-0 right-0 left-0` fixed, `height` explicit rather than
      // `bottom: 0` — see this file's own doc comment and
      // useAppViewportHeight for why the implied height of a `bottom: 0`
      // box isn't trusted here any more. `100dvh` is the pre-hydration
      // fallback; `--app-vh` (real, measured pixels) takes over the instant
      // the effect runs.
      className="fixed inset-x-0 top-0 flex cursor-pointer flex-col items-center justify-center overflow-hidden px-6"
      style={{ height: "var(--app-vh, 100dvh)" }}
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

      {/* Horizon glow, so the logo sits on something rather than floating. */}
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
  );
}
