import { cn } from "@/lib/utils";

/**
 * The control legend that ran along the bottom of every console menu.
 *
 * It's a genuine affordance, not decoration: this UI is driven by a cursor
 * rather than a pointer, and the legend is how anyone picking up the app knows
 * that. Each entry pairs the button glyph with what it does *on this screen*,
 * which is exactly what those strips did.
 */

export type LegendEntry = {
  /** "A", "B", "START", "↑↓" … */
  button: string;
  action: string;
  /** N64 face buttons were colour-coded; A was blue, B was green. */
  tone?: "a" | "b" | "neutral";
};

const TONE_STYLES: Record<NonNullable<LegendEntry["tone"]>, string> = {
  a: "bg-accent text-accent-foreground",
  b: "bg-chart-4 text-foreground",
  neutral: "bg-muted text-foreground",
};

export function ButtonLegend({
  entries,
  className,
}: {
  entries: LegendEntry[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-5 gap-y-2",
        className
      )}
    >
      {entries.map((entry) => (
        <span key={entry.button + entry.action} className="flex items-center gap-2">
          <span
            className={cn(
              "grid min-w-7 place-items-center rounded-full border-2 border-bevel-dark px-2 py-0.5",
              "font-display text-[11px] leading-none tracking-wider",
              TONE_STYLES[entry.tone ?? "neutral"]
            )}
          >
            {entry.button}
          </span>
          <span className="font-display text-[11px] tracking-widest text-muted-foreground uppercase">
            {entry.action}
          </span>
        </span>
      ))}
    </div>
  );
}
