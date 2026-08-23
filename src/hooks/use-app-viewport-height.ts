"use client";

import { useEffect } from "react";

/**
 * Sets `--app-vh` on the root element to the real, measured visual viewport
 * height, kept live. Exists because `/start` and `/select` reportedly still
 * show a band of unused space at the bottom in a real installed iOS PWA even
 * after switching those screens from `min-h-dvh` to `position: fixed; inset:
 * 0` — a fix that's correct for the general "min-height only sets a floor"
 * problem `dvh` has, but doesn't help if the actual mismatch is that
 * `bottom: 0` on a fixed element resolves against a taller implied box than
 * the visually rendered one. That's a real, previously-reported class of
 * WebKit bug in standalone home-screen web apps specifically — not something
 * any CSS viewport unit (`vh`, `dvh`, `svh`, or a `fixed` box's own implied
 * height) is guaranteed to sidestep, because all of them are the browser's
 * own computation of "the viewport," which is exactly the thing that's
 * apparently wrong here.
 *
 * `window.visualViewport` is the one API that reports the actual rendered
 * viewport rather than a CSS-side computation of it, so this measures that
 * directly instead of trusting any unit. Falls back to `window.innerHeight`
 * where `visualViewport` doesn't exist (old Safari, non-iOS). Re-measures on
 * `resize` and on the visual viewport's own `resize`/`scroll` — the latter
 * is what actually fires on iOS when the OS chrome or on-screen keyboard
 * changes what's visible, which a plain `window.resize` listener alone can
 * miss.
 *
 * A CSS `100dvh` fallback stays in place wherever this is consumed (SSR has
 * no `window` to measure from, and there's a one-frame gap before the first
 * effect runs) — this only overrides it once real numbers exist.
 */
export function useAppViewportHeight() {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;

    const apply = () => {
      const h = vv?.height ?? window.innerHeight;
      root.style.setProperty("--app-vh", `${h}px`);
    };

    apply();
    window.addEventListener("resize", apply);
    vv?.addEventListener("resize", apply);
    vv?.addEventListener("scroll", apply);

    return () => {
      window.removeEventListener("resize", apply);
      vv?.removeEventListener("resize", apply);
      vv?.removeEventListener("scroll", apply);
    };
  }, []);
}
