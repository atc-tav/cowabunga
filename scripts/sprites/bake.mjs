#!/usr/bin/env node
// bake.mjs — quantize a design-time PNG export to a game's palette and emit a
// pixel-grid (string[] rows + a { char: 0xRRGGBB } legend) for drawPixelArt().
//
// Usage:
//   npm run sprites:bake -- --game <id> --src <file.png> --name <SPRITE> \
//                           [--cell <n>] [--out <file>]
//
//   --game  <id>     game under src/games/<id> (its palette.ts is the target)
//   --src   <png>    the PNG export to bake (e.g. art-src/<game>/<sprite>/export.png)
//   --name  <SPRITE> identifier used in the emitted snippet (e.g. MARIO_WALK_A)
//   --cell  <n>      downsample: average each n×n pixel block to one cell (default 1)
//   --out   <file>   write the snippet here (default: stdout)
//
// The runtime stays code-drawn: this is a DESIGN-TIME tool. Paste its output
// into a game's sprites.ts.

import fs from 'node:fs';
import path from 'node:path';
import {
  decodePng,
  parsePaletteText,
  quantize,
  formatLegend,
} from './quantize.mjs';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (val === undefined || val.startsWith('--')) {
        out[key] = true;
      } else {
        out[key] = val;
        i++;
      }
    }
  }
  return out;
}

function fail(msg) {
  console.error(`bake: ${msg}`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));

if (args.help || args.h) {
  console.log(
    'Usage: npm run sprites:bake -- --game <id> --src <file.png> --name <SPRITE> [--cell <n>] [--out <file>]',
  );
  process.exit(0);
}

const game = args.game;
const src = args.src;
const name = args.name;
const cell = args.cell ? parseInt(args.cell, 10) : 1;
const outFile = typeof args.out === 'string' ? args.out : null;

if (!game) fail('missing --game <id>');
if (!src) fail('missing --src <file.png>');
if (!name) fail('missing --name <SPRITE>');
if (!Number.isInteger(cell) || cell < 1) fail(`--cell must be a positive integer (got ${args.cell})`);

const palettePath = path.join('src', 'games', game, 'palette.ts');
if (!fs.existsSync(palettePath)) fail(`no palette at ${palettePath}`);
if (!fs.existsSync(src)) fail(`no source PNG at ${src}`);

const paletteText = fs.readFileSync(palettePath, 'utf8');
const palette = parsePaletteText(paletteText);
if (palette.length === 0) fail(`no "name: 0xRRGGBB" pairs found in ${palettePath}`);

const img = decodePng(src);
const { rows, legend, usedNames, width, height } = quantize(img, palette, cell);

// ---- emit the snippet -------------------------------------------------------
const iso = new Date().toISOString().slice(0, 10);
const lines = [];
lines.push(`// source: ${src}, baked ${iso}`);
lines.push(`// ${width}x${height} cells${cell > 1 ? ` (downsampled ${cell}x)` : ''}; palette: src/games/${game}/palette.ts`);
lines.push(`// colors used: ${usedNames.join(', ')}`);
lines.push(`const ${name}: string[] = [`);
for (const row of rows) {
  // single-quote, escaping any single quotes (there won't be any in art keys)
  lines.push(`  '${row}',`);
}
lines.push('];');
lines.push('');
lines.push(`// legend — paste alongside (maps each char to its palette color):`);
lines.push(`const ${name}_PALETTE = ${formatLegend(legend)};`);
lines.push('');

const snippet = lines.join('\n');

if (outFile) {
  fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
  fs.writeFileSync(outFile, snippet);
  console.error(`bake: wrote ${rows.length} rows × ${width} cols → ${outFile}`);
} else {
  process.stdout.write(snippet);
}
