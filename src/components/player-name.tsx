import * as React from "react";
import Image from "next/image";
import { UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A player's name with their photo avatar beside it — the standard way a
 * competitor is shown anywhere in the app (medal table, betting screens,
 * score entry). The photo is the primary visual identifier; state flags
 * were dropped from the UI (the `state` prop is still accepted so call
 * sites don't need to change, kept only as accessible metadata).
 */

export type PlayerNameSize = "sm" | "md" | "lg";

const AVATAR_PX: Record<PlayerNameSize, number> = { sm: 24, md: 32, lg: 40 };

export interface PlayerNameProps extends React.ComponentProps<"span"> {
  name: string;
  /** No longer rendered as a visual flag — kept for the accessible label only. */
  state?: string;
  /** Optional nickname, shown muted after the name. */
  nickname?: string | null;
  /** Optional uploaded photo URL — shown as a small circular avatar. */
  photoUrl?: string | null;
  size?: PlayerNameSize;
  /** This player's own chartColors.ts hue, used as the avatar ring color —
   * the same color as their rank badge/chart line everywhere else in the
   * app. Falls back to the theme's gold accent when not passed, so call
   * sites that don't have a per-player color handy still render sensibly. */
  color?: string;
}

export function PlayerName({
  name,
  state,
  nickname,
  photoUrl,
  size = "md",
  color,
  className,
  ...props
}: PlayerNameProps) {
  const px = AVATAR_PX[size];
  const ringStyle = color ? { borderColor: color } : undefined;
  const ringClassName = color ? undefined : "border-primary/60";
  return (
    // `min-w-0`: this needs to be shrinkable, not just its name span, or a
    // long name inside a fixed-width table column (event-odds-betting.tsx,
    // placed-bets-table.tsx) pushes the whole row wider than its column
    // instead of eliding — an `inline-flex` item is exactly as wide as its
    // content by default, `min-w-0` is what lets a flex/grid ancestor
    // actually shrink it below that. Harmless where nothing constrains
    // width (the common case): `truncate` on the name span only shows an
    // ellipsis once something upstream actually clips it.
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)} {...props}>
      {/* A thin bordered ring — a small nod to game-portrait framing without
          the full bevel treatment, which would be too heavy repeated dozens
          of times in a dense list. */}
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt=""
          width={px}
          height={px}
          className={cn("shrink-0 rounded-full border-2 object-cover", ringClassName)}
          style={{ width: px, height: px, ...ringStyle }}
        />
      ) : (
        <span
          className={cn("bg-muted text-muted-foreground flex shrink-0 items-center justify-center rounded-full border-2", ringClassName)}
          style={{ width: px, height: px, ...ringStyle }}
        >
          <UserRound className="size-3" />
        </span>
      )}
      <span className="min-w-0 truncate font-medium">{name}</span>
      {nickname ? (
        <span className="text-muted-foreground truncate text-sm">“{nickname}”</span>
      ) : null}
      {state ? <span className="sr-only">{`, repping ${state}`}</span> : null}
    </span>
  );
}
