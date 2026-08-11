# Session handoff

Rolling handoff note (per CLAUDE.md). Newest section on top.

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
