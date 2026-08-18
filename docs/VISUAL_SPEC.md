# Bachelor Olympics — Visual Spec

Companion to `PRODUCT_SPEC.md`. That file is the scoring/betting rules; this
one is the look, feel, and character pipeline. Read both before building any
UI screen.

**Status: infrastructure built, waiting on real character assets.** The
three visual directions considered were a retro Olympics broadcast look, an
N64 box-art look, and a hybrid of the two ("1998 sports game opening
ceremony"). Landed on N64-style, with real characters generated from photos
of the actual players — details below. If this changes, update this file,
don't let it drift out of sync with what's actually built.

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

Not built yet: any actual character assets (see the generation pipeline
below — that's the next step, and it's a content task, not an engineering
one), and the "character reacts to multiplier sliders" idea from the
Multiplier screen section.

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
- Selecting a player swaps the large character render in the center of the
  screen to their stylized 3D character, plus their name in a name-plate
  below it.
- The centered character should be **subtly animated/idle** even before
  going anywhere else — a breathing loop, a little shift of weight — so the
  screen feels alive rather than static, same as a real game's select
  screen.
- **Confirming plays a distinct clip**: hitting "Let's go" plays
  `character_confirm_video_url` full-bleed once — a different clip from the
  idling fullbody render, a beat of "you're playing as ___" — before routing
  into the app. Skippable (tap or any key), doesn't trap the player.

## Multiplier screen

Same centered character carries over from selection, still idling, while
the player adjusts their per-event multiplier sliders. The character should
visibly react in some small way as the sliders move — exact reaction is
still open (a flex, a nod, a stat-bar-style pulse), but it needs to feel
connected to the sliders, not just decorative.

## Victory videos

When a player wins an event, play a short clip of their character
triumphing over the others, comedic/cartoon tone — a squash-and-stretch
"defeated" gag on the losing characters, not anything that reads as
aggressive or realistic.

**Scope decision: one victory clip per player, generated once before the
weekend, not per-matchup.** Generating a unique clip for every possible
winner/loser combination isn't practical (too many combinations, and
on-demand generation mid-event has real latency and quality-control risk).
Instead, each player gets one clip of their character beating a generic
group of opponents, played back whenever they win any event. Revisit this
only if a cheap, fast, reliable way to generate matchup-specific clips shows
up later — don't build for that case now.

## Character generation pipeline

Two tools, two different jobs — don't conflate them:

1. **Nano Banana (Gemini's image model)** generates the stylized character
   image from a reference photo. It's specifically good at holding a
   character consistent (face, proportions, outfit) across multiple
   generated poses/angles, which matters since each player needs more than
   one reference image.
2. **Seedance (ByteDance's video model)** takes that character image plus a
   prompt and generates the actual victory clip. It handles multi-character
   scenes and physical interaction between subjects, which is the hard part
   of the "squashing" gag.

This replaces an earlier plan that used Ready Player Me (photo → rigged 3D
avatar) + Mixamo (animation) + React Three Fiber (live in-browser
rendering). That route gets you a true, rotatable, interactive 3D model
driven live by app data; the Nano Banana + Seedance route gets you
pre-rendered video with far less engineering, at the cost of interactivity.
Given this is a one-time party app, pre-rendered video is the current plan
— but if the character likeness or animation quality doesn't come together,
the Ready Player Me route is the fallback, not a dead end.

### Prompt templates

**Step 1 — character reference image (Nano Banana):**

```
Create a stylized 3D-rendered character based on the attached reference
photo of [NAME]. Style: chunky, exaggerated proportions in the style of
late-1990s N64-era video game character models (think Ready 2 Rumble
Boxing, Diddy Kong Racing) — thick outlines, low-poly faceted shading,
saturated primary colors, slightly oversized head-to-body ratio. Preserve
recognizable facial features, hairstyle, and skin tone from the reference
photo, but do not aim for photorealism. Full body, neutral standing pose,
plain white background, front 3/4 view. Should look like an official
character-select portrait from a 1998 sports video game box.
```

Then, to get additional consistent angles/poses without the character
drifting, use Nano Banana's editing/consistency mode rather than a fresh
generation:

```
Same character, same face, hair, and proportions as the previous image —
keep all identifying details identical. Now show them in a [victory pose /
neutral idle / side profile].
```

**Step 2 — victory clip (Seedance):**

```
Using the attached character reference image of [NAME]'s stylized 3D
character, generate a 12–15 second video: [NAME]'s character performs a
triumphant, comedic victory move, then playfully stomps/squashes a small
group of generic same-style opposing characters, who comically flatten
like inflatable toys and pop back up dazed. Setting: a colorful, stylized
arena matching a late-1990s video game aesthetic, bright primary-color
lighting, medal/trophy accents in the background. Simple dynamic camera,
one push-in on the winning character. Cartoon physics, upbeat and silly,
not aggressive or realistic — this is a celebratory gag, not a fight.
```

Expect to regenerate the victory clip a handful of times per player to land
on something that doesn't look broken or off-model — budget real time for
this, it's the least predictable step in the pipeline. Nail all 8 character
reference images and get buy-in on the style before spending generations on
video; that's the more expensive step to redo.

## Open decisions

- ~~Final app/game name~~ — decided: **Bachelor Party** (`src/app/layout.tsx`
  metadata, homepage `<h1>`, boot-screen fallback title).
- Exact character reaction to multiplier slider changes.
- Whether the Ready Player Me + Three.js fallback route ever gets used.
