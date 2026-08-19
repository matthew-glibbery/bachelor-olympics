// Check for page-level horizontal overflow at the narrowest phone width.
const routes = ["/", "/events", "/bets", "/setup", "/multipliers"];
const res = await fetch("http://localhost:9222/json/list");
const page = (await res.json()).find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0; const pending = new Map();
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); } });
await new Promise((r) => ws.addEventListener("open", r));
const send = (method, params = {}) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
const PLAYER_ID = process.env.PLAYER_ID ?? "";
await send("Page.addScriptToEvaluateOnNewDocument", { source: `try{localStorage.setItem("bo.selectedPlayerId",${JSON.stringify(PLAYER_ID)});localStorage.setItem("bo.groomUnlocked","1")}catch(e){}` });
for (const r of routes) {
  await send("Page.navigate", { url: "http://localhost:3000" + r });
  await new Promise((res2) => setTimeout(res2, 4200));
  const { result } = await send("Runtime.evaluate", {
    expression: `(() => {
      const de = document.documentElement;
      const over = [...document.querySelectorAll("*")]
        .filter(el => el.getBoundingClientRect().right > de.clientWidth + 1)
        .slice(0, 4)
        .map(el => (el.tagName + "." + String(el.className).slice(0, 60)));
      return JSON.stringify({ scrollW: de.scrollWidth, clientW: de.clientWidth, overflows: over });
    })()`,
    returnByValue: true,
  });
  const v = JSON.parse(result.value);
  const bad = v.scrollW > v.clientW;
  console.log(`${r.padEnd(13)} scrollW=${v.scrollW} clientW=${v.clientW} ${bad ? "HORIZONTAL OVERFLOW " + JSON.stringify(v.overflows) : "ok"}`);
}
ws.close();
