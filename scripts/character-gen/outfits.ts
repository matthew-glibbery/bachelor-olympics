/**
 * Per-subject outfit/appearance description, folded into the portrait
 * prompt so every generation (and every regeneration, if the style needs
 * iterating) pins the same wardrobe instead of Nano Banana guessing from
 * the reference photo alone. Keyed by slug (players.ts's `slugify`).
 *
 * Straight from the descriptions given for this pass — if a 9th player or
 * a wardrobe change shows up later, this is the only file that needs it.
 */
export const OUTFITS: Record<string, string> = {
  matthew: "a groom's tuxedo, with a wildflower boutonnière pinned to the lapel matching Cassandra's wildflower bouquet. His hair is brown, not black or dark — keep it a natural mid-brown shade",
  andrew: "a bandana folded up and worn as a headband (not a sweat/exercise headband — a folded bandana), an open short-sleeve button shirt, shorts, and two-strap Birkenstock sandals",
  josh: "trail-running gear: a black trucker hat, a white tank top, a black running vest, black shorts, a running watch, and bare feet (no shoes)",
  joe: "a cowboy hat, a toothpick in his mouth, a big belt buckle, jeans, and cowboy boots — a Texas cowboy look",
  isaac: "a full cycling kit and helmet, with cycling shoes and socks, and his flowing hair visibly coming out from underneath the helmet",
  adam: "a business suit, no tie",
  anthony: "ski gear: gray pants, an orange ski jacket, an orange helmet with white goggles worn on it, and ski gloves",
  tyler: "an open long-sleeve flannel shirt over a plain t-shirt, tight jeans, and loose, untied boots. He should have a warm, friendly smile — happy and approachable, not a smirk, scowl, or stern/serious expression, consistent with how the other characters are smiling",
  cassandra: "a white wedding dress with a big, full, voluminous skirt (a large ballgown-style silhouette), carrying a wildflower bouquet, and a wedding veil worn back over/behind her hair so it does NOT cover her face — her face should be fully visible",
  bailey: "get her proportions right: short legs, a long body, scruffy fur, and a little white mohawk of fur on top of her head",
};

/**
 * Per-player signature move for the `fullbody` clip (VISUAL_SPEC's "a
 * short, silly animation related to the character's outfit" — e.g. Isaac
 * doing a wheelie, Joe twirling like he's about to draw). Keyed by slug,
 * same as OUTFITS. Optional — soloClipPrompt falls back to a generic
 * "trick/flex/signature move" line for anyone not listed here yet.
 *
 * DRAFT — everyone but Matthew below is a first pass, not yet generated or
 * reviewed. Edit freely in place; nothing here goes live until
 * `gen:char:clip -- <player> fullbody` actually runs against it.
 */
export const FULLBODY_ACTIONS: Record<string, string> = {
  matthew:
    "a classy, well-dressed beat: fixes his cufflings, straightens his boutonnière, then gives a warm, confident smile — elegant and composed, not silly or exaggerated",
  andrew:
    "a festival concert beat: a few dance moves, then a laid-back, confident nod toward camera — chill and unbothered",
  josh:
    "a quick trail-runner's beat: a couple of light on-the-spot high-knees or a bouncy jog-in-place, glancing down to check his running watch, then a determined nod",
  joe:
    "a cowboy swagger beat: spins on one boot heel, hooks his thumbs into his big belt buckle, then tips his cowboy hat toward camera with a sly grin, toothpick still in his mouth",
  isaac:
    "a cycling flex beat: hops in place like popping a quick wheelie, hair flowing out from under the helmet, then flexes one arm toward camera",
  adam:
    "a business-suit beat: confidently straightens his jacket lapel and cuffs, then gives a sharp, satisfied nod — like he just closed a deal",
  anthony:
    "a ski-hype beat: a couple of small side to side ski turns in his ski boots, then a quick fist pump and a grin",
  tyler:
    "a warm, easygoing beat: a friendly wave, tucking one hand into his flannel pocket, then an approachable head-tilt and grin",
};
