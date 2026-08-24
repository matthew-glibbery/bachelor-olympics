"use client";

import { useEffect, useState } from "react";

/**
 * A visible ruler for the two screens that fill the viewport exactly.
 *
 * Turned on by adding `?probe=1` to /start or /select (Tools → Viewport
 * diagnostics links straight to both). It draws a magenta hairline at each
 * edge of a `fixed inset-0` box — the exact construction those screens use —
 * plus the numbers for where that box actually landed.
 *
 * The point is that one screenshot then answers the question that six
 * rounds of reasoning could not: if there is dead space BELOW the bottom
 * hairline, the fixed box is not reaching the bottom of the screen and the
 * numbers say by how much. If the hairline sits right on the screen edge and
 * the dead space is INSIDE it, the box is correct and the problem is what's
 * painted (or not painted) within it. Those two have completely different
 * fixes, and every attempt so far has had to guess which one it was.
 *
 * Reads `location.search` directly rather than `useSearchParams`, which
 * would drag a Suspense boundary onto both screens for a debug-only feature.
 */
export function ScreenProbe() {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mainRect, setMainRect] = useState<DOMRect | null>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!window.location.search.includes("probe=1")) return;
    setOn(true);

    const measure = () => {
      const probe = document.createElement("div");
      probe.style.cssText = "position:fixed;inset:0;pointer-events:none;visibility:hidden";
      document.body.appendChild(probe);
      setRect(probe.getBoundingClientRect());
      probe.remove();
      // The real screen's own <main> — a generic probe can be correct while
      // the actual element is not (different min-height, a stacking or
      // containment ancestor, a stale --app-height).
      const main = document.querySelector("main");
      setMainRect(main ? main.getBoundingClientRect() : null);
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  if (!on) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]" aria-hidden={false}>
      {/* One hairline per edge of the fixed box. */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-fuchsia-500" />
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-fuchsia-500" />
      <div className="absolute inset-y-0 left-0 w-[2px] bg-fuchsia-500" />
      <div className="absolute inset-y-0 right-0 w-[2px] bg-fuchsia-500" />

      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-4 text-center font-mono text-[11px] leading-relaxed text-fuchsia-200">
        <p className="bg-black/80 p-2">
          {rect ? (
            <>
              probe box: top {Math.round(rect.top)} · bottom {Math.round(rect.bottom)} · height{" "}
              {Math.round(rect.height)}
              <br />
              this &lt;main&gt;:{" "}
              {mainRect
                ? `top ${Math.round(mainRect.top)} · bottom ${Math.round(mainRect.bottom)} · height ${Math.round(mainRect.height)}`
                : "not found"}
              <br />
              screen {window.screen.width}×{window.screen.height} · inner {window.innerWidth}×
              {window.innerHeight}
              <br />
              If dead space is BELOW the bottom line, the box is short.
              <br />
              If it&apos;s INSIDE the lines, the box is right and the paint is wrong.
            </>
          ) : (
            "measuring…"
          )}
        </p>
      </div>
    </div>
  );
}
