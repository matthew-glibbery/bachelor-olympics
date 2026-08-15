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

const AVATAR_PX: Record<PlayerNameSize, number> = { sm: 20, md: 24, lg: 28 };

export interface PlayerNameProps extends React.ComponentProps<"span"> {
  name: string;
  /** No longer rendered as a visual flag — kept for the accessible label only. */
  state?: string;
  /** Optional nickname, shown muted after the name. */
  nickname?: string | null;
  /** Optional uploaded photo URL — shown as a small circular avatar. */
  photoUrl?: string | null;
  size?: PlayerNameSize;
}

export function PlayerName({
  name,
  state,
  nickname,
  photoUrl,
  size = "md",
  className,
  ...props
}: PlayerNameProps) {
  const px = AVATAR_PX[size];
  return (
    <span className={cn("inline-flex items-center gap-2", className)} {...props}>
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt=""
          width={px}
          height={px}
          className="shrink-0 rounded-full object-cover"
          style={{ width: px, height: px }}
        />
      ) : (
        <span
          className="bg-muted text-muted-foreground flex shrink-0 items-center justify-center rounded-full"
          style={{ width: px, height: px }}
        >
          <UserRound className="size-3" />
        </span>
      )}
      <span className="font-medium">{name}</span>
      {nickname ? (
        <span className="text-muted-foreground text-sm">“{nickname}”</span>
      ) : null}
      {state ? <span className="sr-only">{`, repping ${state}`}</span> : null}
    </span>
  );
}
