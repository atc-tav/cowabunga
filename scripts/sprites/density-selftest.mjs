#!/usr/bin/env node
// density-selftest.mjs — proves the three pixel-cohesion checks in density.mjs:
//   (1) intrinsic-scale detection (fake hi-res),
//   (2) anti-aliasing detection (compromised atom),
//   (3) cross-asset K consistency (density mismatch).
//
// We synthesize PNGs in a temp dir with encodePng() so the proof is end-to-end
// (decode-from-disk, exactly like the real tool), assert the analysis, and exit
// non-zero on any miss.
//
//   npm run sprites:density-selftest

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { encodePng, decodePng } from './quantize.mjs';
import {
  analyzeFile,
  intrinsicScale,
  detectAA,
  checkConsistency,
} from './density.mjs';

function die(msg) {
  console.error(`density-selftest FAIL: ${msg}`);
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'density-selftest-'));

// A deterministic small palette for synthetic logical pixels.
const COLORS = [
  [0xff, 0x00, 0x00],
  [0x00, 0xcc, 0x00],
  [0x20, 0x40, 0xff],
  [0xff, 0xee, 0x00],
];

/**
 * Render a logical L×L grid (array of [r,g,b]|null per cell, null=transparent)
 * upscaled ×S into a PNG. Returns the path.
 */
function renderGrid(file, logical, L, S) {
  const W = L * S;
  const H = L * S;
  const rgba = Buffer.alloc(W * H * 4, 0); // transparent
  for (let ly = 0; ly < L; ly++) {
    for (let lx = 0; lx < L; lx++) {
      const c = logical[ly * L + lx];
      if (!c) continue;
      const [r, g, b] = c;
      for (let dy = 0; dy < S; dy++) {
        for (let dx = 0; dx < S; dx++) {
          const px = lx * S + dx;
          const py = ly * S + dy;
          const o = (py * W + px) * 4;
          rgba[o] = r;
          rgba[o + 1] = g;
          rgba[o + 2] = b;
          rgba[o + 3] = 255;
        }
      }
    }
  }
  const p = path.join(tmp, file);
  encodePng(p, W, H, rgba);
  return p;
}

// A 4×4 logical pattern (no transparent cells, so every block is opaque-solid).
function pattern4() {
  const g = [];
  for (let i = 0; i < 16; i++) g.push(COLORS[i % COLORS.length]);
  return g;
}

// ============================================================================
// CHECK 1 — intrinsic scale: a clean ×4-upscaled 4×4 grid (file 16×16) must
// detect S=4, true 4×4, and hard edges (no AA).
// ============================================================================
{
  const p = renderGrid('clean4x.png', pattern4(), 4, 4);
  const a = analyzeFile(p);
  if (a.width !== 16 || a.height !== 16) die(`clean4x raw ${a.width}×${a.height} != 16×16`);
  if (a.scale !== 4) die(`clean4x intrinsic scale ${a.scale} != 4`);
  if (a.trueW !== 4 || a.trueH !== 4) die(`clean4x true ${a.trueW}×${a.trueH} != 4×4`);
  if (a.aa.isAA) die('clean4x falsely flagged as AA (should be hard edges)');
  console.log('  [1] intrinsic-scale: clean ×4 16×16 → S=4, true 4×4, hard edges  OK');
}

// Control: a genuine 1× image (logical == file) must report S=1. Note the
// pattern alternates 4 colors across a 4-wide row, so no S>1 block is uniform.
{
  const p = renderGrid('native1x.png', pattern4(), 4, 1);
  const s = intrinsicScale(decodePng(p));
  if (s !== 1) die(`native1x scale ${s} != 1`);
  console.log('  [1b] control: genuine 1× 4×4 → S=1  OK');
}

