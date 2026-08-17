import type { Metadata } from "next";
import "./globals.css";
import { ThemeApplier } from "@/components/theme-applier";
import { IdentityGate } from "@/components/identity-gate";

export const metadata: Metadata = {
  title: "Bachelor Party",
  description: "Eight events. Eight competitors. One leaderboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ThemeApplier />
        <IdentityGate>{children}</IdentityGate>
      </body>
    </html>
  );
}
