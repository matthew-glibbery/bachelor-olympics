# Bachelor Olympics — Visual Spec

Companion to `PRODUCT_SPEC.md`. That file is the scoring/betting rules; this
one is the look, feel, and character pipeline. Read both before building any
UI screen.

**Status: generation pipeline built and proven on Matthew; the other 9
subjects' full-body images/headshots need regenerating** (an earlier session's
locally-generated images were lost to a worktree cleanup before upload —
not a data-loss risk going forward, since nothing is "real" until it's
uploaded to Supabase, but worth knowing the other 9 need a re-run of
`scripts/character-gen` before they show up anywhere). The three visual
directions considered were a retro Olympics broadcast look, an N64 box-art
look, and a hybrid of the two ("1998 sports game opening ceremony"). Landed
on N64-style, with real characters generated from photos of the actual
players — details below. If this changes, update this file, don't let it
drift out of sync with what's actually built.

**The stylized headshot is now the canonical "photo" everywhere** —
`photo_url` (`ManagePlayerRow`'s "Upload photo" field), read by
`PlayerName`, the medal table, event cards, and the `/select` roster strip.
This supersedes the original "real photo, separate from the character art"
split `0011_character_media.sql`'s comment describes — explicit product
decision, uploaded via `pnpm run gen:char:upload-photo`.

The plumbing is in place and works today with zero uploaded assets (every
screen degrades gracefully to a plain fallback until real clips exist):

- `supabase/migrations/0011_character_media.sql` (`character_portrait_url`
  dropped again in `0013_drop_character_portrait.sql` — unused, nothing ever
  read it, the roster strip uses `photo_url` directly) +
  `0012_character_confirm_video.sql` — `character_select_video_url` /
  `character_fullbody_video_url` / `character_confirm_video_url` /
  `character_victory_video_url` on `players`, `boot_video_url` on
  `app_settings`, and a `videos` Storage bucket (same trusted-friends RLS
  model as `photos`). `character_confirm_video_url` plays once on `/select`
  right after hitting "Let's go," before routing into the app — distinct
  from the fullbody clip, which idles while still choosing.
- `src/components/identity-gate.tsx` — wraps the whole app (`layout.tsx`).
  Until this device has picked a player, redirects to `/start` (which leads
  into `/select`) instead of rendering the requested page. Bypasses itself
  automatically when there are zero players yet (first-run bootstrap) or on
  a connection error, so it can never lock anyone out.
- `src/app/start/page.tsx`, `src/app/select/page.tsx`,
  `src/components/character-bust.tsx` — the boot/select screens themselves.
  `CharacterBust` is the shared "big render" piece: plays `videoUrl`
  (character clip) if set, else falls back to `photoUrl`, else a
  silhouette — the real swap seam once assets exist.
- `/start`'s background is layered, most to least specific: a real
  groom-uploaded `app_settings.boot_video_url`, then a static design asset at
  `public/start-background.jpg` (the swap seam for a one-off title-card image
  — drop the file at that exact path and it appears with no code change),
  then a plain gradient fallback. The controller/input hint text ("tap
  anywhere, or press any key") was removed from this screen per explicit
  direction — keep it to just the logo and the press-start prompt.
- `src/components/victory-replay-button.tsx` — "Replay" button on a
  resolved `EventCard`, wired via `src/lib/scoring/eventWinner.ts` (pure
  winner-id lookup, handles placement + absolute + ties). Renders nothing if
  the winner has no victory clip uploaded yet.
- Upload UI: `ManagePlayerRow` (groom tools → Manage players, always visible
  on each player's row, not hidden behind edit mode) gets five upload fields
  per player; `BootVideoUploader` (groom tools → Boot video) sets the one
  shared boot clip.

Not built yet: character assets for anyone but Matthew (see the Status note
above), any of the four per-player clips or the boot clip for anyone
(full-body images/headshots only so far), and the "character reacts to multiplier
sliders" idea from the Multiplier screen section.

## Reference points

- **Character style**: Ready 2 Rumble Boxing and Diddy Kong Racing —
  exaggerated proportions, low-poly faceted shading, thick outlines, clearly
  a caricature but a recognizable one, not photorealistic.
- **Screen structure**: Mario Kart 64's character-select grid (portrait busts
  along the top, one big character render front-and-center below, name in a
  chunky plate) and Super Mario 64's spinning-logo boot sequence for the
  start screen.

## Start screen

An N64 cartridge boot / title screen, not a generic web landing page.
Think: game logo (needs a real name — "Bachelor Olympics" doesn't fit this
direction; brainstorm something in the register of a real N64 title, e.g.
`STAG64`), rendered in the chunky beveled 3D lettering style of a mid-90s
game logo, with a "press start" style entry point rather than a
conventional button.

## Player selection screen

- Row of small portrait busts along the top — one per player, all 8 (or
  however many) visible at once, mirroring Mario Kart 64's roster strip.
  These use `photo_url` (the headshot) directly, not a video.
- Selecting a player swaps the large character render in the center of the
  screen to their **fullbody clip**, looping continuously, plus their name
  in a name-plate below it.
- **Confirming plays a distinct clip**: hitting "Let's go" plays
  `character_confirm_video_url` full-bleed once — the character celebrating
  being picked, a different clip from the idling fullbody render. The
  screen must not advance to the next screen until that clip finishes
  playing (an explicit tap/key skip is fine and doesn't count as "not
  finished" — the point is no *premature auto-advance*, not that skipping
  is disallowed).

## Multiplier screen

Same **fullbody clip** from selection carries over, still looping
continuously, while the player adjusts their per-event multiplier sliders.
Exact reaction to slider changes (a flex, a nod, a stat-bar-style pulse) is
still open — see Open decisions.

## Victory videos

When a player wins an event, play a short clip of their character
triumphing over **the whole rest of the cast**, comedic/cartoon tone — think
the animation that plays in a bowling alley after a strike, applied to
knocking out every other character (not just a couple of generic rivals).
Go silly with *how* the others are eliminated; the constraint is tone, not
mechanism — squash-and-stretch, comically flattened and popping back up
dazed, nothing that reads as aggressive or realistic.

**Scope decision: one victory clip per player, generated once before the
weekend, not per-matchup.** Generating a unique clip for every possible
winner/loser combination isn't practical (too many combinations, and
on-demand generation mid-event has real latency and quality-control risk).
Instead, each player gets one clip of their character beating the whole
rest of the cast, played back whenever they win any event. Revisit this
only if a cheap, fast, reliable way to generate matchup-specific clips shows
up later — don't build for that case now.

## The four per-player clips + shared boot clip

Generation priority, cheapest/most-certain first (see
`scripts/character-gen/README.md` for the actual commands):

1. **Fullbody** (`character_fullbody_video_url`) — a short, silly animation
   related to the character's outfit (e.g. Isaac doing a wheelie, Joe
   twirling like he's about to draw), starting and ending in the same pose
   so it loops seamlessly. Shown looping continuously on `/select` (bottom,
   once a character is picked), on `/multipliers`, and on the leaderboard
   podium (`/`).
2. **Confirm** (`character_confirm_video_url`) — a quick reaction/
   celebration animation, the character celebrating being selected. Plays
   once on "Let's go," blocks advancing until it finishes (see above).
3. **Select** (`character_select_video_url`) — **lowest priority of the
   four**, generate last. A short animation using the *headshot* framing —
   not fullbody — as both its first and last frame (Veo's `lastFrame`, see
   `gemini.ts`), so it loops perfectly. Plays in the small roster-strip box
   when that character is the current selection/hover target.
4. **Victory** (`character_victory_video_url`) — generated **last of all**,
   since it ideally needs every other character's art to exist first (the
   whole cast gets knocked out, see above).
