/**
 * Generates the PWA app icons in `public/` from one on-theme SVG.
 *
 * Reproducible on purpose: the icons are drawn from the exact palette
 * `src/app/globals.css` defines, so re-running this after a palette change
 * regenerates matching icons instead of leaving a stale hand-drawn PNG
 * behind. Run with `pnpm run gen:icons`.
 *
 * The palette lives in CSS as `oklch()`; PNGs need sRGB, so the tokens are
 * converted here (oklab -> linear sRGB -> sRGB) rather than hand-picked
 * hexes being duplicated out of the stylesheet by eye.
 *
 * Two icon subjects, two different treatments:
 *   pnpm run gen:icons                          -- the medal mark (default)
 *   pnpm run gen:icons -- --photo <path.jpg>     -- a player's headshot
 * The medal keeps its own beveled console-plate frame (`iconSvg` below) —
 * that's decorative chrome drawn ON TOP of an abstract mark, and it's the
 * app's own bevel language. A photo doesn't want that: iOS/Android already
 * apply their own shape mask (squircle, adaptive icon, circle) to whatever
 * this script outputs, so a *second* rounded-rect-plus-border drawn here
 * became a visible double frame that didn't line up with the OS's own
 * shape. `--photo` mode (`photoIconSvg`) is full-bleed instead — no plate,
 * no border, no bevel — so the photo IS the icon and the OS owns the only
 * shape being applied. See the bottom of this file for which player's
 * headshot is actually live right now.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const OUT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public");

/** oklch(L C H) -> #rrggbb, the same conversion browsers do for our tokens. */
function oklch(L, C, H) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;

  const lin = [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  const hex = lin
    .map((v) => {
      const srgb = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(v, 0), 1 / 2.4) - 0.055;
      return Math.round(Math.min(1, Math.max(0, srgb)) * 255)
        .toString(16)
        .padStart(2, "0");
    })
    .join("");
  return `#${hex}`;
}

// Mirrors the tokens in src/app/globals.css. Keep in sync if those change.
const COLORS = {
  background: oklch(0.16, 0.06, 275),
  card: oklch(0.24, 0.07, 272),
  primary: oklch(0.8, 0.17, 82),
  accent: oklch(0.75, 0.16, 220),
  bevelLight: oklch(0.78, 0.09, 268),
  bevelDark: oklch(0.14, 0.05, 274),
};

/** The medal icon's own frame: a beveled console plate (light top-left
 * edge, dark bottom-right, exactly like `.bevel-raised`) on the app's real
 * background color. Returns the opening markup up through the bevel ring —
 * `iconSvg` fills in the medal itself before the closing `</svg>`. Only
 * the medal uses this now — see the file header for why the photo doesn't.
 */
