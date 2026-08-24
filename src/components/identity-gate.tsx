"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";

/** Routes never redirected away from — the identity flow, plus /debug. */
const EXEMPT_PATHS = new Set([
  "/start",
  "/select",
  // Not part of the identity flow, but exempt for the same practical
  // reason: /debug (src/app/debug/page.tsx) exists to be opened on a phone
  // to measure the viewport, and bouncing it to /start would measure the
  // wrong screen. It's unlinked and read-only.
  "/debug",
]);

/**
 * App-wide gate: until this device has picked who it's acting as (see
 * src/lib/session/identity.ts), redirect to /start — the N64 boot screen,
 * which leads into /select (docs/VISUAL_SPEC.md) — instead of rendering
 * whatever page was requested. Once a player is selected, or on any later
 * visit (selection persists in localStorage), this is a no-op and renders
 * `children` normally.
 *
 * Bypasses itself (renders `children` regardless) when there's no roster
 * yet — a brand-new weekend needs the groom to reach Setup and add the
 * first player before anyone can pick who they are — and on a connection
 * error, so each page's own error UI still surfaces instead of a stuck
 * redirect loop.
 */
export function IdentityGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { players, connect, ready, error } = useGameStore();
  const { selectedPlayerId, hydrate } = useSessionStore();

  useEffect(() => {
    hydrate();
    connect();
  }, [hydrate, connect]);

  const exempt = EXEMPT_PATHS.has(pathname);
  const shouldGate =
    !exempt && ready && !error && !selectedPlayerId && players.length > 0;

  useEffect(() => {
    if (shouldGate) router.replace("/start");
  }, [shouldGate, router]);

  if (exempt) return <>{children}</>;
  // Avoid a flash of the real app before we know whether to redirect.
  if (!ready && !error) return null;
  if (shouldGate) return null;
  return <>{children}</>;
}
