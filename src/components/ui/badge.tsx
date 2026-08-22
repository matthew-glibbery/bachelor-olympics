import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Status tag — "In progress", "Absolute", "+30%", "Done", "Awaiting result",
 * "Alive — worth 100 pts", won/lost/voided.
 *
 * These are the one family in the app that is deliberately NOT a beveled
 * plate. Almost every other surface here is raised or sunken chrome, and
 * giving these a bevel too (an earlier pass did) stopped them reading as
 * annotation and started them reading as small physical controls — a real
 * problem where they sit beside actual buttons, as "Awaiting result" does
 * next to Edit/Cancel on /bets, because it made a status look pressable.
 * A tag is a label printed ON a plate, not another plate.
 *
 * The flat treatment lives in the `tag` utility in globals.css; the
 * variants here only choose a `--tag-color`, so border, tint and text all
 * move together and can't drift out of sync. Every variant is the same
 * object in a different hue, which is what makes them read as one family
 * rather than four unrelated chips.
 */
const badgeVariants = cva("tag hud-label [&>svg]:size-3", {
  variants: {
    variant: {
      /** Notable / positive — a resolved event, a won bet, a catch-up bonus. */
      default: "[--tag-color:var(--primary)]",
      /** Quiet metadata — scoring mode, "Done", "Not started". */
      secondary: "[--tag-color:var(--muted-foreground)]",
      /** Bad or urgent — a lost bet, an event live right now. */
      destructive: "[--tag-color:var(--destructive)]",
      /** Neutral, pending — "Awaiting result", "Voided". */
      outline: "[--tag-color:var(--muted-foreground)]",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
