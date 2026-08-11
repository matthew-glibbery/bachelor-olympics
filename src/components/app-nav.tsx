"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Medal, Settings2, Sliders } from "lucide-react";

import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Medal Table", icon: Medal },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/multipliers", label: "Multipliers", icon: Sliders },
  { href: "/setup", label: "Setup", icon: Settings2 },
] as const;

/** Shared nav for the four core screens. Renders as a row of pill links. */
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground border-transparent"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground border-transparent",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
