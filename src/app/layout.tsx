import type { Metadata, Viewport } from "next";
import "./globals.css";
import { IdentityGate } from "@/components/identity-gate";
import { CrtOverlay } from "@/components/n64/crt-overlay";

export const metadata: Metadata = {
  title: "Bachelor Party",
  description: "Eight events. Eight competitors. One leaderboard.",
};

export const viewport: Viewport = {
  // The UI is a dark console screen edge to edge; tell the browser so the
  // status bar and any native chrome match instead of flashing light.
  themeColor: "#1f1c17",
  colorScheme: "dark",
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
      </body>
    </html>
  );
}
