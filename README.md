# Bachelor Party

Eight events, eight competitors, adjustable multipliers, and a live leaderboard.

## Stack

- **Next.js** (App Router, TypeScript)
- **Tailwind CSS v4**
- **shadcn/ui** primitives (`src/components/ui`), themed via CSS variables in `src/app/globals.css` — a single fixed N64-style dark identity, not a switchable theme (there used to be a groom-facing theme picker; removed in favor of one deliberate look everywhere)
- **lucide-react** for icons
- **zustand** for lightweight client state (multiplier sliders, live standings)

## Getting started

```bash
pnpm install
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Adding more shadcn components

```bash
npx shadcn@latest add <component-name>
```

This reads `components.json` and drops new primitives into `src/components/ui`.

## Editing the look

Every color, radius, and the bevel effect is a CSS custom property in the
`:root` block of `src/app/globals.css` — change a value there and it updates
everywhere (there's no theme picker or per-theme JSON to keep in sync). Leave
the `@theme inline { ... }` block below it alone — it just maps those
variables to Tailwind utility classes.

## Working together

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the branch workflow.

## Product decisions

`CLAUDE.md` and `docs/PRODUCT_SPEC.md` capture every scoring, multiplier,
and betting decision made for this app — read `docs/PRODUCT_SPEC.md` before
touching any of that logic, whether you're a human or an agent. It's the
source of truth, not the code.
