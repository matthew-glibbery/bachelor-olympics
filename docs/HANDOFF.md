# Session handoff

Rolling handoff note (per CLAUDE.md). Newest section on top.

## Current state (as of 2026-08-11, end of session)

Start here if you're picking this up cold — the detailed log below has the
blow-by-blow if you need it, but this is the map.

**Live and working**, verified against the real Supabase project + a real
GitHub repo + Vercel deploy (not just typechecked), except this session's
work — see the caveat in the log entry below:
- **Repo**: `github.com/matthew-glibbery/bachelor-olympics` (private), `main`
  branch, CI green on every push (`.github/workflows/ci.yml`: pnpm, Node 22).
  Deployed on Vercel, auto-deploys from `main`.
- **Package manager is pnpm, not npm** — a real, hard-won fix (see the
  "Switch from npm to pnpm" log entry). Don't reintroduce npm/package-lock.json.
- **8 real players** already set up in the live DB, one groom, real states,
  some photos uploaded. **Beach Volleyball** is the one resolved event so far.
- **Five core screens** (shared bottom-floating-on-mobile nav,
  `src/components/app-nav.tsx`):
  - `/` — live cumulative progress chart (player photos as markers,
    flag-inspired colors, dataviz-skill-validated) + Medal Table.
  - `/events` — groom-gated event board: start scoring → drag-to-reorder
    placement results (or numeric for absolute events, e.g. golf) → finalize
    → resolved. Ties via a "tied with row above" toggle. Cancel = hard delete
    (per spec).
  - `/multipliers` — per-player sliders, zero-sum budget gate, locks once an
    event leaves "planned."
  - `/odds` — **new this session**: groom's private strength ranking
    (drag-to-reorder, no ties) → win/top3/last payout odds for everyone,
    visible to all. See log entry below.
  - `/setup` ("Player Settings" in the nav, shows your name once picked) —
    player picker, groom PIN gate (`GROOM_PIN` env var, checked server-side
    via `/api/groom/unlock`), add/edit/remove players + photos, **shared
    tweakcn theme picker**.
- **All 6 Supabase migrations run** (0006 is new this session — see below):
  schema, RLS (trusted-friends/shared-link model — no real accounts, the
  link is the trust boundary), Realtime publication, photos (Storage
  bucket), theme (`app_settings`), groom_ranking added to Realtime.
- Domain/scoring logic (`src/lib/scoring/*`, `src/lib/multipliers/*`,
  `src/lib/betting/*`, `src/lib/odds/*`) is pure, unit-tested (111 tests),
  and matches `docs/PRODUCT_SPEC.md` — placement scoring rounds to whole
  numbers (100/72/52/37/27/19/14/10), per an explicit product decision from
  an earlier session.

**Not built yet** (rest of Phase 3–4, `docs/PRODUCT_SPEC.md` has the rules):
overall betting (win/top3/last picks, switch-pick halving, mathematical
elimination), per-event multiplier betting, groom's one-time power move,
peer award vote, on-the-fly bonus events. The pure math for overall/per-event
betting already exists (`src/lib/betting/`) and now has real odds to consume
(`src/lib/odds/` + the `/odds` screen, this session) — no UI or data-layer
wiring yet for any of these five.

**Environment quirk worth knowing**: this dev machine sits behind corporate
TLS interception (Zscaler) and a corporate npm registry mirror. Both are
worked around already (`.npmrc` pins the public registry;
`NODE_EXTRA_CA_CERTS` needed for any Node-side script that calls Supabase
directly, not needed for `next dev`/`next build` themselves). See the
relevant log entries below if this bites again.

**Open question for next session**: the `/odds` ranking editor is only
UI-locked once an event leaves "planned" (same convention as multipliers) —
there's no DB-level enforcement stopping the groom from re-saving a ranking
mid-weekend by, e.g., hitting the API directly. Spec says odds are set once,
upfront, and this app's whole security model is app-level trust anyway (see
`0002_rls.sql`), so this was judged good enough rather than adding a DB
trigger — flag if that judgment call feels wrong once betting actually
depends on odds staying fixed.

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