function plateFrame({ size, scale, radius }) {
  const S = size;
  const inset = (S * (1 - scale)) / 2;
  const plate = S * scale;
  const bevel = Math.max(2, plate * 0.035);
  const r = plate * radius;
  const cx = inset + plate / 2;
  const cy = inset + plate / 2;

  const open = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <rect width="${S}" height="${S}" fill="${COLORS.background}"/>
  <rect x="${inset}" y="${inset}" width="${plate}" height="${plate}" rx="${r}" fill="${COLORS.card}"/>
  <clipPath id="plate"><rect x="${inset}" y="${inset}" width="${plate}" height="${plate}" rx="${r}"/></clipPath>
  <clipPath id="br"><polygon points="${S},0 ${S},${S} 0,${S}"/></clipPath>`;

  const bevelRing = `<g clip-path="url(#plate)">
    <rect x="${inset}" y="${inset}" width="${plate}" height="${plate}" rx="${r}" fill="none" stroke="${COLORS.bevelLight}" stroke-width="${bevel * 2}"/>
    <g clip-path="url(#br)">
      <rect x="${inset}" y="${inset}" width="${plate}" height="${plate}" rx="${r}" fill="none" stroke="${COLORS.bevelDark}" stroke-width="${bevel * 2}"/>
    </g>
  </g>`;

  return { open, bevelRing, inset, plate, cx, cy };
}

/**
 * The mark: a gold medal disc with a star inside the plate — the
 * leaderboard/trophy idea the whole app is built around, drawn as pure
 * geometry so it rasterizes identically everywhere with no font dependency.
 *
 * `scale` shrinks the artwork inside the canvas: 1 for a normal icon,
 * ~0.62 for the maskable variant, whose safe area is only the middle 80%
 * of a circle that platforms are free to crop to any shape.
 */
function iconSvg({ size = 512, scale = 1, radius = 0.18 } = {}) {
  const { open, bevelRing, cx, cy, plate } = plateFrame({ size, scale, radius });
  const discR = plate * 0.29;

  const star = (() => {
    const pts = [];
    const outer = discR * 0.62;
    const inner = outer * 0.42;
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? outer : inner;
      const ang = (Math.PI / 5) * i - Math.PI / 2;
      pts.push(`${(cx + rad * Math.cos(ang)).toFixed(2)},${(cy + rad * Math.sin(ang)).toFixed(2)}`);
    }
    return pts.join(" ");
  })();

  return `${open}
  ${bevelRing}
  <rect x="${cx - discR * 0.62}" y="${cy - discR * 1.5}" width="${discR * 0.42}" height="${discR * 0.85}" rx="${discR * 0.12}" fill="${COLORS.accent}"/>
  <rect x="${cx + discR * 0.2}" y="${cy - discR * 1.5}" width="${discR * 0.42}" height="${discR * 0.85}" rx="${discR * 0.12}" fill="${COLORS.accent}"/>
  <circle cx="${cx}" cy="${cy + discR * 0.18}" r="${discR}" fill="${COLORS.primary}"/>
  <circle cx="${cx}" cy="${cy + discR * 0.18}" r="${discR * 0.84}" fill="${COLORS.bevelDark}" opacity="0.28"/>
  <polygon points="${star}" transform="translate(0 ${(discR * 0.18).toFixed(2)})" fill="${COLORS.primary}"/>
</svg>`;
}

/**
 * A player's headshot, full-bleed — no plate, no border, no bevel ring.
 *
 * This used to share the medal's beveled-plate frame, which drew a second
 * rounded-rect-plus-border on top of a photo the OS was *already* going to
 * mask into its own shape (iOS squircle, Android adaptive icon, etc.) —
 * two frames stacked, visibly misaligned since they never agreed on the
 * exact corner radius. A photo doesn't need a drawn frame to read as
 * "this app's icon" the way an abstract medal mark does; it just needs to
 * fill the canvas so the OS's own mask is the only shape applied.
 *
 * `scale` still exists for the maskable variant only, and it's doing a
 * real job there, not a decorative one: Android can crop a maskable icon
 * to any shape using only the middle ~66-80% "safe zone," so the photo has
 * to be inset and centered smaller than the full canvas or a circular crop
 * clips his forehead/shoulders. That margin is just plain background color
 * showing through — never a border or bevel drawn around the inset photo.
 */
function photoIconSvg({ size = 512, scale = 1, photoBase64, photoMime }) {
  const S = size;
  const inset = (S * (1 - scale)) / 2;
  const plate = S * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <rect width="${S}" height="${S}" fill="${COLORS.background}"/>
  <image href="data:${photoMime};base64,${photoBase64}" x="${inset}" y="${inset}" width="${plate}" height="${plate}" preserveAspectRatio="xMidYMid slice"/>
</svg>`;
}

const TARGETS = [
  { file: "icon-192.png", size: 192, scale: 0.88 },
  { file: "icon-512.png", size: 512, scale: 0.88 },
  // Maskable: full-bleed background, artwork inside the 80% safe circle.
  { file: "icon-maskable-512.png", size: 512, scale: 0.62, radius: 0.5 },
  // iOS squircle-masks this itself and never wants transparency.
  { file: "apple-touch-icon.png", size: 180, scale: 0.9 },
  { file: "favicon-32.png", size: 32, scale: 0.94 },
];

// Photo mode's own scales — full-bleed (1) everywhere except maskable,
// which keeps the real safe-zone inset the medal used (0.62). No `radius`:
// there's no plate to round, the OS applies whatever shape it wants to the
// full-bleed square this produces.
const PHOTO_TARGETS = [
  { file: "icon-192.png", size: 192, scale: 1 },
  { file: "icon-512.png", size: 512, scale: 1 },
  { file: "icon-maskable-512.png", size: 512, scale: 0.62 },
  { file: "apple-touch-icon.png", size: 180, scale: 1 },
  { file: "favicon-32.png", size: 32, scale: 1 },
];

const photoFlagIndex = process.argv.indexOf("--photo");
const photoPath = photoFlagIndex !== -1 ? process.argv[photoFlagIndex + 1] : undefined;

await mkdir(OUT_DIR, { recursive: true });

if (photoPath) {
  const buf = await readFile(photoPath);
  const photoBase64 = buf.toString("base64");
  const photoMime = photoPath.endsWith(".png") ? "image/png" : "image/jpeg";
  // icon.svg is left as the medal mark deliberately — it's the one format
  // any browser can rescale losslessly for a favicon, and a face is
  // photographic content, not vector content; embedding it here would just
  // be a bigger version of the same PNG with none of the benefit.
  for (const { file, size, scale } of PHOTO_TARGETS) {
    const svg = photoIconSvg({ size, scale, photoBase64, photoMime });
    await sharp(Buffer.from(svg)).png().toFile(path.join(OUT_DIR, file));
    console.log(`wrote public/${file} (${size}x${size}) from ${photoPath}`);
  }
} else {
  await writeFile(path.join(OUT_DIR, "icon.svg"), iconSvg({ size: 512, scale: 0.88 }));
  for (const { file, size, scale, radius } of TARGETS) {
    const svg = iconSvg({ size, scale, radius });
    await sharp(Buffer.from(svg)).png().toFile(path.join(OUT_DIR, file));
    console.log(`wrote public/${file} (${size}x${size})`);
  }
}
console.log("palette:", COLORS);
