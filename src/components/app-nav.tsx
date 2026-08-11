"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Coins, Medal, Percent, Sliders, UserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";

const STATIC_LINKS = [
  { href: "/", label: "Medal Table", icon: Medal },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/multipliers", label: "Multipliers", icon: Sliders },
  { href: "/odds", label: "Odds", icon: Percent },
  { href: "/bets", label: "Bets", icon: Coins },
] as const;

/**
 * Shared nav for the four core screens. A floating bottom tab bar on mobile
 * (this app is mostly used on phones at the actual event) that reverts to a
 * plain inline pill row at larger widths — one component, responsive
 * classes, no separate mobile/desktop implementations to keep in sync.
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
      icon: UserRound,
    },
  ];

  return (
    <nav
      className={cn(
        "fixed inset-x-4 bottom-4 z-50 flex items-center justify-around gap-1 rounded-2xl border bg-card/95 px-2 py-2 shadow-lg backdrop-blur-sm",
        "sm:static sm:inset-auto sm:z-auto sm:flex-wrap sm:justify-start sm:gap-2 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none sm:backdrop-blur-none",
      )}
    >
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1 text-[11px] font-medium transition-colors",
              "sm:flex-none sm:flex-row sm:items-center sm:gap-1.5 sm:rounded-md sm:border sm:px-3 sm:py-1.5 sm:text-sm",
              active
                ? "bg-primary/10 text-primary sm:bg-primary sm:text-primary-foreground sm:border-transparent"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground sm:border-transparent",
            )}
          >
            <Icon className="size-5 sm:size-4" />
            <span className="max-w-16 truncate sm:max-w-none">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
