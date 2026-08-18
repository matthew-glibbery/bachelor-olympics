import { cn } from "@/lib/utils";

/**
 * The drifting starfield behind the title screen.
 *
 * Star positions come from a seeded PRNG evaluated at module load, not
 * `Math.random()` at render time — otherwise the server and the client would
 * generate different fields and React would throw a hydration mismatch. Same
 * seed, same stars, every render.
 *
 * The field is rendered twice, stacked vertically, and the pair scrolls up by
 * exactly 50%: at the moment the animation loops, the second copy is sitting
 * precisely where the first one started, so the drift never visibly seams.
 */

const STAR_COUNT = 90;

/** Mulberry32 — small, fast, and deterministic across server and client. */
function mulberry32(seed: number) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Star = { x: number; y: number; size: number; opacity: number };

const STARS: Star[] = (() => {
  const rand = mulberry32(0x5741_6f75);
  return Array.from({ length: STAR_COUNT }, () => ({
    x: rand() * 100,
    y: rand() * 100,
    // A few big bright ones, mostly small dim ones — a flat distribution
    // reads as noise rather than as a starfield.
    size: rand() < 0.15 ? 3 : rand() < 0.5 ? 2 : 1,
    opacity: 0.25 + rand() * 0.6,
  }));
})();

export function Starfield({ className }: { className?: string }) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      aria-hidden
    >
      {/* Deep-space gradient under the stars. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 120%, var(--secondary) 0%, var(--background) 55%, var(--background) 100%)",
        }}
      />
      <div className="anim-star-drift absolute inset-x-0 top-0 h-[200%]">
        {[0, 1].map((copy) => (
          <div key={copy} className="absolute inset-x-0 h-1/2" style={{ top: `${copy * 50}%` }}>
            {STARS.map((star, i) => (
              <span
                key={i}
                className="absolute rounded-full bg-foreground"
                style={{
                  left: `${star.x}%`,
                  top: `${star.y}%`,
                  width: star.size,
                  height: star.size,
                  opacity: star.opacity,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
