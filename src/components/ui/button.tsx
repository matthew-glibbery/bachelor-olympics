import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Disabled is an *unlit* plate, not a recessed one.
  //
  // Two previous attempts, both wrong for a different reason. `opacity-50`
  // over the gold primary produced a muddy olive that read as dirty rather
  // than unavailable. Replacing the raised bevel with `bevel-sunken` fixed
  // the colour but broke the affordance: a sunken plate is this app's
  // vocabulary for a *well* — the thing inputs and readouts sit inside — so
  // the most important button on the betting form ("Wager", disabled until
  // you've picked someone) stopped reading as a button at all and looked
  // like a label pressed into the panel.
  //
  // A disabled control still has to look like a control. It keeps the raised
  // plate and loses only its colour: `bg-muted` is a real mid-tone fill, so
  // the button is plainly still a button, plainly just not lit up yet. The
  // `:disabled` pseudo-class outranks the variants' own `bg-primary`, so this
  // replaces the fill for every variant rather than layering over it.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground disabled:border-transparent [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  {
    variants: {
      // bevel-raised goes on every variant that's meant to read as a chunky
      // physical plate (default/destructive/outline/secondary). ghost and
      // link are deliberately flat/textual — bevel-ing them would fight
      // their whole point, so they're left plain.
      variant: {
        default:
          "bevel-raised bg-primary text-primary-foreground hover:bg-primary/90 active:translate-y-px",
        destructive:
          "bevel-raised bg-destructive text-white hover:bg-destructive/90 active:translate-y-px",
        outline:
          "bevel-raised border bg-background hover:bg-accent hover:text-accent-foreground active:translate-y-px",
        secondary:
          "bevel-raised bg-secondary text-secondary-foreground hover:bg-secondary/80 active:translate-y-px",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
