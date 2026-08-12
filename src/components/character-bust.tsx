import Image from "next/image";
import { UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The big centered "3D character render" on the boot/select screens
 * (docs/visual_spec.md). Today this is a placeholder: the player's uploaded
 * photo (or a silhouette if they don't have one) in a thick-outlined plate,
 * subtly idling via the `idle-bob` keyframes (globals.css) so the screen
 * feels alive even before any interaction — matching the spec's "breathing
 * loop" note.
 *
 * **Swap seam**: once the Nano Banana character renders exist (per the
 * spec's pipeline), replace `photoUrl` here with that stylized render URL —
 * every call site stays the same, same pattern as `Flag`'s `FlagGlyph` seam.
 */
export interface CharacterBustProps {
  name: string;
  photoUrl?: string | null;
  /** Player's assigned categorical color (chartColors.ts) — used as the
   * plate's ring/glow so the bust visually matches their roster swatch. */
  color: string;
  size?: "sm" | "lg" | "xl";
  idle?: boolean;
  className?: string;
}

const SIZE_PX: Record<NonNullable<CharacterBustProps["size"]>, number> = {
  sm: 64,
  lg: 160,
  xl: 240,
};

export function CharacterBust({
  name,
  photoUrl,
  color,
  size = "xl",
  idle = true,
  className,
}: CharacterBustProps) {
  const px = SIZE_PX[size];
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[2rem] border-4 bg-card",
        idle && "animate-[idle-bob_3.6s_ease-in-out_infinite]",
        className,
      )}
      style={{
        width: px,
        height: px,
        borderColor: color,
        boxShadow: `0 0 0 6px color-mix(in oklch, ${color} 20%, transparent), 0 12px 28px -8px color-mix(in oklch, ${color} 60%, transparent)`,
      }}
    >
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt=""
          width={px}
          height={px}
          className="size-full rounded-[1.6rem] object-cover"
        />
      ) : (
        <UserRound style={{ color }} className="size-2/3" strokeWidth={1.5} />
      )}
      <span className="sr-only">{name}</span>
    </div>
  );
}
