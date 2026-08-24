"use client";

import { useEffect } from "react";

/**
 * Publishes a trustworthy full-screen height as `--app-height`.
 *
 * Background: with `apple-mobile-web-app-status-bar-style:
 * black-translucent` (layout.tsx) an installed iOS PWA paints under the
 * status bar — which is what we want for the boot video and the starfield —
 * but WebKit can then report a *layout viewport* shorter than the real
 * screen. Anything sized from the viewport (`100dvh`, `fixed inset-0`,
 * `innerHeight`, `visualViewport.height`) inherits that shortfall and leaves
 * a band of bare page background along the bottom.
 *
 * `window.screen.height` is not a viewport measurement — it's the device
 * screen in CSS pixels — so it is the one number available here that the
 * bug doesn't affect. When it disagrees with the viewport, it wins.
 *
 * Deliberately narrow about when it applies, because outside this exact
 * situation `screen.height` is the *wrong* answer (in a browser tab it
 * includes the chrome the page doesn't get):
 *   - standalone display mode only, i.e. launched from the home screen;
 *   - portrait only (`innerWidth === screen.width`) — iOS does not swap
 *     `screen.width`/`screen.height` on rotation, so in landscape the two
 *     axes aren't comparable and the measurement is meaningless;
 *   - only ever as a floor, and never by an absurd amount (see
 *     MAX_CORRECTION_RATIO).
 *
 * Everywhere else `--app-height` keeps its CSS default from globals.css
 * (`100dvh`, or `100lvh` in standalone), so browsers and Android are
 * untouched by any of this.
 *
 * The measurement is exported separately from the effect so /debug can print
 * the exact decision this made, and why — rather than re-deriving it and
 * drifting out of sync with the thing it's meant to be diagnosing.
 */

/**
 * Largest shortfall we'll correct, as a fraction of the screen.
 *
 * This started life as a flat 80px, sized as "the tallest plausible status
 * bar" — which was wrong, and is the likeliest reason the first version of
 * this fix didn't take: the shortfall reported on a notched iPhone can span
 * the status bar AND the home-indicator area together (roughly 54 + 34 =
 * 88px), so the guard rejected the exact case it was written for. In
 * standalone mode there is no browser chrome for the viewport to be
 * legitimately short by, so any positive shortfall is this bug; the cap
 * exists only to refuse a nonsensical measurement, not to second-guess a
 * plausible one.
 */
const MAX_CORRECTION_RATIO = 0.25;

export interface ViewportFloorMeasurement {
  standalone: boolean;
  portrait: boolean;
  screenHeight: number;
  innerHeight: number;
  shortfall: number;
  maxCorrection: number;
  /** Whether `--app-height` gets overridden with the screen height. */
  applies: boolean;
  /** Human-readable "why not", for /debug. Empty when it applies. */
  reason: string;
}

export function measureViewportFloor(): ViewportFloorMeasurement {
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari's own non-standard flag, still the reliable one on older
    // versions that don't match the media query.
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  const portrait = window.innerWidth === window.screen.width;
  const shortfall = window.screen.height - window.innerHeight;
  const maxCorrection = window.screen.height * MAX_CORRECTION_RATIO;

  const applies = standalone && portrait && shortfall > 0 && shortfall <= maxCorrection;
  const reason = applies
    ? ""
    : !standalone
      ? "not standalone (open this from the home-screen icon)"
      : !portrait
        ? `not portrait (innerWidth ${window.innerWidth} vs screen.width ${window.screen.width})`
        : shortfall <= 0
          ? "no shortfall — the viewport already matches the screen"
          : `shortfall ${shortfall} exceeds the ${Math.round(maxCorrection)} cap`;

  return {
    standalone,
    portrait,
    screenHeight: window.screen.height,
    innerHeight: window.innerHeight,
    shortfall,
    maxCorrection,
    applies,
    reason,
  };
}

export function ViewportFloor() {
  useEffect(() => {
    const root = document.documentElement;

    const apply = () => {
      const measurement = measureViewportFloor();
      if (measurement.applies) {
        root.style.setProperty("--app-height", `${measurement.screenHeight}px`);
      } else {
        root.style.removeProperty("--app-height");
      }
    };

    apply();
    window.addEventListener("resize", apply);
    window.addEventListener("orientationchange", apply);
    // Returning to a backgrounded standalone app can re-report the
    // viewport; re-measure rather than trusting the value from launch.
    window.addEventListener("pageshow", apply);
    return () => {
      window.removeEventListener("resize", apply);
      window.removeEventListener("orientationchange", apply);
      window.removeEventListener("pageshow", apply);
    };
  }, []);

  return null;
}
