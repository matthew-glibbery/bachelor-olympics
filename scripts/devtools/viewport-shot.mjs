/**
 * Like screenshot.mjs, but captures the VIEWPORT as a phone actually sees it
 * (no full-page resize) — which is the only way to see "unused space at the
 * bottom" problems, since a full-page capture stretches the viewport to the
 * document and hides exactly the gap you're looking for.
 *
 * Also prints a small geometry probe per route: viewport height, document
 * scroll height, and the bottom edge of the last visible element, so a gap
 * can be measured rather than eyeballed.
 *
 * Usage: node viewport-shot.mjs <outDir> <width> <height> <label> [routes...]
 */
const [, , outDir, widthArg, heightArg, label, ...routes] = process.argv;
const width = Number(widthArg);
const height = Number(heightArg);
const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const PLAYER_ID = process.env.PLAYER_ID ?? "";

const res = await fetch(`http://localhost:${process.env.CDP_PORT ?? 9222}/json/list`);
const targets = await res.json();
const page = targets.find((t) => t.type === "page");
if (!page) throw new Error("no page target");

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result);
    pending.delete(msg.id);
  }
});
await new Promise((r) => ws.addEventListener("open", r));
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const msgId = ++id;
    pending.set(msgId, resolve);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width,
  height,
  deviceScaleFactor: 2,
  mobile: width < 700,
});
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `try {
    localStorage.setItem("bo.selectedPlayerId", ${JSON.stringify(PLAYER_ID)});
    localStorage.setItem("bo.groomUnlocked", "1");
  } catch (e) {}`,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fs = await import("node:fs/promises");

for (const route of routes) {
  await send("Page.navigate", { url: BASE + route });
  await sleep(4200);

  const { result } = await send("Runtime.evaluate", {
    expression: `(() => {
      const vh = window.innerHeight;
      const doc = document.documentElement.scrollHeight;
      // Deepest painted bottom edge among elements with real boxes.
      let maxBottom = 0, who = "";
      for (const el of document.querySelectorAll("main *")) {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.opacity === "0") continue;
        const b = r.bottom + window.scrollY;
        if (b > maxBottom) { maxBottom = b; who = el.tagName + "." + (el.className.baseVal ?? el.className ?? "").toString().slice(0, 60); }
      }
      return JSON.stringify({ vh, doc, maxBottom: Math.round(maxBottom), who, path: location.pathname });
    })()`,
    returnByValue: true,
  });
  const g = JSON.parse(result.value);
  console.log(
    `${route} -> ${g.path} | viewport ${g.vh} | doc ${g.doc} | last content bottom ${g.maxBottom} | gap ${g.vh - g.maxBottom}px | ${g.who}`,
  );

  const shot = await send("Page.captureScreenshot", { format: "png" });
  const name = (route === "/" ? "home" : route.replace(/[/?=]/g, "")) + `-${label}.png`;
  await fs.writeFile(`${outDir}/${name}`, Buffer.from(shot.data, "base64"));
}

ws.close();
