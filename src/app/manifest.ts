import type { MetadataRoute } from "next";

/**
 * Web app manifest, served by Next at `/manifest.webmanifest`.
 *
 * The eight players add this to their home screen at the start of the
 * weekend and use it like an app for two days — `standalone` so there's no
 * browser chrome eating the top of a phone screen, `portrait` because every
 * screen in here is a single narrow column and a landscape rotation mid-golf
 * is always an accident.
 *
 * `background_color`/`theme_color` are the real `--background` token from
 * globals.css converted to sRGB (see scripts/generate-icons.mjs, which does
 * the same conversion for the icons) — matching them means the splash screen
 * and status bar are the same near-black indigo as the app itself, with no
 * flash of a different colour on launch.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bachelor Party",
    short_name: "Bachelor Party",
    description: "Eight events. Eight competitors. One leaderboard.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#070926",
    theme_color: "#070926",
    categories: ["games", "sports"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        // Padded copy for Android's adaptive-icon crop, which can shave up
        // to 20% off every edge of the icon it's given.
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
