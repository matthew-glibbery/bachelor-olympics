"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Coins, Medal, Sliders, UserRound, Wrench } from "lucide-react";

import { cn } from "@/lib/utils";
import { useGameStore } from "@/store/gameStore";
import { useSessionStore } from "@/store/sessionStore";
import { assignPlayerColors } from "@/lib/chartColors";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// One word per concept, everywhere.
//
// These used to carry a second, shorter `short` label for the narrow mobile
// bar ("Ranking" for Leaderboard, "Boosts" for Multipliers) because five
// full labels across a phone truncated to "Leaderbo…" / "Multiplie…". The
// cost was that the app called the same feature different things depending
// on your screen width: the mobile tab said "Boosts", the page title said
// "Set your multipliers", and the plate inside it said "Event multipliers".
// "Boost" also appears nowhere in docs/PRODUCT_SPEC.md, which uses
// "multiplier" throughout — and per CLAUDE.md the spec is the source of
// truth for this vocabulary, so the invented word is the one that goes.
//
// The width problem is now solved by showing the label only on the ACTIVE
// mobile tab (see below) rather than by shortening the word.
const STATIC_LINKS = [
  { href: "/", label: "Leaderboard", icon: Medal },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/multipliers", label: "Multipliers", icon: Sliders },
  { href: "/bets", label: "Bets", icon: Coins },
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
/** Shared classes for every tab, link or button alike, so the new
 * dialog-triggering "switch player" tab reads identically to the rest of
 * the bar instead of standing out as a different control. */
function tabClassName(active: boolean) {
  return cn(
    // Mobile: only the ACTIVE tab spends width on its label, so it grows to
    // fit the word while the other four collapse to icon-only squares. Every
    // tab used to be `flex-1` with a stacked icon-over-label, which is what
    // forced the labels to be short enough for a ~70px column in the first
    // place ("Ranking", "Boosts") — the compromise that made the app call
    // the same feature two different names. Growing one tab instead means
    // the real word always fits, and the four inactive tabs end up with a
    // wider, squarer touch target than the cramped columns they replaced.
    "flex items-center justify-center gap-1.5 rounded-xl py-2.5 transition-colors",
    "hud-label",
    active ? "flex-1 px-3" : "flex-none px-3.5",
    "sm:font-display sm:flex-none sm:flex-row sm:items-center sm:gap-1.5 sm:rounded-md sm:px-3 sm:py-1.5 sm:text-xs sm:tracking-wider sm:uppercase",
    active
      ? // A small glow on the active mobile tab (real shadow-* utilities,
        // so the desktop row can override it), and the full gold cursor
        // treatment on the desktop pill — the same `.is-cursor` the roster
        // strip uses for "you are here," rather than a second, unrelated
        // active style.
        "bg-primary/10 text-primary shadow-[0_0_0_1px_var(--primary),0_0_10px_-2px_var(--primary)] sm:is-cursor sm:bg-primary sm:text-primary-foreground"
      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground sm:bevel-raised sm:bg-card",
  );
}

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();
  const players = useGameStore((s) => s.players);
  const selectedPlayerId = useSessionStore((s) => s.selectedPlayerId);
  const clearSelectedPlayer = useSessionStore((s) => s.clearSelectedPlayer);
  const selectedPlayer = players.find((p) => p.id === selectedPlayerId);
  const isGroom = selectedPlayer?.name === "Matthew";
  const [switchOpen, setSwitchOpen] = useState(false);

  const colorByPlayer = players.length
    ? assignPlayerColors(
        [...players]
          .sort((a, b) => a.id.localeCompare(b.id))
          .map((p) => ({ id: p.id, state: p.state ?? "" })),
        "dark",
      )
    : {};

  function switchPlayer() {
    setSwitchOpen(false);
    clearSelectedPlayer();
    router.push("/start");
  }

  return (
    <>
      <nav
        className={cn(
          "bevel-raised bg-card nav-inset-safe fixed z-50 flex items-center justify-around gap-1 rounded-2xl px-2 py-2",
          "sm:static sm:inset-auto sm:z-auto sm:flex-wrap sm:justify-center sm:gap-2 sm:rounded-none sm:bg-transparent sm:px-0 sm:py-0 sm:shadow-none",
        )}
      >
        {STATIC_LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              // On the mobile bar an inactive tab shows no text, so it needs
              // an accessible name of its own. This does NOT recreate the
              // WCAG 2.5.3 "Label in Name" problem the previous short labels
              // had: that rule is about an aria-label disagreeing with
              // VISIBLE text, and here there is none to disagree with. On
              // `sm:` and up the label is always rendered, and an aria-label
              // identical to the visible text is harmless.
              aria-label={label}
              className={tabClassName(active)}
            >
              <Icon className="size-5 sm:size-4" strokeWidth={active ? 2.5 : 2} />
              {/* Only the active tab spends horizontal room on its word.
                  That's what lets every tab use the app's real vocabulary
                  instead of a squeezed synonym, and it gives the four
                  inactive tabs a wider, easier touch target. */}
              <span className={cn("truncate sm:hidden", !active && "sr-only")}>{label}</span>
              <span className="hidden sm:inline">{label}</span>
            </Link>
          );
        })}

        {/* Last tab: Matthew (the groom) gets a real link to the groom
            tools page — same tab everyone used to see, just renamed and
            reserved for him now that picking him at /select already asks
            for the groom PIN. Everyone else gets their own name/photo, not
            a link at all — tapping it opens a lightweight "switch player"
            dialog instead of navigating to the groom's admin page. */}
        {isGroom ? (
          <Link
            href="/setup"
            aria-label="Tools"
            className={tabClassName(pathname === "/setup")}
          >
            <Wrench className="size-5 sm:size-4" strokeWidth={pathname === "/setup" ? 2.5 : 2} />
            <span className={cn("truncate sm:hidden", pathname !== "/setup" && "sr-only")}>
              Tools
            </span>
            <span className="hidden sm:inline">Tools</span>
          </Link>
        ) : selectedPlayer ? (
          <button type="button" onClick={() => setSwitchOpen(true)} className={tabClassName(false)}>
            {selectedPlayer.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selectedPlayer.photo_url}
                alt=""
                className="size-5 shrink-0 rounded-full border-2 object-cover sm:size-4"
                style={{ borderColor: colorByPlayer[selectedPlayer.id] }}
              />
            ) : (
              <UserRound className="size-5 sm:size-4" />
            )}
            <span className="truncate sm:hidden">{selectedPlayer.name}</span>
            <span className="hidden sm:inline">{selectedPlayer.name}</span>
          </button>
        ) : (
          <Link
            href="/setup"
            aria-label="Player settings"
            className={tabClassName(pathname === "/setup")}
          >
            <UserRound className="size-5 sm:size-4" strokeWidth={pathname === "/setup" ? 2.5 : 2} />
            <span className={cn("truncate sm:hidden", pathname !== "/setup" && "sr-only")}>
              Player settings
            </span>
            <span className="hidden sm:inline">Player settings</span>
          </Link>
        )}
      </nav>

      <Dialog open={switchOpen} onOpenChange={setSwitchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Playing as {selectedPlayer?.name}
            </DialogTitle>
            <DialogDescription>
              Not you, or handing the device to someone else? Switch to a different competitor.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSwitchOpen(false)}>
              Cancel
            </Button>
            <Button onClick={switchPlayer}>Switch player</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
