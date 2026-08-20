# N64 character asset generation pipeline

Generates the four per-player video clips described in
`docs/VISUAL_SPEC.md` (character generation pipeline section) from a
reference photo, using the Gemini API only:

- **Nano Banana** (`gemini-3.1-flash-image`) for stylized N64 portraits and
  for composing multi-character scene images.
- **Veo 3.1** (`veo-3.1-generate-preview`, image-to-video, 8s clips) for
  every clip — `select`, `fullbody`, `confirm`, `victory`, plus the boot
  clip. The spec's original plan used ByteDance's Seedance for the victory
  clip specifically, since it handles multi-character physical interaction
  (the squash gag); this pipeline tries Veo for that too, on the explicit
  call that a single-provider pipeline is worth the risk of a lower-quality
  victory clip. If it doesn't hold up, Seedance is the documented fallback
  for that one clip type only.

Two kinds of subject (`subjects.ts`):

- **Players** — the 8 competing players in Supabase. Get a solo portrait
  plus all four clips.
- **Guests** — Cassandra (the bride) and Bailey (the dog), portrait-only.
  They never get their own clips; their portraits are extra reference
  material fed into three *composite scenes* — the victory clip, the
  confirm clip, and the shared boot/start-screen clip — so they show up
  everywhere a "here's everyone" moment calls for them, without needing a
  Supabase row of their own (they're not competing, so they don't belong in
  `players`). Add a third guest the same way if wanted later — just append
  to `SPECIAL_SUBJECTS` in `subjects.ts`, nothing else needs to change.

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

## Workflow

Staged deliberately — the spec calls out that a portrait needs sign-off
*before* spending Veo calls on clips, and clips are worth a local look
before they go live. **Start with one player to nail the portrait prompt
and style before running the other seven** — every human portrait shares
one prompt, so one good result de-risks the rest; Bailey's dog variant is
worth its own one-off check since it's a different prompt.

```bash
# see what's live vs. generated-but-unreviewed vs. missing, per subject
pnpm run gen:char:status

# --- step 1: nail the style on one subject first ---
pnpm run gen:char:image -- "Matthew" reference-photos/matthew.jpg
open character-assets/matthew/portrait.png
# iterate on the prompt in prompts.ts (portraitPrompt) and re-run until the
# style/likeness is right, *then* move on to the rest of the roster.

# --- step 2: portraits for everyone, including the two guests ---
# gen:char:image accepts more than one reference photo — pass all of them
# and Nano Banana combines them (likeness from whichever shows the face
# best, outfit/accessory detail from whichever shows that best):
pnpm run gen:char:image -- "Andrew" reference-photos/andrew-1.jpg reference-photos/andrew-2.jpg
pnpm run gen:char:image -- "Cassandra" reference-photos/cassandra.jpg
pnpm run gen:char:image -- "Bailey" reference-photos/bailey.jpg
# ...one per remaining player

# --- step 3: solo clips (select/fullbody always solo; confirm/victory can
#     be solo too if you skip step 4) ---
pnpm run gen:char:clip -- "Matthew" select
pnpm run gen:char:clip -- "Matthew" fullbody
open character-assets/matthew/select.mp4   # review each before uploading

# --- step 4: composite scenes for confirm/victory, so Cassandra + Bailey
#     appear in them (skip this per-player if you're fine with solo clips) ---
pnpm run gen:char:composite -- victory "Matthew"
open character-assets/matthew/victory-scene.png   # review the STILL first —
                                                # cheaper to catch a bad
                                                # composite here than after
                                                # spending a Veo call on it
pnpm run gen:char:clip -- "Matthew" victory        # picks up victory-scene.png
                                                 # automatically if present

pnpm run gen:char:composite -- confirm "Matthew"
pnpm run gen:char:clip -- "Matthew" confirm

# --- step 5: push an approved clip to Supabase Storage + the player row ---
pnpm run gen:char:upload -- "Matthew" select
pnpm run gen:char:upload -- "Matthew" victory
# ...repeat clip/upload for confirm, fullbody, and the rest of the roster

# --- step 6: the shared boot/start-screen clip, everyone in one scene ---
pnpm run gen:char:composite -- boot   # all 8 players + Cassandra + Bailey
open character-assets/_boot/scene.png
pnpm run gen:char:boot-clip
open character-assets/_boot/clip.mp4
pnpm run gen:char:boot-upload         # sets app_settings.boot_video_url
```

Re-running `image`, `composite`, or `clip` just overwrites the local file —
nothing is live until `upload`/`boot-upload` runs, so iterate freely.
`<player>` matches by name, id, or slug (case-insensitive); `"Cassandra"`/
`"Bailey"` resolve the same way via `subjects.ts`.

## Known constraints, not yet worked around

- **Veo caps `durationSeconds` at 8** — confirmed fine for this pass (was
  flagged against the spec's 12–15s victory-clip target, explicitly
  accepted as-is rather than chasing a workaround).
- **Aspect ratio defaults to `9:16`** (`generateVideo`'s default in
  `gemini.ts`), a guess based on this being a mobile-first phone game — not
  confirmed against how `CharacterRender`/`CharacterBust` actually frame
  these clips on screen. Override via the `aspectRatio` option in
  `gemini.ts` if `9:16` looks wrong once you see a real clip in the app.
- **No portrait upload step for players, on purpose.** `character_portrait_url`
  was dropped from the schema (0013 migration) as dead — the roster strip
  uses the real `photo_url` directly, and a player's stylized portrait's
  only job here is as Veo's seed image. It stays local in
  `character-assets/`. Cassandra/Bailey's portraits never had a Supabase
  slot to begin with — they're guest-only, portrait stays local always.
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
- **Regeneration is expected, budget time for it** — `docs/VISUAL_SPEC.md`
  explicitly calls out redoing the victory clip "a handful of times per
  player" as normal, and to nail the portrait style before spending any Veo
  calls — doubly true now that confirm/victory each cost an extra Nano
  Banana composite call before the Veo call.
