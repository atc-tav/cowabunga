// Core quantizer shared by bake.mjs and selftest.mjs.
//
// The principle: no runtime asset files. A design-time tool (e.g. PixelLab)
// authors a sprite as a PNG; this module QUANTIZES that PNG to a game's palette
// and emits a pixel-grid — the same `string[]` rows + `{ char: 0xRRGGBB }`
// legend that `drawPixelArt()` (src/shared/textures.ts) already consumes. The
// shipped game stays 100% code-drawn and deterministic.

import fs from 'node:fs';
import { PNG } from 'pngjs';

/** Decode a PNG file into { width, height, data } (data = RGBA bytes). */
export function decodePng(path) {
  const buf = fs.readFileSync(path);
  const png = PNG.sync.read(buf);
  return { width: png.width, height: png.height, data: png.data };
}

/** Encode an RGBA byte buffer into a PNG file. */
export function encodePng(path, width, height, rgba) {
  const png = new PNG({ width, height });
  png.data = Buffer.from(rgba);
  fs.writeFileSync(path, PNG.sync.write(png));
}

/**
 * Parse a game's palette.ts AS TEXT (we never import TS). Extracts every
 * `name: 0xRRGGBB` pair and returns [{ name, rgb: 0xRRGGBB }, ...] in source
 * order. Hex is normalized to 6 digits.
 */
export function parsePaletteText(text) {
  const out = [];
  const seen = new Set();
  // name: 0xRRGGBB  (allow 3- or 6-digit; tolerate trailing comment/comma)
  const re = /([A-Za-z_$][\w$]*)\s*:\s*0x([0-9a-fA-F]{3,8})/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1];
    let hex = m[2];
    // Use the low 6 hex digits as RGB (ignore any alpha prefix).
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    if (hex.length > 6) hex = hex.slice(-6);
    if (hex.length < 6) hex = hex.padStart(6, '0');
    const rgb = parseInt(hex, 16);
    if (seen.has(name)) continue;
    seen.add(name);
    out.push({ name, rgb });
  }
  return out;
}

/** Split 0xRRGGBB into [r, g, b]. */
export function toRgb(n) {
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Index of the palette entry nearest to [r,g,b] by squared Euclidean distance. */
export function nearestIndex(r, g, b, paletteRgb) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < paletteRgb.length; i++) {
    const [pr, pg, pb] = paletteRgb[i];
    const dr = r - pr;
    const dg = g - pg;
    const db = b - pb;
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Assign a stable single-char key to each USED palette entry. Preference: the
 * first uppercase letter of the palette name if still free, else the next free
 * char from A–Z then 0–9. Returns Map<paletteIndex, char>.
 */
export function assignKeys(usedIndices, palette) {
  const taken = new Set();
  const keyOf = new Map();
  // First pass: try each name's preferred initial (uppercased).
  for (const idx of usedIndices) {
    const name = palette[idx].name;
    const initial = (name[0] || '').toUpperCase();
    if (/[A-Z0-9]/.test(initial) && !taken.has(initial)) {
      taken.add(initial);
      keyOf.set(idx, initial);
    }
  }
  // Second pass: anything still unkeyed gets the next free alphabet char.
  let cursor = 0;
  for (const idx of usedIndices) {
    if (keyOf.has(idx)) continue;
    while (cursor < ALPHABET.length && taken.has(ALPHABET[cursor])) cursor++;
    if (cursor >= ALPHABET.length) {
      throw new Error('ran out of single-char keys (>36 distinct colors)');
    }
    const ch = ALPHABET[cursor];
    taken.add(ch);
    keyOf.set(idx, ch);
  }
  return keyOf;
}

/**
 * Quantize a decoded image to a palette grid.
 *
 * @param img      { width, height, data } RGBA (from decodePng)
 * @param palette  [{ name, rgb }, ...] (from parsePaletteText)
 * @param cell     downsample factor: average each cell×cell block to one cell
 *                 (default 1 = 1px per cell)
 * @returns { rows: string[], legend: { [char]: rgb }, usedNames: string[] }
 *          rows are equal-length strings; ' ' = transparent.
 */
export function quantize(img, palette, cell = 1) {
  if (palette.length === 0) throw new Error('palette is empty');
  const paletteRgb = palette.map((p) => toRgb(p.rgb));

  const gw = Math.floor(img.width / cell);
  const gh = Math.floor(img.height / cell);

  // First compute, per cell, either null (transparent) or a palette index.
  const cellIdx = new Array(gh);
  const used = new Set();
  for (let cy = 0; cy < gh; cy++) {
    cellIdx[cy] = new Array(gw);
    for (let cx = 0; cx < gw; cx++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let dy = 0; dy < cell; dy++) {
        for (let dx = 0; dx < cell; dx++) {
          const px = cx * cell + dx;
          const py = cy * cell + dy;
          const o = (py * img.width + px) * 4;
          r += img.data[o];
          g += img.data[o + 1];
          b += img.data[o + 2];
          a += img.data[o + 3];
          n++;
        }
      }
      r /= n;
      g /= n;
      b /= n;
      a /= n;
      if (a < 128) {
        cellIdx[cy][cx] = null; // mostly transparent
      } else {
        const idx = nearestIndex(r, g, b, paletteRgb);
        cellIdx[cy][cx] = idx;
        used.add(idx);
      }
    }
  }

  // Stable key assignment over used indices (in palette source order).
  const usedIndices = palette
    .map((_, i) => i)
    .filter((i) => used.has(i));
  const keyOf = assignKeys(usedIndices, palette);

  // Build rows.
  const rows = [];
  for (let cy = 0; cy < gh; cy++) {
    let row = '';
    for (let cx = 0; cx < gw; cx++) {
      const idx = cellIdx[cy][cx];
      row += idx === null ? ' ' : keyOf.get(idx);
    }
    rows.push(row);
  }

  // Legend in key order, keyed by char -> rgb. Also keep name mapping.
  const legend = {};
  const usedNames = [];
  for (const idx of usedIndices) {
    const ch = keyOf.get(idx);
    legend[ch] = palette[idx].rgb;
    usedNames.push(palette[idx].name);
  }

  return { rows, legend, usedNames, width: gw, height: gh };
}

/** Format a legend object as a pasteable `{ K: 0xRRGGBB, ... }` literal. */
export function formatLegend(legend) {
  const entries = Object.keys(legend).map(
    (k) => `${k}: 0x${legend[k].toString(16).padStart(6, '0')}`,
  );
  return `{ ${entries.join(', ')} }`;
}
