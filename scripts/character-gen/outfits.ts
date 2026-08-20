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
  matthew: "a groom's tuxedo",
  andrew: "a headband, an open short-sleeve button shirt, shorts, and two-strap Birkenstock sandals",
  josh: "trail-running gear: a black trucker hat, a white tank top, a black running vest, black shorts, a running watch, and bare feet (no shoes)",
  joe: "a cowboy hat, a toothpick in his mouth, a big belt buckle, jeans, and cowboy boots — a Texas cowboy look",
  isaac: "a full cycling kit and helmet, with cycling shoes and socks, and his flowing hair visibly coming out from underneath the helmet",
  adam: "a business suit, no tie",
  anthony: "ski gear: gray pants, an orange ski jacket, an orange helmet with white goggles worn on it, and ski gloves",
  tyler: "an open long-sleeve flannel shirt over a plain t-shirt, tight jeans, and loose, untied boots",
  cassandra: "a Princess Peach-style wedding dress",
  bailey: "get her proportions right: short legs, a long body, scruffy fur, and a little white mohawk of fur on top of her head",
};
