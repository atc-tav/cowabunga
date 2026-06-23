#!/usr/bin/env node
// Factory status — a fast, no-browser audit of how far each registered game has
// gone through the spec-driven, oracle-gated process (docs/spec-driven-development.md).
//
// It does NOT run the games (that's `npm run test:game`). It statically checks
// that the *process artifacts* exist, so the debt is visible at a glance and an
// agent can self-check before claiming a game is done.
//
//   npm run factory:status            # advisory: prints the table, exits 0
//   npm run factory:status -- --strict  # exits 1 if any non-hidden game is missing an artifact
//
// "Has spec" and "Has ledger" are the two that decide whether a game can be
// faithful at all. A green test:game run on a game with no ledger means nothing
// (see the doc) — this check is what makes that omission impossible to ignore.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.argv.includes('--strict');

// --- Which games exist (parse registry.ts as text; avoids importing Phaser/TS) ---
const registry = readFileSync(join(root, 'src/registry.ts'), 'utf8');
const games = [];
// Each entry has an `id: '...'`; an entry is `hidden` if `hidden:` appears in its block.
const blocks = registry.split(/\{\s*\n/).filter((b) => b.includes('id:'));
for (const b of blocks) {
  const id = b.match(/id:\s*'([^']+)'/)?.[1];
  if (!id) continue;
  games.push({ id, hidden: /hidden:\s*true/.test(b) });
}

// --- Loosely map a game id to its spec file in specs/ ---
const specFiles = existsSync(join(root, 'specs'))
  ? readdirSync(join(root, 'specs')).filter((f) => f.endsWith('.md') && !/README|SPEC_GUIDE/.test(f))
  : [];
const ALIASES = { donkeykong: 'donkey', mariobros: 'mario-bros', pacman: 'pac' };
function specFor(id) {
  const needle = ALIASES[id] ?? id;
  return specFiles.find((f) => f.includes(needle)) ?? null;
}

// --- Per-game artifact checks ---
function check(id) {
  const dir = join(root, 'src/games', id);
  const has = (p) => existsSync(join(dir, p));
  let surface = false;
  try {
    surface = readdirSync(dir)
      .filter((f) => f.endsWith('.ts'))
      .some((f) => readFileSync(join(dir, f), 'utf8').includes('buildTestSurface'));
  } catch { /* dir may not exist */ }
  return {
    spec: specFor(id),
    ledger: has('test-design/TEST_DESIGN.md'),
    scenarios: has('testing/scenarios.mjs'),
    fuzz: has('testing/fuzz.mjs'),
    surface,
  };
}

// --- Render ---
const mark = (b) => (b ? '🟢' : '🔴');
const rows = games.filter((g) => !g.hidden).map((g) => ({ ...g, ...check(g.id) }));

console.log('\nFactory status — spec-driven, oracle-gated process');
console.log('  (artifact presence only; run `npm run test:game -- <id>` for green/red)\n');
console.log('  game           spec   ledger  surface  scenarios  fuzz');
console.log('  ' + '-'.repeat(58));
let incomplete = 0;
for (const r of rows) {
  const ok = r.spec && r.ledger && r.surface && r.scenarios;
  if (!ok) incomplete++;
  const specCell = r.spec ? '🟢' : '🔴 none';
  console.log(
    `  ${r.id.padEnd(13)}  ${specCell.padEnd(6)} ${mark(r.ledger).padEnd(7)} ${mark(r.surface).padEnd(8)} ${mark(r.scenarios).padEnd(10)} ${mark(r.fuzz)}`,
  );
}
const withLedger = rows.filter((r) => r.ledger).length;
console.log('\n  ' + '-'.repeat(58));
console.log(`  ${withLedger}/${rows.length} games have an Oracle Ledger.`);
if (incomplete) {
  console.log(`  ${incomplete} game(s) missing a process artifact — see docs/spec-driven-development.md`);
}
console.log('');

if (strict && incomplete) {
  console.error(`factory:status --strict: ${incomplete} game(s) incomplete.`);
  process.exit(1);
}
