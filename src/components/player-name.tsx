import * as React from "react";
import Image from "next/image";
import { UserRound } from "lucide-react";

import { cn } from "@/lib/utils";
import { Flag, type FlagSize } from "@/components/flag";

/**
 * A player's name with their state flag beside it — the standard way a
 * competitor is shown anywhere in the app (medal table, betting screens, score
 * entry). Keeps flag + name spacing consistent in one place.
 */

const AVATAR_PX: Record<FlagSize, number> = { sm: 20, md: 24, lg: 28 };

export interface PlayerNameProps extends React.ComponentProps<"span"> {
  name: string;
  state: string;
  /** Optional nickname, shown muted after the name. */
  nickname?: string | null;
  /** Optional uploaded photo URL — shown as a small circular avatar. */
  photoUrl?: string | null;
  size?: FlagSize;
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
      <Flag state={state} size={size} />
      <span className="font-medium">{name}</span>
      {nickname ? (
        <span className="text-muted-foreground text-sm">“{nickname}”</span>
      ) : null}
    </span>
  );
}
