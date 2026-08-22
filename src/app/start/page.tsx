"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { GameLogo } from "@/components/n64/game-logo";
import { Starfield } from "@/components/n64/starfield";
import { useGameInput } from "@/hooks/use-game-input";
import { GAME_COPYRIGHT, GAME_TAGLINE } from "@/lib/branding";
import { playSfx, unlockAudio } from "@/lib/sfx";
import { useGameStore } from "@/store/gameStore";

/** Beat at which PRESS START appears — after the logo has settled. */
const PROMPT_DELAY_MS = 1500;

/**
 * N64 cartridge-boot title screen (docs/VISUAL_SPEC.md "Start screen") — a
 * logo slams in, the tagline fades up, PRESS START starts blinking, and
 * *any* input gets you in (keyboard, gamepad, tap, click), because there
 * wasn't a button to aim at in 1998, there was a cartridge.
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
    // The `autoPlay` attribute alone is unreliable on mobile Safari/Chrome —
    // same fix already used for character clips (character-render.tsx):
    // explicitly set `muted` as a DOM property (not just the JSX attribute)
    // and call `.play()` imperatively, catching the rejection autoplay
    // policies can still throw rather than letting it become an unhandled
    // rejection.
    v.muted = true;
    v.play().catch(() => {});
  }, [bootVideoUrl]);

  return (
    <main
      onClick={skipOrStart}
      className="relative flex min-h-dvh cursor-pointer flex-col items-center justify-center overflow-hidden px-6"
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

        <p
          className="font-display text-primary/90 max-w-[22rem] text-center text-[11px] tracking-[0.16em] text-balance uppercase sm:max-w-none sm:text-sm sm:tracking-[0.3em]"
          style={{ animation: "n64-pop-in 0.5s ease-out 1.1s both" }}
        >
          {GAME_TAGLINE}
        </p>

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

      {/* The boot video plays full-bleed behind all of this, and its bottom
          edge can be any brightness the groom's clip happens to end on — the
          current one is pale stone, against which `text-muted-foreground`
          all but vanished. A gradient scrim behind the footer (rather than
          a brighter text colour) keeps the type quiet by design while
          guaranteeing it stays legible over an arbitrary frame. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/75 to-transparent"
        aria-hidden
      />
      <footer className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-1 px-6">
        <p className="font-display text-center text-[9px] tracking-[0.14em] text-balance text-white/70 uppercase sm:tracking-[0.2em]">
          {GAME_COPYRIGHT}
        </p>
        <p className="font-display text-center text-[9px] tracking-[0.2em] text-white/50 uppercase">
          Keyboard · Gamepad · Touch
        </p>
      </footer>
    </main>
  );
}
