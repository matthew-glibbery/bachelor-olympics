import { cn } from "@/lib/utils";

/**
 * A titled section plate — the in-screen grouping unit for the content-heavy
 * screens (`/bets`, `/setup`).
 *
 * This is `Card` + `CardHeader` + `CardTitle` + `CardDescription` collapsed
 * into the one shape those screens actually used every single time, but in
 * the console register the rest of the app speaks: the heading is
 * `font-display`, uppercase and tracked (matching `ButtonLegend`, the roster
 * strip labels, and the screen subtitles) rather than shadcn's default
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
  action,
  children,
  className,
  contentClassName,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  /** Optional control pinned to the right of the title row. */
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  return (
    <section className={cn("bevel-raised bg-card rounded-xl p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          {Icon ? (
            <span className="bevel-sunken grid size-8 shrink-0 place-items-center rounded-md">
              <Icon className="text-primary size-4" />
            </span>
          ) : null}
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="font-display text-sm tracking-wider uppercase">{title}</h2>
            {description ? (
              <p className="text-muted-foreground text-xs leading-relaxed">{description}</p>
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
