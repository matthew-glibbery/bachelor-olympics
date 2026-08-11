import * as React from "react";

import { cn } from "@/lib/utils";
import { isStateCode, stateName } from "@/lib/states";

/**
 * A player's US-state "flag", shown Olympics-style next to their name.
 *
 * Rendering is deliberately abstracted so we can upgrade it in ONE place. Today
 * it's a lightweight abbreviation chip (the USPS code, token-styled — no assets,
 * renders identically everywhere). To move to real SVG state flags later, swap
 * only the body of `FlagGlyph` below; every call site (`<Flag state="TX" />`)
 * stays untouched.
 */

const SIZES = {
  sm: "h-4 min-w-6 px-1 text-[10px]",
  md: "h-5 min-w-7 px-1.5 text-[11px]",
  lg: "h-6 min-w-9 px-2 text-xs",
} as const;

export type FlagSize = keyof typeof SIZES;

export interface FlagProps extends React.ComponentProps<"span"> {
  /** Two-letter USPS state code, e.g. "TX". */
  state: string;
  size?: FlagSize;
}

/** The swappable rendering seam. Replace this body with an <svg>/<img> later. */
function FlagGlyph({ state, size }: { state: string; size: FlagSize }) {
  const code = state.toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-sm border bg-secondary font-semibold tracking-wide text-secondary-foreground tabular-nums",
        SIZES[size]
      )}
    >
      {code}
    </span>
  );
}

/** Flag chip for a player's state. Falls back gracefully on an unknown code. */
export function Flag({ state, size = "md", className, ...props }: FlagProps) {
  const known = isStateCode(state.toUpperCase());
  return (
    <span
      data-slot="flag"
      role="img"
      aria-label={known ? stateName(state.toUpperCase()) : `Unknown state: ${state}`}
      title={known ? stateName(state.toUpperCase()) : state}
      className={cn("shrink-0", className)}
      {...props}
    >
      <FlagGlyph state={state} size={size} />
    </span>
  );
}
