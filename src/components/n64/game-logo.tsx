import { GAME_NAME, GAME_NAME_SUFFIX } from "@/lib/branding";
import { cn } from "@/lib/utils";

/**
 * The chunky extruded title logo.
 *
 * Built as layered SVG rather than styled HTML text because the extrusion
 * needs a dozen stacked copies of the same glyphs, which `text-shadow` can
 * fake but not light properly.
 *
 * `textLength` pins the logo to an exact width so it can't reflow. It used to
 * carry a second job — papering over the fact that the display font was a
 * system stack, so the machine might resolve Arial Black, Helvetica Bold, or
 * anything at all. That was never really working: it pinned the *width* while
 * the letterforms underneath still changed completely, which is why the logo
 * looked wrong on every phone (no iOS or Android device has Arial Black).
 * The font is now a real self-hosted webfont (src/app/fonts.ts), so the
 * glyphs are guaranteed and `lengthAdjust` is set to `spacing` — it flexes
 * the tracking to hit the target width but never stretches the glyphs
 * themselves. Distorted letterforms are the one thing a logo can't have.
 *
 * The gradients are the era's whole visual trick: a bright top half, a hard
 * midpoint, a saturated bottom half, and a dark outline thick enough to read
 * against a busy background.
 */

const DEPTH = 12;
const VIEWBOX_WIDTH = 1600;
const VIEWBOX_HEIGHT = 260;

export function GameLogo({ className }: { className?: string }) {
  // Rendered twice at different x positions so "PARTY" can carry its own
  // palette, the way cartridge logos always split an accent word out.
  //
  // These widths are the two words' MEASURED natural advance in the real
  // title face at `fontSize` (measured via getComputedTextLength in a
  // browser, not estimated). Getting this right matters because `textLength`
  // forces each word to its number: the previous values (950 / 480) were
  // inherited from a different, un-loadable font, and against Bungee they
  // tracked "BACHELOR" ~14px looser per gap while squeezing "PARTY" ~10px
  // tighter — two words in one logo visibly disagreeing about letter-spacing.
  // Matching the natural widths means `lengthAdjust` has essentially nothing
  // to correct, so both words track identically, while `textLength` still
  // does its real job of guaranteeing the logo can never reflow.
  const nameWidth = 851;
  const suffixWidth = 521;
  const gap = 58;
  const totalWidth = nameWidth + gap + suffixWidth;
  const startX = (VIEWBOX_WIDTH - totalWidth) / 2;

  return (
    <svg
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      className={cn("w-full", className)}
      role="img"
      aria-label={`${GAME_NAME} ${GAME_NAME_SUFFIX}`}
    >
      <defs>
        {/* Gold face for the wordmark. */}
        <linearGradient id="logo-face" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.97 0.06 100)" />
          <stop offset="46%" stopColor="oklch(0.86 0.16 90)" />
          <stop offset="47%" stopColor="oklch(0.72 0.17 66)" />
          <stop offset="100%" stopColor="oklch(0.82 0.15 78)" />
        </linearGradient>

        {/* Cyan face for the accent word, the contrast pop. */}
        <linearGradient id="logo-face-suffix" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.96 0.04 210)" />
          <stop offset="46%" stopColor="oklch(0.82 0.14 215)" />
          <stop offset="47%" stopColor="oklch(0.62 0.16 240)" />
          <stop offset="100%" stopColor="oklch(0.74 0.15 225)" />
        </linearGradient>

        {/* The extruded side wall, darkening toward the back of the stack. */}
        <linearGradient id="logo-extrude" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.42 0.13 60)" />
          <stop offset="100%" stopColor="oklch(0.16 0.02 60)" />
        </linearGradient>
        <linearGradient id="logo-extrude-suffix" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.38 0.12 250)" />
          <stop offset="100%" stopColor="oklch(0.16 0.02 60)" />
        </linearGradient>

        {/* Clips the specular pass to the upper part of the glyphs. Has to be
            a real <clipPath> — the CSS `inset()` shorthand isn't valid in an
            SVG `clip-path` *attribute*, which silently does nothing. */}
        <clipPath id="logo-specular">
          <rect x="0" y="0" width={VIEWBOX_WIDTH} height="128" />
        </clipPath>

        <filter id="logo-drop" x="-20%" y="-20%" width="150%" height="160%">
          <feDropShadow
            dx="6"
            dy="10"
            stdDeviation="10"
            floodColor="oklch(0.12 0.02 60)"
            floodOpacity="0.75"
          />
        </filter>
      </defs>

      <g filter="url(#logo-drop)">
        <LogoWord
          text={GAME_NAME}
          x={startX + nameWidth / 2}
          width={nameWidth}
          faceFill="url(#logo-face)"
          extrudeFill="url(#logo-extrude)"
        />
        <LogoWord
          text={GAME_NAME_SUFFIX}
          x={startX + nameWidth + gap + suffixWidth / 2}
          width={suffixWidth}
          faceFill="url(#logo-face-suffix)"
          extrudeFill="url(#logo-extrude-suffix)"
        />
      </g>
    </svg>
  );
}

function LogoWord({
  text,
  x,
  width,
  faceFill,
  extrudeFill,
}: {
  text: string;
  x: number;
  width: number;
  faceFill: string;
  extrudeFill: string;
}) {
  const baseline = 190;

  const shared = {
    x,
    textAnchor: "middle" as const,
    fontFamily: "var(--font-title)",
    fontSize: 150,
    fontWeight: 400,
    // Locks the logo's width so it can never reflow, while `spacing` (rather
    // than `spacingAndGlyphs`) guarantees the letterforms stay undistorted.
    textLength: width,
    lengthAdjust: "spacing" as const,
  };

  return (
    <g>
      {/* Extrusion: copies marching down-right, back to front. */}
      {Array.from({ length: DEPTH }, (_, i) => DEPTH - i).map((d) => (
        <text
          key={d}
          {...shared}
          y={baseline + d}
          transform={`translate(${d * 0.55}, 0)`}
          fill={extrudeFill}
          stroke={extrudeFill}
          strokeWidth={14}
          strokeLinejoin="round"
        >
          {text}
        </text>
      ))}

      {/* Hard outline, so the logo holds up against the starfield behind it. */}
      <text
        {...shared}
        y={baseline}
        fill="none"
        stroke="oklch(0.14 0.02 60)"
        strokeWidth={22}
        strokeLinejoin="round"
      >
        {text}
      </text>

      {/* Face. */}
      <text {...shared} y={baseline} fill={faceFill}>
        {text}
      </text>

      {/* Specular sliver along the top edge. */}
      <text
        {...shared}
        y={baseline}
        fill="none"
        stroke="oklch(1 0 0 / 55%)"
        strokeWidth={2.5}
        strokeLinejoin="round"
        clipPath="url(#logo-specular)"
      >
        {text}
      </text>
    </g>
  );
}
