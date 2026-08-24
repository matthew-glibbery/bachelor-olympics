"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { measureViewportFloor } from "@/components/viewport-floor";

/**
 * Viewport diagnostics — reachable from Tools → Viewport diagnostics (groom
 * only), and not linked anywhere else. It needs a link at all because an
 * installed PWA has no address bar to type a route into, and this page is
 * useless anywhere except inside the installed app.
 *
 * There is a long, expensive history in this repo of guessing at the
 * installed-iOS-PWA viewport (see docs/HANDOFF.md and layout.tsx): the bug
 * doesn't reproduce in a browser tab or in headless Chrome, so every fix so
 * far has been reasoned rather than measured, and several were wrong in ways
 * a single real number would have settled immediately.
 *
 * This page is that number. Open it *inside the installed app* (Safari's
 * address bar isn't the same thing) and send the readout. The green/red
 * banner is the whole answer: green means the layout viewport matches the
 * screen and nothing needs correcting; red means it doesn't, and the exact
 * shortfall says what `--app-height` has to make up.
 *
 * Deliberately dependency-free and layout-free — it must not itself depend
 * on any of the sizing machinery it exists to diagnose.
 */

type Row = { label: string; value: string };

export default function DebugPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [gap, setGap] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const measure = useCallback(() => {
    const de = document.documentElement;
    const vv = window.visualViewport;
    const style = getComputedStyle(de);
    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;

    // A probe element pinned to the bottom of a `fixed inset-0` box — the
    // exact construction /start and /select use. Where its bottom edge lands
    // versus the screen is the thing being asked about.
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;inset:0;pointer-events:none;visibility:hidden";
    document.body.appendChild(probe);
    const probeRect = probe.getBoundingClientRect();
    probe.remove();

    // The floor's own decision, from the floor's own code — not re-derived
    // here, or this page would drift out of sync with the thing it exists
    // to explain.
    const floor = measureViewportFloor();

    const shortfall = window.screen.height - window.innerHeight;
    setGap(shortfall);
    setRows([
      { label: "display-mode standalone", value: String(standalone) },
      {
        label: "display-mode (other)",
        value:
          ["fullscreen", "minimal-ui", "browser"]
            .filter((mode) => window.matchMedia?.(`(display-mode: ${mode})`).matches)
            .join(", ") || "none",
      },
      { label: "navigator.standalone", value: String((navigator as Navigator & { standalone?: boolean }).standalone) },
      {
        label: "height floor applies",
        value: floor.applies ? "YES — using screen height" : `no — ${floor.reason}`,
      },
      { label: "screen.width × height", value: `${window.screen.width} × ${window.screen.height}` },
      { label: "inner width × height", value: `${window.innerWidth} × ${window.innerHeight}` },
      {
        label: "documentElement client",
        value: `${de.clientWidth} × ${de.clientHeight}`,
      },
      {
        label: "visualViewport",
        value: vv ? `${Math.round(vv.width)} × ${Math.round(vv.height)} @ y=${Math.round(vv.offsetTop)}` : "unavailable",
      },
      { label: "fixed inset-0 height", value: `${Math.round(probeRect.height)}` },
      { label: "screen.height − innerHeight", value: `${shortfall}` },
      { label: "--app-height (computed)", value: style.getPropertyValue("--app-height").trim() || "(unset)" },
      { label: "safe-area top / bottom", value: `${style.getPropertyValue("--safe-top").trim()} / ${style.getPropertyValue("--safe-bottom").trim()}` },
      { label: "devicePixelRatio", value: String(window.devicePixelRatio) },
      { label: "userAgent", value: navigator.userAgent },
    ]);
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [measure]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(rows.map((r) => `${r.label}: ${r.value}`).join("\n"));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be refused; the readout is on screen either way.
    }
  };

  return (
    <main className="min-h-dvh p-4 pt-[calc(1rem+var(--safe-top))] pb-[calc(1rem+var(--safe-bottom))] font-mono text-xs">
      <h1 className="mb-3 text-sm font-bold">Viewport diagnostics</h1>

      <p
        className={`mb-4 rounded-md p-3 text-sm font-bold ${
          gap === null ? "" : gap === 0 ? "bg-green-900 text-green-100" : "bg-red-900 text-red-100"
        }`}
      >
        {gap === null
          ? "measuring…"
          : gap === 0
            ? "Viewport matches the screen — no correction needed."
            : `Viewport is ${gap}px shorter than the screen.`}
      </p>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="break-all">{r.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="bevel-raised bg-card rounded-md px-4 py-2 text-sm"
        >
          {copied ? "Copied ✓" : "Copy readout"}
        </button>
        {/* There is no nav on this page, and an installed PWA has no address
            bar to escape with — without this the only way out is to kill the
            app. */}
        <Link href="/setup" className="bevel-raised bg-card rounded-md px-4 py-2 text-sm">
          Back to Tools
        </Link>
      </div>

      {/* A hairline pinned to the true bottom of a `fixed inset-0` box. If
          there is a band of dead space below this line on a real device,
          that is the bug, rendered. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 bottom-0 h-1 bg-red-500"
      />
    </main>
  );
}
