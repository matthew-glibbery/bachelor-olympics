# Session handoff

Rolling handoff note (per CLAUDE.md). Newest section on top.

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
