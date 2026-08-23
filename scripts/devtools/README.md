# Screenshotting the app locally

Every handoff note before 2026-08-18 says the app couldn't be
screenshot-verified because there was "no browser driver in this
environment." That was wrong, and it cost several sessions real bugs.

`npx playwright` / `puppeteer` genuinely can't install here — the corporate
TLS interception breaks their post-install binary download. But **Google
Chrome is already installed, and Node 22 ships a global `WebSocket`**, which
is all the Chrome DevTools Protocol needs. No dependencies required.

These two scripts caught, in one session: a title silently losing its font
and extrusion (tailwind-merge eating a class), a whole column of the
leaderboard pushed off-screen on a phone, and a chart rendering half its
width as empty columns. None of those were visible from reading the code.

## Setup

```bash
# 1. This worktree needs credentials, or every screen renders empty:
cp ../../.env.local .           # from the main checkout; gitignored

# 2. Dev server
pnpm run dev

# 3. Chrome with the debugger open (leave running)
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --no-sandbox \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/bo-chrome about:blank
```

> Don't run `pnpm run build` while `next dev` is running — they share
> `.next` and the dev server starts 500ing with a missing-chunk error. Stop
> dev, `rm -rf .next`, then build.

## Screenshots

```bash
# outDir width label routes…
PLAYER_ID=<a real players.id> node scripts/devtools/screenshot.mjs \
  ./shots 430 phone / /events /bets /multipliers /setup
```

`PLAYER_ID` is seeded into `localStorage` before any app code runs, so
`IdentityGate` doesn't bounce every route to `/start`. It also unlocks the
groom tools. Grab a real id with:

```bash
URL=$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d= -f2-)
KEY=$(grep NEXT_PUBLIC_SUPABASE_ANON_KEY .env.local | cut -d= -f2-)
curl -s "$URL/rest/v1/players?select=id,name" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"
```

(`curl` works where Node's `fetch` doesn't — it trusts the macOS keychain,
so you don't need `NODE_EXTRA_CA_CERTS` for this.)

Each route is captured full-page at 2x. Useful widths: `390`/`430` (the
phone this app is actually used on) and `1280`.

## Horizontal overflow check

```bash
node scripts/devtools/check-overflow.mjs
```

Loads every screen at 390px and reports any element wider than the
viewport. Worth running after touching a table or a wide layout — the app
has no page-level `overflow-x` guard, so one overflowing cell scrolls the
whole page sideways.

## Viewport screenshots (for "dead space" problems)

```bash
# outDir width height label routes…
PLAYER_ID=<id> node scripts/devtools/viewport-shot.mjs \
  ./shots 430 932 tall /start /select
```

`screenshot.mjs` stretches the viewport to the full document before it
captures, which is what you want for reviewing a long page — and exactly
wrong for "there's unused space at the bottom on my phone", because the
stretch hides the gap you're looking for. This one captures the viewport as
a phone actually sees it and prints a geometry line per route (viewport
height, document height, deepest content edge) so a gap can be measured
rather than eyeballed. Useful heights: 852 (iPhone 15/16), 932 (Pro Max),
667 (SE) — and remember an installed PWA is *taller* than the same phone in
a browser tab, since there's no address bar.

## Behaviour probes

```bash
PLAYER_ID=<id> node scripts/devtools/probe-multiplier-clip.mjs
```

A worked example of driving the app rather than photographing it: it tags
the live `<video>` node, taps a multiplier "+", and asserts the same node is
still there afterwards with its playback position intact — which is the only
way to actually confirm the "adjusting a slider restarts the character clip"
class of bug, since a screenshot can't show it and the code reads fine
either way. It taps "+" then "-" inside the 500ms autosave debounce so the
live project is never written to; it still prints enough for you to check
the rows yourself before and after.

## Beyond screenshots

The same ~20 lines of CDP setup will drive the app: `Runtime.evaluate` can
read computed styles (how the tailwind-merge bug was confirmed — by
inspecting the rendered `className`), click real buttons, and assert on what
came back after a reload. That's how the multipliers save fix was verified
end-to-end rather than reasoned about. **If you do drive the live project,
put any data you changed back.**
