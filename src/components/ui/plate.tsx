import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * A raised beveled surface for anything that isn't already a `Card` — e.g.
 * wrapping `AppNav`'s floating bar. Shares the exact same `.bevel-raised`
 * CSS (globals.css) that `Card`/`Button`/`DialogContent` use, so there's one
 * bevel implementation in the whole app, not several drifting copies.
 */
function Plate({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="plate"
      className={cn("bevel-raised bg-card text-card-foreground rounded-xl", className)}
      {...props}
    />
  );
}

export { Plate };
