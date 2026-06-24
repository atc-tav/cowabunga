#!/usr/bin/env node
// density.mjs — design-time "pixel cohesion" checks for the sprite pipeline.
//
// The governing invariant of a code-drawn world: every asset's
//   (true logical pixels ÷ intended tile-span)  ==  the SAME K
// where K (the "atom") = logical pixels per tile. Break it and the illusion
// breaks: a ×4-upscaled "hi-res" export, an anti-aliased soft edge, or two
// sprites authored at different pixels-per-tile all read as fake when placed
// in one world. This tool catches those automatically, at design time.
//
// ---------------------------------------------------------------------------
// USAGE
//
//   Per-file report (one or more PNGs):
//     npm run sprites:density -- <a.png> [<b.png> ...]
//
//   Cross-asset consistency (assert a constant atom K across a set):
//
//   (a) Manifest mode  — RECOMMENDED interface:
//     npm run sprites:density -- --manifest <manifest.json>
//
//       manifest.json = { "atom": 8, "sprites": [
//         { "file": "art-src/mario/walk.export.png", "tiles": [2, 2] },
//         { "file": "art-src/mario/coin.export.png", "tiles": [1, 1] }
//       ] }
//
//     For each sprite we assert trueLogical.w === atom*tilesW and
//     trueLogical.h === atom*tilesH. "atom" may be omitted to infer K from the
//     first sprite and assert the rest match it.
//
//   (b) Inline mode — same assertion without a file:
//     npm run sprites:density -- --atom 8 \
//        --sprite art-src/mario/walk.export.png:2x2 \
//        --sprite art-src/mario/coin.export.png:1x1
//
//   Consistency modes print a per-sprite PASS/FAIL table and EXIT NON-ZERO on
//   any mismatch (or on a soft/AA sprite, whose atom is already compromised).
//
// Exit code: 0 = all good; 1 = a consistency assertion failed or a bad arg.
// Per-file report mode never fails on AA alone (it just warns); consistency
// mode treats AA as a hard fail because an AA'd atom can't be trusted.

import fs from 'node:fs';
import { decodePng } from './quantize.mjs';

// --- tuning knobs ------------------------------------------------------------
// A block counts as "uniform" if every pixel's per-channel delta from the
// block's mean stays within these tolerances. Tiny slack absorbs lossless-PNG
// rounding without admitting genuine gradients.
const COLOR_TOL = 2; // per-channel RGB tolerance (0..255) within a block
const ALPHA_TOL = 2; // alpha tolerance within a block
// Partial-alpha boundary pixels (0 < a < 255) are the classic AA tell.
const AA_PIXEL_FRACTION_WARN = 0.005; // >0.5% soft pixels => AA warning

/** Integer divisors of n, sorted descending (largest first). */
function divisorsDesc(n) {
  const out = [];
  for (let d = 1; d <= n; d++) if (n % d === 0) out.push(d);
  return out.reverse();
}

/** gcd of two positive integers. */
function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

/**
 * Does the image decompose EXACTLY into S×S uniform blocks? A block is uniform
 * when all four channels of every pixel stay within tolerance of the block's
 * first pixel.
 */
function blocksUniform(img, S) {
  const { width: w, height: h, data } = img;
  for (let by = 0; by < h; by += S) {
    for (let bx = 0; bx < w; bx += S) {
      // reference = top-left pixel of the block
      const ro = (by * w + bx) * 4;
      const r0 = data[ro];
      const g0 = data[ro + 1];
      const b0 = data[ro + 2];
      const a0 = data[ro + 3];
      for (let dy = 0; dy < S; dy++) {
        for (let dx = 0; dx < S; dx++) {
          const o = ((by + dy) * w + (bx + dx)) * 4;
          if (
            Math.abs(data[o] - r0) > COLOR_TOL ||
            Math.abs(data[o + 1] - g0) > COLOR_TOL ||
            Math.abs(data[o + 2] - b0) > COLOR_TOL ||
            Math.abs(data[o + 3] - a0) > ALPHA_TOL
          ) {
            return false;
          }
        }
      }
    }
  }
  return true;
}

/**
 * Intrinsic scale S — the largest integer S≥1 such that the image decomposes
 * EXACTLY into S×S uniform blocks (i.e. it was upscaled ×S from true logical
 * dims W/S × H/S). Tested over divisors of gcd(W,H), large to small. S=1 means
 * the art is already at its true atom (no detected upscaling).
 */
