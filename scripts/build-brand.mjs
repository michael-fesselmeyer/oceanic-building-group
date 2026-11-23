// Builds the brand files from the site's own typefaces and color tokens:
//
//   src/assets/brand/wordmark.svg   header wordmark, drawn in currentColor
//   public/favicon.svg              browser-tab icon
//   public/favicon-32.png           fallback for browsers without SVG icons
//   public/apple-touch-icon.png     180px home-screen icon
//   public/icon-192.png, icon-512.png  web manifest icons
//   public/site.webmanifest         name, icons and brand colors
//   public/og-default.png           1200 x 630 share image
//
// Letters are converted to outlines with fontkit, so the files look the same
// everywhere and need no font at render time. Colors are read from
// src/styles/tokens.css and the tagline from src/lib/site.ts, so changing
// either and running this script keeps every file in step.
//
// Usage: npm run brand
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as fontkit from 'fontkit';
import sharp from 'sharp';
import wawoff2 from 'wawoff2';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = (...parts) => join(root, ...parts);

// ---------------------------------------------------------------- inputs

const tokens = readFileSync(path('src/styles/tokens.css'), 'utf8');
function token(name) {
  const match = tokens.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`));
  if (!match) throw new Error(`Color token --${name} not found in tokens.css`);
  return match[1].toLowerCase();
}

const color = {
  navy: token('color-navy-900'),
  navyDeep: token('color-navy-950'),
  navySoft: token('color-navy-700'),
  ocean: token('color-ocean-600'),
  oceanLight: token('color-ocean-300'),
  white: token('color-white'),
};

const siteSource = readFileSync(path('src/lib/site.ts'), 'utf8');
function fact(name) {
  const match = siteSource.match(new RegExp(`\\b${name}: '([^']+)'`));
  if (!match) throw new Error(`"${name}" not found in src/lib/site.ts`);
  return match[1];
}
const siteName = fact('name');
const tagline = fact('tagline');

// The same font files the site serves. fontkit cannot apply variable-font
// axes to WOFF2 data, so each file is unpacked to TrueType first.
async function loadFont(pkg, file) {
  const woff2 = readFileSync(path('node_modules/@fontsource-variable', pkg, 'files', file));
  return fontkit.create(Buffer.from(await wawoff2.decompress(woff2)));
}
const serif = await loadFont('newsreader', 'newsreader-latin-opsz-normal.woff2');
const sans = await loadFont('hanken-grotesk', 'hanken-grotesk-latin-wght-normal.woff2');

// ---------------------------------------------------------------- outlines

const round = (n) => Number(n.toFixed(2));

/**
 * Sets one line of text as SVG path data. Returns the path (baseline at
 * y = 0, starting at x = 0), its advance width and its cap height.
 */
function setText(font, text, { size, tracking = 0, variation = {} }) {
  const face = Object.keys(variation).length ? font.getVariation(variation) : font;
  const scale = size / face.unitsPerEm;
  const run = face.layout(text);
  let d = '';
  let x = 0;
  run.glyphs.forEach((glyph, i) => {
    const pos = run.positions[i];
    const gx = x + pos.xOffset * scale;
    const gy = -pos.yOffset * scale;
    for (const { command, args } of glyph.path.commands) {
      const pts = [];
      for (let j = 0; j < args.length; j += 2) {
        pts.push(round(gx + args[j] * scale), round(gy - args[j + 1] * scale));
      }
      d += { moveTo: 'M', lineTo: 'L', quadraticCurveTo: 'Q', bezierCurveTo: 'C', closePath: 'Z' }[
        command
      ];
      d += pts.join(' ');
    }
    x += pos.xAdvance * scale;
    if (i < run.glyphs.length - 1) x += tracking * size;
  });
  return { d, width: x, capHeight: face.capHeight * scale };
}

/** Moves every coordinate in absolute path data. */
function shift(d, dx, dy) {
  return d.replace(
    /(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g,
    (_, x, y) => `${round(Number(x) + dx)} ${round(Number(y) + dy)}`,
  );
}

// ---------------------------------------------------------------- wordmark
//
// Derived from the full logo: "OCEANIC" in a high-contrast serif with a tall
// first O and last C, and "BUILDING GROUP" in spaced sans capitals between
// two fine rules. The illustration, the town names and the service line are
// left out; they do not survive at header size.

function buildWordmark() {
  const display = { wght: 560, opsz: 72 };
  const big = 100;
  const small = 82;
  const letterGap = 0.045;

  const o = setText(serif, 'O', { size: big, variation: display });
  const mid = setText(serif, 'CEANI', { size: small, tracking: letterGap, variation: display });
  const c = setText(serif, 'C', { size: big, variation: display });

  // The tall letters sit centered on the short ones, as in the logo.
  const capSmall = mid.capHeight;
  const drop = (o.capHeight - capSmall) / 2;
  const gap = letterGap * small;
  const top = o.capHeight - drop; // distance from small-cap baseline to the top of the O
  let x = 0;
  const parts = [];
  parts.push(shift(o.d, x, top + drop));
  x += o.width + gap;
  parts.push(shift(mid.d, x, top));
  x += mid.width + gap;
  parts.push(shift(c.d, x, top + drop));
  x += c.width;
  const nameWidth = x;
  const nameBottom = top + drop;

  const sub = setText(sans, 'BUILDING GROUP', {
    size: 27,
    tracking: 0.3,
    variation: { wght: 600 },
  });
  const subTop = nameBottom + 22;
  const subBaseline = subTop + sub.capHeight;
  const subX = (nameWidth - sub.width) / 2;
  parts.push(shift(sub.d, subX, subBaseline));

  const rule = 2;
  const ruleY = subTop + sub.capHeight / 2 - rule / 2;
  const ruleGap = 14;
  parts.push(rect(0, ruleY, subX - ruleGap, rule));
  parts.push(
    rect(subX + sub.width + ruleGap, ruleY, nameWidth - (subX + sub.width + ruleGap), rule),
  );

  // Round letters overshoot the cap height and baseline, so the drawing is
  // measured and moved to start at 0, 0.
  const d = parts.join('');
  const box = bounds(d);
  return {
    d: shift(d, -box.minX, -box.minY),
    width: Math.ceil(box.maxX - box.minX),
    height: Math.ceil(box.maxY - box.minY),
  };
}

function rect(x, y, width, height) {
  const [x1, y1, x2, y2] = [x, y, x + width, y + height].map(round);
  return `M${x1} ${y1}L${x2} ${y1}L${x2} ${y2}L${x1} ${y2}Z`;
}

/** Bounding box of absolute path data, counting curve control points. */
function bounds(d) {
  const box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const [, x, y] of d.matchAll(/(-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)) {
    box.minX = Math.min(box.minX, Number(x));
    box.maxX = Math.max(box.maxX, Number(x));
    box.minY = Math.min(box.minY, Number(y));
    box.maxY = Math.max(box.maxY, Number(y));
  }
  return box;
}

const wordmark = buildWordmark();

function wordmarkSvg() {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${wordmark.width} ${wordmark.height}" fill="currentColor">`,
    `<path d="${wordmark.d}"/>`,
    `</svg>`,
    '',
  ].join('\n');
}