5. **Boot/start-screen clip** (`app_settings.boot_video_url`, one shared
   asset) — the whole cast on an N64-styled Lake Tahoe beach, doing
   individual bits, ending in a group photo with Matthew, Cassandra, and
   Bailey specifically front-and-center. Cassandra and Bailey never appear
   in any other clip except this one and Matthew's own confirm/victory
   (`scripts/character-gen/README.md`'s guest-scoping section) — they're not
   competing players.

## Per-event action images (new, not yet built)

One still image per event (not a clip), same N64-styled Lake Tahoe beach
background reused across all of them for a consistent "this all happened
at the same party" feel. Each image shows a diverse subset of players
actually playing that event prominently (e.g. 2 players at a ping-pong
table for the ping-pong event), with the rest of the cast visible watching
in the background — vary *which* players are featured across the event set
rather than always the same 2-3. No pipeline code for this exists yet;
scope it as its own phase once the per-player clips are done. Where these
images actually get used in the UI (an event card's header? a bonus-events
card background?) is also still open.

## Character generation pipeline

Built and working, entirely on the **Gemini API** — `scripts/character-gen/`
is the actual implementation and the source of truth for prompts; don't
duplicate them here where they can drift out of sync with what's really
running. Short version, full detail in that directory's own README:

1. **Nano Banana** (`gemini-3.1-flash-image`) generates the stylized N64
   full-body image from a reference photo (or several — most players'
   second photo exists specifically to show an outfit/accessory detail),
   then a shoulders-up headshot from that full-body image (edit mode, so it
   stays the same character), then composite scenes (victory/confirm/boot)
   combining multiple existing character images into one. Every image
   renders on a radial gradient from the player's own chart color into the
   app's dark navy (`scripts/character-gen/background.ts`), not plain
   white — a real fix after white read badly once live (a stray halo behind
   every render).
2. **Veo 3.1** (`veo-3.1-generate-preview`, image-to-video, 8s clips)
   animates each of those into the actual clips — including pinning a
   clip's first *and* last frame to the same seed image (`lastFrame`) for
   the `select` clip's exact hover-loop.

This originally considered ByteDance's Seedance for the victory clip
specifically (better documented multi-character physical interaction), and
before that a Ready Player Me (photo → rigged 3D avatar) + Mixamo +
React Three Fiber live-rendering route — both dropped in favor of a single
Gemini-only pipeline, on the explicit call that one provider's simplicity is
worth the risk of a lower-quality victory clip. Revisit Seedance for just
that one clip type if Veo's output doesn't hold up; the React Three Fiber
route is a bigger pivot, not a small swap.

Iteration reality, confirmed over several real rounds: expect 2-3 tries per
image to land good style/framing/expression (no stray outline, no seam
lines between facets, centered and facing camera, right expression) —
budget real time for this. Nail every subject's full-body image and
headshot before spending any Veo calls on clips; that's the expensive step
to redo.

## Open decisions

- ~~Final app/game name~~ — decided: **Bachelor Party** (`src/app/layout.tsx`
  metadata, homepage `<h1>`, boot-screen fallback title).
- Exact character reaction to multiplier slider changes.
- Where per-event action images get used in the UI (see that section above).
