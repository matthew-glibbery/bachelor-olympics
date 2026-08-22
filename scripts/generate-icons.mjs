/**
 * Generates the PWA app icons in `public/` from one on-theme SVG.
 *
 * Reproducible on purpose: the icons are a beveled console plate in the
 * exact palette `src/app/globals.css` defines, so re-running this after a
 * palette change regenerates matching icons instead of leaving a stale
 * hand-drawn PNG behind. Run with `pnpm run gen:icons`.
 *
 * The palette lives in CSS as `oklch()`; PNGs need sRGB, so the tokens are
 * converted here (oklab -> linear sRGB -> sRGB) rather than hand-picked
 * hexes being duplicated out of the stylesheet by eye.
 */
import { mkdir, writeFile } from "node:fs/promises";
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

/**
 * The mark: a beveled console plate (light top-left edge, dark
 * bottom-right, exactly like `.bevel-raised`) holding a gold medal disc
 * with a star — the leaderboard/trophy idea the whole app is built around,
 * drawn as pure geometry so it rasterizes identically everywhere with no
 * font dependency.
 *
 * `scale` shrinks the artwork inside the canvas: 1 for a normal icon,
 * ~0.62 for the maskable variant, whose safe area is only the middle 80%
 * of a circle that platforms are free to crop to any shape.
 */
function iconSvg({ size = 512, scale = 1, radius = 0.18 } = {}) {
  const c = COLORS;
  const S = size;
  const inset = (S * (1 - scale)) / 2;
  const plate = S * scale;
  const bevel = Math.max(2, plate * 0.035);
  const r = plate * radius;

  const cx = inset + plate / 2;
  const cy = inset + plate / 2;
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

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <rect width="${S}" height="${S}" fill="${c.background}"/>
  <rect x="${inset}" y="${inset}" width="${plate}" height="${plate}" rx="${r}" fill="${c.card}"/>
  <clipPath id="plate"><rect x="${inset}" y="${inset}" width="${plate}" height="${plate}" rx="${r}"/></clipPath>
  <clipPath id="br"><polygon points="${S},0 ${S},${S} 0,${S}"/></clipPath>
  <g clip-path="url(#plate)">
    <rect x="${inset}" y="${inset}" width="${plate}" height="${plate}" rx="${r}" fill="none" stroke="${c.bevelLight}" stroke-width="${bevel * 2}"/>
    <g clip-path="url(#br)">
      <rect x="${inset}" y="${inset}" width="${plate}" height="${plate}" rx="${r}" fill="none" stroke="${c.bevelDark}" stroke-width="${bevel * 2}"/>
    </g>
  </g>
  <rect x="${cx - discR * 0.62}" y="${cy - discR * 1.5}" width="${discR * 0.42}" height="${discR * 0.85}" rx="${discR * 0.12}" fill="${c.accent}"/>
  <rect x="${cx + discR * 0.2}" y="${cy - discR * 1.5}" width="${discR * 0.42}" height="${discR * 0.85}" rx="${discR * 0.12}" fill="${c.accent}"/>
  <circle cx="${cx}" cy="${cy + discR * 0.18}" r="${discR}" fill="${c.primary}"/>
  <circle cx="${cx}" cy="${cy + discR * 0.18}" r="${discR * 0.84}" fill="${c.bevelDark}" opacity="0.28"/>
  <polygon points="${star}" transform="translate(0 ${(discR * 0.18).toFixed(2)})" fill="${c.primary}"/>
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

await mkdir(OUT_DIR, { recursive: true });
await writeFile(path.join(OUT_DIR, "icon.svg"), iconSvg({ size: 512, scale: 0.88 }));
for (const { file, size, scale, radius } of TARGETS) {
  const svg = iconSvg({ size, scale, radius });
  await sharp(Buffer.from(svg)).png().toFile(path.join(OUT_DIR, file));
  console.log(`wrote public/${file} (${size}x${size})`);
}
console.log("palette:", COLORS);
