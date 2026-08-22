"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * A competitor's character model on /start and /select.
 *
 * Three-tier swap seam, in priority order: a real character clip
 * (`videoUrl` — `character_select_video_url` / `character_fullbody_video_url`,
 * uploaded per player in groom tools) beats an uploaded photo (`photoUrl`),
 * which beats a procedural low-poly stand-in drawn from the player's
 * assigned color (src/lib/chartColors.ts). Per docs/VISUAL_SPEC.md, the
 * Nano Banana/Seedance pass hasn't been run yet — the procedural render is
 * what actually shows today, at least giving the right *shape* of what's
 * coming instead of a plain silhouette. The moment real art exists for a
 * player, it takes over automatically; no screen needs to change.
 *
 * The video element is always mounted once `videoUrl` exists and cross-fades
 * in/out over the base layer via `playing` (opacity + play/pause on a ref)
 * instead of being conditionally mounted — swapping DOM nodes on every hover
 * causes a white flash each way (a fresh <video> paints blank before its
 * first frame decodes). Same pattern as the pre-existing CharacterBust.
 */
export type CharacterRenderProps = {
  name: string;
  nickname?: string | null;
  videoUrl?: string | null;
  photoUrl?: string | null;
  /** Player's assigned categorical color (chartColors.ts), e.g. "#2a78d6". */
  color: string;
  /** Jersey number drawn on the chest in `full` pose — roster position, not a database id. */
  number?: number;
  /** `full` for centre stage, `bust` for the roster strip. */
  pose?: "full" | "bust";
  /** Idle breathing/weight-shift loop. Off for static thumbnails. */
  idle?: boolean;
  /** Whether the video (if any) should be visible/playing right now — e.g.
   * only while hovered/focused for a roster bust. Defaults to true. */
  playing?: boolean;
  className?: string;
};

