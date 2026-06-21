#!/usr/bin/env node
// @ts-check
/**
 * Spec linter for Cowabunga Arcade game design specs.
 *
 * Mechanically enforces the rules in specs/AUTHORING.md §9. It does NOT judge
 * design quality — it catches the structural defects and copy-paste bugs that a
 * human reviewer misses: malformed sprite grids, non-ASCII glyphs in art,
 * cross-game contamination, missing required sections, naming drift, and TX-key
 * mismatches.
 *
 * Usage:
 *   node scripts/lint-specs.mjs                 # lint every specs/*.md
 *   node scripts/lint-specs.mjs specs/x.md ...  # lint specific files
 *   node scripts/lint-specs.mjs --strict        # treat warnings as failures
 *
 * Exit code: 0 if no errors (and no warnings under --strict), 1 otherwise.
 * Findings are ERROR (real defects, fail the build) or WARN (standard not yet
 * met — informational for the pre-existing specs).
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SPECS_DIR = join(ROOT, 'specs');

// Files in specs/ that are not game specs and should be skipped.
const NOT_A_SPEC = new Set(['README.md', 'AUTHORING.md']);

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

// Sections every spec must contain (matched case-insensitively against ## / #
// headings). Missing → ERROR for the load-bearing ones, WARN for newer-standard
// ones that the original specs predate.
const REQUIRED_SECTIONS = [
  { name: 'Game Overview', re: /game overview/i, severity: 'error' },
  { name: 'Core Gameplay Mechanics', re: /gameplay mechanics/i, severity: 'error' },
  { name: 'Scoring', re: /scoring/i, severity: 'error' },
  { name: 'TX (Texture Key) Registry', re: /tx.*registry|texture key/i, severity: 'error' },
  { name: 'Self-Verification Checklist', re: /self-verification|verification checklist/i, severity: 'error' },
  { name: 'Reference Sources', re: /reference sources/i, severity: 'warn' },
  { name: 'Player / Avatar Sprite', re: /player.*sprite|avatar sprite|mario sprite|vaus sprite|fighter sprite/i, severity: 'warn' },
  { name: 'Canonical vs. Tunable (§13)', re: /canonical vs\.?\s*tunable|tunable values/i, severity: 'warn' },
  { name: 'Level / Content Data (§14)', re: /level.*data|content data|layout data/i, severity: 'warn' },
  { name: 'Palette table (token→hex)', re: /palette/i, severity: 'warn' },
];

// Distinctive, game-unique terms. If a term shows up in a spec it does NOT
// "own", that's almost certainly copy-paste contamination. Keep this list to
// terms that are genuinely unique to one game (no shared nouns like "barrel",
// which appears in both Donkey Kong and Mario Bros legitimately).
// Key = lowercased filename substring identifying the owning spec.
const GAME_SIGNATURE_TERMS = {
  'dig-dug': ['pooka', 'fygar', 'rock crush', 'air pump'],
  'galaga': ['zako', 'goei', 'tractor beam', 'boss galaga'],
  'donkey-kong': ['rivet', 'pauline', 'oil drum'],
  'mario-bros': ['shellcreeper', 'sidestepper', 'fighter fly', 'slipice', 'pow block'],
  'arkanoid': ['vaus', 'doh', 'disruption capsule'],
};

// ---------------------------------------------------------------------------
// Finding helpers
// ---------------------------------------------------------------------------

/** @typedef {{severity:'error'|'warn', rule:string, line:number|null, msg:string}} Finding */

function makeReporter() {
  /** @type {Finding[]} */
  const findings = [];
  return {
    findings,
    error: (rule, msg, line = null) => findings.push({ severity: 'error', rule, line, msg }),
    warn: (rule, msg, line = null) => findings.push({ severity: 'warn', rule, line, msg }),
  };
}

/** Return the 1-based line number where `index` falls in `text`. */
function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

// ---------------------------------------------------------------------------
// Individual checks
// ---------------------------------------------------------------------------

/** Title must end `— <…> Design Specification` (Clone or Game for originals). */
function checkTitle(text, r) {
  const first = text.split('\n').find((l) => l.startsWith('# '));
  if (!first) return r.error('title', 'No H1 title found.', 1);
  if (!/—\s*[A-Za-z ]*Design Specification\s*$/.test(first)) {
    r.error('title', `Title must end with "— … Design Specification". Got: ${first}`, 1);
  }
  if (!/\(.*\d{4}.*\)/.test(first)) {
    r.warn('title', 'Title should include "(<Year> <Platform>)".', 1);
  }
}

