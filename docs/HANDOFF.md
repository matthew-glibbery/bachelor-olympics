# Session handoff

Rolling handoff note (per CLAUDE.md). Newest section on top.

## 2026-08-22 (6) — Mobile PWA pass: bets as a table, wagers as a stepper, decluttering, two real bugs

A punch list of real-use feedback from the installed PWA on a phone, plus
two genuine bugs. 174 tests (+10, all for the two helpers added while fixing
the review findings below), lint/typecheck/build all green. **Verified live against the
real Supabase project** throughout via headless Chrome + CDP
(`scripts/devtools/`), including two scripted interaction tests, not just
screenshots. Nothing in the live database was written to (checked before and
after, see below).

### The two real bugs

- **Adjusting a multiplier restarted the character's full-body clip.**
  `/multipliers` bumped a `reactionKey` and used it as a `key` on the wrapper
  around `CharacterRender` to replay the reaction pop. A changed `key` does
  not re-run an animation — it unmounts and remounts the whole subtree, and
  that subtree contains the `<video>`. So every single tap of a `+`/`-` built
  a fresh, unbuffered video element: the idle clip snapped to frame zero and
  re-decoded from scratch. Now `pulseCharacter()` restarts the CSS animation
  on a *stable* element (drop the class, force a reflow so the removal is
  flushed as its own style change — without that the browser coalesces the
  remove and re-add into no change at all — then add it back). The video is
  never touched. **Verified for real, not reasoned about**: new
  `scripts/devtools/probe-multiplier-clip.mjs` tags the live `<video>` node,
  taps a `+`, and confirms the same node is still there with its playback
  position advanced (3.98s → 5.10s, still playing). It taps `-` again inside
  the 500ms autosave debounce so nothing is written; Matthew's six multiplier
  rows were byte-identical before and after.
- **The `/start` and `/select` dead space at the bottom — fixed, but not by
  this branch.** This session diagnosed it as the character render being a
  fixed `h-96` centred in the leftover (so a taller screen bought a bigger
  empty band rather than a bigger character) and rebuilt it as a `flex-1
  min-h-0` box. Section (5) below landed the same `flex-1 min-h-0` change
  *plus* a better root-cause fix this branch had missed — `min-h-dvh` only
  sets a floor, and on an installed PWA `dvh` can sit a hair under the true
  visual viewport, so the shortfall became unfilled space; `fixed inset-0`
  resolves against the viewport directly. **Both screens here are main's
  version verbatim**, taken wholesale on the rebase; this branch's own
  attempt was dropped, along with the `screen-boot-pad` utility it added
  (nothing uses it now) and its PRESS START / scrim / tagline work, since (5)
  removed the tagline and footer outright. Recorded because the *diagnosis*
  differs and the difference matters: if bottom dead space ever comes back on
  a boot screen, `min-height` versus a fixed inset is the first thing to
  check, not the flex chain.

### Placed bets are one table now, everywhere

- **New `src/components/placed-bets-table.tsx`.** Bets used to render as a
  differently-worded sentence on each of the three screens that show them —
  "Josh to place top 3 — wagered 1.5" on `/bets`, "Matthew wagered 1.5 on
  Josh to place" on the event Bets tab, a two-column list on the Odds tab —
  three shapes for one fact, none of which let you compare two bets by
  scanning a column. One table now, columns **Player · Bet · Odds · Stake ·
  To win**, with edit/cancel as pencil and trash icons. Used by
  `event-odds-betting.tsx` (your own bet on an event), `/bets` (every
  per-event wager you have running), and `event-bets-list.tsx` (the reveal of
  everyone's bets, which switches on a `showBettor` column).
- **Fitting six columns into a 390px phone took real work, and the details
  matter if anyone touches this.** `table-fixed` with an explicit width on
  every column but the first — auto layout spends width on whichever cell
  holds the longest string, which pushed the controls off the right edge into
  a horizontal scroll nobody would find. The event name is a full-width group
  header row rather than a line inside the name cell (at ~110px it truncated
  to "SETTLER…", which names nothing) and is emitted only when the context
  changes, so a run of bets on one event is labelled once. Header type is
  9px at reduced tracking because `hud-label`'s tracking alone forced "To
  win" onto two lines and left the header row visibly ragged. `framed={false}`
  drops the table's own bevel where it sits inside a sunken panel already —
  two nested bevels read as a rendering fault and the inner inset shadow ate
  into the controls column. `check-overflow.mjs` clean at 390px on all five
  routes afterwards.
- **`/bets`' per-event editing** went from a dormant form per row to one
  shared editor below the table, opened by a row's pencil. Same mutations as
  before (`updatePerEventBet` / `cancelPerEventBet`), same "add this bet's own
  wager back before capping the new amount" rule. **Exercised live**: clicked
  the pencil on the real open Catan bet, confirmed the editor came up
  pre-filled (Josh / to place top 3 / stake 0.3, correct odds and payout),
  then clicked Discard — never Save, so the live bet is untouched.

### Wagers are stepped, not typed

- **New `src/components/wager-stepper.tsx`** replaces the `<input
  type="number">` on both the Odds tab and `/bets`. This app is used
  one-handed, outdoors, on a phone; a number field there means summoning the
  numeric keyboard over half the screen to enter one of the ~10 legal values
  a wager can be. Wagers move in fixed `MULTIPLIER_STEP` increments off a
  small reserve, so every reachable value is a couple of taps from either
  end. Clamping and step-snapping live in the component, not in each caller's
  submit handler — the point of a stepper is that an illegal value is
  unreachable, not rejected afterwards. Picking a player with nothing staked
  seeds one step, so the form is never in a state where the only live control
  is a "+".

### Inactive buttons look like buttons again

- `Button`'s disabled state was `bevel-sunken` + `bg-sunken`. That fixed an
  older problem (`opacity-50` over the gold primary went muddy olive) but
  broke the affordance: a sunken plate is this app's vocabulary for a *well*,
  the thing inputs and readouts sit inside — so "Wager", disabled until you
  have picked someone, stopped reading as a button at all and looked like a
  label pressed into the panel. Disabled is now an **unlit** plate: it keeps
  the raised bevel and loses only its colour (`bg-muted`). Applied to the
  same-shaped hand-rolled controls too (`multiplier-bar.tsx`'s `+`/`-`, which
  were still on `disabled:opacity-50`), so there is one answer app-wide. The
  unpicked Win/Place odds buttons also moved `outline` → `secondary`; against
  this dark panel a transparent plate with a hairline border read as an inert
  label, and those are the primary things you tap on that screen.

### Decluttering, per the punch list

- **`/events` has no screen title on either step.** The grid sat under an
  "EVENTS" plate with the nav's own highlighted Events tab directly beneath
  it; the detail step repeated the event's name as a subtitle immediately
  above the event card's own heading. Two labels, one fact, both times.
  `GameScreen`'s `title` is optional now.
- **The back button** on the event detail gets `gap-5` and its own hit
  padding — with the title gone it is the only thing above the card, and at
  `gap-3` it read as part of the card's frame rather than the way out of it.
- **Results tab is gone for an event that hasn't been played** — it opened
  onto an empty panel, which is worse than no tab, since a tab is a promise
  that something is behind it. This required moving the groom's own controls
  (start scoring, enter/edit results, reset, cancel) *out* of the Results tab
  to above the tab strip, since that tab existing for a planned event was the
  only reason those were reachable. They are now reachable in every state.
  A tab strip left holding exactly one tab isn't drawn at all.
- **`event.notes` is no longer rendered** on the event card ("Scored on
  strokes, lowest wins", and so on). It mostly restated the scoring-mode badge
  next to the title, and on a phone it pushed the tabs below the fold. Still
  editable in groom tools — this is a display change only.
- **Explainer copy removed**: the Progress panel's description and the
  chart's eight-entry player key on the leaderboard; `/bets`' screen subtitle
  and both panel descriptions ("Flat 100 points…", "Your wagers on…"). On the
  chart specifically, the key was identifying lines that are already
  identified — every marker carries the player's own photo or initial and the
  tooltip names everyone at the hovered event — while costing three wrapped
  rows on the app's primary device.

### Deliberately not done

- The **"Adjusted = raw points × …" line under Standings** was deliberately
  left alone here — the ask named the explainer under *Progress*, and this
  was a different line in a different panel. Moot now: (5) removed it
  independently, so both are gone on this branch after the rebase.
- The **event Bets tab's reveal view** (`showBettor`) could not be
  screenshot-verified with real data: the only two events carrying bets right
  now (Catan, Smash Bros.) are both still `planned`, and that tab only exists
  once betting has closed. The code path typechecks and shares the table with
  the two views that *were* verified, but it hasn't been looked at on screen.
- **Player photos render as broken-image glyphs** in every screenshot here.
  Pre-existing and not caused by this work — Next's image optimizer can't
  reach Supabase Storage through this machine's TLS interception. Fine on the
  real Vercel deploy.

### Five bugs a review pass caught in this work, all fixed

An independent review of the diff found five real problems, three of them
regressions introduced by this session's own restructuring. Worth recording
because two are traps anyone touching these files could fall into again.

- **Radix `Tabs` was uncontrolled while its tabs came and went.**
  `event-card.tsx` used `defaultValue`, and the card is keyed on event id so
  it never remounts on a status change. Two failures fell out of that. Reset a
  resolved event with the Results tab open and `hasResults` flips false: both
  Results and Bets unmount, the now-single-tab strip hides itself, and Radix
  still holds `"results"` internally — matching no panel, so the card rendered
  its header and nothing else with no way back to Odds. And moving the groom
  controls above the strip (see above) meant "Enter results" could be clicked
  from the Odds tab, where the editor it opens is unmounted: it set `editing`,
  put nothing on screen, and hid its own button. The strip is controlled now;
  an effect keeps the value pointing at a panel that exists, and `openEditing`
  switches to Results.
- **`busyEventId` on `/bets` was set to an event id on save and a bet id on
  cancel**, while every consumer compared it to a bet id — so during an
  in-flight save nothing was disabled and a second tap fired a second
  `updatePerEventBet`. Renamed to `busyBetId` and keyed consistently.
- **The wager cap rounded the wrong way.** `WagerStepper` derived its ceiling
  by *rounding* `max`, so a cap of 0.25 offered a 0.3 step the submit guard
  then rejected. Worse in practice: a reserve is a sum of 0.1s, so "0.3
  available" really arrives as 0.2999999999999998, and a stepper adding floats
  reached 0.30000000000000004 — greater than the cap — which greyed the submit
  button out at exactly the amount the screen had just said was available.
  The stepper counts whole integer steps now, and three new helpers in
  `budget.ts` carry the rule: `stepsWithin` (floors, so the top step always
  fits), `stepAmount` (snaps back onto the grid), and `fitsBudget` (the
  float-tolerant comparison every submit guard should use instead of `<=`).
  **Use these rather than comparing reserve figures directly** — 8 new tests
  pin the behaviour with the real dirty values.
- **`perEventPayoutMultiplier` throws on a pick that isn't in the ranking**,
  and this session put it in three render paths that only guarded
  `ranking.length > 0`. A player added or removed after the groom ranked an
  event would have taken out the whole event card or bets page during render
  rather than showing "—" in one cell. New
  `perEventPayoutMultiplierOrNull` for display; the throwing one stays for
  settlement, where an unknown pick genuinely should stop the payout.
  174 tests now (+10).
- **Verified the max-stake case live afterwards**, since that's the one a test
  can't fully cover: opened the real Catan bet's editor and stepped to the
  ceiling (0.5 = 0.2 available + its own 0.3 back), confirming Save stayed
  enabled and the To-win figure stayed live at every rung, with "+" correctly
  dead at the top. Discarded rather than saved; `per_event_bets` and
  `multipliers` were byte-identical before and after everything in this
  session.

### Rebased onto (5), which overlapped

(5) landed on `main` while this was in flight and covered a lot of the same
ground from the same feedback. Resolution, for the record: `/start` and
`/select` are main's files verbatim (see the first bullet at the top);
`/events`' subtitle is gone in *both* steps now — (5) had removed the grid
step's, this removes the detail step's, which repeated the event's name
directly above the event card's own heading; the leaderboard keeps main's
"line chart at every width" decision (`rank-ladder.tsx` stays deleted) with
only this branch's `description` removal applied on top; and
`/multipliers` carries both (5)'s hard budget wall and this branch's
character-clip fix, which touch different parts of the file.

### New tooling

`scripts/devtools/viewport-shot.mjs` (captures the viewport as a phone sees
it, rather than stretching to the document like `screenshot.mjs` does — the
stretch hides exactly the dead-space problems you'd be looking for, and this
prints a measured gap per route) and `probe-multiplier-clip.mjs` (the
video-remount regression test described above). Both documented in
`scripts/devtools/README.md`.
## 2026-08-22 (5) — Real-use punch list: /start fullscreen+autoplay, /select fits one screen, chart reverted, budget hard-blocked, six text removals

A long batch of direct feedback after actually using the PWA for a bit.
164 tests (unchanged — one component deleted, no domain logic touched),
lint/typecheck/build all green.

- **`/start`'s boot video wasn't reaching the true screen edge in
  standalone.** Real bug, not style: `main` was `min-h-dvh`, which only
  sets a floor, and on an installed PWA `dvh` can be a hair off the true
  visual viewport depending on device/WebKit version — the gap showed up
  as unfilled space at the bottom. Switched to `fixed inset-0`, which
  resolves against the real viewport directly and sidesteps the ambiguity
  entirely (and, as a bonus for a splash screen, makes it unscrollable
  outright). Same fix applied to `/select` for the same reason (see
  below) — worth checking any other full-bleed screen if this class of bug
  resurfaces.
- **`/start`'s autoplay made more defensive**, though this class of bug is
  hard to fully verify without a real device in this sandbox: the ref
  effect now also sets `playsInline` as a DOM property (was JSX-attribute
  only), retries `.play()` on `loadeddata` and `canplay` (the original
  single call could fire before the browser had buffered enough to
  actually start, silently no-oping), and retries again on `pageshow`
  (covers iOS suspending video when a standalone app backgrounds and
  resuming not resuming it automatically). Confirmed via headless Chrome
  that the video does play mid-action (not stuck on frame 0) with this
  code path — real device confirmation is still open.
- **`/start`'s tagline and footer (copyright + "Keyboard · Gamepad ·
  Touch") removed entirely**, per explicit ask. `GAME_TAGLINE`/
  `GAME_COPYRIGHT` left defined in `branding.ts` (unused now, harmless) —
  not deleted since nothing else needed touching to satisfy the ask.
- **`/select` now fits one iPhone screen with zero scroll, heading
  removed.** Verified, not assumed: measured `document.scrollHeight ==
  innerHeight` via CDP at both 390×844 and 375×667 (iPhone SE — the
  shortest common size) after the change, both exactly equal. Two real
  fixes, not one: (1) `fixed inset-0` for the same dvh reason as /start,
  (2) the character render was a **fixed** `h-96` (384px) regardless of
  how much room the roster strip and safe-area padding actually left —
  changed to `flex-1 min-h-0` so it's a genuine flex sibling of the
  nameplate/button (not `h-full`, which fills the whole flex parent and
  leaves nothing for those siblings — tried that first, wrong). `max-h-
  [28rem]` still caps it on a tall desktop window. "Choose your character"
  heading removed, which also freed real vertical space.
- **Progress chart reverted to the line chart on every width.** A
  same-day-earlier session replaced it with a rank-ladder (one row per
  player, position after each event as stepped segments) below `sm`,
  reasoning that 8 clumped series in a phone-width line chart was hard to
  read. Direct feedback: it wasn't actually more helpful in practice.
  `rank-ladder.tsx` deleted outright (not left as unused dead code), along
  with the `--status-up`/`--status-down` tokens it needed — confirmed
  nothing else referenced either before removing.
- **Multipliers: budget is now a hard wall, not just a validation
  flag.** Previously a player could drag a slider into an over-budget
  draft and only find out on save ("Not saved — over budget"). Now every
  `MultiplierBar.onChange` computes the FULL hypothetical draft (every
  event, same `validateAllocations` call `handleSave` already trusts) and
  refuses the move outright — `playSfx("deny")`, no state change — if it
  would go over. Verified live via a scripted click sequence, not just
  read: at a real fully-allocated 0.0-remaining state, clicking `+` on an
  unlocked bar left its value unchanged; `-` on another bar to free 0.1,
  then `+` elsewhere, succeeded exactly once and was refused again once
  back at zero. Test mutations restored via the same script before
  finishing (DB rows re-verified back at 1.0 for both events touched).
  Decreases are never blocked (they only free budget). The "Not saved —
  over budget" label stays as a safety net for the one path this doesn't
  cover — a locked event's already-committed value sitting out-of-range
  from stale pre-this-change data — but is effectively unreachable through
  normal use now.
- **Six pieces of copy removed, all per explicit ask, all with the
  underlying data/logic untouched**: multipliers' "Autosaves as you
  adjust" idle label (Panel's `action` slot now renders nothing when idle,
  not empty text) and its "Raising one event has to come from another…"
  subtitle and "See Bets to place a per-event wager" line; events' "Pick
  an event to start scoring…" subtitle (still shows the focused event's
  own name once one's picked — only the ungated grid-view copy is gone);
  leaderboard's "Adjusted = raw points × …" footnote and the "Adjusted"
  column header, renamed to **"Points"**.
- **Multipliers' "Unspent — becomes reserve" → "Available for betting"**,
  same budget-remaining figure, clearer of what it's actually for.
- **Mobile nav sits closer to the true bottom edge.** `nav-inset-safe`'s
  gap above the home-indicator inset went from a flat `1rem` to `0.5rem` —
  this app is used installed (standalone), where there's no browser bottom
  chrome left to share that space with, so the floating bar can sit lower
  and hand the freed room back to page content.
  `screen-pad-block`'s bottom padding shrank by the same 0.5rem (7rem →
  6.5rem) to match. A judgment call on magnitude, not a measured "correct"
  value — worth another look once someone's actually holding it.

Verified beyond the unit suite: full headless-Chrome pass against the real
Supabase project (read-only except the scripted budget-block test, whose
mutations were restored and re-verified via a direct table read) —
screenshotted /start, /select, /, /events, /multipliers at 390px;
`check-overflow.mjs` clean on all five routes.

## 2026-08-22 (4) — App icon: dropped the bevel frame, full-bleed photo instead

Direct feedback on (3)'s icon: "that isn't aligning well with the app
shape" — the beveled console-plate frame this session composited the
photo into was a real bug, not a style question. iOS/Android already apply
their own shape mask (squircle, adaptive icon, circle) to whatever a PWA
icon PNG contains, so drawing a *second* rounded-rect-plus-border in the
PNG itself produced two frames stacked with different, unaligned corner
radii — visibly wrong regardless of device.