// ---------------------------------------------------------------- icon
//
// A serif O, the first letter of the wordmark, over a double wave taken from
// the logo, on navy. `rounded` adds corners for browser tabs; home-screen
// icons are square because the platform rounds them.

function iconSvg({ rounded }) {
  const size = 512;
  const o = setText(serif, 'O', { size: 380, variation: { wght: 620, opsz: 72 } });
  const ox = (size - o.width) / 2;
  const oy = 212 + o.capHeight / 2;
  const radius = rounded ? 96 : 0;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">`,
    `<rect width="${size}" height="${size}" rx="${radius}" fill="${color.navy}"/>`,
    `<path fill="${color.white}" d="${shift(o.d, ox, oy)}"/>`,
    `<path d="M92 430c41-26 82-26 123 0s82 26 123 0 82-26 123 0" fill="none" stroke="${color.oceanLight}" stroke-width="28" stroke-linecap="round"/>`,
    `</svg>`,
    '',
  ].join('\n');
}

// ---------------------------------------------------------------- share image

function shareSvg() {
  const width = 1200;
  const height = 630;
  const markWidth = 720;
  const scale = markWidth / wordmark.width;
  const markHeight = wordmark.height * scale;
  const markX = (width - markWidth) / 2;
  const markY = 196;

  const line = setText(sans, tagline.toUpperCase(), {
    size: 22,
    tracking: 0.24,
    variation: { wght: 500 },
  });
  const lineX = (width - line.width) / 2;
  const lineY = markY + markHeight + 64 + line.capHeight;

  // Two long, shallow waves along the foot of the card, as in the logo.
  const waves = [
    `<path d="M-40 548C220 488 420 520 640 556S1040 590 1240 520V670H-40Z" fill="${color.navySoft}"/>`,
    `<path d="M-40 584C260 540 460 566 700 592S1060 612 1240 566V670H-40Z" fill="${color.ocean}"/>`,
    `<path d="M-40 606C280 576 500 594 740 614S1080 628 1240 600V670H-40Z" fill="${color.navyDeep}"/>`,
  ];

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="${width}" height="${height}" fill="${color.navy}"/>`,
    ...waves,
    `<g transform="translate(${round(markX)} ${round(markY)}) scale(${round(scale * 1000) / 1000})" fill="${color.white}"><path d="${wordmark.d}"/></g>`,
    `<path fill="${color.oceanLight}" d="${shift(line.d, lineX, lineY)}"/>`,
    `</svg>`,
  ].join('\n');
}

// ---------------------------------------------------------------- write

function write(file, contents) {
  mkdirSync(dirname(path(file)), { recursive: true });
  writeFileSync(path(file), contents);
  console.log(`wrote ${file}`);
}

async function png(file, svg, size) {
  const [w, h] = Array.isArray(size) ? size : [size, size];
  const buffer = await sharp(Buffer.from(svg), { density: 300 })
    .resize(w, h)
    .png({ compressionLevel: 9, palette: w <= 192 })
    .toBuffer();
  write(file, buffer);
}

write('src/assets/brand/wordmark.svg', wordmarkSvg());

const tabIcon = iconSvg({ rounded: true });
const homeIcon = iconSvg({ rounded: false });
write('public/favicon.svg', tabIcon);
await png('public/favicon-32.png', tabIcon, 32);
await png('public/apple-touch-icon.png', homeIcon, 180);
await png('public/icon-192.png', homeIcon, 192);
await png('public/icon-512.png', homeIcon, 512);
await png('public/og-default.png', shareSvg(), [1200, 630]);

const manifest = {
  name: siteName,
  short_name: 'Oceanic',
  start_url: '/',
  display: 'browser',
  theme_color: color.navy,
  background_color: color.white,
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
  ],
};
write('public/site.webmanifest', `${JSON.stringify(manifest, null, 2)}\n`);
