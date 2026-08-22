# N64 character asset generation pipeline

Generates the two per-player video clips described in
`docs/VISUAL_SPEC.md` (character generation pipeline section) from a
reference photo, using the Gemini API only:

- **Nano Banana** (`gemini-3.1-flash-image`) for stylized N64 full-body
  images and headshots, and for composing multi-character scene images.
- **Veo 3.1** (`veo-3.1-generate-preview`, image-to-video, 8s clips) for
  every clip — `fullbody`, `victory`, plus the boot clip. (`select` and
  `confirm` clips existed in an earlier version of this pipeline; both were
  cut per explicit product decision — see `docs/VISUAL_SPEC.md` — so this
  script no longer generates them.) The spec's original plan used
  ByteDance's Seedance for the victory clip specifically, since it handles
  multi-character physical interaction (the squash gag); this pipeline
  tries Veo for that too, on the explicit call that a single-provider
  pipeline is worth the risk of a lower-quality victory clip. If it doesn't
  hold up, Seedance is the documented fallback for that one clip type only.

Two kinds of subject (`subjects.ts`):

- **Players** — the competing players in Supabase. Get a full-body image, a
  headshot (uploaded as `photo_url` — see below), and both clips.
- **Guests** — Cassandra (the bride) and Bailey (the dog), full-body-image-
  only, no headshot (`gen:char:headshot` refuses non-player subjects — they
  never appear on the roster strip). Their images are extra reference
  material fed into two places only, per explicit product decision, not a
  technical limitation: the shared boot/start-screen scene (everyone), and
  **Matthew's own** victory composite specifically — he's the groom, it's
  his moment they belong in, not every player's.
  `gen:char:composite -- victory <player>` refuses any player that isn't
  Matthew for exactly this reason; every other player's victory clip is
  solo (`gen:char:clip` without a composite step). Add a third guest the
  same way if wanted later — just append to `SPECIAL_SUBJECTS` in
  `subjects.ts` — but revisit this file's composite gating too if they
  should show up more broadly than Matthew's clip.

**The headshot is now the canonical `photo_url`** — `gen:char:upload-photo`
pushes it live, superseding the original "real uploaded photo, separate
from the character art" design. `PlayerName`, the medal table, event
cards, and the roster strip all read `photo_url` directly, so this is what
shows up everywhere a player's "photo" appears.

## Setup

1. Add `GEMINI_API_KEY=...` to `.env.local` (alongside the existing Supabase
   vars — this script reuses the same file).
2. Drop reference photos anywhere convenient, e.g. a local
   `reference-photos/` folder (gitignored, same as `character-assets/` below
   — neither should be committed).
3. **On a machine behind corporate TLS interception (Zscaler, same root
   cause `docs/HANDOFF.md` already notes for npm/Docker), Node's `fetch`
   will fail with `unable to get local issuer certificate` against both
   Supabase and the Gemini API.** `curl` works fine (it trusts the system
   keychain); Node doesn't unless told to. One-time fix, run from the repo
   root:
   ```bash
   security find-certificate -a -c "Zscaler" -p /Library/Keychains/System.keychain > zscaler-ca.pem
   ```
   Then prefix every `pnpm run gen:char:*` command with
   `NODE_EXTRA_CA_CERTS="$(pwd)/zscaler-ca.pem"` (or `export` it once per
   shell session). `zscaler-ca.pem` is gitignored (`*.pem`) — it's a local
   export of a machine-trusted root cert, not a secret, but it's also not
   portable to a different machine/network, so it doesn't belong in the
   repo. Skip this entirely on a network without TLS interception.

## Background

Every full-body image, headshot, and solo clip renders on a **radial
gradient from the player's own chart color (`src/lib/chartColors.ts`) into
the app's actual `--background` navy** (`background.ts`) — not plain white.
Explicit product decision, after plain white read badly once live (a stray
white halo behind every character render). Guests (no chart color) get a
flat version of the same navy instead of an invented color. Solid white/
black are still used, but only by the opt-in `matte` command's difference-
matting technique (`matte.ts`) — unrelated to what the shipped asset looks
like, see that command's own notes below.

## Workflow

Staged deliberately — the spec calls out that a full-body image needs
sign-off *before* spending Veo calls on clips, and clips are worth a local
look before they go live. **Start with one player to nail the prompt and
style before running the rest of the roster** — every human full-body image
shares one prompt, so one good result de-risks the rest; Bailey's dog
variant is worth its own one-off check since it's a different prompt.

