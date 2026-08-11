import type { Metadata } from "next";
import "./globals.css";
import { ThemeApplier } from "@/components/theme-applier";

export const metadata: Metadata = {
  title: "Bachelor Olympics",
  description: "Eight events. Eight competitors. One medal table.",
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
        {children}
      </body>
    </html>
  );
}
