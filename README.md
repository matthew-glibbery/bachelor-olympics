# Bachelor Olympics

Eight events, eight competitors, adjustable multipliers, and a live medal table.

## Stack

- **Next.js** (App Router, TypeScript)
- **Tailwind CSS v4**
- **shadcn/ui** primitives (`src/components/ui`), themed via CSS variables in `src/app/globals.css`
- **[tweakcn](https://tweakcn.com)** for visual theme editing — design a theme there and paste the exported `:root` / `.dark` blocks into `globals.css`
- **lucide-react** for icons
- **zustand** for lightweight client state (multiplier sliders, live standings)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Adding more shadcn components

```bash
npx shadcn@latest add <component-name>
```

This reads `components.json` and drops new primitives into `src/components/ui`.

## Updating the theme

1. Go to [tweakcn.com](https://tweakcn.com) and design/tweak a theme.
2. Copy the generated CSS.
3. Paste it over the `:root { ... }` and `.dark { ... }` blocks in `src/app/globals.css`.
4. Leave the `@theme inline { ... }` block below it alone — it maps the variables to Tailwind utilities and doesn't change between themes.

## Working together

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the branch workflow.

## Product decisions

`CLAUDE.md` and `docs/PRODUCT_SPEC.md` capture every scoring, multiplier,
and betting decision made for this app — read `docs/PRODUCT_SPEC.md` before
touching any of that logic, whether you're a human or an agent. It's the
source of truth, not the code.
