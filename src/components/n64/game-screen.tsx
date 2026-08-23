import { cn } from "@/lib/utils";
import { AppNav } from "@/components/app-nav";
import { Starfield } from "@/components/n64/starfield";

/**
 * The shell every in-game screen sits in (docs/VISUAL_SPEC.md).
 *
 * Before this existed, `/`, `/events` and `/multipliers` each hand-repeated
 * the same `min-h-dvh px-4 py-6 pb-28 …` main + centered extruded header,
 * while `/bets` and `/setup` had drifted to an entirely different one
 * (`max-w-2xl`, `min-h-screen`, `pt-12`, a left-aligned italic
 * `PageHeading` left over from the deleted theme-picker era). Two competing
 * page grammars in one app is the single most obvious consistency break
 * there was, so the shell is now one component rather than a convention
 * five files are each trusted to remember.
 *
 * The header is deliberately centered: a console menu titles its screens in
 * the middle, not flush-left like a document. `width` exists because the
 * screens genuinely differ — the multiplier grid wants more room than a
 * betting column — but every option is a fixed step, not a free-for-all.
 */
export function GameScreen({
  title,
  subtitle,
  width = "default",
  tone = "default",
  children,
  className,
}: {
  /** Optional — some screens are their own title. `/events` is the case
   *  that made this optional: its grid of event tiles, and the event detail
   *  it opens into (which carries the event's own name as a heading), both
   *  had a literal "EVENTS" plate above them saying what the Events tab in
   *  the nav directly below it already said. */
  title?: React.ReactNode;
  /** The small tracked uppercase line under the title. */
  subtitle?: React.ReactNode;
  width?: "default" | "wide" | "narrow";
  /** "gold" is reserved for the leaderboard — the trophy screen, and the
   *  only one that should wear the prestige color in its title. */
  tone?: "default" | "gold";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main className="screen-pad-block relative min-h-dvh overflow-hidden px-4 sm:px-8">
      <Starfield className="opacity-60" />

      <div
        className={cn(
          "relative mx-auto flex flex-col gap-5",
          width === "wide" && "max-w-6xl",
          width === "default" && "max-w-4xl",
          width === "narrow" && "max-w-2xl",
          className,
        )}
      >
        <header className="flex flex-col items-center gap-3 text-center">
          {title ? (
            <h1
              className={cn(
                "extruded text-xl sm:text-2xl",
                tone === "gold" && "extruded-gold",
              )}
            >
              {title}
            </h1>
          ) : null}
          {subtitle ? (
            // Tracked uppercase at 10px is already the hardest type on the
            // screen; left full-width it wrapped with a single orphan word on
            // line two on four of five screens. Balanced and capped so it
            // breaks into even lines instead.
            <p className="hud-label text-muted-foreground max-w-[48ch] text-balance">
              {subtitle}
            </p>
          ) : null}
          <AppNav />
        </header>

        {children}
      </div>
    </main>
  );
}
