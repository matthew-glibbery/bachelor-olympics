/*
  Deliberately the smallest service worker that does anything useful.

  This app is a live scoreboard driven by Supabase realtime. A cached page
  or a cached API response is *worse than no page*: a stale leaderboard that
  looks current is exactly the failure mode you don't want at an event where
  people are betting on the numbers on screen. So this worker:

    - never caches HTML, RSC payloads, or anything from Supabase;
    - never intercepts non-GET, cross-origin, or query-string requests;
    - precaches only /offline.html + the icons, and serves the offline page
      only when a navigation genuinely fails on the network.

  What it buys us is (a) an honest "you're offline" screen instead of the
  browser's dinosaur, and (b) Chrome on Android treating the app as
  installable, which needs a fetch handler that can answer a navigation
  while offline. Next's own /_next/static output is content-hashed and
  immutably cached by the HTTP cache already — re-caching it here would add
  a second, staler copy of the same thing.

  skipWaiting + clients.claim on purpose: with nothing dynamic in the cache
  there is no reason to leave an old worker in charge, and it means a bad
  deploy is one refresh away from being gone.
*/
const CACHE = "shell-v1";
const SHELL = ["/offline.html", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Navigations: always the network. Only if that throws (no connection at
  // all) do we show the offline card.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }

  // Everything else: network first, falling back to a precached icon if it
  // happens to be one of them. No cache writes at runtime.
  const url = new URL(request.url);
  if (url.origin === self.location.origin && SHELL.includes(url.pathname)) {
    event.respondWith(fetch(request).catch(() => caches.match(url.pathname)));
  }
});