export function CharacterRender({
  name,
  nickname,
  videoUrl,
  photoUrl,
  color,
  number,
  pose = "full",
  idle = false,
  playing = true,
  className,
}: CharacterRenderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const showVideo = Boolean(videoUrl) && playing;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (showVideo) v.play().catch(() => {});
    else v.pause();
  }, [showVideo]);

  return (
    <div className={cn("relative h-full w-full", className)}>
      {/* A matching glow behind the render — a perfect circle, diameter
          equal to the container's own height, centered. The generated
          clips/images already bake this same radial gradient (the
          player's own color fading to the app's navy) into their pixels,
          but only out to the video's rectangular edge — character-clip-
          mask's circular fade then reveals raw page background past that
          edge, which read as a harsh seam. This picks up exactly where
          the baked-in gradient leaves off instead of cutting straight to
          the starfield. */}
      <div
        aria-hidden
        className="absolute top-1/2 left-1/2 aspect-square h-full -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        }}
      />
      {photoUrl ? (
        /* Uploaded player photo — intrinsic size unknown ahead of time and
           there's a handful of these at most, so next/image's optimizer
           buys nothing; a plain <img> is the right call.

           Faded out while the video is actively showing, not just left
           opaque underneath it: character-clip-mask (globals.css) fades the
           video's own edges to transparency so it blends into whatever's
           behind it — but with the photo always fully opaque here, those
           faded edges revealed the *photo* instead (a different framing/
           crop than the video, white background), showing up as a ghosted
           double-exposure. Hiding the photo while the video plays means the
           mask's transparent edges reveal the real page background, which
           is the point of it. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={name}
          className={cn("h-full w-full object-cover transition-opacity duration-300", showVideo ? "opacity-0" : "opacity-100")}
        />
      ) : (
        <ProceduralBust
          name={name}
          nickname={nickname}
          color={color}
          number={number}
          pose={pose}
          idle={idle}
        />
      )}
      {videoUrl ? (
        <video
          ref={videoRef}
          src={videoUrl}
          loop
          muted
          playsInline
          poster={photoUrl ?? undefined}
          className={cn(
            "character-clip-mask absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
            showVideo ? "opacity-100" : "opacity-0",
          )}
        />
      ) : null}
    </div>
  );
}

/** Small, fast, deterministic string hash — same player always gets the
 * same procedural face, without needing a database id passed down. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const SKIN_TONES = [
  "oklch(0.84 0.05 62)",
  "oklch(0.74 0.08 58)",
  "oklch(0.56 0.07 52)",
  "oklch(0.4 0.05 46)",
];

const HAIR_COLORS = [
  "oklch(0.26 0.02 60)",
  "oklch(0.38 0.06 55)",
  "oklch(0.76 0.11 88)",
  "oklch(0.46 0.13 38)",
];

/** Deterministic per player, so a given competitor always looks the same. */
function featuresFor(seed: number) {
  const skin = SKIN_TONES[seed % SKIN_TONES.length] ?? SKIN_TONES[0]!;
  const hair = HAIR_COLORS[(seed * 3) % HAIR_COLORS.length] ?? HAIR_COLORS[0]!;
  return {
    skin,
    hair,
    hairStyle: seed % 4,
    hasBeard: seed % 3 === 0,
  };
}

/**
 * The procedural stand-in itself: faceted low-poly panels, thick outlines,
 * an oversized head — the Ready 2 Rumble / Diddy Kong Racing register from
 * docs/VISUAL_SPEC.md, minus the part that actually requires generated art.
 */
function ProceduralBust({
  name,
  nickname,
  color,
  number,
  pose,
  idle,
}: {
  name: string;
  nickname?: string | null;
  color: string;
  number?: number;
  pose: "full" | "bust";
  idle: boolean;
}) {
  const seed = hashString(name);
  const f = featuresFor(seed);
  const kit = color;
  const kitShade = `color-mix(in oklab, ${color} 68%, black)`;
  const skinShade = `color-mix(in oklab, ${f.skin} 74%, black)`;
  const outline = "var(--bevel-dark)";

  // Cropping via viewBox rather than a second set of shapes: one model, two
  // framings, guaranteed to stay consistent with each other. The bust crop
  // includes the top of the torso — a head floating above a neck stub reads
  // as a bug, not a portrait.
  const viewBox = pose === "bust" ? "40 28 140 166" : "0 0 220 340";

  return (
    <svg
      viewBox={viewBox}
      className="h-full w-full"
      role="img"
      aria-label={nickname ? `${name}, "${nickname}"` : name}
    >
      <g className={idle ? "anim-weight-shift" : undefined} stroke={outline} strokeWidth={4} strokeLinejoin="round">
        {pose === "full" && (
          <ellipse cx={110} cy={322} rx={62} ry={10} fill="oklch(0.1 0.02 60 / 55%)" stroke="none" />
        )}

        <g className={idle ? "anim-breathe" : undefined}>
          {pose === "full" && (
            <>
              {/* Legs and shoes first, so the torso overlaps them cleanly.
                  Stubby and wide on purpose: the era's proportions are
                  roughly three heads tall, with limbs thick enough to read
                  at thumbnail size. */}
              <polygon points="74,232 110,232 108,294 76,294" fill={kitShade} />
              <polygon points="112,232 146,232 146,294 114,294" fill={kit} />
              <polygon points="70,292 110,292 110,312 66,312" fill="oklch(0.24 0.02 60)" />
              <polygon points="114,292 154,292 158,312 114,312" fill="oklch(0.3 0.02 60)" />

              {/* Arms — chunky slabs, not tapers. */}
              <polygon points="62,156 34,168 30,222 60,228 70,176" fill={kitShade} />
              <polygon points="158,156 186,168 190,222 160,228 150,176" fill={kit} />
              <circle cx={45} cy={236} r={15} fill={f.skin} />
              <circle cx={175} cy={236} r={15} fill={f.skin} />
            </>
          )}

          {/* Torso. Drawn for both poses so the bust has real shoulders. */}
          <polygon points="58,150 162,150 164,196 146,240 74,240 56,196" fill={kit} />
          {/* Faceted shading panel down the right side — the low-poly tell. */}
          <polygon points="110,150 162,150 164,196 146,240 110,240" fill={kitShade} stroke="none" />

          {pose === "full" && number !== undefined ? (
            <text
              x={110}
              y={210}
              textAnchor="middle"
              fontFamily="var(--font-display)"
              fontSize={46}
              fill="oklch(1 0 0 / 88%)"
              stroke={outline}
              strokeWidth={3}
              paintOrder="stroke"
            >
              {number}
            </text>
          ) : null}

          {/* Neck. */}
          <polygon points="94,118 126,118 126,154 94,154" fill={skinShade} />

          {/* Head. */}
          <polygon points="68,52 152,52 158,74 152,116 128,132 92,132 62,116 62,74" fill={f.skin} />
          {/* Shaded half of the face. */}
          <polygon points="110,52 152,52 158,74 152,116 128,132 110,132" fill={skinShade} stroke="none" />

          <Hair style={f.hairStyle} color={f.hair} />

          {/* Eyes: white block + pupil, the way a low-poly face did it. */}
          <rect x={80} y={80} width={20} height={14} rx={3} fill="oklch(0.98 0 0)" />
          <rect x={120} y={80} width={20} height={14} rx={3} fill="oklch(0.98 0 0)" />
          <rect x={88} y={83} width={7} height={9} rx={2} fill={outline} stroke="none" />
          <rect x={128} y={83} width={7} height={9} rx={2} fill={outline} stroke="none" />

          {/* Brow — does most of the work in giving the face any attitude. */}
          <polygon points="78,72 102,68 102,76 78,78" fill={f.hair} stroke="none" />
          <polygon points="142,72 118,68 118,76 142,78" fill={f.hair} stroke="none" />

          {f.hasBeard ? (
            <polygon points="86,104 134,104 130,126 110,134 90,126" fill={f.hair} stroke="none" />
          ) : null}

          {/* Mouth. */}
          <polygon points="98,112 122,112 118,120 102,120" fill={outline} stroke="none" />
        </g>
      </g>
    </svg>
  );
}

function Hair({ style, color }: { style: number; color: string }) {
  switch (style) {
    case 0: // Flat top.
      return <polygon points="64,54 62,40 158,40 156,54" fill={color} />;
    case 1: // Spikes.
      return <polygon points="62,56 72,30 88,50 104,26 120,50 136,30 148,52 158,58" fill={color} />;
    case 2: // Side part with a sweep.
      return <polygon points="62,58 66,38 150,34 158,58 132,44 96,48" fill={color} />;
    default: // Buzz cut.
      return <polygon points="64,58 66,48 154,48 156,58" fill={color} />;
  }
}
