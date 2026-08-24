"use client";

import { Lock, Minus, Plus } from "lucide-react";

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

/** 1 -> "1st", 2 -> "2nd" … English ordinals, teens handled. */
function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
  return `${n}${suffix}`;
}

export type MultiplierBarProps = {
  label: string;
  value: number;
  /** Player's assigned categorical color (chartColors.ts), e.g. "#2a78d6". */
  color: string;
  /** Locked once the event starts being scored — see PRODUCT_SPEC. */
  locked?: boolean;
  /**
   * Where the groom's ranking for this event puts this player (1-indexed),
   * or null if he hasn't ranked it. This is the single most useful thing to
   * know while deciding where to spend multiplier — a 1.5 on an event you're
   * projected to win is worth far more than a 1.5 on one you're projected to
   * finish last in — and it isn't a secret: the same ranking is already
   * public on each event's Odds tab, which lists the field in rank order.
   */
  projectedPosition?: number | null;
  onChange: (next: number) => void;
  className?: string;
};

export function MultiplierBar({
  label,
  value,
  color,
  locked = false,
  projectedPosition = null,
  onChange,
  className,
}: MultiplierBarProps) {
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

  const valueClass = cn(
    "font-score shrink-0 text-right text-sm tabular-nums",
    delta > 0 && "text-primary",
    delta < 0 && "text-muted-foreground",
  );

  // Below `sm` this is a two-row layout — name and value on one line, the
  // bar full-width underneath — because beside the bar, real event names
  // ("Super Smash Bros. (N64)", "Nine Holes of Golf") truncated to
  // "SUPER SMAS…", so the row you were adjusting was the one row you
  // couldn't identify. From `sm` up it's a single row.
  //
  // That column was a flat `w-28` (112px), which was NOT in fact enough for
  // the longest name: at 1280px four of the eight rows still truncated
  // ("NINE HOLES OF…", "BEACH VOLLEY…", "SUPER SMASH …", "SETTLERS OF C…")
  // while ~600px of the viewport sat empty to the right. It widens with the
  // breakpoint now, since the room is there to spend.
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 px-3 py-2 sm:flex-row sm:items-center sm:gap-3",
        locked && "opacity-70",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 sm:contents">
        <span className="hud-label flex min-w-0 shrink items-center gap-1.5 sm:w-40 sm:shrink-0 lg:w-56">
          {/* The lock icon plus the segments' own desaturated colour (below)
              carry this now — a text "Locked" badge alongside both read as
              redundant. */}
          {locked ? <Lock className="text-muted-foreground size-3 shrink-0" /> : null}
          <span className="truncate">{label}</span>
          {projectedPosition != null ? (
            // Abbreviated, because it shares a line with an event name that
            // is already truncating on a phone. `title` carries the full
            // wording for anyone unsure what it means.
            <span
              title={`Projected to finish ${ordinal(projectedPosition)} — the groom's ranking for this event`}
              className="bevel-sunken text-muted-foreground shrink-0 rounded-sm px-1.5 py-0.5 text-[0.625rem] leading-none"
            >
              PROJ {ordinal(projectedPosition).toUpperCase()}
            </span>
          ) : null}
        </span>
        {/* The value rides beside the name on the stacked mobile layout and
            moves to the end of the row on `sm` — `sm:contents` drops this
            wrapper out of the layout so the parent flex row lays out the
            name, bar and value as siblings, in that order. */}
        <span className={cn(valueClass, "sm:hidden")}>
          {value.toFixed(1)}×
        </span>
      </div>

      {/* Coarse step controls flanking the track.

          The segments themselves are ~30px wide — eleven of them have to
          share a phone's width, so no amount of layout work makes a single
          notch a comfortable 44px target. This app is used outdoors by
          people several drinks in, and a mis-tap here silently moves real
          budget, so precision tapping needs a fallback rather than just a
          bigger version of itself. These two give every adjustment a large,
          unambiguous target; tapping a segment directly still works for
          anyone who wants to jump straight to a value.

          `tabIndex={-1}` + `aria-hidden` for the same reason the segment
          buttons already carry them: the `role="slider"` below is the one
          accessible control, with the full valuemin/max/now semantics and
          arrow-key handling. Exposing these as extra tab stops would give
          the same control three focusable entry points and interfere with
          the screen's own D-pad row navigation. */}
      <div className="flex flex-1 items-center gap-2">
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          disabled={locked}
          onClick={() => attempt(currentIndex - 1)}
          className="bevel-raised bg-card grid size-9 shrink-0 place-items-center rounded-md active:translate-y-px disabled:bg-muted disabled:text-muted-foreground"
        >
          <Minus className="size-4" />
        </button>

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
          "bevel-sunken bg-sunken flex flex-1 gap-[3px] rounded-sm p-[3px]",
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
                "h-9 flex-1 rounded-[2px] border transition-colors duration-75",
                isBaseline ? "border-foreground/70" : "border-bevel-dark/60",
                !filled && "bg-bevel-dark/45",
              )}
              style={
                filled
                  ? {
                      // Locked segments are desaturated to a flat grey
                      // instead of the player's colour or the gold
                      // above-baseline treatment — colour reads as "live and
                      // editable" everywhere else in this app, so a locked
                      // bar keeping full colour undercut the point of also
                      // labelling it locked. Past the baseline on an
                      // unlocked bar the segment turns gold: that's
                      // borrowed multiplier, and it should look like it.
                      backgroundColor: locked
                        ? "var(--muted-foreground)"
                        : aboveBaseline
                          ? "var(--primary)"
                          : color,
                    }
                  : undefined
              }
            />
          );
        })}
      </div>

        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          disabled={locked}
          onClick={() => attempt(currentIndex + 1)}
          className="bevel-raised bg-card grid size-9 shrink-0 place-items-center rounded-md active:translate-y-px disabled:bg-muted disabled:text-muted-foreground"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <span className={cn(valueClass, "hidden w-16 sm:block")}>
        ×{value.toFixed(1)}
      </span>
    </div>
  );
}
