/**
 * Gemini's image models have no alpha channel — every render is flat RGB
 * (see scripts/character-gen/README.md). To get a real transparent cutout
 * anyway, this implements difference/triangulation matting (Smith & Blinn
 * 1996): render the exact same character on a solid white background and
 * again on a solid black background, then solve for per-pixel alpha and
 * true (unpremultiplied) color from the two observations.
 *
 * For a pixel with true (premultiplied-by-coverage) foreground color F and
 * alpha a, composited over background B:
 *   observed = a*F + (1-a)*B
 * With B=white(1) and B=black(0) for the same pixel:
 *   white = a*F + (1-a)
 *   black = a*F
 *   =>  white - black = 1 - a   =>   a = 1 - (white - black)
 *   =>  F = black / a  (unpremultiply; a=0 pixels have no defined color,
 *       arbitrarily kept transparent black)
 *
 * Only works because the two renders are pixel-aligned — see cli.ts's
 * `image`/`headshot` commands, which get there by generating the white
 * version first and then editing it (not a fresh generation) to swap only
 * the background to black.
 */
import sharp from "sharp";

export async function differenceMatte(onWhitePng: Buffer, onBlackPng: Buffer): Promise<Buffer> {
  const [white, black] = await Promise.all([
    sharp(onWhitePng).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(onBlackPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);

  if (white.info.width !== black.info.width || white.info.height !== black.info.height) {
    throw new Error(
      `differenceMatte: white/black renders are different sizes (${white.info.width}x${white.info.height} vs ${black.info.width}x${black.info.height}) — Nano Banana didn't return pixel-aligned images, matting can't proceed.`,
    );
  }

  const { width, height, channels } = white.info;
  const out = Buffer.alloc(width * height * 4);

  for (let i = 0; i < width * height; i++) {
    const wi = i * channels;
    const oi = i * 4;
    const wr = white.data[wi]!, wg = white.data[wi + 1]!, wb = white.data[wi + 2]!;
    const br = black.data[wi]!, bg = black.data[wi + 1]!, bb = black.data[wi + 2]!;

    // Alpha from each channel independently, then average — more stable
    // than picking one channel when the character's own color is near
    // white or near black in a given channel.
    const aR = 1 - (wr - br) / 255;
    const aG = 1 - (wg - bg) / 255;
    const aB = 1 - (wb - bb) / 255;
    const alpha = Math.min(1, Math.max(0, (aR + aG + aB) / 3));

    if (alpha < 0.02) {
      out[oi] = 0;
      out[oi + 1] = 0;
      out[oi + 2] = 0;
      out[oi + 3] = 0;
      continue;
    }
    // Unpremultiply using the black-background observation (F = black/alpha).
    out[oi] = Math.round(Math.min(255, br / alpha));
    out[oi + 1] = Math.round(Math.min(255, bg / alpha));
    out[oi + 2] = Math.round(Math.min(255, bb / alpha));
    out[oi + 3] = Math.round(alpha * 255);
  }

  return sharp(out, { raw: { width, height, channels: 4 } }).png().toBuffer();
}
