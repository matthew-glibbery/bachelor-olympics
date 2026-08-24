import type { Metadata, Viewport } from "next";
import "./globals.css";
import { fontVariables } from "./fonts";
import { IdentityGate } from "@/components/identity-gate";
import { CrtOverlay } from "@/components/n64/crt-overlay";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
import { ViewportFloor } from "@/components/viewport-floor";

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
      `black-translucent`: the web view extends up *underneath* the status
      bar, so the boot video, the starfield and the page background paint
      edge to edge instead of stopping at an opaque black band across the
      top. That band is what `black` (the previous value here) produces —
      it fixed a bottom-gap bug at the cost of the top of every screen, and
      a full-bleed title screen is the higher-value half of that trade.

      The bottom gap `black` was fixing is real and is handled deliberately
      now rather than by giving up the top of the screen. In standalone
      mode on a notched iPhone, WebKit can report a viewport shorter than
      the actual screen once it extends under the status bar, and the
      shortfall shows as a band of unfilled page background along the
      BOTTOM. Every viewport-derived measurement — `100vh`, `100dvh`,
      `position: fixed; inset: 0`, `window.innerHeight`, even
      `window.visualViewport.height` — resolves against that same short
      number, which is why earlier CSS-only attempts each measured the
      wrong height very accurately. `ViewportFloor`
      (src/components/viewport-floor.tsx) sidesteps that by reading
      `window.screen.height`, which is NOT a viewport API and does report
      the true screen, and publishing it as `--app-height` for the three
      full-screen shells to use as a floor. See that file for the
      (deliberately narrow) conditions under which it applies.

      `env(safe-area-inset-top)` becomes non-zero again under this style,
      which is what keeps actual UI out from under the clock and the notch
      — the `--safe-*` tokens in globals.css already feed every screen's
      padding, so content stays clear while the background does not.

      NOTE FOR ANYONE TESTING THIS: iOS reads these `apple-*` meta tags
      once, when the icon is added to the home screen, and caches them for
      the life of that install. Editing them here does nothing to an
      already-installed icon — the app has to be deleted from the home
      screen and re-added before this change has any effect. (Ordinary
      HTML/CSS/JS changes do reach an installed PWA on reload, which is why
      the earlier attempts were genuinely being tested even though this
      layer was frozen.)
    */
    statusBarStyle: "black-translucent",
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
        <ViewportFloor />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
