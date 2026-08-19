"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Coins, Medal, Sliders, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";

// `short` is what the narrow mobile tab bar shows. Five tabs across a phone
// leaves each about 70px, which truncated "Leaderboard" to a meaningless
// "Leaderbo…" and "Multipliers" to "Multiplie…". A real word that fits beats
// a clipped longer one; the full label still shows on the desktop pill row
// and is always the accessible name.
const STATIC_LINKS = [
  { href: "/", label: "Leaderboard", short: "Ranking", icon: Medal },
  { href: "/events", label: "Events", short: "Events", icon: CalendarDays },
  { href: "/multipliers", label: "Multipliers", short: "Boosts", icon: Sliders },
  { href: "/bets", label: "Bets", short: "Bets", icon: Coins },
] as const;

/**
 * Shared nav for the four core screens. A floating bottom tab bar on mobile
 * (this app is mostly used on phones at the actual event) that reverts to a
 * plain inline pill row at larger widths — one component, responsive
 * classes, no separate mobile/desktop implementations to keep in sync.
 *
 * Labels go uppercase+tracked on the wide `sm:` pill row, echoing the same
 * chunky-game-menu register `GameScreen` puts on every screen's title —
 * colors/icons/layout untouched, they already work. Desktop-only, though:
 * on the floating mobile bar five tabs share one phone-width screen (the
 * device this app is mostly used on, per the note above), and uppercase
 * alone is enough to push "Leaderboard"/"Multipliers" past a ~70px column
 * into visible truncation — verified by testing the mobile bar directly,
 * not assumed. Normal case there reads fine at this size.
 *
 * The mobile bar is a `.bevel-raised` plate rather than the soft
 * `border + shadow-lg` it used to be: it was the last floating surface in
 * the app still lit like a 2020s bottom sheet while everything behind it
 * was a beveled console plate, which is exactly the kind of mismatch that
 * reads as "unfinished" rather than "deliberate."
 */
export function AppNav() {
  const pathname = usePathname();
  const players = useGameStore((s) => s.players);
  const selectedPlayerId = useSessionStore((s) => s.selectedPlayerId);
  const selectedPlayer = players.find((p) => p.id === selectedPlayerId);

  const links = [
    ...STATIC_LINKS,
    {
      href: "/setup",
      label: selectedPlayer?.name ?? "Player Settings",
      // A first name already fits; only the signed-out label needs shortening.
      short: selectedPlayer?.name ?? "You",
      icon: UserRound,
    },
  ];

  return (
    <nav
      className={cn(
        "bevel-raised bg-card fixed inset-x-4 bottom-4 z-50 flex items-center justify-around gap-1 rounded-2xl px-2 py-2",
        "sm:static sm:inset-auto sm:z-auto sm:flex-wrap sm:justify-center sm:gap-2 sm:rounded-none sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none",
      )}
    >
      {links.map(({ href, label, short, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1 text-[11px] font-medium transition-colors",
              "sm:font-display sm:flex-none sm:flex-row sm:items-center sm:gap-1.5 sm:rounded-md sm:px-3 sm:py-1.5 sm:text-xs sm:tracking-wider sm:uppercase",
              active
                ? // A small glow on the active mobile tab (real shadow-*
                  // utilities, so the desktop row can override it), and the
                  // full gold cursor treatment on the desktop pill — the
                  // same `.is-cursor` the roster strip uses for "you are
                  // here," rather than a second, unrelated active style.
                  "bg-primary/10 text-primary shadow-[0_0_0_1px_var(--primary),0_0_10px_-2px_var(--primary)] sm:is-cursor sm:bg-primary sm:text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground sm:bevel-raised sm:bg-card",
            )}
            aria-label={label}
          >
            <Icon className="size-5 sm:size-4" />
            <span className="truncate sm:hidden">{short}</span>
            <span className="hidden sm:inline">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
