"use client";

import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { MULTIPLIER_STEP, stepAmount, stepsWithin } from "@/lib/multipliers/budget";

/**
 * A wager amount as two big thumb-targets and a readout, not a number field.
 *
 * This app is played on a phone, one-handed, outdoors, usually while
 * something else is going on — and a `<input type="number">` there means
 * summoning the numeric keyboard over half the screen, typing a value with
 * one decimal place, and dismissing it again, all to enter one of the ~10
 * legal amounts a wager can actually be. Wagers move in fixed
 * `MULTIPLIER_STEP` increments off a small reserve (PRODUCT_SPEC.md →
 * Per-event multiplier betting), so every reachable value is a couple of
 * taps away from either end. Stepping is strictly better here.
 *
 * Clamping lives in this component rather than in each caller's submit
 * handler: `max` is the caller's own reserve math, and the point of a
 * stepper is that an out-of-range value is unreachable in the first place,
 * not rejected after the fact.
 */
export function WagerStepper({
  value,
  max,
  onChange,
  disabled = false,
  className,
}: {
  /** Current wager. 0 means "nothing staked yet". */
  value: number;
  /** Most this player can stake right now (their unallocated reserve). Need
   *  not be on the 0.1 grid — the top reachable step is floored to fit it. */
  max: number;
  onChange: (next: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  // Counted in whole steps, not added to as floats. Two different float
  // problems bite here and integer steps kill both: a displayed figure
  // drifting ("1.7999999999999998"), and — the one that actually broke the
  // form — a ceiling derived by *rounding* the cap, which could round UP past
  // the real reserve and offer a top step the submit button then rejected.
  // `stepsWithin` floors, so the top step always fits. See budget.ts.
  const maxSteps = stepsWithin(max);
  const steps = Math.round(value / MULTIPLIER_STEP);

  const canDown = !disabled && steps > 0;
  const canUp = !disabled && steps < maxSteps;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <StepButton
        label="Decrease wager"
        onClick={() => onChange(stepAmount(Math.max(0, steps - 1)))}
        disabled={!canDown}
      >
        <Minus className="size-4" />
      </StepButton>

      {/* The figure sits in the same sunken well every other readout in the
          app uses, so it reads as a value being adjusted rather than as a
          third button between two buttons. */}
      <span
        className="bevel-sunken bg-sunken font-score grid h-9 min-w-16 place-items-center rounded-md px-2 text-base tabular-nums"
        aria-live="polite"
      >
        {value.toFixed(1)}
      </span>

      <StepButton
        label="Increase wager"
        onClick={() => onChange(stepAmount(Math.min(maxSteps, steps + 1)))}
        disabled={!canUp}
      >
        <Plus className="size-4" />
      </StepButton>
    </div>
  );
}

/** Deliberately not `Button`: these are square 36px plates whose whole job
 *  is to be hit with a thumb, and `Button`'s size scale has no square
 *  variant that isn't `size-9` with icon-only padding assumptions. Same
 *  bevel language, sized for touch. */
function StepButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "bevel-raised bg-secondary text-secondary-foreground grid size-9 shrink-0 place-items-center rounded-md transition-all",
        "active:translate-y-px",
        "focus-visible:is-cursor focus-visible:outline-none",
        // Still a plate when it can't be used — see button.tsx's disabled
        // treatment for why an unavailable control here stays raised.
        "disabled:bg-muted disabled:text-muted-foreground disabled:pointer-events-none",
      )}
    >
      {children}
    </button>
  );
}