/** Build-target header block. */
function checkHeader(text, r) {
  if (!/\*\*Build target:\*\*/i.test(text)) {
    r.warn('header', 'Missing "**Build target:**" header callout.');
  }
}

/** At least one ✅ CHECK callout — our signature device. */
function checkCallouts(text, r) {
  const n = (text.match(/✅\s*\*\*CHECK/g) || []).length;
  if (n === 0) r.warn('check-callouts', 'No "✅ **CHECK**" callouts found.');
}

/** Required sections present. */
function checkSections(text, r) {
  for (const { name, re, severity } of REQUIRED_SECTIONS) {
    if (!re.test(text)) {
      const fn = severity === 'error' ? r.error : r.warn;
      fn('sections', `Missing required section: ${name}.`);
    }
  }
}

/** Constants object should be named GAME and be `as const`. */
function checkConstants(text, r) {
  const hasGame = /export const GAME\b/.test(text);
  const hasPhysics = /export const PHYSICS\b/.test(text);
  if (hasPhysics && !hasGame) {
    const idx = text.indexOf('export const PHYSICS');
    r.warn('constants', 'Constants object is named PHYSICS; standardize on GAME.', lineOf(text, idx));
  }
  if (!hasGame && !hasPhysics) {
    r.warn('constants', 'No exported constants object (export const GAME = { ... } as const) found.');
  }
}

/**
 * Sprite grids: rectangular, dimension-labeled (WxH), ASCII-only.
 * We scan for `const NAME: string[] = [ ... ];` blocks and validate the rows.
 */
function checkSprites(text, r) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const decl = lines[i].match(/const\s+([A-Za-z0-9_]+)\s*:\s*string\[\]\s*=\s*\[/);
    if (!decl) continue;
    const name = decl[1];
    const declLine = i + 1;

    // Look back up to 3 lines for a dimension label "(WxH)".
    let expectedW = null;
    let expectedH = null;
    for (let b = i; b >= Math.max(0, i - 3); b--) {
      const dim = lines[b].match(/\((\d+)\s*[xX×]\s*(\d+)\)/);
      if (dim) {
        expectedW = Number(dim[1]);
        expectedH = Number(dim[2]);
        break;
      }
    }

    // Collect the quoted row strings until the closing `];`.
    /** @type {{content:string, line:number}[]} */
    const rows = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      if (/^\s*\]/.test(lines[j])) break; // closing bracket
      // A quoted row, allowing an optional trailing comma and `// comment`.
      const m = lines[j].match(/^\s*'(.*)'\s*,?\s*(\/\/.*)?$/);
      if (m) rows.push({ content: m[1], line: j + 1 });
    }
    i = j; // advance past this block

    if (rows.length === 0) continue;

    // 1. Rectangular: all rows the same width.
    const widths = new Set(rows.map((row) => row.content.length));
    if (widths.size > 1) {
      const detail = rows.map((row) => `${row.line}:${row.content.length}`).join(' ');
      r.error('sprite-shape', `${name}: rows are not all the same width (line:width → ${detail}).`, declLine);
    }

    // 2. Dimension label matches actual grid.
    if (expectedW != null) {
      const actualW = rows[0].content.length;
      if (widths.size === 1 && actualW !== expectedW) {
        r.error('sprite-dims', `${name}: label says width ${expectedW} but rows are ${actualW} wide.`, declLine);
      }
      if (rows.length !== expectedH) {
        r.error('sprite-dims', `${name}: label says height ${expectedH} but found ${rows.length} rows.`, declLine);
      }
    } else {
      r.warn('sprite-dims', `${name}: no (WxH) dimension label in the preceding comment.`, declLine);
    }

    // 3. ASCII-only inside the art (this is where Cyrillic look-alikes hide).
    for (const row of rows) {
      for (let k = 0; k < row.content.length; k++) {
        const code = row.content.charCodeAt(k);
        if (code > 127) {
          r.error(
            'sprite-ascii',
            `${name}: non-ASCII char "${row.content[k]}" (U+${code.toString(16).toUpperCase().padStart(4, '0')}) in sprite row.`,
            row.line,
          );
          break; // one report per row is enough
        }
      }
    }
  }
}

