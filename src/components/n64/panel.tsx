import { cn } from "@/lib/utils";

/**
 * A titled section plate — the in-screen grouping unit for the content-heavy
 * screens (`/bets`, `/setup`).
 *
 * This is `Card` + `CardHeader` + `CardTitle` + `CardDescription` collapsed
 * into the one shape those screens actually used every single time, but in
 * the console register the rest of the app speaks: the heading is
 * `font-display`, uppercase and tracked (matching the roster strip labels
 * and the screen subtitles) rather than shadcn's default
 * sentence-case `font-semibold`, and an icon sits in a small sunken well so
 * it reads as an inset chip rather than free-floating next to the words.
 *
 * Deliberately not a replacement for `Card` app-wide — `Card` is still the
 * right primitive where something genuinely is a plain container (dialogs,
 * the event detail panel). This is for "a labelled section of a screen".
 */
export function Panel({
  title,
  description,
  icon: Icon,
  iconClassName,
  action,
  children,
  className,
  contentClassName,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  /** Recolours the icon — the panel's own accent isn't always right (a
   *  destructive section's warning glyph shouldn't be gold). */
  iconClassName?: string;
  /** Optional control pinned to the right of the title row. */
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={cn("bevel-raised bg-card rounded-xl p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon ? (
            // A lucide hairline (1.5px at 16px) reads visibly thinner than
            // the 2px hard bevel edge of the well it sits in, which is the
            // "thin line icons against chunky plates" mismatch. Heavier
            // stroke via CSS rather than a `strokeWidth` prop: `Icon` is
            // typed as a bare `{ className }` component here, and a CSS
            // `stroke-width` overrides the SVG presentation attribute
            // anyway, so this works for any glyph passed in.
            <span className="bevel-sunken bg-sunken grid size-8 shrink-0 place-items-center rounded-md [&_svg]:[stroke-width:2.25]">
              <Icon className={cn("text-primary size-[18px]", iconClassName)} />
            </span>
          ) : null}
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="font-display text-[15px] tracking-[0.06em] uppercase">{title}</h2>
            {description ? (
              <p className="hud-copy text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {action}
      </div>
      {children ? (
        <div className={cn("mt-4 flex flex-col gap-3", contentClassName)}>{children}</div>
      ) : null}
    </section>
  );
}
