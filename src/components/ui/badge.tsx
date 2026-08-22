import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Status chip, in the console register.
 *
 * These carry real state all over the app — "Done" on an event tile,
 * "+10%" catch-up on the standings, "Alive — worth 100 pts" and "Awaiting
 * result" on `/bets`, won/lost/voided on the bets list — and as stock
 * shadcn they were the only thin-hairline rounded objects left in a UI
 * otherwise built entirely from beveled plates. That mismatch is loud
 * precisely because they sit next to real plates (a badge beside the
 * beveled Edit/Cancel pair on `/bets` was the clearest case), and it made
 * a few of them read as tappable controls rather than as status.
 *
 * Restyled at the primitive rather than at the ~10 call sites, which is the
 * same route `button.tsx` and `card.tsx` already took to get the bevel
 * treatment — one edit, and every badge in the app inherits it.
 *
 * `bevel-sunken` is shadow-only and needs a fill alongside it (see
 * globals.css): the coloured variants bring their own, and `outline` — the
 * neutral one — uses `bg-sunken`, so an unfilled chip reads as a recess in
 * the plate behind it rather than as a floating outline.
 */
const badgeVariants = cva(
  [
    "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm px-2 py-1 whitespace-nowrap",
    // The one label register — a status chip is a label like any other, and
    // 11px caps reads better outdoors than the 12px sentence case it was.
    "hud-label",
    "bevel-sunken border-0 transition-[color,box-shadow] [&>svg]:size-3",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive: "bg-destructive text-white [a&]:hover:bg-destructive/90",
        outline:
          "bg-sunken text-muted-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

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
