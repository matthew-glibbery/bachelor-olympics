import Image from "next/image";
import { UserRound } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The big centered "3D character render" on the boot/select screens
 * (docs/visual_spec.md). Today this is mostly a placeholder: the player's
 * uploaded photo (or a silhouette if they don't have one) in a
 * thick-outlined plate, subtly idling via the `idle-bob` keyframes
 * (globals.css) so the screen feels alive even before any interaction —
 * matching the spec's "breathing loop" note. The idle-bob is skipped when a
 * real video is playing (`videoUrl`) — the clip itself carries the motion.
 *
 * **Swap seam**: `videoUrl` (character_select_video_url /
 * character_fullbody_video_url, uploaded per player in groom tools) takes
 * priority over `photoUrl` the moment a real Nano Banana + Seedance clip
 * exists for that player — every call site stays the same. Falls back to
 * `photoUrl`, then a silhouette.
 */
export interface CharacterBustProps {
  name: string;
  /** Real character clip (docs/VISUAL_SPEC.md) — takes priority over `photoUrl`. */
  videoUrl?: string | null;
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
  videoUrl,
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
        idle && !videoUrl && "animate-[idle-bob_3.6s_ease-in-out_infinite]",
        className,
      )}
      style={{
        width: px,
        height: px,
        borderColor: color,
        boxShadow: `0 0 0 6px color-mix(in oklch, ${color} 20%, transparent), 0 12px 28px -8px color-mix(in oklch, ${color} 60%, transparent)`,
      }}
    >
      {videoUrl ? (
        <video
          key={videoUrl}
          src={videoUrl}
          autoPlay
          loop
          muted
          playsInline
          className="size-full rounded-[1.6rem] object-cover"
        />
      ) : photoUrl ? (
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
