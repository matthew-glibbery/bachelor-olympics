"use client";

import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { playSfx } from "@/lib/sfx";
import { MULTIPLIER_DEFAULT, MULTIPLIER_MAX, MULTIPLIER_MIN, MULTIPLIER_STEP } from "@/lib/multipliers/budget";

/**
 * A single event's multiplier, as a segmented stat bar.
 *
 * Deliberately *not* a smooth drag slider. The real range/step (docs/
 * PRODUCT_SPEC.md → Multipliers, src/lib/multipliers/budget.ts) is eleven
 * discrete steps — 0.5 to 1.5 by 0.1 — and a continuous track would imply
 * values that don't exist while making it hard to see how far you are from
 * the 1.0 baseline. Discrete notches are also exactly what the era used for
 * character stats, the reference docs/VISUAL_SPEC.md points at.
 *
 * The baseline notch matters strategically: segments to the right of it are
 * multiplier you've *spent* on this event and have to find elsewhere (or
 * cover from your unspent reserve), and segments to the left are multiplier
 * you've freed up. That tension is the core of the whole game, so the bar
 * is drawn to make it obvious at a glance.
 */

const SEGMENTS = Math.round((MULTIPLIER_MAX - MULTIPLIER_MIN) / MULTIPLIER_STEP) + 1;
const BASELINE_INDEX = Math.round((MULTIPLIER_DEFAULT - MULTIPLIER_MIN) / MULTIPLIER_STEP);

function valueAtIndex(i: number): number {
  return Math.round((MULTIPLIER_MIN + i * MULTIPLIER_STEP) * 10) / 10;
}

function indexOfValue(value: number): number {
  return Math.round((value - MULTIPLIER_MIN) / MULTIPLIER_STEP);
}

export type MultiplierBarProps = {
  label: string;
  value: number;
  /** Player's assigned categorical color (chartColors.ts), e.g. "#2a78d6". */
  color: string;
  /** Locked once the event starts being scored — see PRODUCT_SPEC. */
  locked?: boolean;
  onChange: (next: number) => void;
  className?: string;
};

export function MultiplierBar({ label, value, color, locked = false, onChange, className }: MultiplierBarProps) {
  const currentIndex = indexOfValue(value);

  function attempt(nextIndex: number) {
    if (locked) {
      playSfx("deny");
      return;
    }
    const clamped = Math.max(0, Math.min(SEGMENTS - 1, nextIndex));
    if (clamped === currentIndex) {
      playSfx("deny");
      return;
    }
    playSfx("move");
    onChange(valueAtIndex(clamped));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    // Left/right adjust the value; up/down are deliberately left alone so
    // they bubble up to the screen's own handler and move between events —
    // splitting the axes is what lets one D-pad both pick a row and set
    // its value.
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        e.stopPropagation();
        attempt(currentIndex - 1);
        break;
      case "ArrowRight":
        e.preventDefault();
        e.stopPropagation();
        attempt(currentIndex + 1);
        break;
      case "Home":
        e.preventDefault();
        attempt(0);
        break;
      case "End":
        e.preventDefault();
        attempt(SEGMENTS - 1);
        break;
    }
  }

  const delta = value - MULTIPLIER_DEFAULT;

  // The label stacks above the bar on a phone: at `w-28` beside it, real
  // event names ("Super Smash Bros. (N64)", "Nine Holes of Golf") truncated
  // to "SUPER SMAS…", so the row you were adjusting was the one row you
  // couldn't identify. Side-by-side from `sm` up, where 112px is enough.
  return (
    <div
      className={cn(
        "flex flex-col items-stretch gap-1.5 px-3 py-2 sm:flex-row sm:items-center sm:gap-3",
        locked && "opacity-70",
        className,
      )}
    >
      <span className="font-display flex shrink-0 items-center gap-1.5 text-xs tracking-wider uppercase sm:w-28">
        {locked ? <Lock className="text-muted-foreground size-3 shrink-0" /> : null}
        <span className="truncate">{label}</span>
      </span>

      <div
        role="slider"
        tabIndex={locked ? -1 : 0}
        aria-label={`${label} multiplier`}
        aria-valuemin={MULTIPLIER_MIN}
        aria-valuemax={MULTIPLIER_MAX}
        aria-valuenow={value}
        aria-valuetext={`${value.toFixed(1)} times`}
        aria-disabled={locked || undefined}
        onKeyDown={onKeyDown}
        className={cn(
          "bevel-sunken flex flex-1 gap-[3px] rounded-sm p-[3px]",
          !locked && "cursor-pointer focus-visible:is-cursor focus-visible:outline-none",
        )}
      >
        {Array.from({ length: SEGMENTS }, (_, i) => {
          const filled = i <= currentIndex;
          const aboveBaseline = i > BASELINE_INDEX;
          const isBaseline = i === BASELINE_INDEX;

          return (
            <button
              key={i}
              type="button"
              tabIndex={-1}
              aria-hidden
              disabled={locked}
              onClick={() => attempt(i)}
              className={cn(
                "h-6 flex-1 rounded-[2px] border transition-colors duration-75",
                isBaseline ? "border-foreground/70" : "border-bevel-dark/60",
                !filled && "bg-bevel-dark/45",
              )}
              style={
                filled
                  ? {
                      // Past the baseline the segment turns gold: this is
                      // borrowed multiplier, and it should look like it.
                      backgroundColor: aboveBaseline ? "var(--primary)" : color,
                    }
                  : undefined
              }
            />
          );
        })}
      </div>

      <span
        className={cn(
          "font-score w-16 shrink-0 text-right text-sm tabular-nums",
          delta > 0 && "text-primary",
          delta < 0 && "text-muted-foreground",
        )}
      >
        ×{value.toFixed(1)}
      </span>
    </div>
  );
}
