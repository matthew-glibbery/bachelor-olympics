/**
 * Per-player victory clip content — the actual comedic bit, not just a
 * name swapped into a shared template.
 *
 * Explicit product decision (direct ask, not inferred): every player's
 * victory clip names and defeats the real rest of the cast — not the
 * "generic same-style opposing characters" prompts.ts's old soloClipPrompts
 * used — and all seven share the one Lake Tahoe beach
 * (background.ts's VICTORY_BEACH_BACKGROUND), per docs/VISUAL_SPEC.md's own
 * "this all happened at the same party" framing.
 *
 * Tyler is excluded from this file entirely, both as a winner and as
 * someone the others defeat — he isn't attending the actual weekend. This
 * is scoped to victory-clip CONTENT only: his `players` row, betting,
 * scoring, and every other pipeline step (fullbody clip, etc.) are
 * untouched. If that changes, add him back here with his own beat rather
 * than reusing someone else's.
 *
 * Each entry is a function of the OTHER six real players' names (not
 * hardcoded into the prose) so the cast list stays correct if the roster
 * ever changes, while the actual bit — the "how" of the victory — is
 * bespoke, hand-written prose per player, deliberately varied in mechanism
 * (buried in sand, mogul-bounced, lassoed, wind-flattened, blast-waved,
 * rubber-stamped, swooned) rather than one move re-skinned seven times.
 *
 * `pose` seeds the still composite scene (Nano Banana, multi-image input —
 * see cli.ts's cmdComposite); `action` is what Veo animates on top of that
 * still (cmdClip). Keep both in the "celebratory gag, not a fight" register
 * every other clip prompt in this file already commits to — cartoon
 * physics, nobody actually hurt, everyone back up and fine.
 */
import { nameList } from "./format";

export const VICTORY_EXCLUDED = new Set(["tyler"]);

export interface VictoryBeat {
  /** Describes how to arrange the winner + rivals in the STILL scene image. */
  pose: (rivalNames: string[]) => string;
  /** Describes the motion Veo should animate on top of that still. */
  action: (rivalNames: string[]) => string;
}

export const VICTORY_BEATS: Record<string, VictoryBeat> = {
  isaac: {
    pose: (rivals) => `Isaac stands center on his bike, having just skidded a huge rooster-tail of sand,
one arm raised in triumph, hair flying loose from under his helmet. The other
six — ${nameList(rivals)} — are buried in the sand behind him up to their
necks in a ragged row, dazed, sand-covered, comically unable to move.`,
    action: (rivals) => `Isaac pops a wheelie and skids sideways across the sand, kicking up a huge
rooster-tail spray that buries the other six players (${nameList(rivals)}) up
to their necks like sandcastle prisoners. He hops off the bike, flexes one
arm at the camera, and grins.`,
  },

  anthony: {
    pose: (rivals) => `Anthony stands triumphant at the bottom of a sand dune, still in full ski gear
— orange jacket, helmet, goggles pushed up — one ski pole raised. The other
six — ${nameList(rivals)} — lie flattened in a line up the dune behind him,
comically squashed, like they were used as moguls on the way down.`,
    action: (rivals) => `Anthony rides his skis straight down the sand dune, bouncing off the other
six players' (${nameList(rivals)}) backs one after another like moguls — each
one flattens with a comic squash-and-pop as he passes over them — and he
sticks a three-point superhero landing at the bottom, pumping his fist.`,
  },

  joe: {
    pose: (rivals) => `Joe stands center, cowboy hat tipped back, toothpick in his mouth, one hand
on his big belt buckle, having just cinched a lasso tight. The other six —
${nameList(rivals)} — are roped together in one big dazed dogpile at his
feet, tangled up, little cartoon stars circling their heads.`,
    action: (rivals) => `Joe twirls a lasso overhead and drops it over all six of the other players
(${nameList(rivals)}) at once, cinching the rope so they get yanked together
into one big dazed dogpile knot. He struts over, tips his hat to the camera,
and blows across his fingertip like a smoking gun barrel.`,
  },

  josh: {
    pose: (rivals) => `Josh stands center in his trail-running gear, barefoot on the sand, checking
his running watch with a calm, satisfied look. The other six —
${nameList(rivals)} — are sprawled flat in a ring around him, dazed, a last
curl of sand still settling out of the air.`,
    action: (rivals) => `Josh takes off on victory laps around the other six players
(${nameList(rivals)}) so fast a cartoon sand-devil forms behind him, and the
spinning cloud flattens all six of them in a single pass like a mini
tornado. He skids to a stop, checks his running watch, and gives a calm,
determined nod.`,
  },

  andrew: {
    pose: (rivals) => `Andrew stands center mid-breakdance pose — bandana headband, open shirt,
Birkenstocks somehow still on, arms out, totally chill. The other six —
${nameList(rivals)} — are knocked flat in a ring around him, sand still
settling from the shockwave, dazed but smiling.`,
    action: (rivals) => `Andrew drops into an epic breakdance headspin that spins faster and faster
until it flings a ring of sand outward, and the shockwave comically flattens
the other six players (${nameList(rivals)}) where they stand, like a cartoon
blast wave. He pops back up totally unbothered and gives a slow, chill nod
to the camera.`,
  },

  adam: {
    pose: (rivals) => `Adam stands center in his suit, no tie, one hand holding open a briefcase, the
other holding a giant comedic rubber stamp, a satisfied smirk on his face.
The other six — ${nameList(rivals)} — lie flat on the sand behind him in a
row, each stamped with a huge cartoon "REJECTED" mark, dazed and paper-flat.`,
    action: (rivals) => `Adam pulls a giant comedic rubber stamp from his briefcase and, one by one,
stamps each of the other six players (${nameList(rivals)}) flat with a huge
cartoon "REJECTED" mark — each one goes instantly flat and dazed the moment
he stamps them. He snaps the briefcase shut, straightens his jacket, and
gives a sharp, satisfied nod.`,
  },

  // Matthew is the one clip that isn't a solo "beats the cast" moment — per
  // explicit direction, it closes on Cassandra and Bailey jumping into his
  // arms. Kept classy and composed rather than silly (matching his existing
  // FULLBODY_ACTIONS beat in outfits.ts): the other six are dazzled into
  // fainting, not physically knocked down, since a groom clip landing on
  // "beat up my groomsmen" reads wrong even as a cartoon gag.
  matthew: {
    pose: (rivals) => `Matthew stands center in his tuxedo, calm and composed, straightening his
boutonnière with a warm, confident smile. The other six — ${nameList(rivals)}
— are sprawled backward in a dazed, swooning row around him as if overcome
with admiration, comic stars over their heads, no impact of any kind.
Cassandra, in her wedding dress, and Bailey the dog are positioned just
outside the frame's edges on either side of Matthew, mid-run toward him.`,
    action: (rivals) => `Matthew simply straightens his boutonnière and flashes his signature
confident smile — and the other six players (${nameList(rivals)}), dazzled,
comically swoon and topple backward one after another like dominoes, no
impact at all, just overcome with admiration. Then Cassandra runs in from one
side and Bailey bounds in from the other, both leaping into Matthew's arms at
once as he laughs and catches them, spinning slightly with the joy of the
moment.`,
  },
};
