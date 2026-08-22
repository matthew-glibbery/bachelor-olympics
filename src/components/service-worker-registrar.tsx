"use client";

import { useEffect } from "react";

/**
 * Registers `public/sw.js` (read the comment at the top of that file for why
 * it caches almost nothing). Renders no markup — it exists only because a
 * service worker has to be registered from the page, and everything else in
 * the PWA setup is declarative metadata.
 *
 * Dev is deliberately excluded: a worker sitting in front of the Next dev
 * server's HMR requests is a well-known source of phantom stale-chunk errors,
 * and there's nothing here worth testing outside a production build.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    // After load, so registration never competes with the first paint.
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // A failed registration is not worth surfacing: the app works
        // identically without it, minus the offline fallback card.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