```bash
# see what's live vs. generated-but-unreviewed vs. missing, per subject
pnpm run gen:char:status

# --- step 1: nail the style on one subject first ---
pnpm run gen:char:image -- "Matthew" reference-photos/matthew.jpg
open character-assets/matthew/fullbody.png
# check it's genuinely full body (head to feet, both legs/shoes visible) —
# the single most common failure mode is a shoulders-up crop instead, which
# then makes step 1b's headshot barely different from this image at all.
pnpm run gen:char:headshot -- "Matthew"
open character-assets/matthew/headshot.png
# iterate on the prompts in prompts.ts (fullBodyPrompt/headshotPrompt) and
# re-run until style/likeness/framing are right, *then* move on to the rest
# of the roster.
pnpm run gen:char:upload-photo -- "Matthew"   # see it live as photo_url

# --- step 2: full-body images for everyone, including the two guests ---
# gen:char:image accepts more than one reference photo — pass all of them
# and Nano Banana combines them (likeness from whichever shows the face
# best, outfit/accessory detail from whichever shows that best):
pnpm run gen:char:image -- "Andrew" reference-photos/andrew-1.jpg reference-photos/andrew-2.jpg
pnpm run gen:char:image -- "Cassandra" reference-photos/cassandra.jpg
pnpm run gen:char:image -- "Bailey" reference-photos/bailey.jpg
# ...one per remaining player, + gen:char:headshot + gen:char:upload-photo
# for each player (not the two guests)

# --- step 3: fullbody clip, solo for everyone including Matthew ---
pnpm run gen:char:clip -- "Matthew" fullbody
open character-assets/matthew/fullbody.mp4   # review before uploading

# --- step 4: composite scene for Matthew's victory clip only, so
#     Cassandra + Bailey appear in it — gen:char:composite refuses any
#     other player here, this is Matthew-specific by design ---
pnpm run gen:char:composite -- victory "Matthew"
open character-assets/matthew/victory-scene.png   # review the STILL first —
                                                # cheaper to catch a bad
                                                # composite here than after
                                                # spending a Veo call on it
pnpm run gen:char:clip -- "Matthew" victory        # picks up victory-scene.png
                                                 # automatically if present

# --- step 5: push an approved clip to Supabase Storage + the player row ---
pnpm run gen:char:upload -- "Matthew" fullbody
pnpm run gen:char:upload -- "Matthew" victory
# ...repeat clip/upload for the rest of the roster

# --- step 6: the shared boot/start-screen clip, everyone in one scene ---
pnpm run gen:char:composite -- boot   # every player + Cassandra + Bailey
open character-assets/_boot/scene.png
pnpm run gen:char:boot-clip
open character-assets/_boot/clip.mp4
pnpm run gen:char:boot-upload         # sets app_settings.boot_video_url
```

Re-running `image`, `headshot`, `composite`, or `clip` just overwrites the
local file — nothing is live until `upload`/`upload-photo`/`boot-upload`
runs, so iterate freely. `<player>` matches by name, id, or slug (case-
insensitive); `"Cassandra"`/`"Bailey"` resolve the same way via
`subjects.ts`.

**Generated assets are local-only and gitignored (`character-assets/`) —
they do not survive a worktree being removed.** Copy anything worth
keeping (e.g. to the main checkout, outside any worktree) before a
worktree cleanup, or just re-run the pipeline — every prompt here is
already tuned, so a re-run costs the same as one clean pass, not a redo of
the trial-and-error.

## Known constraints, not yet worked around

- **Veo caps `durationSeconds` at 8** — confirmed fine for this pass (was
  flagged against the spec's 12–15s victory-clip target, explicitly
  accepted as-is rather than chasing a workaround).
- **Aspect ratio defaults to `9:16`** (`generateVideo`'s default in
  `gemini.ts`), a guess based on this being a mobile-first phone game — not
  confirmed against how `CharacterRender` actually frames these clips on
  screen. Override via the `aspectRatio` option in `gemini.ts` if `9:16`
  looks wrong once you see a real clip in the app.
- **Composite scenes are a single Nano Banana call with 2-3 (or 10, for
  boot) reference images at once** — untested at that image count as of
  this pipeline's build; if quality or likeness degrades with more
  references, the fallback is generating in two passes (e.g. player + one
  guest, then adding the second) rather than redesigning the prompt shape.
- **Nano Banana's response shape is defensively parsed, not pinned to one
  schema** (`findImageData` in `gemini.ts`) — Google's docs for this
  specific model were inconsistent between two fetches during this
  pipeline's build (a `steps[]` shape vs. an `output_image` convenience
  field). If image generation ever throws "no recognizable image block,"
  that's the seam to widen, not a sign the whole approach is wrong.
- **`gen:char:matte` assumes its input is already on a plain white
  background** — the default generation background changed to the gradient
  above, so a `fullbody.png`/`headshot.png` on disk is no longer
  automatically usable as this command's white-background input. Regenerate
  with `matteBackgroundDescription("white")` first if you need to matte
  something generated after this change. Opt-in and rarely used (see
  `cmdMatte`'s own doc comment in `cli.ts` for why) — not worth hardening
  further unless it actually gets used.
- **Regeneration is expected, budget time for it** — `docs/VISUAL_SPEC.md`
  explicitly calls out redoing the victory clip "a handful of times per
  player" as normal, and to nail the full-body/headshot style before
  spending any Veo calls — doubly true for Matthew's victory clip, which
  costs an extra Nano Banana composite call before the Veo call.
