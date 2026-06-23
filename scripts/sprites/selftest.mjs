#!/usr/bin/env node
// selftest.mjs — proves the quantizer is correct via an EXACT round-trip.
//
//   grid + palette  --render-->  PNG  --bake-->  grid + legend
//
// We start from a known in-repo-style grid and an inline palette, render it to
// a real PNG (pngjs) using that palette, then bake the PNG back with the SAME
// palette and assert the resulting rows + legend reproduce the original grid
// EXACTLY. Any mismatch exits non-zero. This is the load-bearing proof that the
// nearest-color quantize + stable key assignment is faithful.
//
//   npm run sprites:selftest

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { decodePng, encodePng, parsePaletteText, quantize, toRgb } from './quantize.mjs';

// --- fixture: a small grid + palette (drawPixelArt conventions) --------------
// Keys here are arbitrary; what must round-trip is the SHAPE (which cells share
// a color, and which are transparent), not the literal characters — bake
// re-derives keys from palette-name initials.
const FIXTURE_GRID = [
  ' RRRR ',
  'RRGGRR',
  'RGBBGR',
  'RGBBGR',
  'RRGGRR',
  ' RRRR ',
];

// Palette written the way a game's palette.ts looks (name: 0xRRGGBB). Initials
// R/G/B are distinct so bake will pick exactly those keys back.
const FIXTURE_PALETTE_TS = `
export const COLORS = {
  red: 0xff0000,
  green: 0x00cc00,
  blue: 0x2040ff,
} as const;
`;

// The character->paletteName mapping for rendering the fixture to pixels.
const CHAR_TO_NAME = { R: 'red', G: 'green', B: 'blue' };

function die(msg) {
  console.error(`selftest FAIL: ${msg}`);
  process.exit(1);
}

const palette = parsePaletteText(FIXTURE_PALETTE_TS);
const byName = new Map(palette.map((p) => [p.name, p.rgb]));

// 1) Render the fixture grid to an RGBA buffer using the palette.
const h = FIXTURE_GRID.length;
const w = FIXTURE_GRID[0].length;
for (const row of FIXTURE_GRID) {
  if (row.length !== w) die('fixture rows are not equal length');
}
const rgba = Buffer.alloc(w * h * 4, 0); // default fully transparent
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const ch = FIXTURE_GRID[y][x];
    if (ch === ' ') continue; // leave transparent
    const name = CHAR_TO_NAME[ch];
    if (!name) die(`fixture char '${ch}' has no palette mapping`);
    const [r, g, b] = toRgb(byName.get(name));
    const o = (y * w + x) * 4;
    rgba[o] = r;
    rgba[o + 1] = g;
    rgba[o + 2] = b;
    rgba[o + 3] = 255;
  }
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sprite-selftest-'));
const pngPath = path.join(tmp, 'fixture.png');
encodePng(pngPath, w, h, rgba);

// 2) Bake the PNG back with the same palette (re-decode from disk for realism).
const img = decodePng(pngPath);
const { rows, legend } = quantize(img, palette, 1);

// 3a) Assert geometry.
if (rows.length !== h) die(`row count ${rows.length} != ${h}`);
for (let y = 0; y < h; y++) {
  if (rows[y].length !== w) die(`row ${y} width ${rows[y].length} != ${w}`);
}

// 3b) Assert EXACT grid round-trip. The fixture uses R/G/B initials and the
// palette names are red/green/blue, so the baked keys must equal the originals.
for (let y = 0; y < h; y++) {
  if (rows[y] !== FIXTURE_GRID[y]) {
    die(`row ${y} mismatch:\n  expected '${FIXTURE_GRID[y]}'\n  got      '${rows[y]}'`);
  }
}

// 3c) Assert the legend maps each used key to the correct palette color.
const expectedLegend = { R: 0xff0000, G: 0x00cc00, B: 0x2040ff };
for (const k of Object.keys(expectedLegend)) {
  if (legend[k] !== expectedLegend[k]) {
    die(
      `legend['${k}'] = 0x${(legend[k] ?? 0).toString(16)} expected 0x${expectedLegend[k].toString(16)}`,
    );
  }
}
if (Object.keys(legend).length !== Object.keys(expectedLegend).length) {
  die(`legend has ${Object.keys(legend).length} keys, expected ${Object.keys(expectedLegend).length}`);
}

// 3d) Transparent cells must round-trip to spaces (covered by 3b corners, but
// assert explicitly for clarity).
if (rows[0][0] !== ' ' || rows[0][w - 1] !== ' ') {
  die('expected transparent corners to bake to space');
}

fs.rmSync(tmp, { recursive: true, force: true });

console.log('selftest OK — grid + legend round-trip EXACTLY');
console.log(`  ${w}x${h} grid, ${Object.keys(legend).length} colors, palette nearest-match + stable keys verified`);