/** Cross-game contamination: a spec referencing another game's unique terms. */
function checkContamination(text, r) {
  const file = r.file.toLowerCase();
  const owner = Object.keys(GAME_SIGNATURE_TERMS).find((k) => file.includes(k));
  const lower = text.toLowerCase();
  for (const [game, terms] of Object.entries(GAME_SIGNATURE_TERMS)) {
    if (game === owner) continue; // a spec may use its own terms
    for (const term of terms) {
      const idx = lower.indexOf(term);
      if (idx !== -1) {
        r.error(
          'contamination',
          `Contains "${term}" — a term unique to the ${game} spec. Likely copy-paste from another game.`,
          lineOf(text, idx),
        );
      }
    }
  }
}

/** TX registry present and every referenced key exists in it. */
function checkTxRegistry(text, r) {
  const block = text.match(/export const TX\s*=\s*\{([\s\S]*?)\}\s*as const/);
  if (!block) {
    r.warn('tx', 'No `export const TX = { ... } as const` registry found.');
    return;
  }
  if (!/export type TXKey\s*=\s*keyof typeof TX/.test(text)) {
    r.warn('tx', 'Missing `export type TXKey = keyof typeof TX`.');
  }
  // Keys declared in the registry.
  const declared = new Set(
    [...block[1].matchAll(/^\s*([A-Za-z0-9_]+)\s*:/gm)].map((m) => m[1]),
  );
  // Keys referenced in "**TX keys:** `foo`, `bar`" lines.
  for (const m of text.matchAll(/\*\*TX keys:\*\*\s*(.+)/g)) {
    const refs = [...m[1].matchAll(/`([A-Za-z0-9_]+)`/g)].map((x) => x[1]);
    for (const ref of refs) {
      if (!declared.has(ref)) {
        r.warn('tx', `TX key \`${ref}\` is referenced but not in the TX registry.`, lineOf(text, m.index));
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function lintFile(path) {
  const text = readFileSync(path, 'utf8');
  const r = makeReporter();
  r.file = basename(path);
  checkTitle(text, r);
  checkHeader(text, r);
  checkCallouts(text, r);
  checkSections(text, r);
  checkConstants(text, r);
  checkSprites(text, r);
  checkContamination(text, r);
  checkTxRegistry(text, r);
  return r.findings;
}

function main() {
  const args = process.argv.slice(2);
  const strict = args.includes('--strict');
  const fileArgs = args.filter((a) => !a.startsWith('--'));

  const files = fileArgs.length
    ? fileArgs.map((f) => (f.startsWith('/') ? f : join(ROOT, f)))
    : readdirSync(SPECS_DIR)
        .filter((f) => f.endsWith('.md') && !NOT_A_SPEC.has(f))
        .map((f) => join(SPECS_DIR, f));

  let totalErrors = 0;
  let totalWarns = 0;
  const perFile = [];

  for (const path of files) {
    const findings = lintFile(path);
    const errors = findings.filter((f) => f.severity === 'error');
    const warns = findings.filter((f) => f.severity === 'warn');
    totalErrors += errors.length;
    totalWarns += warns.length;
    perFile.push({ path, errors: errors.length, warns: warns.length });

    const rel = relative(ROOT, path);
    if (findings.length === 0) {
      console.log(`\n\x1b[32m✓\x1b[0m ${rel} — clean`);
      continue;
    }
    console.log(`\n\x1b[1m${rel}\x1b[0m  (${errors.length} error${errors.length !== 1 ? 's' : ''}, ${warns.length} warning${warns.length !== 1 ? 's' : ''})`);
    for (const f of findings.sort((a, b) => (a.line || 0) - (b.line || 0))) {
      const tag = f.severity === 'error' ? '\x1b[31mERROR\x1b[0m' : '\x1b[33mWARN \x1b[0m';
      const loc = f.line ? `:${f.line}` : '';
      console.log(`  ${tag} [${f.rule}]${loc}  ${f.msg}`);
    }
  }

  // Summary table.
  console.log('\n\x1b[1mSummary\x1b[0m');
  for (const f of perFile) {
    const status = f.errors ? '\x1b[31mFAIL\x1b[0m' : f.warns ? '\x1b[33mwarn\x1b[0m' : '\x1b[32mok  \x1b[0m';
    console.log(`  ${status}  ${relative(ROOT, f.path).padEnd(34)} ${f.errors} errors, ${f.warns} warnings`);
  }
  console.log(`\n  Total: ${totalErrors} errors, ${totalWarns} warnings across ${files.length} spec(s).`);

  const failed = totalErrors > 0 || (strict && totalWarns > 0);
  process.exit(failed ? 1 : 0);
}

main();
