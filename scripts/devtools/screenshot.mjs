/**
 * Zero-dependency screenshot harness over the Chrome DevTools Protocol.
 *
 * npx playwright/puppeteer can't install behind this machine's corporate TLS
 * interception, but Chrome itself is present and Node 22 ships a global
 * WebSocket — which is all CDP actually needs. Seeds localStorage so the
 * app's IdentityGate lets us past, then captures each route full-page.
 *
 * Usage: node shoot.mjs <outDir> <width> <label> [routes...]
 */
const [, , outDir, widthArg, label, ...routes] = process.argv;
const width = Number(widthArg);
const BASE = "http://localhost:3000";
const PLAYER_ID = process.env.PLAYER_ID ?? "";

const res = await fetch("http://localhost:9222/json/list");
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
  height: 900,
  deviceScaleFactor: 2,
  mobile: width < 700,
});

// Seed identity before any app code runs, so IdentityGate doesn't bounce us
// to /start on every navigation.
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `
    try {
      localStorage.setItem("bo.selectedPlayerId", ${JSON.stringify(PLAYER_ID)});
      localStorage.setItem("bo.groomUnlocked", "1");
    } catch (e) {}
  `,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

for (const route of routes) {
  const url = BASE + route;
  await send("Page.navigate", { url });
  // Realtime store hydration is async; give it room, then settle layout.
  await sleep(4200);

  const { result } = await send("Runtime.evaluate", {
    expression: `JSON.stringify({
      h: document.documentElement.scrollHeight,
      path: location.pathname
    })`,
    returnByValue: true,
  });
  const { h, path } = JSON.parse(result.value);

  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: Math.min(h + 40, 6000),
    deviceScaleFactor: 2,
    mobile: width < 700,
  });
  await sleep(700);

  const shot = await send("Page.captureScreenshot", { format: "png" });
  const name = (route === "/" ? "home" : route.replace(/\//g, "")) + `-${label}.png`;
  const fs = await import("node:fs/promises");
  await fs.writeFile(`${outDir}/${name}`, Buffer.from(shot.data, "base64"));
  console.log(`${name}  (landed on ${path}, ${h}px tall)`);

  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 900,
    deviceScaleFactor: 2,
    mobile: width < 700,
  });
}

ws.close();
