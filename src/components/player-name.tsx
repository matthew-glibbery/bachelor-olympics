import * as React from "react";

import { cn } from "@/lib/utils";
import { Flag, type FlagSize } from "@/components/flag";

/**
 * A player's name with their state flag beside it — the standard way a
 * competitor is shown anywhere in the app (medal table, betting screens, score
 * entry). Keeps flag + name spacing consistent in one place.
 */

export interface PlayerNameProps extends React.ComponentProps<"span"> {
  name: string;
  state: string;
  /** Optional nickname, shown muted after the name. */
  nickname?: string | null;
  size?: FlagSize;
}

export function PlayerName({
  name,
  state,
  nickname,
  size = "md",
  className,
  ...props
}: PlayerNameProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)} {...props}>
      <Flag state={state} size={size} />
      <span className="font-medium">{name}</span>
      {nickname ? (
        <span className="text-muted-foreground text-sm">“{nickname}”</span>
      ) : null}
    </span>
  );
}
