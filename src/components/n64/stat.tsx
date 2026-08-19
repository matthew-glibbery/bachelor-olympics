import { cn } from "@/lib/utils";

/**
 * A single sunken readout — small tracked label over a monospace figure.
 *
 * The "numbers live in a recessed slot" idea was already in the app in three
 * hand-rolled variants (the betting reserve pair on `/multipliers`, the
 * budget counter beside the character, the payout preview on the Odds tab),
 * each with its own spacing and type sizes. This is that pattern as one
 * component so a figure reads the same wherever it appears.
 *
 * `font-score` (monospace, tabular) is the rule for anything numeric in this
 * app — a scoreboard figure that reflows its own width as it ticks is the
 * fastest way to make a game UI feel cheap.
 */
export function Stat({
  label,
  value,
  hint,
  tone = "default",
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Optional small line under the figure. */
  hint?: React.ReactNode;
  tone?: "default" | "primary" | "destructive";
  className?: string;
}) {
  return (
    <div className={cn("bevel-sunken bg-sunken flex min-w-0 flex-1 flex-col gap-0.5 rounded-md px-3 py-2", className)}>
      <span className="font-display text-muted-foreground text-[9px] leading-tight tracking-[0.15em] uppercase">
        {label}
      </span>
      <span
        className={cn(
          "font-score text-lg leading-none tabular-nums",
          tone === "primary" && "text-primary",
          tone === "destructive" && "text-destructive",
        )}
      >
        {value}
      </span>
      {hint ? (
        <span className="font-display text-muted-foreground text-[9px] tracking-wider uppercase">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
