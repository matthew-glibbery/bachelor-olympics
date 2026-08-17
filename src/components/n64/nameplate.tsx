import { cn } from "@/lib/utils";

/**
 * The chunky name plate that sits under the centre-stage character.
 *
 * Straight out of a character-select screen: name in big extruded caps, the
 * player's assigned color (src/lib/chartColors.ts) running along the top
 * edge as an identity stripe, and the nickname underneath in the register
 * of a box-art epithet.
 */
export function Nameplate({
  name,
  nickname,
  color,
  className,
}: {
  name: string;
  nickname?: string | null;
  color: string;
  className?: string;
}) {
  return (
    <div className={cn("bevel-raised bg-card min-w-64 overflow-hidden rounded-md", className)}>
      <div className="h-1.5 w-full" style={{ backgroundColor: color }} aria-hidden />
      <div className="px-6 py-3 text-center">
        <p className="text-extruded text-3xl leading-none sm:text-4xl">{name}</p>
        {nickname ? (
          <p className="text-primary mt-2 font-display text-[10px] tracking-[0.25em] uppercase">
            &ldquo;{nickname}&rdquo;
          </p>
        ) : null}
      </div>
    </div>
  );
}