// ============================================================================
// CHECK 2 — anti-aliasing: take the same clean grid but soften a boundary with
// partial-alpha pixels. The AA detector must fire.
// ============================================================================
{
  // Build a 16×16 buffer then stamp a column of partial-alpha pixels.
  const W = 16;
  const H = 16;
  const rgba = Buffer.alloc(W * H * 4, 0);
  const grid = pattern4();
  for (let ly = 0; ly < 4; ly++) {
    for (let lx = 0; lx < 4; lx++) {
      const [r, g, b] = grid[ly * 4 + lx];
      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 4; dx++) {
          const o = ((ly * 4 + dy) * W + (lx * 4 + dx)) * 4;
          rgba[o] = r;
          rgba[o + 1] = g;
          rgba[o + 2] = b;
          rgba[o + 3] = 255;
        }
      }
    }
  }
  // Soft AA seam: a whole column at half alpha (16 pixels = 6.25% > 0.5%).
  for (let y = 0; y < H; y++) {
    const o = (y * W + 8) * 4;
    rgba[o + 3] = 128; // partial alpha => AA tell
  }
  const p = path.join(tmp, 'soft.png');
  encodePng(p, W, H, rgba);

  const img = decodePng(p);
  const aa = detectAA(img);
  if (!aa.isAA) die(`soft.png AA not detected (softFraction=${aa.softFraction})`);
  // And the full analysis path must surface it too.
  const a = analyzeFile(p);
  if (!a.aa.isAA) die('soft.png analyzeFile did not flag AA');
  console.log(`  [2] anti-aliasing: partial-alpha seam → AA WARNING fires (${(aa.softFraction * 100).toFixed(1)}% soft)  OK`);
}

// ============================================================================
// CHECK 3 — cross-asset K consistency.
//   matching: two clean ×S sprites whose (trueLogical / tiles) == same K → PASS
//   mismatch: one sprite at the wrong density → FAIL + non-zero exit semantics
// ============================================================================
{
  // K=4 world. Sprite A: 1×1 tile at atom 4 → true 4×4 (render 4×4 ×1).
  // Sprite B: 2×2 tiles at atom 4 → true 8×8 (render 8×8 ×1).
  const a = renderGrid('k4_a.png', pattern4(), 4, 1); // true 4×4
  const grid8 = [];
  for (let i = 0; i < 64; i++) grid8.push(COLORS[i % COLORS.length]);
  // render an 8×8 logical at ×1
  const bPath = path.join(tmp, 'k4_b.png');
  {
    const W = 8;
    const H = 8;
    const rgba = Buffer.alloc(W * H * 4, 0);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const [r, g, bl] = grid8[y * 8 + x];
        const o = (y * W + x) * 4;
        rgba[o] = r;
        rgba[o + 1] = g;
        rgba[o + 2] = bl;
        rgba[o + 3] = 255;
      }
    }
    encodePng(bPath, W, H, rgba);
  }

  const good = checkConsistency(
    [
      { file: a, tiles: [1, 1] },
      { file: bPath, tiles: [2, 2] },
    ],
    4,
  );
  if (!good.allOk) {
    die(`matching-K set should PASS: ${good.rows.map((r) => r.reason).join('; ')}`);
  }
  console.log('  [3a] cross-asset K: matching K=4 (true 4×4@1tile + 8×8@2tiles) → PASS  OK');

  // Mismatch: claim sprite B is 1×1 tile at K=4 → wants true 4×4 but it's 8×8.
  const bad = checkConsistency(
    [
      { file: a, tiles: [1, 1] },
      { file: bPath, tiles: [1, 1] }, // wrong: 8×8 true at 1 tile => K=8, not 4
    ],
    4,
  );
  if (bad.allOk) die('mismatching-K set should FAIL but passed');
  const badRow = bad.rows.find((r) => !r.ok);
  if (!badRow) die('expected a failing row in mismatch set');
  console.log(`  [3b] cross-asset K: mismatch (8×8@1tile vs K=4) → FAIL (${badRow.reason})  OK`);
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log('density-selftest OK — intrinsic-scale, AA, and cross-asset K checks all proven');
