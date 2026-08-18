import { cn } from "@/lib/utils";

/**
 * The chunky beveled page title used on every core screen's header — the
 * same `text-shadow`-as-3D-bevel trick `/start`'s logo uses (docs/VISUAL_SPEC.md),
 * scaled down for an in-page heading instead of a full title screen and
 * recolored for `--foreground`-on-`--background` instead of `/start`'s
 * `--background`-on-dark-stage, since these headers sit on whatever the
 * groom's chosen theme (`src/lib/themes.ts`) actually looks like — Classic,
 * Olympic, Doom 64, whichever. Only `var(--primary)`/`var(--accent)` drive
 * the bevel color, same as `/start`, so it reads correctly against any of
 * the eight themes without a component-level change.
 *
 * This is the intentionally-scoped piece of the N64 direction that extends
 * past `/start`/`/select`: the headline treatment, not a wholesale
 * dark-stage reskin of every Card/Table on these pages — that would compete
 * with the theme picker being a real, groom-facing feature, which felt like
 * a bigger call to make unilaterally than "give every page the same title
 * treatment the boot screen already has."
 */
export function PageHeading({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h1
      className={cn(
        "text-foreground text-2xl font-black tracking-tight italic uppercase sm:text-3xl",
        className,
      )}
      style={{
        textShadow: "2px 2px 0 var(--primary), 4px 4px 0 var(--accent)",
      }}
    >
      {children}
    </h1>
  );
}
