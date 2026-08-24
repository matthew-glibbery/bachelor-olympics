import type { Metadata, Viewport } from "next";
import "./globals.css";
import { fontVariables } from "./fonts";
import { IdentityGate } from "@/components/identity-gate";
import { CrtOverlay } from "@/components/n64/crt-overlay";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";

export const metadata: Metadata = {
  title: "Bachelor Party",
  description: "Eight events. Eight competitors. One leaderboard.",
  applicationName: "Bachelor Party",
  // Served by src/app/manifest.ts. Everything below is the iOS half of the
  // same story: Safari ignores most of the manifest, so the home-screen
  // icon and the standalone/status-bar hints have to be <meta> tags too.
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "Bachelor Party",
    /*
      `black`, NOT `black-translucent` — this is the fix for the
      "unused space at the bottom of /start and /select" bug that three
      previous rounds of CSS/layout changes failed to shift.

      `black-translucent` asks iOS to extend the web view up underneath the
      status bar. In standalone (home-screen) mode on a notched iPhone,
      WebKit then reports a viewport that doesn't account for that
      consistently, and the shortfall renders as a band of unfilled page
      background along the BOTTOM of the screen.

      The reason this took so long to find is the reason it matters where
      the fix lives: *every* way of asking "how tall is the screen" —
      `100vh`, `100dvh`, `position: fixed; inset: 0`, `window.innerHeight`,
      even `window.visualViewport.height` — resolves against that same
      short viewport. So no CSS unit and no JS measurement can paper over
      it; each previous attempt measured the wrong number very accurately.
      It also can't be reproduced outside an installed iOS PWA: a Safari
      tab and headless Chrome both hand back a correct viewport, which is
      why every fix tested clean and shipped broken.

      With `black` the status bar is opaque and the web view starts below
      it, correctly sized. Against this app's near-black `#070926`
      background the visual difference is negligible, and `env(safe-area-
      inset-top)` correctly collapses to 0 (the `--safe-*` tokens in
      globals.css keep working; `viewport-fit=cover` still covers the
      home-indicator area at the bottom, so `--safe-bottom` is unaffected).

      NOTE FOR ANYONE TESTING THIS: iOS reads these `apple-*` meta tags
      once, when the icon is added to the home screen, and caches them for
      the life of that install. Editing them here does nothing to an
      already-installed icon — the app has to be deleted from the home
      screen and re-added before this change has any effect. (Ordinary
      HTML/CSS/JS changes do reach an installed PWA on reload, which is why
      the earlier attempts were genuinely being tested even though this
      layer was frozen.)
    */
    statusBarStyle: "black",
  },
  other: {
    // Next only emits the standardised `mobile-web-app-capable`. WebKit has
    // honoured that name since iOS 15.4, but the phones in this group aren't
    // all new, and the legacy Apple spelling is what older iOS reads to
    // launch without Safari's chrome. One extra meta tag is cheap insurance.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  // The UI is a dark console screen edge to edge; tell the browser so the
  // status bar and any native chrome match instead of flashing light.
  themeColor: "#070926",
  colorScheme: "dark",
  // Installed to a home screen there is no browser chrome, so the app has
  // to paint into the notch/home-indicator area itself and then keep its
  // own UI out of it — see the `safe-*` tokens in globals.css.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="antialiased">
        <IdentityGate>{children}</IdentityGate>
        <CrtOverlay />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
