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
 * `main` is NORMAL FLOW with `min-h-[var(--app-height)]` — deliberately NOT
 * `position: fixed`, which is what this screen used for seven rounds of
 * failed bottom-gap fixes.
 *
 * Measured on the affected device (iPhone, iOS 18.7, installed PWA, screen
 * 852 tall) with the probe below:
 *
 *     fixed inset-0 box:  top 0 · bottom 793 · height 793
 *     this <main>:        top 0 · bottom 852 · height 852
 *
 * In an installed iOS PWA with `black-translucent` + `viewport-fit=cover`,
 * the LAYOUT viewport — what `position: fixed` and `inset-0` resolve
 * against — is inset by the top safe area (852 − 59 = 793), while the
 * VISUAL viewport is the whole 852-pixel screen. So a `fixed inset-0`
 * element is 59px short by construction and no amount of height correction
 * reaches the bottom of the glass; that band was the bug, and it's why the
 * one thing every other screen in this app does — normal flow with a
 * min-height — has always filled correctly while these two never did.
 *
 * Do not reintroduce `position: fixed` here. If this screen ever needs to
 * stop the page scrolling, do it some other way: `overflow: hidden` on the
 * root would clip to that same short layout viewport and bring the band
 * straight back.
 *
 * Every background layer below is `absolute inset-0`, so it stretches to
 * main's full used height, min-height included.
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
      <main
        onClick={skipOrStart}
        className="relative flex min-h-[var(--app-height)] cursor-pointer flex-col items-center justify-center overflow-hidden px-6"
      >
        {/* Fill layers. `absolute inset-0` against a normal-flow main whose
            min-height is the real screen height, so they reach the bottom of
            the glass — which the same markup could not do while main was
            `fixed` (see the note above). */}
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

      <ScreenProbe />
    </>
  );
}
