# CLAUDE.md

Standing orders for any agent (Claude Code, Claude Code on the web, or
otherwise) working in this repo. Read this file first, every session.

## Before doing any scoring, betting, or multiplier work

**Read `docs/PRODUCT_SPEC.md` in full.** It's the actual product decisions —
scoring curves, multiplier rules, betting mechanics, elimination logic — all
worked out deliberately in prior planning sessions. Don't infer or simplify
these rules from the code or from first principles; the spec is the source
of truth, not a summary. If something in the code seems to contradict the
spec, the spec wins — flag the discrepancy rather than "fixing" the spec to
match the code.

`docs/simulation-notes.md` has the reasoning behind the one number in the
spec that isn't self-evidently right (the 100-point overall-bet payout) —
read it before changing that number.

## Working conventions

- This is a two-person project (see `CONTRIBUTING.md` for the branch/PR
  workflow). Don't push directly to `main`.
- Design tokens live in `src/app/globals.css` as CSS variables, tweakcn-
  compatible — don't hardcode colors in components, use the Tailwind
  utilities that map to those variables (`bg-primary`, `text-muted-foreground`,
  etc.).
- New shadcn primitives should go through `npx shadcn@latest add
  <component>` when network access allows, so they match the existing style
  (`components.json` is already configured). If you have to hand-write one
  because of a sandboxed/offline environment, match the shape of the
  existing components in `src/components/ui/` exactly.
- Icons: `lucide-react` only, for consistency.
- Run `npm run lint && npm run typecheck && npm run build` before considering
  a task done — CI runs the same checks on every PR.

## Context handoff

For long sessions that need to break and resume: write a short handoff note
(what's done, what's in progress, what's next, any open questions) before
ending the session. There's no fixed location for this yet in this repo —
use your judgment on where it's most useful, or ask if it's not obvious.