- `scripts/generate-icons.mjs`'s `photoIconSvg` no longer calls
  `plateFrame()` (the medal's beveled-plate helper) at all — full-bleed
  photo on a background-filled canvas, no border, no bevel stroke. The
  medal mark (`iconSvg`, default `pnpm run gen:icons` with no `--photo`
  flag) is untouched — that frame is deliberate chrome around an abstract
  mark, not a mismatch, and still looks right.
- New `PHOTO_TARGETS`, separate from the medal's `TARGETS`: scale 1
  (true full-bleed) for icon-192/icon-512/apple-touch-icon/favicon-32.
  Maskable keeps its scale-0.62 inset — that one's a real functional need
  (Android's safe-zone crop), not decoration, so it's still there, just
  with no border/bevel drawn around the inset photo, only plain background
  color showing through the margin.
- Regenerated all five PNGs the same way as (3) — Matthew's live
  `photo_url` via curl, source photo not committed (character-assets/
  reference-photos/ gitignore convention).

Verified: lint, typecheck, 164 tests, production build all green; looked
at all five sizes again, not just 512px — no visible frame or misalignment
at any of them now.

## 2026-08-22 (3) — Bespoke per-player victory prompts, Tyler excluded, app icon is Matthew's headshot

Follow-up on the same day's victory-clip work, after direct feedback that
the first pass (a single template with the name swapped, generic "opposing
characters") wasn't what was wanted. 164 tests (unchanged — no app code
touched, this is entirely the character-gen pipeline + a generated asset
pair), lint/typecheck/build all green.

- **Every player's victory clip now names and defeats the real rest of the
  cast**, not generic rivals — direct ask. New
  `scripts/character-gen/victoryBeats.ts`: one hand-written `{ pose, action
  }` pair per player, each a genuinely different comedic mechanism (Isaac
  buries the group in a sand rooster-tail, Anthony mogul-bounces off their
  backs skiing down a dune, Joe lassoes everyone into one dogpile, Josh
  tornado-flattens them on a victory lap, Andrew's breakdance headspin
  blast-waves them, Adam rubber-stamps them "REJECTED" one by one) rather
  than one move re-skinned seven times.
- **Tyler is excluded** — not attending the actual weekend, so he neither
  wins a clip nor appears as someone the others defeat.
  `VICTORY_EXCLUDED` in victoryBeats.ts is the single point of control;
  both `gen:char:composite` and `gen:char:clip` throw a clear error if
  asked to generate his. Deliberately scoped to victory-clip *content*
  only — his `players` row, betting, scoring, and every other pipeline
  step are untouched, since removing a live competitor is a much bigger
  call than this ask and wasn't part of it.
- **All seven share one Lake Tahoe beach**
  (`background.ts`'s new `VICTORY_BEACH_BACKGROUND`) instead of each
  player's own hex-gradient background — this is docs/VISUAL_SPEC.md's own
  "Lake Tahoe beach" direction, which that doc's character-gen section
  already flagged as deferred for victory/boot; done here for victory on
  direct ask. Boot's still on the older "arena" language — separate,
  still-open follow-up, not touched.
- **Composite is now required for every player, not just Matthew.**
  `victoryScenePrompt`/`victorySceneClipPrompt` (Matthew-only) became
  `namedVictoryScenePrompt`/`namedVictorySceneClipPrompt`, taking the real
  rival list + guest list so the scaffolding (which images are attached,
  background, likeness-fidelity instruction, tone footer) can't drift
  between players while `pose`/`action` stay bespoke.
  `gen:char:composite -- victory <player>` no longer rejects non-Matthew
  players; `gen:char:clip` no longer silently falls back to a generic solo
  clip when the composite scene is missing — it throws, since that silent
  fallback is exactly the wrong-content problem this session fixed.
  README.md's walkthrough updated to match (composite is a per-player step
  now, generate victory last after the whole roster's fullbody images
  exist).
- **Verified by generating the real prompts, not by reading the code** — a
  scratch script (deleted, never committed) ran the actual
  `namedVictoryScenePrompt`/`VICTORY_BEATS` functions against the real
  8-player roster and printed what cli.ts would actually send. Confirmed:
  Tyler excluded from every rival list; each player's own name absent from
  their own rival list; Matthew's scene lists all 6 rivals + Cassandra +
  Bailey (9 reference images) and his clip still closes on them jumping
  into his arms.

**PWA icon set to Matthew's actual headshot**, on direct ask ("unless you
have a better idea" — considered it and didn't have one that beat this:
the medal mark is a fine generic icon but this is a small private group's
app, and a face they'll recognize instantly beats an abstract trophy for a
home-screen icon at a glance).

- `scripts/generate-icons.mjs` gained a `--photo <path>` mode: composites a
  given square image into the *same* beveled-plate frame the medal icon
  uses (same background/bevel colors, same rounded-corner geometry) rather
  than shipping a bare cropped photo — keeps every icon variant reading as
  this app's icon regardless of which subject is inside it. Implemented as
  one shared `plateFrame()` the medal and photo renderers both build on,
  so the frame can't drift between the two modes. `icon.svg` is
  deliberately left as the medal vector in photo mode — a face is
  photographic content, not vector content, so there's no lossless-rescale
  benefit to embedding it there, and it doubles as a fallback if the group
  ever wants to switch back.
  Default (`pnpm run gen:icons`, no flag) is unchanged and still produces
  the medal icon — that path isn't gone, just not what's live now.
- Regenerated all five PNGs (`icon-192`, `icon-512`, `icon-maskable-512`,
  `apple-touch-icon`, `favicon-32`) from Matthew's current live `photo_url`
  — which, per the character-gen pipeline's own design, is already his
  stylized N64-headshot render (`gen:char:upload-photo` pushes that live
  as `photo_url`, superseding the real photo), fetched via `curl` (Node's
  own `fetch` can't reach Supabase through this machine's TLS
  interception, same limitation noted in earlier sessions).
  **The source photo itself is intentionally not committed** — matches
  this repo's existing convention of gitignoring `character-assets/` and
  `reference-photos/`, source art lives outside git and only derived
  output does. To regenerate after Matthew's headshot changes:
  `curl -o /tmp/matthew.jpg <his current photo_url>` then
  `pnpm run gen:icons -- --photo /tmp/matthew.jpg`.
- Checked legibility at real small sizes before committing to this, not
  just at 512px — the source headshot's generous headroom/high background
  contrast (purple radial gradient vs. warm skin/dark hair/white shirt)
  holds up down to the 180px apple-touch-icon and even the 32px favicon.
  The maskable variant scales the photo down further than the medal did
  (same `scale: 0.62` parameter, reused) so a platform's circular safe-zone
  crop doesn't clip his forehead or shoulders.
- Verified: production build + `next start`, confirmed `/manifest.
  webmanifest` and all five PNGs serve 200 with correct dimensions, and
  the rendered `<head>` still links `apple-touch-icon.png` (180x180),
  `favicon-32.png`, `icon-192.png`, and `icon.svg` in that order.

## 2026-08-22 (2) — Real webfonts, a type scale, and a design-review pass

User ask: improve the UI generally, with three specifics — the font
selection should be more on theme; the fonts and some icons ("the let's go
arrow on player selection") look wrong on mobile, "like it's a different
font"; and `/start` wants a more appropriate face for "Bachelor Party" and
"Press Start". Plus: have another agent review the work, and put agents on
making it installable as a web app (that last one is the PWA section below,
merged into this branch). 164 tests (unchanged — no domain logic touched),
lint/typecheck/build green.

### The mobile font bug was real, and it was the tokens

Every font token in `globals.css` was a **system stack** headed by
`"Arial Black"` / `"Helvetica Neue"` / `ui-monospace, "SF Mono"`. None of
those faces ship on iOS or Android. So every phone silently fell through to
its own default UI font while desktop Safari/Chrome resolved the real
thing — the fonts genuinely *were* different on mobile. Not a rendering
quirk, not a weight issue: a different typeface.

- **`src/app/fonts.ts`** (new) loads three self-hosted faces through
  `next/font/local`, pointed at the woff2 files the `@fontsource/*` packages
  ship. **Deliberately not `next/font/google`**: `fonts.googleapis.com` is
  blocked outright on this network (connection-level, not a cert problem —
  `fonts.gstatic.com` is fine), and that loader resolves families at *build*
  time, so a Google-backed font turns every local build and any CI runner
  behind the same proxy into a hard failure. npm works with
  `NODE_EXTRA_CA_CERTS=<repo>/zscaler-ca.pem`, which is how the packages got
  installed. 88KB total for all three.
- Three distinct voices, not one font in three sizes: **Bungee** for the
  marquee (new `--font-title` — the cartridge logo and "Press Start" only),
  **Archivo** for display labels and body, **Saira** for scoreboard numerals
  (semi-condensed, so the Pts/×/Total columns survive a phone).
- **`--font-display` carries `"wght" 800` on the token itself.** It used to
  resolve to Arial Black, which is heavy by definition, so not one of its 47
  call sites ever set a weight class — Archivo is variable and would have
  rendered all 47 at a thin 400. Confirmed against the *built* CSS that
  Tailwind v4 actually emits `--font-*--font-variation-settings`, and that
  no call site sets a competing weight utility. `--font-score` deliberately
  does NOT carry one, because one call site does combine it with
  `font-medium` and variation-settings would silently win.
- **Verified on an emulated iPhone**, not inferred from desktop: UA + touch +
  393px metrics via CDP, then read the computed styles back. All three woff2
  fetched 200; `hud-label` → `fontDisplay` 11px `"wght" 700`; `hud-copy` →
  `fontDisplay` 15px; `font-score` → `fontScore`; `scrollWidth == innerWidth`.

### The logo, and the "different font" it was hiding

`game-logo.tsx` used `textLength` + `lengthAdjust="spacingAndGlyphs"` with a
comment saying it pinned the logo "no matter which font resolves." That was
never really working — it pinned the *width* while the letterforms
underneath changed completely, which is exactly why the logo looked wrong on
phones. Now the face is guaranteed, so `lengthAdjust` is `"spacing"` (flexes
tracking, never distorts glyphs), and the two words' widths are their
**measured** natural advance in Bungee (851 / 521 at size 150, read via
`getComputedTextLength` in a real browser). The old 950/480 were inherited
from a different font and tracked BACHELOR ~14px looser per gap while
squeezing PARTY ~10px tighter — one logo, two disagreeing letter-spacings.

### The arrow

`/select`'s "Let's go ▶" was a literal U+25B6. iOS renders that codepoint
with its colour **emoji** font, so the arrow arrived on phones as a
blue-and-white emoji triangle matching nothing else on screen. Now a lucide
`<Play>`, per the repo's lucide-only rule. (Checked the other glyphs while
in there: the BONUS tile's icon is already a lucide `PartyPopper` — it just
reads emoji-like at tile scale — and the `✓`/`○` in `<option>` elements
can't be SVG anyway.)

### Type scale — the design review's headline finding

An independent reviewer read every screen at both widths. Its central point:
the app had grown 42 `text-xs`, 19 `text-[10px]`, 11 `text-[9px]`, a
`text-[8px]`, and **nine** tracking values, nearly all small tracked
uppercase — four distinct uppercase registers inside a 5px size range on the
leaderboard alone, separated by nothing but tracking. The eye hit the gold
title and found no second stop, so every screen read at one volume.

Two new utilities, and only two: **`.hud-label`** (11px / 0.1em / wght 700 /
caps — the ONE label register) and **`.hud-copy`** (15px, sentence case —
the ONE reading register). Applied at the three components that set the
register for everything else (`Stat`, `GameScreen`, `Panel`), then swept
across 23 more class strings.

**Trap worth knowing about:** `.hud-label` sets a font-size, so pairing it
with any `text-*` utility leaves two size declarations racing on stylesheet
order — and tailwind-merge *cannot* arbitrate, because it doesn't know
`.hud-label` is a size. The sweep hit this twice (`/select`'s confirm CTA,
`/start`'s tagline); both were pulled back out, and the hazard is written
into the utility's own comment. Same family of bug as the `text-extruded`
one this file already records.

Worst single instance fixed: the standings footnote was an explanatory
*sentence* set in 9px uppercase at 0.15em, on a phone, used outdoors.

### Colour, vocabulary, and controls

- **Gold had nine unrelated jobs, so it had none.** Most visibly the
  adjusted score was `text-primary` on *every* row — the colour that should
  mean "winning" painted on last place as brightly as first. Gold is the
  leader's now; everyone else is foreground.
- **One word per concept.** The mobile bar said "Boosts" and "Ranking" while
  the page titles said "Multipliers" and "Leaderboard" — one feature, two
  names depending on screen width. "Boost" appears **zero** times in
  `PRODUCT_SPEC.md` against 23 for "multiplier", and per CLAUDE.md the spec
  owns this vocabulary, so the invented short words went. The width problem
  that forced them is solved properly: on mobile only the **active** tab
  spends room on its label and grows to fit; the rest collapse to icon-only
  with an `aria-label` (which does not recreate the WCAG 2.5.3 concern the
  old code documents — that rule is about disagreeing with *visible* text,
  and there now is none). Inactive tabs also end up with a bigger touch
  target than the cramped columns they replaced.
- **`/` stopped repeating `/start`'s marketing tagline** in the most valuable
  40px of the primary screen. That slot is a live standing readout now
  ("3rd · 127 pts · 47 behind Andrew"), falling back to the tagline before
  anyone is picked or scored.
- **`Badge` restyled at the primitive** — the same route `button.tsx` and
  `card.tsx` already took. These carry real state everywhere (Done, +10%
  catch-up, "Alive — worth 100 pts", "Awaiting result", won/lost/voided) and
  were the last thin-hairline rounded objects in a UI made of beveled
  plates. One edit, ~10 call sites inherit it.
- **Multiplier bar got real step controls.** Eleven segments share a phone's
  width, so a notch is ~30×24px — no layout work makes that a 44px target,
  and this control is operated outdoors by people several drinks in where a
  mis-tap silently moves budget. Beveled −/+ plates either side, segments
  24px → 36px tall. Both new buttons are `tabIndex={-1}` + `aria-hidden` for
  the same reason the segment buttons already are: the `role="slider"` is
  the one accessible control and owns the arrow keys.
- The multiplier **label column was a flat `w-28`** with a comment claiming
  it fit the longest name. It didn't — at 1280px four of eight rows
  truncated while ~600px sat empty. Widens with the breakpoint now.
- `/bets`: "Cancel" was a flat `ghost` button (the app's only unbeveled
  control) beside a beveled "Edit", destructive, at ~45×20px. Now an equal
  plate. Its subtitle broke as "PER-" / "EVENT"; `text-balance` can't fix
  that because a real hyphen is a valid break opportunity, so the character
  is U+2011 now.

### Tooling

`scripts/devtools/` now honours `BASE_URL` / `PORT` / `CDP_PORT`, so a second
worktree running its own dev server screenshots **its** app rather than
whatever happens to hold port 3000. That matters as soon as two agents work
in parallel, which is how this session ran.

### Still open — the review's remaining findings

Ranked roughly by the reviewer's own impact ordering:

1. ~~The Recharts progress chart~~ — **done, see `rank-ladder.tsx`.** (An
   agent was dispatched for this first and died on an account session limit
   before writing a line; the tree was verified clean and it was then built
   directly.) The ladder renders below `sm`, the line chart from `sm` up.
   Worth knowing if you touch it: measuring rank movement first-to-last is
   wrong, because the opening moment has everyone who wasn't in that event
   tied on zero and competition ranking compresses them into one joint
   place — that manufactured phantom six-place drops that summed to -21
   across the field. It measures the most recent hop instead. **What's still
   open here is the desktop chart**, which is untouched and remains a
   configured Recharts rather than a designed object.
2. **`/bets` is the weakest screen.** It opens with rules rather than state,
   its overall-bets table is 6-of-8 rows of em-dashes pre-lock, and "Your
   picks" sits at the *bottom*. Invert it: lead with the status readout, put
   the rules behind a disclosure, make the Win/Place columns real toggle
   cells.
3. **Native `<select>` × 11.** The closed control is styled but has no
   chevron and throws an OS wheel over the console on iOS. `/select` and
   `overall-betting.tsx` already show the right answer (a roster of plates).
   Groom-only admin rows can stay native.
4. **Rank chips on the standings are lying** — they use `chartColors`
   *identity* colours but, sitting in a rank badge, read as a green→red
   status ramp. Make them read as identity (a ring, matching the avatar) or
   make them a real rank ramp.
5. **`/events` tiles carry almost no information** — no status band, no "your
   multiplier", no winner on finished ones.
6. **`/start`'s logo has no relationship to the boot video** (arbitrary
   groom-uploaded content), and `/select` still has ~200px of dead space
   between the roster and the bust.

## 2026-08-22 — Installable PWA (manifest, icons, iOS standalone, safe areas)

Makes the app add-to-home-screen-able so the eight players run it as an app
for the weekend rather than as a Safari tab. 164 tests (unchanged — no
domain logic touched), lint/typecheck/build green, verified in a real
production build behind headless Chrome.

- **`src/app/manifest.ts`** — Next's typed manifest route, served at
  `/manifest.webmanifest` (verified with `curl` against `next start`).
  `standalone`, `portrait`, `start_url: "/"`, and `background_color`/
  `theme_color` `#070926`, which is the actual `--background` token
  converted to sRGB. `viewport.themeColor` in `layout.tsx` was `#1f1c17`
  — a leftover from the warm amber palette PR #18 landed, several shades
  off the blue/black the app has actually been since — so it moved to the
  same `#070926`; that's the only value changed there.
- **Icons are generated, not hand-drawn** — `scripts/generate-icons.mjs`
  (`pnpm run gen:icons`, uses the `sharp` we already have) rasterises one
  on-theme SVG into `public/`: 192, 512, a 512 maskable padded into the
  80% safe circle, a 180 apple-touch-icon, a 32 favicon, plus the source
  `icon.svg`. The mark is a `.bevel-raised`-style console plate holding a
  gold medal — pure geometry, no font dependency — and the script converts
  the `oklch()` tokens from globals.css to sRGB itself so re-running after
  a palette change keeps the icons honest.
- **Safe-area insets are tokens, not inline `env()`** — `--safe-top/right/
  bottom/left` in globals.css, consumed by two new utilities:
  `nav-inset-safe` (the floating mobile tab bar, previously
  `inset-x-4 bottom-4`) and `screen-pad-block` (GameScreen's `py-6 pb-28
  sm:pb-6`). Both live in `@utility` blocks with the `sm:` case *inside*
  `screen-pad-block`, because a custom utility and `pb-*` are the same
  specificity and Tailwind's own sort order — not source order — decides
  which wins; same trap `bevel-none` already documents. `/start`'s footer
  and `/select`'s column use `calc(... + var(--safe-*))` directly since
  they don't go through GameScreen. Verified live at 390px by overriding
  the tokens to a notched phone's 59px/34px: main padding went 24/112 →
  83/146 and the nav's `bottom` 16 → 50, with the zero-inset case
  byte-identical to the old layout.
- **Service worker is deliberately almost nothing** (`public/sw.js`,
  registered in prod only by `service-worker-registrar.tsx`). It caches
  `offline.html` + the icons and nothing else: this is a realtime Supabase
  scoreboard, and a cached leaderboard that *looks* current is worse than
  no leaderboard. Navigations are always network, falling back to the
  offline card only when the fetch genuinely throws — verified by killing
  the server and reloading, not by trusting the code. What it buys is an
  honest offline screen and Chrome-on-Android installability (which needs
  a fetch handler that can answer a navigation).
- **Not done**: no iOS splash-screen images (`apple-touch-startup-image`)
  — they need one PNG per device size and iOS 15+ generates a decent one
  from the manifest anyway; no install prompt UI; no left/right safe-area
  padding on the page gutters (the app is portrait-locked, where those
  insets are 0).

## 2026-08-19 (4) — `/bets` rework: overall picks as a roster list, per-event bets view-only

User ask: make picking the overall win/top3 bet feel like the Odds tab's
per-event betting (event-odds-betting.tsx) — a roster list with Win/Place
columns and buttons, not the old two `<select>` dropdowns. Once the weekend
starts (any event leaves "planned"), that same list should re-sort by
however many picks each candidate received and swap the button columns for
the photos of whoever picked them. Separately: stop letting people place
new per-event bets from `/bets` at all (that's the Odds tab's job now,
since #23–#24 put a full wager form there) — this page should just be a
single read view of a player's own per-event bets, past and future, with
edit/cancel for whichever ones are still on a "planned" event. 153 tests
(unchanged — pure UI rework, no new domain logic), lint/typecheck/build all
green.

- **New `src/components/overall-betting.tsx`**, replaces the two
  `OVERALL_BET_TYPES.map(...)` dropdown blocks and the separate "Everyone's
  overall bets" reveal panel that used to live in `bets/page.tsx`. One
  roster list, ordered alphabetically pre-lock; once `weekendStarted`, it
  re-sorts by total picks received (win + top3 combined, ties alphabetical)
  and each column swaps from a clickable odds button
  (`placeOverallBet` fires immediately on click — no separate confirm step,
  since unlike a per-event wager there's no amount to review first) to a
  new `PickerAvatars` — a small overlapping stack of the bettors' photos,
  `title`-tagged with each name, `-ml-2` overlap with a `border-background`
  ring so overlapping photos don't blend into each other. A player's own
  pick/status/switch-when-eliminated summary is a compact `bevel-sunken`
  panel below the list (same shape as the Odds tab's "Your bet" panel),
  instead of being interleaved into each bet-type block like before.
- **`bets/page.tsx`'s per-event section** now maps `events` to this
  player's own `perEventBets` (`myPerEventBets`, filters out events with no
  bet) instead of `bettableEvents` — no more "Pick a player…" selects for a
  *new* bet. `canEdit = bet.status === "open" && event.status === "planned"`
  gates Edit/Cancel; resolved/void/still-in-progress bets render as a plain
  read row with a final Won/Lost/Voided badge. `handlePlacePerEvent` deleted
  outright (dead code — nothing on this page inserts a bet anymore);
  `startEditingPerEvent`/`handleUpdatePerEvent`/`discardPerEventEdit`/
  `handleCancelPerEvent` kept as-is, same mutations as before.
- **Verified against the real live Supabase project**, not just typechecked
  — copied `.env.local` into this worktree (gitignored, deleted again
  before committing), ran the real dev server behind headless Chrome
  (`scripts/devtools/`), screenshotted `/bets` at 430px and 1280px against
  actual production data: 8 real players, weekend already underway (golf
  scoring, 2 events resolved), one real overall bet pair (Matthew → Joe to
  win, Tyler to place) and one real per-event bet (Matthew → Josh to place
  top 3 on the still-planned Catan). Confirmed live: the roster re-sorts
  Joe/Tyler to the top, the Win/Place avatar cells correctly show Matthew's
  photo only in the cells matching his actual picks, the "Your picks" panel
  reads both bet types correctly with live Alive/worth-N-pts badges, and
  the Catan bet shows with working Edit/Cancel since it's still "planned."
  `check-overflow.mjs` clean at 390px on all five routes. Read-only
  verification throughout — never clicked a live Place/Edit/Cancel button
  against the real bets, to avoid mutating actual pre-event game state.
  One pre-existing, unrelated thing the screenshots surface: player photos
  render as a broken-image glyph in this sandboxed dev server (`fetch
  failed: unable to get local issuer certificate` from Next's image
  optimizer hitting Supabase Storage over this machine's TLS interception)
  — visible on the nav avatar too, not something this session's code causes
  or can fix locally; will render fine on the real Vercel deploy.
- **Not built, out of scope for this session**: no change to
  `event-odds-betting.tsx` itself (per-event placement stays exactly where
  it already was, on the Odds tab) — this session only touched where
  *overall* bets get placed and where per-event bets get *reviewed*.

## 2026-08-19 (3) — Column spacing, catch-up preview before scoring starts, locked-icon-only, side-by-side reserve stats, bet-form alignment

Real-use feedback batch after (2) — **this app is now genuinely being used
live**: `events` shows a real in-progress "Nine Holes of Golf" with one
player's actual result already entered, and real per-event bets exist.
Screenshot/live verification this session was careful to only ever click
"Edit" on a real bet form and never "Save changes" — nothing in this
session's testing wrote to live game data, unlike some earlier sessions
which mutated-then-restored specific rows. 153 tests (unchanged),
lint/typecheck/build all green. **Not yet merged** — pushed as
`fix-pass-4`, left as a PR for the next session to pick up per explicit
request (a fresh session is starting on `/bets` next).

- **Event results columns widened further**: the spacer columns added last
  session (`event-card.tsx`, between Pts/×/Total) went from `0.75rem` to
  `1.5rem` — the first pass wasn't enough.
- **Catch-up bonus preview now shows before an event starts scoring** —
  this reverses part of (2)'s own change, on direct user feedback that
  showing nothing until scoring starts was worse than showing a
  best-guess. `upcomingCatchUp` (`fromRows.ts`) now prefers an actively
  `"scoring"` event same as before, but **falls back to the lowest-
  `sort_order` "planned" event** when nothing's scoring yet, returning a
  new `confirmed: boolean` alongside `eventId`/`bonuses` so the UI can word
  a live "the event currently being scored" differently from a "up next
  going by the current running order — may change" guess. Both matter: the
  fallback answers today's "I don't see a preview before it starts," and
  `confirmed` preserves the earlier, still-valid point that a merely
  "planned" event isn't a promise about what's actually played next.
- **Multiplier bar's "Locked" text badge removed** (`multiplier-bar.tsx`)
  — reverted to icon-only, on explicit feedback that combined with the
  segments' desaturated colour (kept from last session), the text was
  redundant. Straightforward revert of one specific piece of (2)'s locked-
  clarity change, not the whole thing.
- **Budget Remaining / Tied Up in Open Wagers are now side by side**
  (`multipliers/page.tsx`), not stacked — two short readouts don't need a
  full stacked column's worth of vertical space, especially on a phone.
  Numbers went `text-3xl` → `text-2xl` to fit comfortably at half width in
  the narrow desktop aside column too.
- **"Place a bet" form on the Odds tab reworked into real aligned columns**
  (`event-odds-betting.tsx`): added a separate **Odds** column between
  Wager and Payout (previously payout and odds were mashed into one string,
  "12.4 (2.3×)"); the label row (Wager/Odds/Payout) and value row now share
  matching fixed column widths so labels sit directly over their values —
  they didn't before, because label+value were two independent flex
  columns of different heights, bottom-aligned (`items-end`), so Payout's
  shorter column left its label sitting lower than Wager's. Value row is
  `items-center` so the Odds/Payout numbers and the Input/Button(s) all
  centre against the tallest thing in the row instead of each sitting on
  its own baseline. The trailing button group (Wager/Save changes +
  Discard) has no label of its own and is the one thing allowed to wrap
  onto its own line — verified live that this actually happens gracefully
  on a real phone width in the edit-with-two-buttons case, the tightest
  one; the common single-button case fits on one line at both widths.

## 2026-08-19 (2) — Multiplier autosave, /select confirm flow, locked-event clarity, "You" highlighting, mobile autoplay

Same-day follow-up on the batch below, after a real look at what shipped.
153 tests (+1, the degenerate-first-event `upcomingCatchUp` case),
lint/typecheck/build all green. Live-verified against the real Supabase
project via headless Chrome + CDP — including scripting an actual slider
click with **no button clicked afterward** to prove autosave, and a full
preview-then-confirm click sequence on `/select`.

- **Multipliers now autosave — no Save button.** `handleSave` fires from a
  debounced `useEffect` keyed on `draft` (`multipliers/page.tsx`) instead of
  a click handler: every slider move (or Reset to even) reschedules a
  500ms timer, and whichever edit is the last one in a burst is the one
  that actually writes — same debounce shape as `gameStore.ts`'s realtime
  refetch from earlier today, for the same reason (don't fire a write per
  click). Runs from an effect specifically so the closure that fires always
  has that render's fresh `draft`/`validation`, not a stale one captured by
  a handler-local timer. A hydrate-triggered `draft` change (mount, or
  switching player) safely no-ops since `handleSave`'s existing diff-only
  logic finds nothing changed to write. The A-button binding that used to
  trigger a manual save is gone; D-pad up/down (row picking) still works.
  Verified live: clicked a segment with no button anywhere on screen,
  watched the status line go idle → "Saving…" → "Saved ✓" and the DB row
  actually change, with no click after the slider itself.
- **Removed "Available to wager"** from `/multipliers` — it's the same
  number as Budget Remaining once anything's saved (both derive from the
  same committed-multiplier math, see `reserve.ts`), so showing both was
  the same fact twice. Kept "Tied up in open wagers" — that one's genuinely
  different information.
- **Event multiplier list now sits in a `Panel`** (title "Event
  multipliers", `Sliders` icon — same icon `AppNav` already uses for this
  tab) instead of a bare `bevel-sunken` list straight on the page
  background, matching the bevel-consistency fix applied to the leaderboard
  earlier today.
- **Locked vs. unlocked events are now unmistakable**, not just a faded
  row + small icon: locked rows get an explicit "LOCKED" text badge (not
  icon-only) and their filled segments render in a flat desaturated grey
  instead of the player's own colour — colour reads as "live, mine, can
  still move" everywhere else in this app, so a full-colour locked bar was
  undercutting its own lock icon.
- **Catch-up bonus preview no longer disappears** when nothing's currently
  being scored — `/events`' new section (added earlier today) is now
  always rendered with three states (an active preview with names/badges;
  "scoring X now, nobody qualifies yet"; "nothing being scored right now")
  instead of only rendering in the first case. Also fixed a real edge-case
  bug while in there: `upcomingCatchUp` previewed a bonus for *nearly
  everyone* on the very first event ever scored, because with zero
  resolved history every player is trivially tied at 0 and
  `catchUpBonuses` on a fully-tied field hands the bonus to the whole tied
  group. Now mirrors the same "no bonus on the very first resolved event"
  guard the real scoring path already had.
- **Leaderboard and progress chart now clearly mark "your" row/line.** The
  table row got a left border + background tint in the player's own
  colour (same colour as their rank badge and chart line) plus a "You"
  tag — the previous `bg-card/70` tint was barely distinguishable from the
  zebra striping already on the table. The chart line for the session
  player is thicker (3.5 vs 2), full-opacity while every other line dims
  to 0.55, drawn last so it's never buried under a crossing line, and its
  markers are slightly larger; the legend entry is bold with its own "You"
  tag. New optional `currentPlayerId` prop on `ProgressChart`.
- **Mobile boot-video autoplay fixed** (`/start`) — `autoPlay`/`muted` as
  JSX attributes alone aren't reliable on mobile Safari/Chrome (a known gap
  between the DOM attribute and the property autoplay policies actually
  check). Switched to the same ref + imperative `video.muted = true` +
  `.play().catch(() => {})` pattern `character-render.tsx` already used for
  character clips — applied to the boot video and, since it's the same
  bug, `/select`'s confirm-clip video too.
- **`/select`'s confirm flow, actually fixed, not just described.** Two
  real gaps: (1) the visible "← Back" link is gone (explicit ask) — the
  underlying B-button/gamepad back-to-`/start` behavior is untouched, only
  the on-screen link is removed; (2) **clicking a roster tile no longer
  instantly confirms your pick.** It used to — `useMenuNav`'s default
  `onClick` both moves the cursor *and* calls `onConfirm`, which is a
  reasonable "hover previews, click commits" model for a mouse but leaves
  a touch user with no preview step and, after this session's earlier
  legend removal, no visible hint that tapping = committing. Tiles now
  override `onClick` to only call `setIndex` (preview only, same as
  hover/D-pad); a new explicit **"Let's go ▶" button** below the focused
  character (visible whenever one's focused) is the one deliberate confirm
  action for every input method, calling the same `onConfirm` A/Enter
  already triggered — plays the player's confirm clip if they have one,
  same as before. Verified live: tapped a different roster tile (stayed on
  `/select`, previewed correctly), then tapped "Let's go" (routed away) —
  a real click-sequence test, not just reading the code.

## 2026-08-19 — Catch-up bonus targeting fix + section move, save-speed fix, leaderboard bevel, column spacing, Power Move removed

Follow-up batch the day after (5), same PR pattern: a short punch list plus
one real logic bug. 152 tests (+2, both `upcomingCatchUp`), lint/typecheck/
build all green. Screenshot- and live-DB-verified via headless Chrome + CDP
against the real Supabase project, same approach as prior sessions —
credentials copied in and removed again after.

- **Real bug, the catch-up bonus preview was targeting the wrong event.**
  `upcomingCatchUp` (`src/lib/scoring/fromRows.ts`) used to pick "whichever
  not-yet-resolved event has the lowest `sort_order`" as the one about to
  score next. The user pointed out real play order routinely doesn't match
  the configured list order — the groom might start event 6 before event 2.
  Now it targets `status === "scoring"` specifically (set the instant the
  groom hits Start on an event, `event-card.tsx`'s `startScoring`) — the one
  unambiguous "this is actually being played right now" signal. If nothing
  is currently being scored, it returns `null` rather than guessing at a
  "planned" event, since there's genuinely no reliable way to know which one
  comes next until it's started. Verified live: set a *higher-sort_order*
  event to `"scoring"` while a lower-sort_order event sat `"planned"`, and
  the preview correctly followed the scoring one, not the list order.
- **Catch-up bonus moved to its own section** on `/events`
  (`src/app/events/page.tsx`), between the event tile strip and the focused
  event's detail card — previously it lived inside whichever `EventCard`
  happened to be focused (gated on `event.status === "planned"`, removed
  from `event-card.tsx`), so it disappeared/changed depending on cursor
  position and could show on the wrong card entirely. Now it's decoupled
  from focus: always shows (when something's being scored) which event and
  which players get it, independent of what's on screen below. Exported
  `CatchUpBadge` from `event-card.tsx` so the new section reuses the same
  badge rather than a second copy.
- **"Saving is slow" — a real, structural cause, not just perception.**
  `gameStore.ts`'s realtime subscription refetches *all 8 tables* on every
  single `postgres_changes` message, and Postgres/Supabase Realtime fires
  one message *per row* a write touches — so saving multipliers (which
  previously wrote every "planned" event's row on every click, changed or
  not) could fire 6-8 concurrent full refetches for one Save click. Two
  fixes, both in this PR: (1) `handleSave` (`multipliers/page.tsx`) now only
  upserts sliders that actually moved, diffed against `committed`, instead
  of rewriting every planned event unconditionally; (2) `gameStore.ts`'s
  realtime handler is now debounced 300ms (`scheduleRefetch`) so a burst of
  change events — from this or any other multi-row write, e.g.
  `setEventRanking`'s wipe-then-insert — collapses into one refetch instead
  of piling up. Re-verified the save itself still round-trips correctly
  end-to-end against live Supabase after both changes.
- **Leaderboard's standings table now sits inside a `Panel`**
  (`src/app/page.tsx`, titled "Standings", `ListOrdered` icon) — it used to
  be a bare `bevel-sunken` table straight on the page background, a
  different bevel treatment than the `Panel`-wrapped Progress chart sitting
  right below it on the same screen. Same raised-card frame now, same
  screen.
- **Event results table: more space between Pts / × / Total**
  (`event-card.tsx`). Real `gap-x` isn't an option here — the existing
  comment explains why: rows are `display: contents` so the zebra stripe is
  painted per-cell, and a real grid gap leaves an unpainted, unstriped
  seam. Added two thin spacer grid columns (hidden below `sm`, matching the
  columns they separate) instead, so the numbers get breathing room without
  breaking the stripe.
- **Power Move removed** — component, `spendPowerMove`/`fetchPowerMove`,
  the `powerMove` store field and its `PowerMoveRow` type, and the
  `PowerMoveCard` render on `/setup`, per explicit ask ("doesn't seem like
  that does anything"). `PRODUCT_SPEC.md`'s two mentions updated to match
  (source-of-truth doc, so a real product decision like this belongs there
  too, not just in code). Deliberately left `power_move` alone in the DB:
  `resetWeekend` still clears that table as part of a full reset, and the
  table/migration itself is untouched — removing the UI doesn't require a
  schema change, and dropping a live table wasn't asked for.
- **Confirm clip vs. fullbody clip, answered inline (no code change)**:
  `character_fullbody_video_url` is the idle loop — plays continuously
  while a character is on screen (the focused render on `/select`, the
  aura'd character on `/multipliers`). `character_confirm_video_url` is a
  one-shot "you're now playing as ___" cutscene that plays exactly once,
  full-bleed, right after hitting "Let's go" on `/select`, before routing
  into the app (`ConfirmClip` in `select/page.tsx`) — distinct clip, distinct
  moment, not a variant of the idle one.

## 2026-08-18 (5) — Legend removal, starfield everywhere, leaderboard reorder, chart rank-change bug, reserve restyle

Follow-up batch after (4), same day: a UI cleanup list plus a re-report of
the multipliers save bug that (4) claimed to have fixed. 150 tests
(unchanged), lint/typecheck/build all green. **Screenshot- and live-DB-
verified**, not just reasoned about — headless Chrome via CDP
(`scripts/devtools/`) against the real Supabase project, credentials
copied in from the main checkout's `.env.local` and removed again after.

- **Bottom controller-action legend removed everywhere** (`ButtonLegend`
  deleted, `GameScreen`'s `legend` prop removed) — the explicit ask was to
  drop things like "A · Change competitor" along the bottom of every
  screen. This also meant `/select`'s own separate `ButtonLegend` call
  (Choose/Confirm/Back) came out too.
- **Starfield background on every screen**: `GameScreen` (the shared shell
  for `/`, `/events`, `/multipliers`, `/bets`, `/setup`) now renders the
  same drifting-dot `Starfield` component `/select`/`/start` already had,
  at the same `opacity-60`. Those two screens build their own layout
  outside `GameScreen` and already had it, so this covers the app.
- **`/select` heading → "Choose your character"** (was "Select Your
  Competitor" — a different string than what an earlier, since-reverted
  handoff entry claimed was already live; confirmed against the actual
  file, not the old note).
- **Real bug, found by reasoning through `cumulativeSeries.ts` +
  `progress-chart.tsx` together**: the chart's synthetic "start" point has
  every player tied at 0, so competition-ranking gives everyone rank #1
  there. The tooltip's rank-change diff used that as "previous" for the
  first real event, so anyone except the actual leader showed a
  manufactured ▼ (prevRank 1 vs. their real rank) — exactly the "a lot of
  people show -1 place when they didn't actually move" the user reported.
  Fixed in `ProgressTooltip` (`src/components/progress-chart.tsx`):
  rank-change is now `null` (renders nothing) when the previous point is
  the `"start"` baseline, since there was no real prior ranking to have
  moved from. Points-gained is untouched — gaining points from a real zero
  is a genuine, correct number.
- **Progress chart moved below the leaderboard** on `/` — was above the
  podium/standings table, now after it, per explicit ask.
- **`/multipliers` betting reserve restyled**: the two reserve figures
  (Available to wager / Tied up in open wagers) previously lived in a
  separate full-width `Panel` below the two-column grid, styled with the
  generic `Stat` component (small figure, side-by-side). Now they're two
  more sunken boxes in the same left-hand aside column as the Budget
  Remaining counter, using that counter's own exact markup shape (uppercase
  label, big `font-score` number) — same look, same column, addressing
  both the "style it like budget remaining" and "why is one in the left
  column and the other full-width" complaints at once. `Panel`, `Stat`,
  and the `Coins` icon import are gone from this page as a result — nothing
  else on the page still used them.
- **Multipliers save bug re-investigated, not re-fixed — confirmed already
  fixed**: the user reported the exact symptom (4) describes as fixed
  ("adjustments don't save, no funds show up in Events after"). Read
  `confirmSave`/`handleSave` line by line — the useCallback that caused the
  original bug is genuinely gone, `grep` for `useCallback`/`useMemo`
  confirms nothing wraps the save path anymore. Then verified for real
  rather than trusting the read: a scripted CDP session loaded
  `/multipliers` against the live project, clicked a slider segment,
  clicked Save, and the write round-tripped — DB row went `1 → 0.5`,
  button showed "Saved ✓", zero console errors. Restored the row to `1`
  afterward via a direct PATCH. **If this is still happening for the user
  in practice, it's very likely a stale Vercel deploy** (this fix and
  today's are both only on this branch / the just-merged (4) branch, not
  necessarily what's live) rather than a code bug — worth confirming the
  Vercel deployment has actually picked up `main` before looking for
  another cause.

## 2026-08-18 (4) — Multipliers save bug + a real N64 UI consistency pass

Two asks: "the adjustments on the multipliers page aren't saving", and a
visual/consistency pass toward an awwwards-level bar, checked by another
model and iterated on. 150 tests, lint/typecheck/build green.

**This session finally has screenshots.** Every prior entry carries the same
"not independently screenshot-verified — no browser driver in this
environment" caveat. That turned out to be false: `npx playwright` can't
install behind this machine's TLS interception, but **Google Chrome is
installed and Node 22 ships a global WebSocket, which is all the DevTools
Protocol needs**. `--headless --remote-debugging-port=9222` plus a ~90-line
zero-dependency CDP script gives full-page screenshots at any viewport,
computed-style probes, and scripted clicking. Worth rebuilding for any
future UI session — it caught several things that reasoning alone did not.

### The save bug (real, and completely silent)

`confirmSave` in `src/app/multipliers/page.tsx` was
`useCallback(..., [validation.valid])`. `useCallback` freezes the
`handleSave` closure from the render where its deps last changed — and
`validation.valid` is already `true` on the very first render (no events
loaded yet → nothing allocated → nothing over budget), so it never changed
again for anyone staying within budget. That frozen `handleSave` had closed
over `player === undefined` (the store hadn't loaded at mount) and returned
at its own first line. No write, no error, not even a "Saving…" flicker.
Both the Save button and the gamepad A path went through it, so saving was
dead outright. Now a plain unmemoised function — `useGameInput` keeps its
handlers in a ref and re-reads them per event, so a stable identity bought
nothing. **Verified end-to-end through the real UI against the live
Supabase project**: changed a slider 1.0 → 0.7, saved, hard-reloaded, value
came back 0.7. (Test mutation restored to 1.0 afterwards.) Also added a
"Saved ✓" confirmation, since a successful save previously changed nothing
on screen and was indistinguishable from one that did nothing.

Non-obvious corollary: going over budget and back under would have minted a
fresh closure and "fixed" saving for that session, which is probably why
this survived as long as it did.

### Two bugs the screenshots found that no amount of reading would have

- **`cn()` was silently deleting `text-extruded`.** `cn` runs
  tailwind-merge, which treats `text-extruded` and `text-extruded-gold` as
  competing `text-*` utilities and keeps only the last — so the leaderboard
  title lost its font, its uppercasing and its entire extrusion. It only
  showed up by reading the rendered `className` off the DOM. Renamed to
  `extruded` / `extruded-gold`, outside the `text-` namespace, so the pair
  can never be merged away again. (This one was self-inflicted: on `main`
  they were a plain string, and routing them through `cn` in the new shared
  header is what broke them.)
- **Variant-prefixed custom classes were generating nothing.** `.bevel-*` /
  `.is-cursor` lived in `@layer components`, and Tailwind v4 only emits
  variants for things it knows are utilities — so `data-[state=active]:bevel-raised`
  on the event card's active tab had always been dead. Converted to
  `@utility`; confirmed by diffing built CSS before/after (1 `bevel-raised`
  selector → 3).

### Consistency pass

- **New `GameScreen` / `Panel` / `Stat`** (`src/components/n64/`). `/bets`
  and `/setup` were still on a completely different page grammar
  (`max-w-2xl`, `min-h-screen`, left-aligned italic `PageHeading` left over
  from the deleted theme-picker era, plain shadcn `Card`s) from the three
  N64-converted screens. All five now share one shell.
  `src/components/page-heading.tsx` deleted.
- **`bevel-sunken` is now shadow-only, paired with a real `bg-sunken`
  token.** It used to bake in its own `background-color`, which any `bg-*`
  would silently beat — that's how the event card's tab strip ended up
  painting shadcn's `bg-muted`. As a real colour utility tailwind-merge
  resolves it properly instead of two rules racing.
- **Whole-number scores** on the leaderboard and `MedalTable` (were 1dp).
  `PRODUCT_SPEC.md` → Scoring is explicit: "no scoring currency in this app
  ever shows a fraction, full stop" — and the event card already rounded,
  so two screens disagreed about the same player's score.
- **Phone fixes:** the leaderboard's "Adjusted" column and the event card's
  "Total" column were both pushed off-screen inside horizontal scrollers
  (the two numbers those tables exist to show); the least important column
  now drops below `sm` instead. Multiplier rows stack so full event names
  fit. Nav labels shortened so they stop truncating mid-word. Verified no
  page-level horizontal overflow at 390px on any screen.
- **Progress chart:** dropped trailing not-yet-played events (over half the
  plot was empty columns, reading as broken), smaller markers, and
  photo-less players' dots now carry their initial.

### Chart colours — a measured limit, not a fix

A reviewer called the 8 series colours ambiguous. Ran them through the
dataviz skill's `validate_palette.js`: they pass adjacent-pair mode but
**fail `--pairs all`** (worst CVD pair ΔE 1.6 deutan; `#e66767`↔`#d95926`
only ΔE 7.1 for *normal* vision). Then searched evenly-spaced 8-hue sets
across lightness/chroma/rotation — **every one also fails**. Eight
simultaneous categorical hues is simply past what a palette can separate,
which is what that skill warns about. So the palette is unchanged and the
markers carry a letter as secondary encoding instead. Re-run the validator
before touching `DARK_HEX` in `src/lib/chartColors.ts`.

### Still open / deliberately not done

The second reviewer's central point stands and is **not** addressed: the
N64 treatment is on the chrome, while some things the user actually
operates are still library defaults — native `<select>`s (styled, but still
native), lucide's thin line icons against chunky beveled plates, and the
progress chart being a configured Recharts rather than a designed object.
Closing that is a bigger piece of work than this session had room for, and
it's the main thing between here and the bar the user asked for.

Also untouched: `/select`'s large vertical dead space between the roster
strip and the character; `/start`'s "Press Start" only being visible on the
blink's on-phase (fine live, awkward in screenshots).

## 2026-08-18 (3) — Real bug: reserve mismatch between screens, Odds tab table polish

User caught a real discrepancy: `/multipliers` showed 0 available to
wager, but the Odds tab showed 2.0 available for the same player at the
same moment. 150 tests (3 new, `allocatedMultiplierTotal` in
`budget.test.ts`), lint/typecheck/build all green, dev-server smoke test
of `/`, `/events`, `/bets`, `/multipliers` (clean compiles, 200s).

- **Root cause, a genuine bug**: `bettingReserve`'s `allocatedToEvents`
  argument was computed two different ways in two places.
  `/multipliers` (`src/app/multipliers/page.tsx`) correctly defaults an
  event with no saved `multipliers` row yet to `MULTIPLIER_DEFAULT` (1.0)
  — a player who never touched a slider is implicitly still at the
  default, not 0. But `/bets` and the Odds tab (`events/page.tsx`) both
  summed via `multipliers.filter(...).reduce((sum, m) => sum + m.value,
  0)` — which only sums rows that actually exist in the table, silently
  treating an unsaved-but-default event as contributing 0 instead of 1.0.
  For a player with 2 events never explicitly saved, that's exactly a 2.0
  undercount — which is exactly the discrepancy reported. Fixed with a new
  shared pure helper, **`allocatedMultiplierTotal`**
  (`src/lib/multipliers/budget.ts`, +3 tests), used by both `/bets` and
  `/events` now instead of each hand-rolling the wrong version.
  `/multipliers`' own calc is intentionally untouched — it correctly mixes
  live draft values (for still-unlocked events) with committed ones, which
  the generic helper doesn't model.
- **Odds tab now defaults to the Odds tab** for any event that hasn't
  started yet (`event-card.tsx`: `defaultValue={event.status === "planned"
  ? "odds" : "results"}`) — Results stays the default once there's
  something to show there.
- **Odds table reworked into a real two-column table**
  (`event-odds-betting.tsx`): a header row now labels the right-hand
  columns "Win" and "Place" (was unlabeled), the odds figure and its
  button are merged into one (the button's own label is the payout, e.g.
  "2.3x", instead of a separate plain-text odds span next to a
  same-labeled "Win"/"Place" button), and the gap between the two columns
  widened (`gap-4`, was `gap-1.5`) per the explicit "more space" ask. Both
  columns are a fixed width (`w-16`) so they stay aligned under their
  headers regardless of digit count.
- **Clicking a Win/Place button now focuses (and selects) the wager
  input** — a new `wagerInputRef` passed to the (previously plain,
  non-forwardRef) `Input` component. This works via React 19's native
  ref-as-a-prop support: `Input` doesn't need `forwardRef` because the
  `ref` key rides through its own `...props` spread onto the underlying
  `<input>`, which is a host element and always honors `ref` however it
  arrives — confirmed by a clean `tsc` pass, this repo's first use of a
  ref on this component.
  - The payout preview is now a labeled stat ("Payout" / "12.4 (2.3×)"),
    matching the label-over-value pattern the Betting Reserve card on
    `/multipliers` already uses, instead of being written out as a
    sentence ("pays 12.4 if correct (2.3×)").
- **Not independently screenshot-verified** — no browser driver in this
  environment, standing limitation. Worth a real look at the new table's
  column alignment on a phone (buttons vs. plain-text odds cells use the
  same fixed width, but worth confirming they actually line up visually)
  and whether the auto-focus/select on the wager field feels right rather
  than jarring.

## 2026-08-18 (2) — Odds tab polish: replay placement, bet edit/cancel, separation

Follow-up feedback on the just-merged "per-event betting on the Odds tab"
work (#23). 147 tests (unchanged — UI wiring only), lint/typecheck/build
all green, dev-server smoke test of `/`, `/events`, `/bets` (clean
compiles, 200s).

- **"Replay" moved out of the Results tab body and into the tab-row
  itself**, right-aligned next to Results/Odds/Bets
  (`src/components/event-card.tsx`): `TabsList` and `VictoryReplayButton`
  now share a `flex justify-between` row as siblings inside `<Tabs>`, gated
  on `event.status === "resolved"` same as before (the button itself
  already no-ops if there's no winner clip uploaded). Previously it sat
  below the results table, inside the Results tab's own content.
- **Per-event bets can now be edited or cancelled from the Odds tab**
  (`src/components/event-odds-betting.tsx`) — this functionality already
  existed on `/bets` (added in #21, same day as the original per-event
  betting build) but the Odds tab's copy of the wager form was written
  independently in #23 and never picked it up. Ported the same pattern:
  "Edit" pre-fills the pick/target/wager form from the existing bet and
  submits via `updatePerEventBet`; "Cancel" calls `cancelPerEventBet`
  outright. The max-wager calculation adds the bet's own current wager back
  before capping the edit, same reasoning as `/bets` — replacing a wager
  isn't spending on top of what's already escrowed. Both only show while
  the event is still `"planned"`, matching betting's normal close-on-start
  rule.
- **Confirmed the "don't let me wager more than I have" cap was already
  correct** (`bettingReserve`'s `available` was floored at zero in #21,
  and the Wager/Save-changes button was already disabled once the typed
  amount exceeds `maxWager`) — no bug found here, but re-verified end to
  end while touching this file since the user flagged it as a concern.
- **Real visual separation between the odds list and the bet form**: the
  bet section (both the locked "Your bet" display and the open wager form)
  now lives in its own `bevel-sunken` panel with a small uppercase label
  ("Your bet" / "Place a bet"), distinct from the plain bordered rows of
  the odds list above it — previously it was just another item in the same
  flex column with no visual boundary.
- **Not independently screenshot-verified** — no browser driver in this
  environment, standing limitation. Worth a real look at: whether the
  Replay button reads right visually sitting next to the beveled tab
  buttons (different button style, done deliberately — see component), and
  whether the new sunken bet panel's contrast holds up against the card
  background in both light conditions this game is likely played under
  (a phone screen, possibly outdoors).

## 2026-08-18 — Per-event betting moved onto the Odds tab itself

User ask: put the actual win/place wager form directly on each event's Odds
tab on `/events`, not just the read-only payout table that lived there
before — players in that event's own rank order (1 at top), win/place odds
per player, buttons to pick someone to win or place, a wager input, and a
live calculated payout. 147 tests (unchanged — pure wiring over already-
tested odds/reserve math, no new domain logic), lint/typecheck/build all
green, dev-server smoke test of `/`, `/events`, `/bets`, `/setup` (clean
compiles, 200s, run on port 3001 since a local 3000 was already occupied).

- **New `src/components/event-odds-betting.tsx`**, replaces the old
  read-only `event-odds-table.tsx` (deleted — its only importer was
  `EventCard`, now switched over). Same rank-ordered payout list as before
  (`payoutMultipliers` from `src/lib/odds/ranking.ts`), plus: a "Win" and a
  "Place" button per row (not a dropdown, per the explicit ask) that select
  that player as the pick and highlight the row; a wager `Input` capped at
  the session player's unallocated multiplier reserve; and a live payout
  preview (`wager × perEventPayoutMultiplier(...)`). Submits via the
  existing `placePerEventBet` mutation — same call `/bets/page.tsx` already
  made, no new data-layer code. If the player already has an open bet on
  this event it shows locked ("Your bet: ... — Awaiting result") instead of
  the form; if betting's closed (event left "planned") or nobody's picked a
  session player yet, the buttons/form just don't render, odds still show.
- **`EventCard`** (`src/components/event-card.tsx`) gained two new required
  props, `currentPlayerId` and `reserve` (type `BettingReserve` from
  `src/lib/betting/reserve.ts`), threaded down to the new component. `myBet`
  is derived locally from the existing `bets` prop
  (`bets.find(b => b.player_id === currentPlayerId)`) — that prop already
  carried every bet on this event regardless of player, same "secrecy is
  UI-side only" model the Bets tab already relied on, so no new fetch was
  needed.
- **`/events`** (`src/app/events/page.tsx`) now reads `selectedPlayerId`
  from `useSessionStore` and computes that player's `bettingReserve` the
  same way `/bets/page.tsx` does (summed multiplier allocation across all
  events, minus tied-up/lost, plus net from resolved bets) — duplicated
  rather than shared, matching how both pages already independently derive
  things from the same store.
- **Deliberately left `/bets`' own "Per-event bets" card untouched** — asked
  the user directly whether to remove the now-duplicate UI there or keep
  both, and they said keep both for now while comparing the two placements,
  but confirmed they'll ultimately want it in one place only. **Worth
  revisiting**: once a placement is chosen, trim the other one out rather
  than maintaining two UIs over the same mutation indefinitely.
- **Not independently screenshot-verified** — no browser driver in this
  environment, standing limitation. The button-based win/place picker in
  particular (row highlighting, whether the wager form reads clearly under
  a rank-ordered list on a narrow phone screen) is worth a real look before
  treating the visual side as settled — the mechanism (state wiring, mutation
  calls, reserve math) is what's confirmed here, not the on-screen feel.

## 2026-08-17/18 — N64 game-feel ported from a stray local scaffold, four PRs

The user reported PR #18's deployed `/select` didn't match the much richer
N64 look they remembered from "overnight work" — a real gamepad-driven
character-select with procedural low-poly busts, an extruded logo, a
starfield, CRT vignette. Turned out that work never happened in this repo
at all: it lived in a completely separate, disconnected local clone at
`~/Downloads/bachelor-olympics 2` (no git remote, never pushed, hardcoded
8-player mock roster, no Supabase). Confirmed via `AskUserQuestion` before
doing anything. The rest of the session was porting that scaffold's real
system into this repo, wired to real data instead of the mock roster, across
four merged PRs (all squash-merged to `main`, all CI-green):

- **#19** — `/start`, `/select`, `/multipliers`, and the leaderboard (`/`).
  New `src/hooks/use-game-input.ts`/`use-menu-nav.ts` (D-pad/gamepad/keyboard
  menu cursor, `useMenuNav` reused by every screen below), `src/lib/sfx.ts`
  (WebAudio blips, no audio files), `src/components/n64/*` (game-logo,
  starfield, crt-overlay, button-legend, character-render, multiplier-bar,
  nameplate). `character-render.tsx`'s swap seam: real character clip >
  uploaded photo > procedural SVG stand-in colored via each player's
  `chartColors.ts` hex — replaces `character-bust.tsx`'s plain silhouette
  fallback on these screens only; `character-bust.tsx` itself is untouched
  for whatever else still uses it. Caught and fixed one real correctness bug
  while porting `/multipliers`: the scaffold assumed the product's old
  "must hit exactly zero" submit rule, which `PRODUCT_SPEC.md` had since
  relaxed to "must not go negative" — followed the current spec, not the
  scaffold's stale assumption. Had to stack this PR on #18's branch and
  later un-stack it (cherry-pick the real commits onto a fresh branch off
  `main`, re-verify, force-push) after #18 squash-merged and the stacked
  branch false-conflicted against the new `main` — a squash merge doesn't
  leave the original commits behind for a stacked branch to diff against
  cleanly.
- **#20** — Fixed feedback on #19: swapped the warm amber palette for the
  scaffold's actual blue/purple one (explicit user preference), dropped the
  CRT scanline pass (read as literal lines across the screen, kept the
  vignette), and ported `/events` — the `/select` roster-strip pattern
  applied to events instead of players, `EventCard` reskinned **in place**
  (not rebuilt — it's only ever used from this one page) since it's ~500
  lines of real groom-tool logic (start scoring, edit results, cancel/reset,
  photo upload, victory replay) that had no reason to be touched, only
  restyled. Also fixed a real, independently-discovered bug here: `globals.css`'s
  `.bevel-sunken` never had a `background-color`, only an inset shadow — so
  the leaderboard's table (and the multiplier bars) read as floating on the
  bare page background. Added the missing fill; this one CSS fix improved
  every `bevel-sunken` surface added afterward too.
- **#21** — More `/events` feedback (bonus events folded into the roster
  strip as one more tile, selection is click/D-pad only now, not mouse
  hover — new `selectOnHover` option on `useMenuNav`, default `true` so
  `/select`/`/multipliers` are unaffected) **plus two real betting bugs**,
  found while investigating "something with the wager logic is broken":
  `validateAllocations` (`src/lib/multipliers/budget.ts`) never accounted
  for budget already escrowed in an open per-event bet, so a player could
  wager their reserve, then go back to `/multipliers` and reallocate that
  same money to an event — double-spending it and pushing `available`
  negative. Fixed with a new `reservedForBets` param, threaded from
  `/multipliers`. Also floored `bettingReserve`'s `available` at zero
  (belt-and-suspenders) and added the previously-missing ability to
  edit/cancel an open per-event bet before its event starts
  (`updatePerEventBet`/`cancelPerEventBet` in `mutations.ts`, same
  "UI-enforced, no DB constraint" pattern as everything else there). 147
  tests (was 144 before #19, +3 for the budget/reserve fixes).

**Verification approach, all four PRs**: this sandbox has no live Supabase
connection, so every gated screen normally renders blank/loading. Verified
visually anyway via a throwaway local mock — temporarily seeded
`gameStore`'s initial state with realistic mock players/events/bets, set
`groomUnlocked`/`selectedPlayerId`, bypassed `sessionStore`'s `hydrate()`
(it reads empty localStorage and stomps the mock), and added a dummy
`.env.local` so `getSupabaseBrowserClient()` doesn't throw synchronously —
then screenshotted every changed screen with a local headless Chrome
(`chromium-cli` wasn't available; `Applications/Google Chrome.app
--headless=new --screenshot` worked fine), and always `git checkout`'d the
store files + deleted `.env.local` before committing. None of that scratch
state made it into any commit — worth double-checking if a future session
finds `gameStore.ts`/`sessionStore.ts` unexpectedly seeded, that'd mean a
revert was missed.

### Still open

- **`/bets` and `/setup` are unstyled** — still the plain Card-based groom-
  tools look from before this session, not the N64 skin. Not clear they
  *should* get the skin (they're dense admin forms, not console-menu
  screens — `/events` already leaned "N64 chrome over an admin form" and
  came out fine, but that's a judgment call for whoever picks this up).
- Every "verified" claim above is against representative mock data in a
  credential-less sandbox, not the real live Supabase project or the actual
  Vercel preview. Worth a real look there before the event.
- The medal-table screen's podium/table pattern (`src/app/page.tsx`) and
  the multiplier segmented-bar (`multiplier-bar.tsx`) are reusable
  reference points if any other screen wants the same treatment later.

## 2026-08-17 (cont'd, part 3) — Theme picker removed, full N64 identity everywhere

Same day, third pass. The previous two entries below explicitly scoped down
to a bevel-headline-only treatment, reasoning that overriding the Card/Table
look everywhere would compete with the real, groom-facing 8-theme picker.
The user reviewed that PR's preview and explicitly overrode that call: go
full N64 everywhere, theme picker can go, reuse existing shadcn components,
drive it all through tokens. Entered plan mode for this one given the size
(deletes a feature, touches most of the app) — three Explore agents mapped
the theme-picker removal surface, the shadcn-primitive/token architecture,
and the remaining page components before writing a word of code; the actual
diff ended up almost exactly matching that plan.

Full detail is in the commit message on `ea315a2` — the short version:

- Deleted `src/lib/themes.ts` + `theme-applier.tsx`/`theme-picker.tsx` and
  their call sites. Confirmed safe to just drop `ThemeApplier`'s mount in
  `layout.tsx` entirely: its only other job (calling `connect()`) was
  already redundant with `IdentityGate`'s own independent `connect()` call,
  guarded against double-firing. `theme_id` stays an unused column in
  Supabase — no migration, this is a live table with a real event coming up.
- `globals.css`'s `:root` block IS the identity now — promoted from the
  file's own previously-dead `.dark` block (already close to what
  `chartColors.ts`'s validated dark-mode player palette was tuned against)
  rather than invented from scratch, then punched up `--primary`/`--accent`
  since they now carry real UI-chrome duty. New `--bevel-light`/
  `--bevel-dark` tokens + a `.bevel-raised` utility, applied inside exactly
  two files (`button.tsx`'s four "plate" variants, `card.tsx`) — every Card
  and Button in the app inherited the look automatically from there. New
  `Plate` component for freestanding non-Card surfaces.
- `progress-chart.tsx` was the one file needing genuinely new values, not
  just new tokens — recharts/SVG props need literal colors. Recomputed via
  a real oklch→srgb conversion (not eyeballed), status-color contrast
  re-checked against the new dark tooltip surface, `assignPlayerColors`
  flipped to `"dark"` mode (activating an already-validated palette that
  just wasn't switched on before).
- Caught and fixed a real inversion bug before it shipped: `/start`/`/select`
  used `bg-foreground`/`text-background` as a hack to force a dark stage
  regardless of which light-mode theme was active. Once `:root` itself went
  dark by default, that hack would have silently inverted (light text on
  light background) — flipped every occurrence to the new-normal
  `bg-background`/`text-foreground`.
- 144 tests (was 150 — `themes.test.ts` deleted with the code it tested, no
  other change), lint/typecheck/build all green.
- **Verified against realistic seeded data**, not just "it compiles" — same
  Playwright-fixture-intercepting-Supabase-REST approach as the previous
  session, all 7 routes, mobile (440px) and desktop (1280px) width, every
  screenshot actually looked at. Confirms the dark stage, the bevel effect,
  the chart's dark palette, the leaderboard, and the nav's active-tab glow
  all render correctly together, not just individually.
- Still true: no verification against the real live Supabase project or the
  real deployed app — this proves the code composes correctly against
  representative data, not that it matches production right now.
- Small known rough edge, not introduced this session: "Leaderboard" still
  clips slightly on the mobile nav even in normal case (pre-existing
  `max-w-16` column, same as the old "Medal Table" label).

## 2026-08-17 (cont'd) — Bevel heading extended to every screen, verified against seeded local data

Follow-up on the same day's session below, after the user chose "skip real
data, reskin locally with representative fixtures" over sharing live
Supabase credentials or Vercel access. Two things made this worth doing
carefully rather than guessing:

1. **The established N64 idiom is lighter-touch than it first looks.**
   `/start`/`/select` are a dark "boot stage" (`bg-foreground`) plus one
   `text-shadow` bevel trick on the title, sitting on top of a real,
   groom-facing 8-theme picker (`src/lib/themes.ts` — Classic, Olympic,
   Doom 64, etc.) that every other screen deliberately respects. Reskinning
   `/events`/`/bets`/`/setup`'s Card/Table backgrounds to the dark stage
   would have meant overriding that picker for the core screens — a bigger
   product call than "extend the N64 look," and not one to make
   unilaterally. What actually shipped: a new `PageHeading` component
   (`src/components/page-heading.tsx`) reusing the exact same bevel trick,
   sized for an in-page title instead of a full boot screen, applied to
   every core screen's `<h1>` (`/`, `/events`, `/multipliers`, `/bets`,
   `/setup`) — plus uppercase nav labels on `AppNav`'s desktop pill row. The
   underlying Card/Table/Button treatment is untouched, so the theme picker
   still does its job everywhere.
2. **Verified against real seeded data, not just "it compiles."** Docker
   couldn't pull fresh Supabase images (same corporate TLS interception as
   npm, but at the Docker-daemon/VM trust-store level — `NODE_EXTRA_CA_CERTS`
   doesn't reach that, and patching Colima's root store felt disproportionate
   for a verification step) — so a full local Supabase stack wasn't viable
   this session. Instead: a small Playwright fixture layer
   (`~/.claude/jobs/.../pw/fixtures.mjs`, not part of this repo) intercepts
   the `rest/v1/*` calls the browser Supabase client makes and returns
   representative fake rows matching `database.types.ts` — 8 players, all 9
   events in a mix of resolved/scoring/planned states, results, multipliers
   with a real budget reserve, event rankings, overall bets, a per-event
   bet, and a bonus event. This caught two real things before they'd have
   shipped un-verified:
   - `/multipliers`'s own `<h1>` was missed in the sweep — still the old
     plain heading. Fixed.
   - Uppercase nav labels looked fine in isolation but visibly truncated
     "Leaderboard"/"Multipliers" on the mobile floating bar once real text
     was actually rendered at that width — reverted to normal case there,
     kept only on the desktop pill row where there's room. "Leaderboard"
     still clips slightly even in normal case (same pre-existing `max-w-16`
     column "Medal Table" already sat inside) — a small, pre-existing rough
     edge, not something this session introduced; worth a follow-up if it
     bothers anyone in practice.
   Also caught: `bonus-events-card.tsx`'s description still said "onto the
   medal table" — missed in the previous rename pass since it's card copy,
   not a heading.
- 150 tests (unchanged), lint/typecheck/build all green.
- **Still true from before**: no live verification against the real
  Supabase project or the actual deployed app — the fixture layer proves the
  UI and domain logic compose correctly with realistic data, not that it
  matches what's actually live right now.

## 2026-08-17 — Leaderboard rename, /start cleanup, reconciling a parallel Claude Code session

A different Claude Code session (this repo's local clone, no git remote) had
spent a chat building an N64-styled UI from scratch against `docs/PRODUCT_SPEC.md`
and an early `docs/VISUAL_SPEC.md`, unaware this repo already existed on
GitHub with 17 merged PRs of real, Supabase-backed functionality (betting,
groom tools, the progress chart, `/start`+`/select` from PR #13/#14) — a
disconnected copy in `~/Downloads/bachelor-olympics 2` diverged after commit
`acdf783`. Once the user pointed at real differences, that work was set
aside as exploratory (not merged, not referenced here) and this session
picked up cold on the real clone (`~/dev/bachelor-olympics`) instead. Noting
this in case the disconnected copy resurfaces in a future session — it isn't
canonical and shouldn't be treated as a spec.

150 tests (unchanged), lint/typecheck/build all green, dev-server smoke test
of all 7 routes against placeholder Supabase credentials (no crashes; the
data-dependent pages just hang on "connecting," which is a placeholder-URL
artifact, not a real bug — a fake-but-well-formed hostname makes the client
hang rather than fail fast, unlike a real network error, which
`IdentityGate`/`gameStore` already handle by bypassing the gate).

- **"Medal Table" → "Leaderboard"** in every user-facing string: nav label
  (`app-nav.tsx`), home page heading + tagline (`page.tsx`), and `layout.tsx`
  metadata description. `PRODUCT_SPEC.md`'s Theming bullet updated to record
  the reversal (previously specified "medal table," explicitly not
  "leaderboard" — now the other way). **Deliberately left the `MedalTable`
  component/file/type names alone** — internal identifiers, not product
  copy; a rename is a pure refactor with no user-facing effect, and doing it
  in the same pass risked a needless collision with any concurrent work on
  this file. Worth doing as its own small PR if a clean rename is wanted.
- **`/start` cleanup**: dropped the "tap anywhere, or press any key"
  instructional line — explicit direction to keep this screen to just the
  logo and Press Start, no controller/input hints. Added a background-image
  layer reading `public/start-background.jpg`, sitting below the existing
  `boot_video_url`/gradient fallbacks in specificity — the user is supplying
  a designed title-card background as a follow-up artifact; dropping the
  file at that exact path will make it appear with zero further code
  changes. No file exists there yet (a missing CSS `background-image`
  degrades silently, unlike a missing `<img src>`), so this is safe to land
  ahead of the actual asset.
- **Verified, not changed**: `src/lib/multipliers/budget.ts` already allows
  proceeding with a nonzero, unallocated multiplier balance (PR #5's "budget
  reserve" — only rejects going negative) — this already matches what was
  asked for, no code change needed.
- **Not yet done, blocked on access**: the user also asked to see the
  betting screens, more of the app's navigation, and the groom controls, and
  to compare against "the current online version"'s graph. This session
  found the live Vercel production deployment via the GitHub Deployments API
  but it sits behind Vercel's SSO/deployment-protection gate — not reachable
  without either the project's real Supabase anon key + URL (safe to share
  per `.env.example`'s own comment) or a way past the Vercel gate. Asked the
  user for one of those rather than guessing at how to extend the N64
  treatment to `/events`, `/bets`, `/setup`, and `AppNav` — those screens are
  all fully built and functional already (see PRs #1–#10), just still on the
  plain shadcn/tweakcn theme rather than the N64 bevel treatment `/start`
  and `/select` (PR #13/#14) got. Whether that extension is actually wanted,
  and against what real data, is the open question for next session.

## 2026-08-15 — Results columns, hover-flash fix, full-screen replay, dropped portrait field

Follow-up batch after PR #15's own real-use feedback. 150 tests (unchanged
— UI/data-layer only), lint/typecheck/build all green, dev-server smoke
test of `/`, `/events`, `/setup`, `/select`, `/start` (clean compiles,
200s). **New migration 0013** (drops `character_portrait_url`) — not yet
confirmed run against the live project, alongside 0012 from last session.

- **Event results now show # / player / points / multiplier / total**, in
  that column order, as a genuine CSS grid (`display: contents` per row
  feeding the parent's tracks — same technique `progress-chart.tsx`'s
  tooltip already uses) instead of the old single "raw value" column.
  Points are computed straight from `results` via the same
  `scorePlacement`/`scoreAbsolute` pure functions the store uses once
  resolved — this also makes it work live while an event is still
  `"scoring"` (drafted but not finalized), not just after. `EventCard`
  gained a required `multipliers` prop (this event's rows only, same
  pre-filter convention as `results`/`ranking`/`bets`) to compute the
  multiplier and total columns.
- **"Replay" moved to the bottom of the results list**, was up in the card
  header next to the title.
- **Victory replay is now full-screen, no chrome**: `VictoryReplayButton`
  rewritten as a controlled Radix dialog (`open`/`onOpenChange` state
  instead of `DialogTrigger`) so it can auto-close via the video's
  `onEnded`. `DialogContent` overridden to cover the full viewport
  (`inset-0`/`h-dvh`/`w-dvw`, `rounded-none border-0 bg-black`,
  `showCloseButton={false}`), title kept but `sr-only` for a11y. Radix's
  existing fade/zoom in-out transition on `DialogContent` covers the
  "fade to black" ask without extra work.
- **Fixed the hover white-flash on `/select`'s roster busts**:
  `CharacterBust` previously conditionally *mounted* either an `<img>` or a
  fresh `<video>` depending on hover state — a brand-new `<video>` paints
  blank until its first frame decodes, twice (once entering hover, once
  leaving). Rewritten to always mount the video once a URL exists and
  cross-fade opacity + play/pause via a ref instead, with the photo/
  silhouette as a permanent base layer underneath and `poster={photoUrl}`
  as a further belt-and-suspenders fallback. New `playing` prop replaces
  passing `videoUrl={null}` to "hide" it.
- **`character_portrait_url` removed** (migration 0013) — turned out to be
  genuinely dead: nothing in the app ever read it, the roster strip uses
  `photo_url` directly and the hover clip is `character_select_video_url`.
  Confirmed via grep before dropping it, not just inferred.
- **Player media uploads moved back inside the edit/expanded row**
  (previous session had made them always-visible on the collapsed row;
  that wasn't actually the ask, reverted) and changed to a vertical list
  instead of wrapped side-by-side.
- **"Manage players" list is now always alphabetical** (`setup/page.tsx`,
  sorted by name at render) — previously followed whatever order
  `select *` happened to return, which could visibly reorder after an
  edit since there's no `ORDER BY`.
- **`/select`'s heading is now "Choose your character"** (was "Choose your
  competitor").
- **Not independently screenshot-verified** — same standing limitation as
  every prior session (no browser driver in this environment). The
  hover-flash fix and the full-screen replay dialog in particular are
  exactly the kind of thing worth an actual look on a real phone before
  calling them done — this environment can confirm the mechanism is right
  (ref-based play/pause, opacity transition, no remounts) but not that it
  visually reads as intended.
- **Explicitly deferred, not built**: N64-style stat bars (speed/strength/
  coordination/etc.) next to the selected character on `/select`, derived
  from the groom's per-event rankings and balanced so nobody's
  overpowered. Real design work needed first (which events feed which
  stat, the normalization/balancing formula, bar visual treatment) — user
  explicitly offered to move this to a fresh session rather than have it
  guessed at inline; a plan was proposed, not yet approved or built.

## 2026-08-15 — Real-use feedback: photos-not-flags, finishing order, bonus edit/deduct, 5th clip

Follow-up batch after the previous session's PR (#14) landed and got a real
look. 150 tests (unchanged — all UI/data-layer, no new domain math beyond
what's already tested), lint/typecheck/build all green, dev-server smoke
test of `/`, `/events`, `/setup`, `/select` (clean compiles, 200s). **New
migration 0012** — not yet confirmed run against the live project.

- **State flags dropped everywhere** — photos are now the sole visual
  identifier. `PlayerName` (`src/components/player-name.tsx`) no longer
  renders `<Flag>`; `state` is still an accepted prop on every one of its
  ~20 call sites (so none needed touching) but now only feeds an
  `sr-only` accessible label, not a visible chip. `src/components/flag.tsx`
  deleted outright (its only two importers were `PlayerName` and
  `/select`'s nameplate, both stopped using it). `src/lib/states.ts` and
  `chartColors.ts`'s state-based hue preferences are untouched — the
  `state` field/data model stays, only the flag glyph is gone.
- **Event results show finishing order, not roster order**: `EventCard`
  (`src/components/event-card.tsx`) now sorts the post-results player list
  by actual finish — position ascending for placement events, raw value
  ordered by `lower_is_better` for absolute ones, unresolved trailing last
  — instead of iterating `players` in whatever order they were added.
- **Catch-up bonus preview is now a vertical list**, not a wrapped inline
  row — same `EventCard`, matches how the applied-badge list already read
  once results exist.
- **Bonus events: edit, delete, and point deductions**
  (`src/components/bonus-events-card.tsx`, rewritten;
  `updateBonusEvent`/`removeBonusEvent` new in `mutations.ts`). Each
  awarded bonus event now has its own inline edit/delete (same
  collapsed/expand pattern as `ManagePlayerRow`), and the points field
  accepts negative numbers — same flat mechanism (`applyBonusAwards`
  already just adds the value, no change needed there), just documented in
  `PRODUCT_SPEC.md` as doubling for a groom-assessed deduction. Relabeled
  "Winner" → "Player" throughout since a deduction isn't a win.
- **Player media uploads are now always visible**, not hidden behind
  clicking the pencil/edit icon on a player row (`ManagePlayerRow`) — this
  was the actual bug behind "I'm not seeing the option to upload media":
  the controls existed but only rendered in edit mode, which wasn't
  obvious. Extracted into a shared `mediaUploads()` render function used in
  both the collapsed and editing views.
- **Fifth character-media slot: the confirm clip** (migration 0012,
  `character_confirm_video_url`) — plays once, full-bleed, right after
  hitting "Let's go" on `/select`, before routing into `/`. Distinct from
  `character_fullbody_video_url` (idles while still choosing). New
  `ConfirmClip` component in `select/page.tsx`; skippable via tap or any
  keypress, doesn't trap the player if there's no clip uploaded yet (falls
  straight through to the old instant-navigate behavior).
- **Not independently screenshot-verified** — same standing limitation as
  every prior session (no browser driver in this environment). The
  finishing-order sort and the always-visible media uploads in particular
  are worth a real look — small enough changes that a subtle layout issue
  wouldn't show up in `tsc`/`eslint`/tests.

## 2026-08-15 — Catch-up bonus, victory replay, character-media pipeline, "Bachelor Party"

Two unrelated threads landed together (parallel sessions): a real scoring
feature, and reconciling a same-day naming collision on the boot/select
screens with the previous session's placeholder build. 150 tests (10 net
new), lint/typecheck/test/build all green, dev-server smoke test of `/`,
`/start`, `/select` (clean compiles, 200s). **New migration 0011 — user
confirmed it's already been run against the live project.**

- **Catch-up bonus** (`docs/PRODUCT_SPEC.md` → Multipliers → Catch-up
  bonus, new): whoever's last/2nd-last/3rd-last in the standings gets an
  automatic +30%/+20%/+10% on their event multiplier for the next event
  only, stacked multiplicatively on top of their own slider (doesn't
  replace it). `src/lib/scoring/catchUp.ts` (new, pure tier/tie math —
  genuine ties share the average of the tiers they span, same philosophy as
  placement-scoring ties) + `src/lib/scoring/fromRows.ts` (rewritten to walk
  resolved events in the order they actually happened, not `sort_order`,
  computing each event's bonus from the running standings right before it —
  same principle `cumulativeSeries.ts` already used for award-order). No
  new migration needed — fully derived, self-corrects on reset/reorder/
  cancel. Shown on `EventCard`: a 🔥+N% badge as a live preview on the
  upcoming event, and applied on already-resolved ones. `deriveScoreLines`
  gained a required `playerIds` param (every call site updated); one
  pre-existing `cumulativeSeries.test.ts` case updated for the new numbers
  (only 2 players in that fixture, so catch-up now applies from event 2).
- **Victory replay**: `src/lib/scoring/eventWinner.ts` (new, pure — winner
  id(s) for a resolved event, placement/absolute/ties) +
  `VictoryReplayButton` (new) on a resolved `EventCard` plays the winning
  player's `character_victory_video_url` in a dialog. Hand-wrote
  `src/components/ui/dialog.tsx` (shadcn's standard shape,
  `@radix-ui/react-dialog` was already a dependency) since `npx shadcn add`
  couldn't reach the registry from this sandboxed environment.
- **Character-media DB layer** (migration 0011): `character_portrait_url` /
  `character_select_video_url` / `character_fullbody_video_url` /
  `character_victory_video_url` on `players`, `boot_video_url` on
  `app_settings`, new `videos` Storage bucket (same trusted-friends RLS
  model as `photos`, kept separate since video files are much larger).
  Upload UI: four new fields per player in Setup → Manage players
  (`manage-player-row.tsx`), plus a "Boot video" card
  (`boot-video-uploader.tsx`).
- **Reconciled with `a662b7d`'s placeholder `/start` + `/select` +
  `CharacterBust`**, merged to `main` the same day from a different session
  — genuinely independent, overlapping work (their opt-in routes + CSS
  idle-bob placeholder vs. this session's app-wide forced gate + real-video
  plan). Resolved by keeping their nicer placeholder screens and layering
  this session's pieces on top rather than replacing them:
  - **`CharacterBust`** gained an optional `videoUrl` prop (character clip)
    that takes priority over `photoUrl`, skips the idle-bob animation (the
    clip carries its own motion) — documented as the real swap seam instead
    of the originally-planned "just swap `photoUrl`" note.
  - **`/select`** now passes `character_select_video_url` into the roster
    strip (`RosterBust`, new — plays the clip in place on hover/tap/focus,
    per the spec's ask) and `character_fullbody_video_url` into the
    centered focused-character render.
  - **`/start`**: `GAME_TITLE` renamed `STAG64` → **"Bachelor Party"** (the
    user's actual decision, replacing the placeholder — same one-line
    constant the previous session set up for exactly this), dropped the
    now-redundant "Bachelor Olympics" caption above it, and it now plays
    `app_settings.boot_video_url` full-bleed behind the logo when the groom
    has uploaded one (falls back to the existing gradient treatment).
  - **`IdentityGate`** (new, `src/components/identity-gate.tsx`, wraps
    `layout.tsx`): the piece their session's own open question flagged as
    undecided ("how do people actually get here... not worth deciding on
    placeholder art") — now decided, per explicit user direction. Redirects
    to `/start` on any route (except `/start`/`/select` themselves) whenever
    this device has no selected player, bypassing itself automatically on a
    brand-new empty roster (so the groom can still reach Setup to add the
    first player) or a connection error. `/setup`'s original plain "Who are
    you?" picker still exists as a fallback/switch-player affordance, just
    unreachable in practice once gated — harmless dead code, not removed.
  - App title/metadata (`layout.tsx`) and homepage `<h1>` (`page.tsx`) also
    updated to "Bachelor Party."
- **Not independently screenshot-verified** — same standing limitation as
  every prior session (no browser driver in this environment); this
  session's `/start`→`/select`→gate round-trip in particular is worth an
  actual click-through once deployed, especially the redirect-loop edge
  cases (empty roster, clearing your identity mid-session via "Not you?").
- **Still open** (from the user's original ask, not built this session): a
  *third*, distinct "just confirmed" video that plays once on hitting
  "Let's go" on `/select`, separate from the fullbody idle clip — would need
  a 5th character-media column if wanted; flagged rather than scoped in.

## 2026-08-12 — Boot/character-select screens (docs/visual_spec.md, placeholder art)

User added `docs/visual_spec.md` (N64-style character-select direction, real
character art pipeline via Nano Banana + Seedance, not built yet) and asked
for a placeholder start screen → character select flow now, ahead of having
any actual character renders. 140 tests (unchanged), lint/typecheck/build
green, dev-server smoke test of `/start` and `/select` (clean compiles,
200s).

- **`/start`** (`src/app/start/page.tsx`): N64 cartridge-boot title screen,
  not a normal landing page — chunky beveled logo text (layered
  `text-shadow` using `var(--primary)`/`var(--accent)`, not hardcoded hex)
  over a full-screen `bg-foreground` "dark stage." Using `--foreground` as
  the stage color (rather than inventing a new dark token) means this screen
  automatically follows whichever app theme is active — try it under the
  new Olympic theme vs. Classic, both just work. "Press Start" is the whole
  screen (a full-bleed `<button>`) plus any keypress, not a conventional
  button, per the spec's explicit ask.
  - **Placeholder title**: `STAG64`, the exact example the spec floated as a
    "direction, not decided" — pulled into one named constant
    (`GAME_TITLE`) so renaming it later is a one-line change.
- **`/select`** (`src/app/select/page.tsx`): Mario Kart 64-style roster —
  every player's bust along the top, a big centered idling render of
  whoever's focused, name plate below, arrow-key/click to browse. **This is
  not a mockup wired to fake data** — "confirm" calls the real
  `selectPlayer` (`src/store/sessionStore.ts`), the same mechanism `/setup`'s
  plain picker already uses, then routes into `/`. It's a re-skin of
  existing, working identity logic, not new business logic.
  - Player colors via the existing `assignPlayerColors` (`chartColors.ts`,
    `mode: "dark"` since the stage is dark here vs. the progress chart's
    white card) — same validated categorical palette as the progress chart,
    so a player's roster color is consistent app-wide.
- **`CharacterBust`** (`src/components/character-bust.tsx`): the shared
  "big render" piece both screens use (and the visual spec's multiplier
  screen will reuse later). **Deliberate placeholder**: shows the player's
  already-uploaded `photo_url` (or a silhouette) in a thick-outlined plate,
  idling via a new `idle-bob` keyframe (`globals.css`) — a gentle
  translateY+scale loop, not a bounce, per the spec's "breathing loop, not
  static" note. Explicitly documented as a **swap seam**: once real Nano
  Banana character renders exist, only this component's `photoUrl` source
  needs to change, every call site stays the same (same pattern as `Flag`'s
  `FlagGlyph` seam).
- **Not wired into `AppNav`** — these are a new pre-game entry point, not one
  of the four core screens, so they're only reachable by URL
  (`/start` → `/select` → `/`) for now. Worth a real "how do people actually
  get here" decision once the character art exists (a link from `/setup`?
  make `/start` the actual root and move the dashboard elsewhere? probably
  not worth deciding on placeholder art).
- **Not independently screenshot-verified** — no browser driver in this
  environment, standing limitation. The chunky-logo bevel effect and the
  idle-bob animation in particular are worth an actual look before treating
  the visual direction as confirmed.

## 2026-08-12 — Olympic theme

Added an "Olympic" option to the shared theme picker (`src/lib/themes.ts`).
Unlike every other non-Classic entry, this one is hand-authored, not pulled
from tweakcn — tweakcn has nothing Olympics-themed to fetch. Built from the
actual Olympic ring colors (blue #0081C8, gold #FCB131, green #00A651, red
#EE334E, a near-black navy standing in for ring-black so it stays legible as
`chart-3` on a light card) converted to oklch by hand via the standard
sRGB→OKLab→OKLCH path (no color library added for one theme). `primary` is
the ring blue, `accent` the ring gold, `destructive` the ring red — so the
app's own buttons and status colors read as "Olympics," not just the chart
legend. Checked WCAG contrast by hand for every foreground/background pairing
that carries text (primary-fg/primary, accent-fg/accent, destructive/card,
foreground/background, muted-foreground/muted, light and dark) and nudged the
initial blue and red picks slightly darker/more saturated where the straight
ring hex landed at 4.0–4.2:1 against white (AA-large but not full AA) — final
values all clear 4.5:1+ (light) / clear AA (dark). 140 tests (unchanged, no
domain logic touched), lint/typecheck/build all green.

## 2026-08-12 — Tooltip column layout + the *real* drag-reorder fix

Two follow-ups on the previous session's own fixes, both requested after a
real look at the deployed app. 140 tests (unchanged), lint/typecheck/build
green.

- **Progress chart tooltip** (`src/components/progress-chart.tsx`): reordered
  and restructured into a genuine CSS grid (`grid-cols-[auto_auto_1fr_auto_auto]`,
  each row `contents`) so rank, rank-change, player name, total points, and
  points-change each form their own left-aligned column across rows — the
  previous version was a flex row with `justify-between`, which only aligned
  within a single row, not down the column. Column order per the ask: rank →
  rank-change → name → total → points-change (previously name was first).
- **The drag-reorder-then-revert bug was NOT actually fixed by the previous
  session's patch.** That patch fixed a real race condition (clearing the
  optimistic order too early), but there was a second, more fundamental bug
  underneath it that made the write fail on *every* drag, race or not:
  `reorderEvents` (`src/lib/data/mutations.ts`) did
  `.upsert([{id, sort_order}, ...])` — sending only two columns. `events.name`
  and `events.scoring_mode` are `NOT NULL` with no default
  (`0001_init.sql`). Postgres's `INSERT ... ON CONFLICT DO UPDATE` still
  builds the INSERT-branch tuple first (missing columns default to `NULL`)
  and checks `NOT NULL` constraints *before* it reaches the conflict
  redirect — so this upsert threw a not-null-violation on every single call,
  the `.catch()` in `manage-events-card.tsx` swallowed it, and
  `setLocalOrder(null)` snapped the list back to the stale order. This is
  provable from the schema alone, no live DB needed to confirm it. Fixed by
  switching `reorderEvents` to per-row `UPDATE ... WHERE id = ...` calls
  (all ids already exist — this never inserts, so upsert was never the right
  tool) instead of a batch upsert.
- Not independently screenshot-verified (no browser driver in this
  environment). Worth confirming both live: the tooltip's 5-column layout on
  an actual phone width, and dragging an event in Manage Events now actually
  sticking through a real Realtime round-trip.

## Current state (as of 2026-08-12, end of session)

Start here if you're picking this up cold — the detailed log below has the
blow-by-blow if you need it, but this is the map.

**Live and working**, verified against the real Supabase project + a real
GitHub repo + Vercel deploy (not just typechecked), except the newest
session's work — see the caveat in that log entry below. All 11 migrations
(0001–0010) are confirmed run against the live project — no migration is
pending as of this update:
- **Repo**: `github.com/matthew-glibbery/bachelor-olympics` (private), `main`
  branch, CI green on every push (`.github/workflows/ci.yml`: pnpm, Node 22).
  Deployed on Vercel, auto-deploys from `main`.
- **Package manager is pnpm, not npm** — a real, hard-won fix (see the
  "Switch from npm to pnpm" log entry). Don't reintroduce npm/package-lock.json.
- **8 real players** already set up in the live DB, one groom, real states,
  some photos uploaded. **Beach Volleyball** is the one resolved event so far.
- **Five core screens**, all `max-w-2xl`:
  - `/` — live cumulative progress chart (player photos as markers,
    flag-inspired colors, dataviz-skill-validated) + Medal Table. Total
    includes bonus-event points and settled overall-bet winnings. X-axis
    sequences by actual award order — a bonus event awarded between two
    planned events shows up between them, not lumped at the end; every
    resolved event, in the real order it resolved (`resolved_at`),
    interleaved with bonus events by their timestamp. Events still
    awaiting a result trail at the end in configured order. **Tooltip
    (this fix)**: more clearance from the hovered dot (was covering it),
    plus per-player place (#N), a ▲/▼ place-change indicator vs. the
    previous moment, and a "+N" for points gained that moment — reserved
    status colors, not the categorical player-line palette (see
    `progress-chart.tsx`).
  - `/events` — groom-gated event board. Each event card is now **tabbed:
    Results / Odds / Bets** (this session). Results tab has the existing
    flow: start scoring → drag-to-reorder placement results (or numeric for
    absolute events) → finalize → resolved, ties via "tied with row above,"
    vertical results list, Cancel (hard delete) / Reset (clear + reopen).
    Odds tab: read-only win/place payout table from that event's own
    ranking. Bets tab: every bet placed on that event, revealed only once
    it's left "planned" (bets stay secret until placement closes).
    Finalizing a placement event auto-settles any open per-event bets on it.
  - `/multipliers` — per-player sliders. Budget is no longer a strict
    zero-sum (this session) — you can leave some unspent as a reserve for
    per-event bets; a new "Betting reserve" card shows what's available to
    wager vs. tied up in open wagers.
  - `/bets` — overall betting (win/top3 only, win=100pts/top3=20pts) with
    odds shown inline next to each pick; new bet placement locks once the
    first event starts, existing bets can still switch if eliminated,
    "everyone's bets" only reveals once locked. **Now settles automatically**
    (this session) once every event has resolved — a bet's badge switches
    from live Alive/Eliminated to a final Won/Lost, and a won bet's points
    show up on the medal table. Per-event betting: pick ANY player to
    win/place in an upcoming ("planned") event, wager drawn from your
    unallocated multiplier reserve (not that event's own multiplier),
    payout scaled by that event's own odds. Closes once the event starts —
    the reveal moves to that event's Bets tab on `/events`.
  - `/setup` — player picker, groom PIN gate. **Groom tools restructured**
    (this session): "Manage players" now has an inline "+ Add player" row
    at the top instead of a separate standalone add form — same expand-to-
    a-form interaction as editing an existing player. New **"Manage
    events" card**: add, edit (name, photo, description, scoring type —
    scoring type locks once the event starts), delete, and drag-to-reorder
    events, mirroring the players card's interaction exactly (**a real
    revert-after-drag bug from the first pass is fixed** — see the log
    entry below). Events are no longer only seeded from
    `src/lib/events/config.ts` — the groom can add more, and the drag
    order here is what every screen follows. Also:
    "Set the odds" card (per-event ranking, ✓/○ progress indicator), a
    "Power move" card, and "Danger zone" (full weekend reset).
  - `/events` has a **"Bonus events" card** below the planned-event list:
    groom names a spontaneous event and picks a winner on the spot, flat
    whole-number points (default 50) land straight on the medal table AND
    (this session) the progress chart — no odds, no multiplier, no
    elimination-math effect, per spec's explicit isolation.
- **11 Supabase migrations exist, all confirmed run** — 0010 adds
  `resolved_at` to `events` (backfilled for already-resolved rows) for the
  progress-chart ordering above.
- **No scoring currency ever shows a fraction now** (this session) —
  absolute-scored events round to the nearest whole point (previously
  deliberately unrounded; reversed by explicit product decision), and
  overall-bet payouts round after each switch-halving (100→50→25→13→6…).
  Placement scoring was already whole; per-event bet wagers/payouts stay in
  their own 0.1-increment multiplier currency, a different unit, untouched.
- Domain/scoring logic (`src/lib/scoring/*`, `src/lib/multipliers/*`,
  `src/lib/betting/*`, `src/lib/odds/*`, `src/lib/bonus/*`) is pure, unit-
  tested (140 tests), and matches `docs/PRODUCT_SPEC.md`.

**Not built yet**: nothing — every mechanic in `docs/PRODUCT_SPEC.md` now has
code behind it. What's left is verification against live data and the open
questions below, not missing features.

**Environment quirk worth knowing**: this dev machine sits behind corporate
TLS interception (Zscaler) and a corporate npm registry mirror. Both are
worked around already (`.npmrc` pins the public registry;
`NODE_EXTRA_CA_CERTS` needed for any Node-side script that calls Supabase
directly, not needed for `next dev`/`next build` themselves). See the
relevant log entries below if this bites again.

**Open questions for next session**:
- **Still needs a live click-through** — nothing since the odds-ranking
  work several sessions back has been screenshot-verified (no browser
  driver in this environment, throughout). Worth a real pass covering: the
  overall-bet settlement flow end-to-end (needs a full weekend of resolved
  events); event management (add/edit/delete/reorder, confirm it reflects
  everywhere); progress-chart interleaving (award a bonus event between two
  resolved events, confirm it lands in between, not at the end); and the
  new tooltip fields (place/place-change/points-gained) for layout on an
  actual phone screen, plus confirming the drag-reorder fix actually holds
  under real Realtime latency, not just the reasoning behind the fix.
- **`eventConfigToRow`/`seedEvents` (`src/lib/data/events.ts`,
  `queries.ts`) can silently clobber a groom edit.** If the groom edits one
  of the original 9 config-seeded events' name/notes/scoring-type via the
  new Manage Events UI, then someone later re-runs the seed script
  (`pnpm run seed:events`), the upsert would overwrite that edit back to
  the static config value (the upsert only skips `status`/`photo_url`,
  not the newly-editable fields). Low risk in practice — the seed script
  is a manual one-time bootstrap step, not something re-run casually — but
  worth knowing if events ever mysteriously revert.
- **Settlement only fires from the event-finalize path** — there's no
  standalone "end the weekend" button. If every event happens to already be
  resolved and something else changes afterward (e.g. a groom edits an
  already-resolved event's results via "Edit results"), open overall bets
  from a *newly-added* player or a late per-event bet wouldn't re-trigger
  settlement, since nothing calls `settleOverallBetsIfWeekendOver` outside
  the finalize flow. Unlikely in practice (all 8 events finalizing is the
  natural end state) but worth a manual "re-settle" trigger if it ever
  comes up.
- Rank ties in settlement use standard competition ranking (1,2,2,4 — a
  tie for 2nd doesn't consume rank 3), tested in
  `src/lib/betting/settleOverallBets.test.ts`. Worth a sanity check against
  real data if the final standings end up close.
- The per-event ranking editor, the multiplier sliders, and per-event bet
  placement all lock UI-side once an event leaves "planned" — no DB-level
  enforcement. Same judgment call as prior sessions, still judged fine given
  this app's app-level trust model (`0002_rls.sql`).
- **Per-event betting is placement-events-only** — resolution keys off the
  `position` field, which absolute-scored events (golf, etc.) never set.
  Extending this needs a definition of "win"/"place" in terms of `raw`
  values first.
- The odds decay (`ODDS_DECAY` in `src/lib/odds/ranking.ts`) was retuned
  this session from 0.72 to 0.9 to bring an 8-player field's longshot win
  payout down from ~33x to ~11-12x — a documented, tunable judgment call
  (see that file's header), not derived from a formula. Worth a gut-check
  once real per-event bets get placed and resolved at the actual event.
- The elimination bounds in `src/lib/betting/fromRows.ts` (used for the
  overall bet's alive/eliminated status) still use the placement curve's
  last-place value as the floor for every remaining event, even ones that
  turn out absolute-scored. Still a documented, conservative-direction
  judgment call, unchanged across sessions.
- Resetting a single event (`EventCard`'s Reset, on the Results tab) doesn't
  touch any open per-event bet that was riding on it — the event reverting
  to "planned" re-opens it for betting again rather than voiding whatever
  was already wagered. Minor, but noted.

## 2026-08-12 — Progress chart tooltip detail + a real drag-reorder bug fix

Two fixes requested right after the previous batch shipped and got a real
look. 140 tests (unchanged — both fixes are UI/presentation, no domain
logic touched), lint/typecheck/test/build all green, dev-server smoke test
of `/` and `/setup` (clean compile, 200s).

- **Progress chart tooltip** (`src/components/progress-chart.tsx`):
  - More clearance from the hovered point — it was rendering close enough
    to cover the dot markers underneath. Recharts' `<Tooltip offset={28}>`
    (was the library default of 10).
  - Each player row now also shows: their **place** at that moment (`#N`,
    standard competition ranking so ties don't skip a number — same
    technique as `settleOverallBets.ts`), a **▲/▼ place-change** indicator
    vs. the immediately preceding moment (green = moved toward 1st, red =
    fell back), and a **"+N" points-gained** figure for that specific
    moment. Needed the tooltip to see the previous data point, not just
    the hovered one, so it now takes the full `data` array as a prop
    (already computed in `ProgressChart`) instead of only Recharts'
    `payload` for the current point.
  - New reserved status colors (`STATUS_GOOD`/`STATUS_BAD`, this file) —
    loaded the dataviz skill before adding them, per its trigger on "chart
    colors." Deliberately NOT the categorical palette's own green/red
    player-line slots (`chartColors.ts`) — reusing those would make a
    status badge look like it belongs to whichever player happens to be on
    that slot, which the skill explicitly calls out as wrong ("status
    colors are reserved... never reused for 'series 4'"). Checked contrast
    by hand against the white tooltip surface (green 7.13:1, red 8.31:1 —
    both comfortably clear WCAG AA); both also always ship with a glyph
    (▲/▼) or sign (+) alongside the color, never color alone, so a
    colorblind reader isn't relying on the hue to tell them apart.
- **Fixed a real bug: dragging an event in "Manage events" visually
  reordered it, then snapped back.** Root cause: the optimistic local
  order (`manage-events-card.tsx`) was being cleared the moment the
  Supabase write *succeeded*, not once the store's `events` actually
  reflected the new order — the write resolves faster than the Realtime
  round-trip that updates the store, so for a beat (sometimes longer, if
  Realtime lagged) the component fell back to `events`' still-stale order
  and visibly un-reordered itself. Fixed by holding the optimistic order
  until `events`' own id sequence genuinely matches it (a `useEffect`
  watching both), rather than clearing on promise resolution. This is
  exactly the kind of thing the previous entry's "not independently
  screenshot-verified... worth an extra-careful manual pass" note called
  out — confirmed now by the user actually finding it.
- **Not independently screenshot-verified** — same standing limitation (no
  browser driver, no live Supabase creds in this worktree). The tooltip
  layout in particular (spacing, whether the new fields wrap awkwardly on
  a narrow phone screen) is worth a real look once deployed.

## 2026-08-12 — Event management, progress-chart ordering, whole-number points

Real-use feedback batch. 140 tests (net: rewrote `cumulativeSeries.test.ts`
for the new ordering behavior, added an `absolute.ts` rounding test, updated
`overall.test.ts`'s halving expectations), lint/typecheck/test/build all
green, dev-server smoke test of `/`, `/setup`, `/events` (clean compile,
200s). **Needs migration 0010 run against the live project — not yet
confirmed.**

- **No fractional points anywhere.** `scoreAbsolute` now rounds its
  proportional result (`src/lib/scoring/absolute.ts`) — this REVERSES an
  earlier explicit decision (the old spec text argued rounding would blur
  close absolute results); overridden by direct instruction this session.
  `overallPayoutValue` now rounds after each switch-halving
  (`src/lib/betting/overall.ts`): 100→50→25→13→6→3… instead of
  →12.5→6.25→… Placement scoring was already whole. Per-event bet
  wagers/payouts are deliberately NOT touched — they're a different
  currency (0.1-increment multiplier units, not "points"), a scoping
  judgment call documented in the relevant commit/docs rather than assumed
  silently.
- **Progress chart now sequences by actual award order, not planned sort
  order** (`src/lib/scoring/cumulativeSeries.ts`, rewritten). Needed
  `resolved_at` added to `events` (migration 0010, backfilled for
  already-resolved rows; `setEventStatus`/`resetEvent`/`resetWeekend` all
  updated to stamp/clear it appropriately) since nothing previously
  recorded when an event actually finished, only its pre-planned position.
  Bonus events (`created_at`, already existed) now interleave into the
  same timeline by timestamp. Events still awaiting a result trail at the
  end in configured order, unchanged from before — we don't know when
  they'll happen yet, so they can't be interleaved for real.
- **Events are now fully groom-managed**, not just seeded from
  `src/lib/events/config.ts`: new `createEvent`/`updateEvent`/
  `reorderEvents` mutations (`cancelEvent` already existed and is reused
  for delete). `sort_order` — already read by `fetchEvents` and therefore
  by every screen — is what reordering rewrites, so "the order shown
  everywhere" needed zero other code changes. Scoring-type edits
  (placement↔absolute) are blocked once an event leaves "planned," since
  the two modes store a result in different columns (`position` vs `raw`)
  and switching mid-scoring would corrupt whatever's already there.
  - `src/components/manage-events-card.tsx` (new): `@dnd-kit` drag list
    (same `PointerSensor` pattern as `GroomRankingEditor`) wrapping
    `manage-event-row.tsx` (new, mirrors `ManagePlayerRow`'s collapsed/
    edit-expanded shape) and `add-event-row.tsx` (new). Optimistic local
    reorder state so a drag feels instant instead of waiting on a
    round-trip + Realtime refetch, cleared once the mutation resolves (or
    fails) so it can't drift from the real DB order if something else
    changes concurrently.
- **"Add" and "edit" now share one interaction, for both players and
  events** — the standalone "Add player" form that used to live inside the
  Groom Tools card is gone; `add-player-row.tsx` (new) is a collapsed
  "+ Add player" button living at the top of "Manage players" that expands
  to the exact same field layout as `ManagePlayerRow`'s edit form.
  `add-event-row.tsx` mirrors this shape for events. "Manage players" now
  shows (groom-gated) even with zero players, since it's now the only way
  to add the first one.
- **Not independently screenshot-verified** — same standing limitation (no
  browser driver, no live Supabase creds in this worktree). The drag-
  reorder interaction in particular is the kind of thing that's easy to
  get subtly wrong visually (item snapping, drop-target feedback) in ways
  unit tests can't catch — worth an extra-careful manual pass once live.

## 2026-08-11 — Overall-bet settlement: the last open gap in the spec

Continuing autonomously per "continue with the next phases of work while
I'm away." This closes the payout-crediting gap flagged as an open question
across the previous two sessions — the last piece of `docs/PRODUCT_SPEC.md`
with no code behind it. 138 tests (8 new, `src/lib/betting/
settleOverallBets.test.ts`), lint/typecheck/test/build all green,
dev-server smoke test of `/`, `/bets`, `/events` (clean compile, 200s).
**Needs migration 0009 run against the live project — not yet confirmed.**

- **New migration 0009**: `overall_bets` gets `status` ('open'/'won'/'lost',
  default 'open') and `payout` (numeric) columns — the table only ever
  tracked the live pick before, nowhere to record whether it ultimately
  landed.
- **New pure `settleOverallBets`** (`src/lib/betting/
  settleOverallBets.ts`, +test): compares each open bet's CURRENT pick
  (switch history already baked into `pick_player_id`/`switches` by
  `switchOverallBetPick`) against final standings, using standard
  competition ranking so ties resolve the way a real podium would (a tie
  for 2nd doesn't consume rank 3 — tested explicitly, since this is exactly
  the kind of edge case that's easy to get subtly wrong).
- **New `settleOverallBetsIfWeekendOver`** mutation
  (`src/lib/data/mutations.ts`): reads all events, no-ops unless every
  single one has resolved (cancelled events don't linger — they're hard-
  deleted per spec, so "every event resolved" is the only state to check
  for). If the weekend's over, computes final standings the same way the
  medal table does — `deriveScoreLines` → `standings` → `applyBonusAwards`,
  so a bet's outcome reflects the SAME total a player would see on `/`, not
  a separate parallel calculation — then settles every open bet and writes
  the outcomes back. Wired into `EventCard`'s finalize flow right after the
  existing per-event-bet resolution call, for every event (not just
  placement ones, since checking "is the weekend over" doesn't care about
  scoring mode). No separate "end the weekend" step needed: since the
  function no-ops until the LAST event resolves, calling it after every
  finalize is both correct and idempotent — once bets are settled, a later
  call finds zero still-open bets and does nothing.
- **Medal table now credits won overall bets**: `src/app/page.tsx` maps
  `overallBets` with `status === "won"` into the same `BonusAward` shape
  `applyBonusAwards` already accepts, crediting the payout to the BETTOR
  (not their pick) alongside bonus-event points — no new plumbing needed,
  reused the extension point from last session.
- **`/bets` now shows a bet's final outcome once resolved**: the live
  Alive/Eliminated badge and switch-pick control only apply while
  `status === "open"`; a settled bet shows a plain Won/Lost badge with the
  payout instead (both in the per-type card and in "Everyone's overall
  bets").
- `docs/PRODUCT_SPEC.md` gained a "Settlement" bullet under Overall betting
  documenting when/how this fires — this behavior was previously implied
  but never actually written down.
- **Not independently screenshot-verified** — same standing limitation (no
  browser driver, no live Supabase creds in this worktree), compounded by
  this feature only being observable at the very end of a full weekend of
  play, which obviously hasn't happened yet on the live project. The
  reasonable proxy check (unit tests covering tie-breaking, halving, and
  the no-op-until-weekend-over gate) is done; the real end-to-end check
  will only be possible once the actual event's 8+ events are all finalized
  for real.

## 2026-08-11 — Power move + bonus events: the last two Phase 3-4 features

Migrations 0007 and 0008 (previous two sessions) confirmed run against the
live project by the user at the start of this session. Continuing
autonomously per "continue with the next phases of work" — these were the
last two unbuilt items in `docs/PRODUCT_SPEC.md`'s core rules. 130 tests (4
new, all in `src/lib/bonus/bonus.test.ts` — `applyBonusAwards`),
lint/typecheck/test/build all green, dev-server smoke test of `/`,
`/events`, `/setup` (clean compile, 200s). **No new migration needed** —
both `bonus_events` and `power_move` have existed with RLS + Realtime since
Phase 1, just never had a UI.

- **Bonus events** (`src/components/bonus-events-card.tsx`, new card on
  `/events` below the planned-event list): groom names what happened and
  picks a winner on the spot — no separate "create, then resolve" step,
  matching how spontaneous the spec says these are meant to be. Flat points
  (default 50, editable). Deliberately its own card, not folded into the
  tabbed per-event UI, since the spec is explicit these live entirely
  outside the core event/scoring/betting system.
  - **New: `applyBonusAwards`** (`src/lib/bonus/bonusEvent.ts`, +test) —
    folds bonus points straight onto a `PlayerTotal`, added equally to
    `raw` and `adjusted` (no multiplier applies to a flat bonus), then
    re-sorted with the same tie-break `standings()` uses. `total.ts`'s
    `PlayerTotal` docstring already anticipated this exact extension point
    ("Bonuses ... are added on top elsewhere"). Kept as a one-way
    dependency (bonus imports scoring's `PlayerTotal` type; scoring still
    never imports bonus) to preserve the module's stated isolation.
    `MedalTable` now takes an optional `bonusAwards` prop; the home page
    passes `bonusEvents` from the store, mapped to awards.
- **Power move** (`src/components/power-move-card.tsx`, new card on
  `/setup`, groom-gated): a note field (optional — "what did you do?") plus
  one big irreversible button, matching the spec's explicit "the mechanic
  is deliberately undefined, the fun is in the surprise and timing" — this
  isn't a picker of specific effects, just a record that it happened, when,
  and what. Visible to everyone once used (no groom-only gate on viewing),
  since the whole point is the reveal. Named the mutation `spendPowerMove`,
  not `usePowerMove` — the obvious name collided with the `react-hooks/
  rules-of-hooks` ESLint rule, which flags any non-component function
  starting with `use` as a suspected hook.
- **Not independently screenshot-verified** — same standing limitation
  (no browser driver, no live Supabase creds in this worktree). Dev-server
  smoke test only. Both features are additive and low-risk (no schema
  change, no altered validation rules) compared to the last two sessions —
  still worth the real click-through noted in the open question above.

## 2026-08-11 — Real-use feedback: tabbed events, pick-based bets, budget reserve, tuning

Feedback after the previous rework actually got clicked around. Several
entangled changes landed together. 126 tests (5 net new —
`src/lib/betting/reserve.test.ts` new, `src/lib/betting/
resolvePerEventBets.test.ts` reworked in place, `overall.test.ts` lost its
"last" describe block), lint/typecheck/test/build all green, dev-server
smoke test of all 5 routes (clean compile, 200s). **Not verified against
live data — migrations 0007 AND 0008 both still need to run, see the open
question above.**

- **Setup's ranking picker now shows progress**: `✓`/`○` prefix per event in
  the dropdown, plus an "N of M events ranked" line
  (`src/components/event-odds-editor.tsx`) — the ask was simply "make it
  clearer which events I've done."
- **Odds retuned down**: `ODDS_DECAY` in `src/lib/odds/ranking.ts` split out
  from the placement-scoring decay it used to borrow (0.72 → its own 0.9).
  An 8-player field's win-bet longshot payout was hitting ~33x, which read
  as absurd against a per-player budget of only ~8.0 total multiplier
  points to wager with; 0.9 brings that down to roughly 11-12x. Documented
  as a tunable judgment call in the file header, same as the original 0.72
  choice was.
- **Overall bet payouts split by type**: win stays 100, top3 drops to 20
  (`OVERALL_BASE_PAYOUT` in `src/lib/betting/overall.ts`) — top3 lands
  roughly 3x more often than win in an 8-player field (3 slots vs. 1 every
  event), so a payout cut well past that ratio keeps it a genuinely
  lower-reward bet. `overallPayoutValue` now takes the bet type as a
  parameter. Also fully removed the vestigial "last" bet type from this
  pure module (`isPickAlive`'s third case, the type union, its tests) —
  last session only stripped it from the DB/UI layer and left this dead
  code behind; cleaned up now while already in the area.
- **Overall betting now locks at weekend start**: new placements close and
  "everyone's bets" only becomes visible once any event leaves "planned"
  (`weekendStarted` in `src/app/bets/page.tsx`) — previously bets were
  visible to everyone immediately, which undercut the "no suspense until
  it's locked in" framing the groom wanted. Switching an eliminated pick is
  still allowed post-lock (spec's only deterrent is the halving).
- **Multiplier budget is no longer a strict zero-sum**
  (`src/lib/multipliers/budget.ts`): `validateAllocations` used to require
  landing on exactly zero remaining to save; now it only rejects going
  *negative*. This was necessary, not cosmetic — per-event bets need
  somewhere to draw a wager from that isn't a specific event's own
  multiplier, and "leftover budget you chose not to allocate" is that
  source. `/multipliers` has a new "Betting reserve" card showing what's
  available vs. tied up.
- **New reserve ledger** (`src/lib/betting/reserve.ts`, +test):
  `bettingReserve(eventCount, allocatedToEvents, bets)` computes a player's
  spendable reserve as a live recomputation, not a stored balance —
  `total − allocated − openWagers + Σ(payout − wager)` over every resolved
  bet. That net-per-bet term is what makes a void bet exactly cancel out, a
  lost bet permanently shrink the reserve, and a won bet add its actual
  profit — got this wrong on the first pass (a test caught it: a void bet
  was coming out *ahead* of never having bet at all) and fixed it before
  it shipped.
- **Per-event betting redesigned around a pick** (schema change, migration
  0008): the original build had bettors wagering on their OWN finish,
  inferred from `per_event_bets` having no pick column. That was wrong —
  the ask was "pick someone to win or place," same shape as an overall bet
  but scoped to one event. `pick_player_id` added to the table;
  `resolveOpenPerEventBets` (`src/lib/betting/resolvePerEventBets.ts`) now
  checks the PICK's finishing position, not the bettor's. Wager currency
  changed too: draws from the new unallocated reserve instead of that
  event's own multiplier value (see above), and the betting window moved
  from "while the event is in progress" to "only before it starts" — you
  size up the odds and lock in a pick, you don't bet live mid-event.
- **Events page is now tabbed per event** (`src/components/event-card.tsx`,
  using a hand-written `src/components/ui/tabs.tsx` — `npx shadcn add tabs`
  failed in this sandboxed environment same as every prior shadcn attempt,
  hand-matched the New York style from the existing `badge.tsx`/`card.tsx`
  shape; `@radix-ui/react-tabs` was already an installed dependency).
  Results / Odds / Bets. Odds tab is read-only
  (`src/components/event-odds-table.tsx`) — ranking editing stays on Setup,
  per the groom's explicit "keep editing on Setup" answer. Bets tab
  (`src/components/event-bets-list.tsx`) only renders once the event has
  left "planned," revealing what was wagered on it — this is also where
  "everyone's per-event bets" now lives, replacing the card of the same
  name that used to sit on `/bets` (removed — redundant with this reveal,
  and showing it pre-lock would have spoiled the suspense the groom wanted).
- **Not independently screenshot-verified** — same standing limitation
  (no browser driver, no live Supabase creds in this worktree). This
  session's changes are the most structurally different from prior
  sessions' builds (a real pick-column schema change, a relaxed budget
  invariant, tab-based navigation) — **recommend the most thorough
  real-project click-through yet** once both migrations run: rank an
  event, place an overall bet, place a per-event bet on someone else,
  finalize that event, and confirm the reserve, the bet's resolved status,
  and the Bets-tab reveal all agree with each other.

## 2026-08-11 — Odds move to Setup, per-event ranking, per-event betting, cuts

Four user-driven changes after using the app for real, all landed together
since they're entangled (per-event ranking is *why* per-event betting's odds
finally make sense). 121 tests (10 net new — 13 added across
`src/lib/betting/fromRows.test.ts` (prior session), `src/lib/odds/
aggregate.test.ts`, `src/lib/betting/resolvePerEventBets.test.ts`, minus 3
removed peer-award tests), lint/typecheck/test/build all green, dev-server
smoke test of all 5 remaining routes (clean compile, 200s). **Not verified
against live data — see the open question above about migration 0007.**

- **Per-event ranking, not one overall ranking.** The spec's "the groom
  ranks all 8 players... across all 8 events" turned out ambiguous — this
  session resolves it as one ranking PER EVENT. This wasn't just a UI
  preference: it's what per-event betting's odds actually need (a bet on
  your own finish in golf should be priced off how strong you're predicted
  to be AT GOLF, not overall). `event_rankings (event_id, player_id, rank)`
  replaces the old single `groom_ranking` table (migration 0007 — see the
  open question above, not yet run live). `src/lib/odds/ranking.ts`'s pure
  Plackett-Luce math is unchanged (it already operated on one ranking at a
  time); only its docstring and callers changed.
- **Ranking editor moved from its own `/odds` page to Setup → Groom tools**
  (`src/components/event-odds-editor.tsx`, new: event picker + the existing
  `GroomRankingEditor` drag list, reused as-is). `/odds` as a page is gone —
  odds now show up inline on `/bets`, next to the bet they inform, per the
  user's explicit direction ("you want to see the odds and make your bet").
- **Overall win/top3 odds now come from `src/lib/odds/aggregate.ts`** (new,
  +test): averages each player's rank across every event the groom has
  completely ranked so far (only *complete* rankings count — a partial one
  would skew the average) and re-derives a synthetic 1..N order from those
  averages, then feeds that into the existing `impliedProbabilities`/
  `payoutMultipliers`. Updates automatically as the groom ranks more events;
  no separate input. A documented policy choice (simple mean, not a
  weighted/Plackett-Luce combination) — see the file header for why.
- **Overall betting drops the "last place" joke bet** — down to win/top3,
  per explicit instruction. Enforced in three places: the DB check
  constraint (migration 0007), `OverallBetRow.bet_type`'s TypeScript type,
  and the `/bets` UI (which never rendered a third option to begin with).
  `docs/PRODUCT_SPEC.md` updated to record this as a decision, not silently
  dropped.
- **Per-event multiplier betting, built for the first time** (was
  previously only pure math, `src/lib/betting/perEvent.ts`, with no data
  layer or UI). Lives on `/bets` under "Per-event bets," one card per event
  currently `"scoring"` (**placement events only** — see the open question
  above): shows that event's own win/place odds for the current player,
  and a wager form capped at their currently-locked multiplier for that
  event. `per_event_bets` had no `pick_player_id` column — it turns out
  these are self-bets (you wager on your OWN finish), which is what makes
  "that event's own odds" the right price. New pure resolver
  `src/lib/betting/resolvePerEventBets.ts` (+test) checks the bettor's
  actual finishing position against their target and settles via the
  existing `resolveWon`/`resolveLost` state machine; a thin
  `resolvePerEventBets` mutation wraps the fetch/resolve/write. Wired into
  `EventCard`'s finalize flow — resolving happens automatically the moment
  the groom finalizes a placement event's results, no separate step.
- **No peer award vote** — cut outright, not deferred. Removed
  `src/lib/bonus/peerAward.ts` and its tests (kept `bonusEvent.ts`, which is
  a different, still-planned feature), dropped `peer_award_votes` from the
  schema (migration 0007) and from `resetWeekend`'s wipe list, removed
  `PeerAwardVoteRow`, and moved the spec bullet to "Explicitly out of
  scope" rather than deleting it outright — keeps the paper trail of what
  was considered and cut.
- **Page widths normalized to `max-w-2xl` everywhere.** `/` and `/events`
  had drifted to `max-w-3xl` (probably from being built in an earlier
  session before the convention settled); every other page was already
  `max-w-2xl`. Picked the majority width rather than widening everything
  else to match the two outliers.

## 2026-08-11 — Overall betting: place, switch, live elimination

114 tests (3 new — `src/lib/betting/fromRows.test.ts`), lint/typecheck/
test/build all green, dev-server smoke test of `/bets` and `/` (clean
compile, 200s).

Picked as the next Phase 3–4 slice, continuing on from the odds screen
(explicit go-ahead: "continue with the next plan item"). No new migration —
`overall_bets` already had RLS (`0002_rls.sql`) and Realtime
(`0003_realtime.sql`) from Phase 1, unlike `groom_ranking` last session.

- **`src/lib/betting/fromRows.ts`** (new, +test): bridges DB rows to the
  `EliminationInput[]` that `isPickAlive` (already existed, Phase 0) needs.
  Computes each player's current multiplier-adjusted total via the existing
  `deriveScoreLines` + `playerTotals`, and shared max/min remaining-points
  bounds via the existing `remainingBounds`, using the placement curve's
  last-place value (rounded, matching how placement scores are stored) as
  the pessimistic per-event floor — see the open-question note above for why
  that's a documented approximation, not an exact derivation.
- **Data layer**: `fetchOverallBets` (queries.ts) + `placeOverallBet` /
  `switchOverallBetPick` (mutations.ts). One row per (player, bet_type) by
  convention — there's no DB unique constraint enforcing that (schema
  predates this session), so the UI is what prevents a duplicate placement
  by switching to "switch" mode once a bet exists for that type.
  `switchOverallBetPick` reads the current `switches` count and increments
  server-side in the same call, rather than trusting a client-supplied
  count, to avoid a stale-read race.
- **Store**: `gameStore.ts` now fetches + realtime-subscribes to
  `overall_bets` alongside everything else.
- **UI**: `src/app/bets/page.tsx` — one card per bet type (win/top3/last).
  Shows the current player's pick, live Alive/Eliminated badge, and the
  payout value at their current switch count if they have one; a plain
  picker + "Place bet" if they don't. Switching is **only offered once the
  pick reads eliminated** (per spec: "if a player's pick becomes
  mathematically eliminated... they get the option to switch"), and the
  switch-to picker is filtered to still-alive players only. Below that, an
  "Everyone's bets" card lists every bet with its live alive/eliminated
  status — consistent with this app's "no suspense, visible to everyone"
  design used everywhere else (medal table, odds).
  - Deliberately did **not** gate bet placement on the groom having set a
    ranking — the payout is flat regardless of pick (spec: "the odds already
    reflect difficulty... the reward doesn't need to scale on top of that"),
    so nothing about betting mechanically depends on odds existing, even
    though the odds screen is what makes an *informed* pick possible.
  - Also didn't restrict betting on yourself — the spec doesn't forbid it
    and it's a harmless edge case (the "last place" joke bet on yourself is
    arguably in the spirit of the thing).
  - Added `/bets` to `app-nav.tsx` (Coins icon) — six links now in the
    mobile floating nav; still fits, each item just gets a little tighter.
- **Not independently screenshot-verified** — same standing limitation
  (no browser driver, no live Supabase creds in this worktree). Dev-server
  smoke test only. **Recommend an actual click-through** once deployed:
  place a bet, resolve enough events to eliminate a pick, confirm the badge
  flips and the switch picker appears with the right candidates.

## 2026-08-11 — Event results list, odds screen relabel, weekend/event reset

Follow-up polish requested after the odds screen shipped and got a real
look. 111 tests (unchanged — no new domain logic, all UI/data-layer),
lint/typecheck/test/build green, dev-server smoke test of `/`, `/events`,
`/odds`, `/setup` (clean compile, 200s).

- **Event results now a vertical list** (`src/components/event-card.tsx`):
  was a `flex-wrap` row that packed every player's name+score onto as few
  lines as possible — hard to scan, especially on a phone with 8 players.
  Now one player per row, name left / value right.
- **Odds screen's ranking editor now sits under a "Groom tools" card**
  (`src/app/odds/page.tsx`) — same title/icon convention as the Setup
  page's groom section, instead of its own "Set the ranking" heading. The
  payout-odds table above it is unchanged and still visible to everyone.
- **Reset an event** (`resetEvent` in `mutations.ts`, button on
  `EventCard`): deletes that event's results and sets it back to
  `"planned"`. Deliberately narrower than cancel — the event, its photo, and
  any multiplier values allocated to it are untouched; going back to
  `"planned"` just re-unlocks its multiplier (locking is derived from
  `status !== "planned"`, not a stored flag, so no separate unlock step was
  needed). Same two-step confirm pattern as "Cancel event," right next to it.
- **Reset the whole weekend** (`resetWeekend` in `mutations.ts`, "Danger
  zone" card on `/setup`, groom-gated): wipes every table of weekend
  *activity* — event results, multiplier allocations, all three bet/vote
  tables, bonus events, the power move (back to unused), and the groom's
  ranking — and puts every event back to `"planned"`. **Deliberately keeps
  players and the theme** — this restarts the competition, not the guest
  list or the look, per the user's explicit choice when asked (they also
  chose to include the ranking in the wipe, unlike the narrower option
  offered). Two-step confirm, same as the other destructive actions in this
  app. Implemented as a loop of per-table deletes (`.delete().not(col, "is",
  null)`, the same "wipe all rows" trick used for `setGroomRanking`'s
  clear-then-insert) rather than a single transaction — no way to run a
  multi-statement transaction through the anon-key REST API this app uses
  everywhere else, and a partial reset from a mid-loop failure is an
  acceptable risk for a rare, groom-only admin action (re-running it is
  idempotent — deleting already-empty tables is a no-op).
- **Not independently screenshot-verified** — same standing limitation as
  every session so far (no browser driver, and this worktree has no
  `.env.local` so there's no live data to exercise interactively). Ran a
  dev-server smoke test only. **The two reset actions are the highest-risk
  code in this session** — recommend the user actually click through both
  confirm flows against the live project once deployed, since a wrong
  table/column name here would silently no-op rather than error loudly
  (Postgres doesn't complain about deleting zero rows).

## 2026-08-11 — Groom's odds-ranking screen

111 tests, unchanged — no new tests added, since this session's new code is
UI/data-layer wiring around `src/lib/odds/ranking.ts`, which was already
fully tested from Phase 0. lint/typecheck/test/build all green, dev-server
smoke test of `/odds` and `/` (clean compile, 200s).

Read `PRODUCT_SPEC.md` → Overall betting → Odds source before starting, per
CLAUDE.md. Picked this as the first Phase 3–4 slice (user's explicit choice
among four options) because it's the prerequisite for every other betting
feature — nothing else in that phase can go live without odds existing first.

- **New migration** `supabase/migrations/0006_groom_ranking_realtime.sql` —
  found a real gap: `groom_ranking` has existed since `0001_init.sql` and
  already has RLS from `0002_rls.sql`, but `0003_realtime.sql` never added it
  to the `supabase_realtime` publication. Without this fix the odds screen
  would need a manual refresh to see a new ranking instead of updating live
  like everything else. **Needs to be run in the SQL Editor**, same pattern
  as 0002-0005. (Unlike `app_settings` in the theme work, this table already
  existed on the live project, so nothing else was blocked by it being
  unrun — only Realtime sync on this one table is affected until it runs.)
- **Data layer**: `fetchGroomRanking` (queries.ts, sorted by rank) +
  `setGroomRanking` (mutations.ts) — the ranking is always saved as a full
  1..N replace (delete-all then insert), not a partial edit, since the odds
  screen always submits a complete ordering. Two round-trips, not atomic,
  but judged fine for a single-groom, low-concurrency admin action — same
  risk profile as other groom-only writes in this app.
- **Store**: `gameStore.ts` now fetches + realtime-subscribes to
  `groom_ranking` alongside the other tables. Included directly in the main
  `Promise.all` (not fetched separately with a `.catch`) because — unlike
  `app_settings` — this table isn't new, so there's no pre-migration project
  state where fetching it would throw and block everything else.
- **UI**: `src/components/groom-ranking-editor.tsx` — drag-to-reorder list,
  reusing the same `@dnd-kit` PointerSensor pattern as
  `ranked-results-editor.tsx`, but deliberately **no tie toggle** — the
  groom's ranking must be a strict 1..N ordering (`assertValidRanking` in
  `src/lib/odds/ranking.ts` enforces unique ranks), unlike event results
  which allow ties.
  `src/app/odds/page.tsx`: everyone sees the win/top3/last payout
  multipliers (computed via `impliedProbabilities` + `payoutMultipliers`,
  both already existed and were already tested); only the groom (PIN-gated,
  same pattern as every other groom tool) sees the ranking editor, and only
  while every event is still `planned` — locks the same way multiplier
  sliders do, matching the spec's "set once, upfront, no live updates"
  design intent even though it isn't DB-enforced (see the open question
  above). Added `/odds` to `app-nav.tsx` (Percent icon).
  - Handles player-list drift: if a player is added after a ranking was
    already saved, the editor appends them at the bottom of the existing
    order rather than discarding the ranking and starting over.
  - Odds only render once the saved ranking covers every current player —
    otherwise shows "the groom hasn't set a ranking yet" rather than a
    partial/misleading table.
- **Not independently screenshot-verified** — same standing limitation as
  every prior session (no browser driver in this environment). Ran a
  dev-server smoke test instead (clean compile, `/odds` and `/` both 200)
  from a git worktree with no `.env.local`, so this only proves the page
  renders and doesn't crash without live data — not a check against the real
  Supabase project's actual player/ranking rows. **Recommend a manual look
  at the deployed app** (or `localhost:3000` with real creds) as the next
  concrete check, same as the progress-chart caveat from the prior session.

## 2026-08-11 — Shared tweakcn theme picker under groom tools

111 tests, all gates green. Shared (not per-device) — matches every other
groom tool, which all act on shared game state; live for everyone via the
same Realtime pattern as the rest of the app.

- `src/lib/themes.ts`: "Classic" (this app's original default, transcribed
  verbatim from `globals.css`) + 6 **real** tweakcn presets — Modern Minimal,
  Twitter, Bubblegum, Doom 64, Tangerine, Catppuccin — fetched directly from
  `tweakcn.com/r/themes/<slug>.json` on 2026-08-11, not invented/approximated.
  Only the CSS vars this app's `globals.css` actually declares are kept.
- `supabase/migrations/0005_theme.sql`: single-row `app_settings` table
  (same pattern as `power_move`), trusted-friends RLS, added to the realtime
  publication. **Needs to be run in the SQL Editor** before the picker
  actually changes anything live — same pattern as 0002-0004.
- `src/components/theme-applier.tsx` (mounted once in `layout.tsx`): writes
  the active theme's tokens as inline styles on `<html>` — wins over the
  static `:root` values in `globals.css`, updates instantly since
  `gameStore` already Realtime-subscribes to `app_settings`. Only the light
  token set is live (this app still has no dark-mode toggle wired up, so
  `theme.dark` is captured for completeness but unused — same call as the
  progress-chart work).
- `src/components/theme-picker.tsx`: swatch grid on `/setup`'s groom tools,
  gated the same way as the other admin actions.
- **Caught a real regression before it shipped**: `app_settings` didn't
  exist yet (migration not run), and `fetchAppSettings` was originally
  inside the same `Promise.all` as the core game data in `gameStore` — that
  would have thrown and blocked players/events/everything from ever loading
  on any device until the migration ran. Fixed: `appSettings` now fetches
  separately with a `.catch(() => null)`, and `ThemeApplier` already treats
  `null` as "use Classic." **Verified live against the actual pre-migration
  project**: core data (8 players, 9 events) loads fine, `appSettings`
  degrades to `null` exactly as intended, nothing else breaks.

## 2026-08-11 — Live progress chart + tie fix + mobile nav + player settings

105 tests, all gates green (lint/typecheck/test/build), plus a dev-server
smoke test of all four routes (200s, clean compile log) against the live
Supabase project (8 real players already set up, Beach Volleyball resolved).

- **Progress chart** (`src/components/progress-chart.tsx`, homepage, above
  the Medal Table): live line chart of cumulative multiplier-adjusted points
  per player across the weekend, via `recharts`. Loaded the **dataviz skill**
  before writing any chart code (mandatory trigger) and followed it
  end-to-end:
  - **Color** (`src/lib/chartColors.ts`): "flag-inspired, auto-disambiguated"
    per the user's explicit choice after I flagged that most US state flags
    are blue-field-plus-seal, so literal flag colors would collide. Uses the
    dataviz skill's validated 8-slot categorical palette (re-validated
    against this app's *actual* surfaces — light `#ffffff`, dark `#241e1a`,
    converted from the real oklch tokens — not just the skill's generic
    defaults; `node scripts/validate_palette.js`, all checks pass). A small,
    deliberately non-exhaustive table maps a handful of genuinely
    well-known, distinctive state flags (AZ copper-orange, NM Zia
    yellow/gold, CA bear-flag red, MD Calvert gold, OH/FL/AL red saltire,
    TX/SC blue field) to their nearest slot; two-pass assignment lets
    preference-holders claim first, then fills everyone else from the
    remaining slots in fixed order — guarantees every player a distinct,
    validated color regardless of how many flags I actually know.
    **Found and fixed a real bug via live-data testing**: single-pass
    assignment let a no-preference player steal a preferred slot ahead of
    its rightful claimant depending on processing order; two-pass fixed it
    (verified against the live project's real 8 players — AZ→orange,
    TX→blue, CA→red, all landed correctly, all 8 still distinct).
  - **Data** (`src/lib/scoring/cumulativeSeries.ts`, pure + tested): a
    leading synthetic "Start" point at zero, then one equally-spaced x
    position per event regardless of status; a player's cumulative total is
    only set once that event resolves, otherwise null — the line stops at
    the live frontier instead of implying false continuation. Verified
    against live data: 10 points (start + 9 events), Beach Volleyball's
    resolved totals correct, the other 8 events correctly null.
  - **Marks**: player photo as the dot marker (SVG `<image>`, circular clip,
    2px surface ring per the skill's spec so overlapping markers stay
    legible), native `<title>` for per-marker hover, fallback for players
    without a photo.
  - **Interaction**: crosshair + one tooltip listing every player's value at
    that event (avatar+flag+name, value bold), per `interaction.md`.
  - **Legend**: always visible with line-key swatches (not boxes) — required
    relief for the light-mode contrast WARN the validator flagged on 3 of
    the 8 slots.
  - X-axis ticks are the event's number, not its full name — long names
    ("Super Smash Bros. (N64)") would collide on a phone-width chart (per
    the skill's "measure first, don't clip" rule); full names live in the
    tooltip.
  - **Not independently screenshot-verified** — no browser driver available
    in this environment (same limitation as earlier in this project). Ran
    the actual data pipeline (`cumulativeSeries` + `assignPlayerColors`)
    against live data instead, and a dev-server smoke test confirmed clean
    compiles and 200s on every route. A manual look at `localhost:3000` (or
    the deployed app) is the one remaining check.
- **Tie fix** (`src/components/ranked-results-editor.tsx`): the visible rank
  badge was showing raw list index instead of the actual computed position,
  so checking "tied with row above" didn't visibly change anything — now
  reads from `positionsFromOrder()`. Also added the tie toggle to every row
  (including 1st, disabled/inert there — nothing above it to tie with) for
  visual consistency, per the ask.
- **Floating bottom mobile nav** (`src/components/app-nav.tsx`): single
  responsive component — fixed floating pill bar on mobile widths, reverts
  to the original inline row at `sm:` and up. Added matching bottom padding
  to every page's `<main>` so the floating bar doesn't cover content.
- **Setup → Player Settings**: person icon, nav label shows the selected
  player's name once picked on this device (falls back to "Player Settings"
  otherwise), page heading updated to match.

## 2026-08-11 — Groom-requested polish batch

Six asks in one batch, all shipped. 93 tests, all gates green.

- **Stump**: dropped the sobriety-check flag/language from
  `src/lib/events/config.ts` + `PRODUCT_SPEC.md`. Also fixed a real bug found
  along the way: `seedEvents()` used `ignoreDuplicates: true`, so it could
  never actually propagate a config edit to an existing live row. Now it
  upserts every config-owned column except `status` and `photo_url` (both
  live app state), verified against the real `stump` row — content updated,
  status (`scoring`, from the user's own live testing) correctly preserved.
- **Placement scoring rounded to whole numbers** (`src/lib/scoring/placement.ts`):
  rounds the final tie-split share, not the underlying 0.72 decay curve, so
  ties still split fairly in continuous space first. Table now reads
  100/72/52/37/27/19/14/10. Total-points-awarded invariant can drift by ~1-2
  points from rounding — judged negligible against `simulation-notes.md`'s
  70-130 point finisher gaps; did not rerun the simulation.
  `src/lib/scoring/absolute.ts` is untouched (proportional scaling is the
  point there, rounding would blur close results) — scoped to placement only,
  as asked.
- **Groom: edit/remove players**: `updatePlayer` mutation +
  `src/components/manage-player-row.tsx`, wired into a new "Manage players"
  card on `/setup`. Verified live (add → update → confirm → clean up).
- **Drag-and-reorder placement results**: added `@dnd-kit` (PointerSensor, so
  it works on touch — this runs on phones at the actual event, native HTML5
  drag-and-drop doesn't). Split the tricky bit into pure, unit-tested helpers
  (`src/lib/scoring/rankedOrder.ts`: order+tie-set ↔ position numbers) from the
  UI (`src/components/ranked-results-editor.tsx`). Ties are a "tied with row
  above" toggle rather than a drag gesture — precise tie ordering via drag
  alone is fiddly, a toggle isn't. Absolute-mode events (golf, etc.) keep the
  plain numeric input — dragging doesn't make sense for strokes/time.
- **Player + event photos**: `photo_url` columns, a `photos` Storage bucket
  (public read, trusted-friends anon write policy — same model as
  `0002_rls.sql`), `src/lib/supabase/storage.ts` upload helper, groom-gated
  upload controls on `/setup` and each event card, displayed as a circular
  avatar next to `PlayerName` everywhere and a thumbnail on `EventCard`. Used
  `next/image` (not a plain `<img>`) — `next.config.ts` now derives the
  allowed remote host straight from `NEXT_PUBLIC_SUPABASE_URL`, no per-env
  config needed.

**Needs `supabase/migrations/0004_photos.sql` run in the SQL Editor before
uploads work** (same pattern as 0002/0003) — adds the columns + bucket +
storage.objects policies. Everything else in this batch works against the
live project as-is; only the photo feature is blocked pending that migration.

## 2026-08-11 — Realtime confirmed working (migration 0003 run)

User ran `supabase/migrations/0003_realtime.sql`. Re-ran the probe: inserted a
row, updated it, both `INSERT` and `UPDATE` `postgres_changes` events fired
correctly, probe row cleaned up. `src/store/gameStore.ts` subscribes with the
identical client/channel pattern against the same now-published tables, so
Phase 1's live-sync goal is met. **Phase 1 is functionally done** — schema,
RLS, auth model, data layer, store, and Realtime are all built and verified
against the real project.

Not independently confirmed: a rendered browser actually reflecting a change
live (no browser driver available in this environment — see prior session's
`claude-in-chrome` note). The underlying mechanism is proven at the client
level; a manual check with two browser tabs open to `localhost:3000` would be
the natural next confirmation, cheap to do by hand.

## 2026-08-11 — Live Supabase project wired up, data layer + store built

User created a real Supabase project and ran migrations 0001 + 0002. Branch
`matthew/phase-1-data-store`, on the stack tip. 84 tests; all gates green;
**verified against the live project**, not just typechecked:

- `src/app/api/groom/unlock/route.ts` — checks the PIN server-side against
  `process.env.GROOM_PIN` (no `NEXT_PUBLIC_` prefix), so it never ships in the
  client bundle. Verified live: wrong PIN → `{ok:false}`, correct PIN → `{ok:true}`.
- `src/lib/data/queries.ts` + `mutations.ts` — thin Supabase wrappers
  (fetch/add/remove players, fetch events/results/multipliers, idempotent
  `seedEvents`). Verified live: add → fetch → remove round-tripped correctly
  and left the DB exactly as before (no orphaned test rows).
- `src/lib/scoring/fromRows.ts` (+test) — pure bridge from DB rows to
  `EventScoreLine[]` (only `resolved` events score; `cancelled` excluded per
  spec). DB-agnostic and unit-tested.
- `src/store/gameStore.ts` — zustand store: fetches players/events/results/
  multipliers once, then a single Realtime channel refetches everything on any
  change to those tables (simple + cheap at 8-player scale).
- `src/store/sessionStore.ts` — zustand wrapper over `src/lib/session/identity.ts`,
  wired to `/api/groom/unlock`.
- `src/app/setup/page.tsx` — real screen: pick which player you are; groom-PIN
  gated "add player" form (name, nickname, US state, is-groom checkbox).
- `src/app/page.tsx` — Medal Table now reads live store data instead of demo
  seed data (`src/lib/demo.ts` deleted).
- `scripts/seed-events.ts` (`npm run seed:events`) — ran live: all 9 events
  from `src/lib/events/config.ts` seeded into the real `events` table, verified
  by direct query.
- Hand-wrote `ui/input.tsx` + `ui/label.tsx` (shadcn registry unreachable
  in-sandbox, same reason as `ui/table.tsx` earlier).

**Found and fixed via live testing:** Realtime subscriptions returned
`SUBSCRIBED` but produced zero `postgres_changes` events on a real insert — new
Supabase projects don't auto-add tables to the `supabase_realtime` publication.
Added `supabase/migrations/0003_realtime.sql` (`alter publication
supabase_realtime add table ...` for every game table). **User needs to run
this one too** (SQL Editor, same as 0001/0002) before Realtime actually works;
re-verify with the probe script below once it's run.

Local dev note: this machine sits behind corporate TLS interception (Zscaler).
`curl`/browsers trust it via the macOS keychain; Node's `fetch` doesn't by
default. Fix: export the "Zscaler Root CA" cert from Keychain Access and set
`NODE_EXTRA_CA_CERTS` to its path before running `npm run dev` / any script
that calls Supabase from Node. Not needed for the browser itself. Cert file
intentionally not committed (kept in a scratch dir).

Realtime re-verify probe (self-terminating, cleans up its own test row):
```
NODE_EXTRA_CA_CERTS=<path> npx tsx -e "
import { createClient } from '@supabase/supabase-js';
process.loadEnvFile?.('.env.local');
const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
const ch = client.channel('probe').on('postgres_changes', {event:'*',schema:'public',table:'players'}, (p) => console.log('EVENT', p.eventType));
ch.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') {
    const { data } = await client.from('players').insert({ name: '__probe__', state: 'CA' }).select().single();
    setTimeout(async () => { await client.from('players').delete().eq('id', data.id); process.exit(0); }, 3000);
  }
});
"
```

**Remaining for full Phase 2:** event board, groom score entry, multiplier
sliders with the zero-sum gate — all straightforward once Realtime is
confirmed, following the same store pattern as the medal table.

## 2026-08-11 — Auth decided + session/identity + RLS

**Decision:** shared-link **name picker** (no accounts). Branch
`matthew/phase-1-auth-session`, on the stack tip. 79 tests; all gates green.

- `supabase/migrations/0002_rls.sql` — RLS for the trusted-friends model:
  enable RLS on all game tables, permissive anon read/write. The trust boundary
  is the link; the groom gate is app-level (PIN), not DB. Documented how to swap
  to `auth.uid()` policies if we ever move to magic-link auth.
- `src/lib/session/identity.ts` (+test) — pure player-picker + groom-PIN gate
  behind a `KeyValueStorage` interface. Blank PIN never unlocks.
- `src/lib/session/browserStorage.ts` — SSR-safe localStorage adapter.

**Still deferred (needs a live Supabase project — can't provision in-sandbox):**
the data-access query/Realtime layer (`src/lib/data/*`) and the zustand store
(`src/store`). Design is settled now, though: store hydrates from Supabase +
subscribes to Realtime; identity comes from the session module; groom writes
gated by `isGroomUnlocked`. The `GROOM_PIN` needs an env var (add to
`.env.example` when the store lands).

**Next once a project exists:** create Supabase project → paste creds into
`.env.local` → run both migrations → build `src/lib/data/*` + `src/store` →
swap the medal table off `src/lib/demo.ts` onto the store → then the remaining
Phase 2 screens (player setup/state picker, event board, score entry,
multiplier sliders with the zero-sum gate).

## 2026-08-10 — Phase 2 flags + medal table (decision-independent slice)

Branch `matthew/phase-2-flags-medal-table`, stacked on Phase 1. Built the
flags-next-to-names feature and the live medal table — the parts of Phase 2 that
need neither auth nor Supabase, so they're fully verifiable now. 71 tests; all
gates green; **verified rendering in the real dev server** (server-rendered
standings, correct sort, flag `aria-label`s, podium medals).

- `src/lib/states.ts` (+test) — USPS code ↔ name, picker options.
- `src/components/flag.tsx` — the `Flag` chip. **Single swap seam** (`FlagGlyph`):
  today an abbreviation chip; replace only that function with `<svg>`/`<img>` to
  move to real state-flag assets. Every `<Flag state="TX" />` call site is stable.
- `src/components/player-name.tsx` — flag + name + optional nickname, the
  standard way to show a competitor anywhere.
- `src/components/medal-table.tsx` — pure presentation over the Phase-0
  `standings()`; feed it live data from the store later, no change needed.
- `src/components/ui/table.tsx` — hand-written shadcn `table` (registry was
  unreachable in-sandbox; matches the new-york shape of the other ui/ files).
- `src/lib/demo.ts` — **placeholder** seed data (real scoring math, made-up
  players). Delete once the store feeds live data.
- `src/app/page.tsx` — now renders the Medal Table instead of the scaffold.

Still open for full Phase 2: player setup / state picker, event board, groom
score entry, multiplier sliders with the zero-sum gate. These want the Phase-1
store, so they come after the auth decision.

## 2026-08-10 — Phase 0 complete, Phase 1 started

### Done & verified

**Phase 0 — domain core** (branch `matthew/phase-0-scoring-core`, committed).
The whole rulebook from `docs/PRODUCT_SPEC.md` as pure, unit-tested TypeScript
under `src/lib/` (no React, no Supabase). 64 tests; lint/typecheck/build green.
Modules: `events/config`, `scoring/{placement,absolute,total}`,
`multipliers/budget`, `odds/ranking`, `betting/{overall,perEvent}`, `bonus/`.
Tooling added: **Vitest** (`npm run test`) and the **Next flat ESLint config**
the scaffold was missing. Spec corrected (user-authorized): groom is one of the
8 competitors and also officiates.

**Phase 1 — backend groundwork** (branch `matthew/phase-1-supabase`, stacked on
Phase 0). Decision-independent pieces only, all compiling (67 tests, gates
green):
- `supabase/migrations/0001_init.sql` — full schema mirroring the domain
  (players, events, event_results, multipliers, groom_ranking, overall_bets,
  per_event_bets, bonus_events, peer_award_votes, power_move). **DRAFT: RLS not
  configured yet** (see below).
- `src/lib/data/database.types.ts` — row types matching the migration.
- `src/lib/data/events.ts` (+test) — seeds the `events` table from
  `src/lib/events/config.ts` so app and DB share one source of truth.
- `src/lib/supabase/client.ts` — lazy browser client from env.
- `.env.example` — Supabase vars uncommented with guidance.

### Blocked — needs a decision + a live project

Two things gate the rest of Phase 1, so I stopped rather than guess:

1. **Auth mechanism (open decision).** Magic-link accounts vs. shared-link name
   picker. This drives the **RLS policies** (left as a TODO at the bottom of the
   migration) and the shape of "who am I" in the data layer. Not built yet:
   auth flow, RLS, the data-access query/Realtime layer (`src/lib/data/*`), and
   the zustand store (`src/store`).
2. **No Supabase project/credentials** in this environment, so Realtime sync is
   unverifiable here. Someone needs to create the project, paste URL + anon key
   into `.env.local`, and run the migration.

### Suggested next steps

- Decide the auth model → finish RLS in `0001_init.sql` → build
  `src/lib/data/*` (queries + Realtime subscriptions) → `src/store`.
- Or, in parallel and decision-independent: start **Phase 2 UI** — the `Flag`
  component (US states) + a medal-table view driven by the Phase-0 domain layer
  with seed data, wiring it to the store once Phase 1 lands.

### Branch/merge note

Phase 0 and Phase 1 branches are stacked and **unpushed**. Phase 0 should merge
to `main` first; Phase 1 rebases onto it. Nothing pushed to `main`.