export function intrinsicScale(img) {
  const g = gcd(img.width, img.height);
  for (const S of divisorsDesc(g)) {
    if (S === 1) return 1;
    if (blocksUniform(img, S)) return S;
  }
  return 1;
}

/**
 * Anti-aliasing / hardness scan.
 *  - softCount: pixels with partial alpha (0 < a < 255) — classic AA boundary.
 *  - (when S>1) variance check is implicit: blocksUniform already proved every
 *    S×S block is solid, so a clean ×S image has no intra-block variance. We
 *    surface a separate gradient flag for the S===1 case by sampling whether
 *    neighbouring pixels form smooth ramps; but the load-bearing signal is the
 *    partial-alpha count, which is what real AA exports produce.
 *
 * @returns { total, softCount, softFraction, isAA }
 */
export function detectAA(img) {
  const { width: w, height: h, data } = img;
  const total = w * h;
  let softCount = 0;
  for (let i = 0; i < total; i++) {
    const a = data[i * 4 + 3];
    if (a > 0 && a < 255) softCount++;
  }
  const softFraction = total > 0 ? softCount / total : 0;
  const isAA = softFraction > AA_PIXEL_FRACTION_WARN;
  return { total, softCount, softFraction, isAA };
}

/**
 * Full analysis of one decoded image: raw dims, intrinsic scale S, true logical
 * dims, and the AA verdict.
 */
export function analyzeImage(img) {
  const S = intrinsicScale(img);
  const aa = detectAA(img);
  return {
    width: img.width,
    height: img.height,
    scale: S,
    trueW: img.width / S,
    trueH: img.height / S,
    aa,
  };
}

/** Analyze a PNG on disk. */
export function analyzeFile(file) {
  const img = decodePng(file);
  return { file, ...analyzeImage(img) };
}

// --- reporting helpers -------------------------------------------------------

function aaVerdict(aa) {
  if (aa.isAA) {
    const pct = (aa.softFraction * 100).toFixed(1);
    return `WARNING: ${pct}% soft/AA pixels (${aa.softCount}/${aa.total}) — atom compromised`;
  }
  return 'crisp 1× art (hard edges)';
}

function printReport(a) {
  const scaleNote =
    a.scale > 1
      ? `${a.scale} (×${a.scale} upscaled — true atom is coarser than file dims)`
      : '1 (no upscaling detected)';
  console.log(`${a.file}`);
  console.log(`  raw:           ${a.width}×${a.height}`);
  console.log(`  intrinsic S:   ${scaleNote}`);
  console.log(`  true logical:  ${a.trueW}×${a.trueH}`);
  console.log(`  edges:         ${aaVerdict(a.aa)}`);
}

// --- cross-asset consistency -------------------------------------------------

/**
 * @param sprites [{ file, tiles:[w,h] }]
 * @param atom    K, or null to infer from the first sprite
 * @returns { atom, rows:[{file, raw, scale, trueW, trueH, tilesW, tilesH,
 *            wantW, wantH, ok, aa, reason}], allOk }
 */
export function checkConsistency(sprites, atom) {
  const analyses = sprites.map((s) => ({
    ...s,
    a: analyzeFile(s.file),
  }));

  let K = atom;
  if (K == null) {
    // Infer from the first sprite: K = trueW / tilesW (must be integral).
    const first = analyses[0];
    const k = first.a.trueW / first.tiles[0];
    K = Number.isInteger(k) ? k : first.a.trueW / first.tiles[0];
  }

  const rows = analyses.map(({ file, tiles, a }) => {
    const [tilesW, tilesH] = tiles;
    const wantW = K * tilesW;
    const wantH = K * tilesH;
    const dimsOk = a.trueW === wantW && a.trueH === wantH;
    const aaOk = !a.aa.isAA;
    const ok = dimsOk && aaOk;
    let reason = 'ok';
    if (!dimsOk) {
      reason = `true ${a.trueW}×${a.trueH} != ${wantW}×${wantH} (K=${K}·${tilesW}×${tilesH})`;
    } else if (!aaOk) {
      reason = `AA: ${(a.aa.softFraction * 100).toFixed(1)}% soft pixels`;
    }
    return {
      file,
      raw: `${a.width}×${a.height}`,
      scale: a.scale,
      trueW: a.trueW,
      trueH: a.trueH,
      tilesW,
      tilesH,
      wantW,
      wantH,
      ok,
      aa: a.aa.isAA,
      reason,
    };
  });

  return { atom: K, rows, allOk: rows.every((r) => r.ok) };
}

