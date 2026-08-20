# N64 character asset generation pipeline

Generates the four per-player video clips described in
`docs/VISUAL_SPEC.md` (character generation pipeline section) from a
reference photo, using the Gemini API only:

- **Nano Banana** (`gemini-3.1-flash-image`) for the stylized N64 portrait.
- **Veo 3.1** (`veo-3.1-generate-preview`, image-to-video) for all four clips
  — `select`, `fullbody`, `confirm`, `victory`. The spec's original plan used
  ByteDance's Seedance for the victory clip specifically, since it handles
  multi-character physical interaction (the squash gag); this pipeline tries
  Veo for that too, on the explicit call that a single-provider pipeline is
  worth the risk of a lower-quality victory clip. If it doesn't hold up,
  Seedance is the documented fallback for that one clip type only — nothing
  else here needs to change.

## Setup

1. Add `GEMINI_API_KEY=...` to `.env.local` (alongside the existing Supabase
   vars — this script reuses the same file).
2. Drop reference photos anywhere convenient, e.g. a local
   `reference-photos/` folder (gitignored, same as `character-assets/` below
   — neither should be committed).

## Workflow

Staged deliberately — the spec calls out that the portrait needs sign-off
*before* spending Veo calls on clips, and clips are worth a local look before
they go live to the actual roster.

```bash
# see what's live vs. generated-but-unreviewed vs. missing, per player
pnpm run gen:char:status

# 1. generate the stylized portrait from a reference photo, review it
pnpm run gen:char:image -- "Josh" reference-photos/josh.jpg
open character-assets/josh/portrait.png

# 2. once the portrait looks right, generate each clip from it (one Veo
#    call each, polls until done — a few minutes per clip)
pnpm run gen:char:clip -- "Josh" select
pnpm run gen:char:clip -- "Josh" fullbody
pnpm run gen:char:clip -- "Josh" confirm
pnpm run gen:char:clip -- "Josh" victory
open character-assets/josh/select.mp4   # etc — review each before uploading

# 3. push an approved clip to Supabase Storage + the player row
pnpm run gen:char:upload -- "Josh" select
```

Re-running `image` or `clip` just overwrites the local file — nothing is
live until `upload` runs, so iterate freely. `<player>` matches by name,
id, or slug (case-insensitive).

## Known constraints, not yet worked around

- **Veo caps `durationSeconds` at 8.** `docs/VISUAL_SPEC.md` asks for a
  12–15s victory clip. This pipeline generates a single 8s clip for now —
  worth revisiting via Veo's video-extension feature (mentioned in Google's
  docs, not yet wired up here) if 8s reads as too rushed for the victory
  beat once you see it.
- **Aspect ratio defaults to `9:16`** (`generateVideo`'s default in
  `gemini.ts`), a guess based on this being a mobile-first phone game — not
  confirmed against how `CharacterRender`/`CharacterBust` actually frame
  these clips on screen. Override via the `aspectRatio` option in
  `gemini.ts` if `9:16` looks wrong once you see a real clip in the app.
- **No portrait upload step, on purpose.** `character_portrait_url` was
  dropped from the schema (0013 migration) as dead — the roster strip uses
  the real `photo_url` directly, and the stylized portrait's only job here
  is as Veo's seed image. It stays local in `character-assets/`.
- **Nano Banana's response shape is defensively parsed, not pinned to one
  schema** (`findImageData` in `gemini.ts`) — Google's docs for this
  specific model were inconsistent between two fetches during this
  pipeline's build (a `steps[]` shape vs. an `output_image` convenience
  field). If image generation ever throws "no recognizable image block,"
  that's the seam to widen, not a sign the whole approach is wrong.
- **Regeneration is expected, budget time for it** — `docs/VISUAL_SPEC.md`
  explicitly calls out redoing the victory clip "a handful of times per
  player" as normal, and to nail all 8 portraits before spending any Veo
  calls.
