import localFont from "next/font/local";

/**
 * The app's three typefaces, self-hosted.
 *
 * Why self-hosted rather than `next/font/google`: `fonts.googleapis.com` is
 * blocked outright on the network this repo is developed on, and
 * `next/font/google` resolves the family at *build* time — so a Google-backed
 * font would turn every local build (and any CI runner behind the same
 * proxy) into a hard failure. The `@fontsource/*` packages ship the exact
 * same upstream woff2 files through npm, which does work here, so we point
 * `next/font/local` at those. Same output, no build-time network dependency.
 *
 * Why real webfonts at all — this is the bug, not a preference. Every font
 * token used to be a *system* stack headed by "Arial Black" / "Helvetica
 * Neue" / "SF Mono". None of those exist on iOS or Android, so every phone
 * silently fell through to its own default UI face while desktop Safari and
 * Chrome on macOS resolved the real thing. That's why the app "looked like a
 * different font on mobile" — it literally was one. Self-hosting means all
 * eight players see identical type on whatever hardware they bring.
 *
 * The three roles are deliberately distinct voices, not three flavours of
 * the same idea:
 *
 * - `title`  — Bungee. Arcade/signage caps: ultra-heavy, wide, drawn only as
 *   uppercase. This is the marquee voice — the cartridge logo and "Press
 *   Start", nothing else. It is *not* usable below ~16px, which is exactly
 *   why it doesn't own the small-label role below.
 * - `display` — Archivo. A grotesque explicitly designed to stay legible at
 *   small sizes and high letter-spacing, which is the entire job here: this
 *   app labels everything with 9-10px tracked uppercase. Variable 100-900,
 *   so the same file covers hairline captions and the heavy plate headings.
 * - `score`  — Saira. Semi-condensed and squared-off, so it reads as a game
 *   HUD readout rather than body copy, and — the practical reason — narrower
 *   digits survive the cramped Pts/x/Total columns on a phone that a
 *   normal-width face overflows.
 */

export const fontTitle = localFont({
  src: "../../node_modules/@fontsource/bungee/files/bungee-latin-400-normal.woff2",
  weight: "400",
  style: "normal",
  variable: "--font-title-loaded",
  display: "swap",
  // Bungee is caps-only and very wide; the fallback is metric-matched as
  // closely as a system font can be so the swap doesn't jolt the logo.
  fallback: ["Arial Black", "Arial Bold", "Helvetica", "sans-serif"],
  adjustFontFallback: false,
});

export const fontDisplay = localFont({
  src: "../../node_modules/@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-display-loaded",
  display: "swap",
  fallback: ["Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
  adjustFontFallback: false,
});

export const fontScore = localFont({
  src: "../../node_modules/@fontsource-variable/saira/files/saira-latin-wght-normal.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-score-loaded",
  display: "swap",
  fallback: ["Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
  adjustFontFallback: false,
});

/** Every font variable, for the single `<html>` className that mounts them. */
export const fontVariables = [
  fontTitle.variable,
  fontDisplay.variable,
  fontScore.variable,
].join(" ");