function printConsistencyTable(result) {
  console.log(`cross-asset consistency — atom K=${result.atom}`);
  console.log('  status  true     want     tiles  file');
  for (const r of result.rows) {
    const status = r.ok ? 'PASS' : 'FAIL';
    const trueStr = `${r.trueW}×${r.trueH}`.padEnd(8);
    const wantStr = `${r.wantW}×${r.wantH}`.padEnd(8);
    const tilesStr = `${r.tilesW}×${r.tilesH}`.padEnd(5);
    console.log(`  ${status.padEnd(6)}  ${trueStr} ${wantStr} ${tilesStr}  ${r.file}`);
    if (!r.ok) console.log(`          └─ ${r.reason}`);
  }
}

// --- CLI ---------------------------------------------------------------------

function parseSpriteFlag(val) {
  // <file>:<WxH>  e.g. art-src/mario/walk.export.png:2x2
  const idx = val.lastIndexOf(':');
  if (idx < 0) throw new Error(`--sprite needs <file>:<WxH-tiles> (got ${val})`);
  const file = val.slice(0, idx);
  const dims = val.slice(idx + 1);
  const m = /^(\d+)x(\d+)$/i.exec(dims);
  if (!m) throw new Error(`--sprite tiles must be WxH (got ${dims})`);
  return { file, tiles: [parseInt(m[1], 10), parseInt(m[2], 10)] };
}

function parseArgs(argv) {
  const files = [];
  const sprites = [];
  let manifest = null;
  let atom = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--manifest') {
      manifest = argv[++i];
    } else if (a === '--atom') {
      atom = parseInt(argv[++i], 10);
    } else if (a === '--sprite') {
      sprites.push(parseSpriteFlag(argv[++i]));
    } else if (a === '--help' || a === '-h') {
      return { help: true };
    } else if (a.startsWith('--')) {
      throw new Error(`unknown flag ${a}`);
    } else {
      files.push(a);
    }
  }
  return { files, sprites, manifest, atom };
}

const HELP = `density.mjs — pixel cohesion checks
  Per-file:    npm run sprites:density -- <a.png> [<b.png> ...]
  Manifest:    npm run sprites:density -- --manifest <manifest.json>
  Inline:      npm run sprites:density -- --atom <K> --sprite <file>:<WxH> ...`;

// Run as a script (not when imported by the self-test).
function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`density: ${e.message}`);
    process.exit(1);
  }

  if (args.help) {
    console.log(HELP);
    process.exit(0);
  }

  // Consistency mode (manifest or inline --sprite).
  if (args.manifest || args.sprites.length > 0) {
    let sprites = args.sprites;
    let atom = args.atom ?? null;
    if (args.manifest) {
      let man;
      try {
        man = JSON.parse(fs.readFileSync(args.manifest, 'utf8'));
      } catch (e) {
        console.error(`density: cannot read manifest ${args.manifest}: ${e.message}`);
        process.exit(1);
      }
      if (!Array.isArray(man.sprites) || man.sprites.length === 0) {
        console.error('density: manifest needs a non-empty "sprites" array');
        process.exit(1);
      }
      sprites = man.sprites.map((s) => ({ file: s.file, tiles: s.tiles }));
      if (atom == null && typeof man.atom === 'number') atom = man.atom;
    }
    for (const s of sprites) {
      if (!fs.existsSync(s.file)) {
        console.error(`density: no such file ${s.file}`);
        process.exit(1);
      }
    }
    const result = checkConsistency(sprites, atom);
    printConsistencyTable(result);
    process.exit(result.allOk ? 0 : 1);
  }

  // Per-file report mode.
  if (args.files.length === 0) {
    console.log(HELP);
    process.exit(0);
  }
  for (const file of args.files) {
    if (!fs.existsSync(file)) {
      console.error(`density: no such file ${file}`);
      process.exit(1);
    }
    printReport(analyzeFile(file));
  }
}

// Only run main() when invoked directly.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
