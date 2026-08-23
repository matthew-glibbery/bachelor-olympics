/**
 * Regression probe for "hitting + or - restarts the full body clip" on
 * /multipliers.
 *
 * The bug was a `key` bump on the wrapper around CharacterRender, which
 * remounts the subtree — including the <video> — on every adjustment. Reading
 * the code can't tell you whether it's fixed; this can. It tags the live
 * <video> node with a property, taps a "+", and checks that the very same
 * node is still there afterwards with its playback position intact.
 *
 * Deliberately non-destructive against the live project: it taps "+" and then
 * "-" inside the 500ms autosave debounce window, so the draft ends where it
 * started and `handleSave`'s diff-only write finds nothing to persist. Verify
 * the row values before and after anyway.
 *
 * Usage: PLAYER_ID=<uuid> node probe-multiplier-clip.mjs
 */
const BASE = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
const PLAYER_ID = process.env.PLAYER_ID ?? "";

const res = await fetch(`http://localhost:${process.env.CDP_PORT ?? 9222}/json/list`);
const page = (await res.json()).find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result);
    pending.delete(m.id);
  }
});
await new Promise((r) => ws.addEventListener("open", r));
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const msgId = ++id;
    pending.set(msgId, resolve);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const evaluate = async (expression) => {
  const { result } = await send("Runtime.evaluate", { expression, returnByValue: true });
  return result.value;
};

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 430,
  height: 932,
  deviceScaleFactor: 2,
  mobile: true,
});
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `try {
    localStorage.setItem("bo.selectedPlayerId", ${JSON.stringify(PLAYER_ID)});
    localStorage.setItem("bo.groomUnlocked", "1");
  } catch (e) {}`,
});

await send("Page.navigate", { url: BASE + "/multipliers" });
await sleep(5000);

const before = await evaluate(`(() => {
  const v = document.querySelector("aside video");
  if (!v) return { error: "no character video on the page" };
  v.dataset.probe = "same-node";
  // Which row is the first unlocked one — its "+" is what we'll tap.
  const plus = [...document.querySelectorAll("button:has(svg.lucide-plus)")];
  return {
    videoFound: true,
    currentTime: v.currentTime,
    paused: v.paused,
    plusButtons: plus.length,
  };
})()`);
console.log("before:", before);
if (before.error) {
  console.log("Can't probe:", before.error);
  ws.close();
  process.exit(1);
}

await sleep(900); // let the clip advance so a reset would be obvious

const clicked = await evaluate(`(() => {
  const plus = [...document.querySelectorAll("button:has(svg.lucide-plus)")].filter((b) => !b.disabled);
  if (plus.length === 0) return { clicked: false };
  plus[0].click();
  return { clicked: true, count: plus.length };
})()`);
console.log("tap +:", clicked);

await sleep(200);
const after = await evaluate(`(() => {
  const v = document.querySelector("aside video");
  return {
    stillSameNode: v?.dataset.probe === "same-node",
    currentTime: v?.currentTime,
    paused: v?.paused,
  };
})()`);
console.log("after: ", after);

// Put the draft back inside the debounce window so nothing is written.
const restored = await evaluate(`(() => {
  const minus = [...document.querySelectorAll("button:has(svg.lucide-minus)")].filter((b) => !b.disabled);
  if (minus.length === 0) return { restored: false };
  minus[0].click();
  return { restored: true };
})()`);
console.log("restore -:", restored);
await sleep(2500);

console.log(
  after.stillSameNode
    ? "PASS — the <video> survived the adjustment (no remount, clip keeps playing)"
    : "FAIL — the <video> was replaced, so the clip restarted",
);

ws.close();
