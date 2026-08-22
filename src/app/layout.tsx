import type { Metadata, Viewport } from "next";
import "./globals.css";
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
    // Translucent so the app's own dark background runs under the status
    // bar instead of a grey band across the top of a console screen; the
    // matching top safe-area padding lives in globals.css.
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
    <html lang="en">
      <body className="antialiased">
        <IdentityGate>{children}</IdentityGate>
        <CrtOverlay />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
