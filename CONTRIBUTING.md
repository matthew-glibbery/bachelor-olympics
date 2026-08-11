# Working together

This is set up for two people pushing to the same GitHub repo without stepping on each other.

## Branching

- `main` is always deployable. Nobody commits to it directly.
- Every change happens on a branch off `main`, named `yourname/short-description`:
  - `matt/multiplier-sliders`
  - `collab/betting-odds-screen`
- Open a pull request into `main` when a branch is ready. Merge with **squash and merge** so `main` stays a clean, readable history.
- Delete the branch after merging (GitHub can do this automatically — enable it in repo Settings → General).

## Avoiding collisions

Because this is a small two-person project, the main risk is both of you editing the same file at once. A few habits prevent most conflicts:

- Claim a feature area before starting (e.g. "I've got the event scoring logic, you take the betting screens") and say so in whatever chat you use to coordinate.
- Keep branches short-lived — open a PR within a day or two rather than letting a branch drift far from `main`.
- Pull `main` and rebase your branch before opening a PR:
  ```bash
  git fetch origin
  git rebase origin/main
  ```
- If you do hit a merge conflict, resolve it locally rather than on GitHub's web editor — you have more context in your own editor.

## Commits

Plain, descriptive commit messages are enough for a project this size — no need for a strict convention. Aim for one logical change per commit so `git log` and `git blame` stay useful.

## Pull requests

- Keep PRs scoped to one feature or fix.
- The PR template will remind you to note what changed and how to test it.
- Either of you can review and merge the other's PR — there's no need to wait on a specific person.

## Environment variables

Copy `.env.example` to `.env.local` and fill in real values. `.env.local` is gitignored, so share actual secrets with each other outside of git (a password manager, Signal, etc.), never in a commit or a PR description.

## Before pushing

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

CI runs these same checks on every PR (see `.github/workflows/ci.yml`), but running them locally first saves a round trip.

## Package manager

This repo uses **pnpm** (not npm) — a Vercel/CI build with npm hit npm's own
["Exit handler never called!"](https://github.com/npm/cli/issues) bug
reliably, triggered by the large number of optional platform-specific
binaries in this dependency tree (`@next/swc-*`, `@tailwindcss/oxide-*`,
`lightningcss-*`). If you don't have pnpm, enable it via Corepack (bundled
with Node 22+):

```bash
corepack enable
corepack prepare pnpm@11.21.0 --activate
```
