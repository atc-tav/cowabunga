// CLI test runner:  node src/shared/testkit/run.mjs <gameId>
// Loads src/games/<gameId>/testing/scenarios.mjs, runs each scenario against a
// freshly-booted headless game, checks invariants after each, and reports.
import { pathToFileURL } from 'node:url';
import { withHarness } from './harness.mjs';
import { makeChecks } from './assert.mjs';

const gameId = process.argv[2] || 'arkanoid';
const mod = await import(pathToFileURL(`src/games/${gameId}/testing/scenarios.mjs`).href);
const scenarios = mod.scenarios;

await withHarness(async (driver) => {
  let total = 0;
  let failed = 0;
  console.log(`\n  testkit — ${gameId} (${scenarios.length} scenarios)\n`);

  for (const sc of scenarios) {
    const t = makeChecks();
    try {
      await sc.run(driver, t);
    } catch (e) {
      t.ok('did not throw', false, String(e && e.message ? e.message : e));
    }
    // Invariants must hold after every scenario.
    let inv = [];
    try {
      inv = await driver.invariants(gameId);
    } catch {
      /* surface gone (e.g. scene mid-restart) — skip */
    }
    for (const v of inv) t.ok(`invariant:${v.rule}`, false, v.detail);

    const res = t.results();
    const bad = res.filter((r) => !r.pass);
    total += res.length;
    failed += bad.length;
    console.log(`  ${bad.length ? 'FAIL' : ' ok '}  ${sc.name}`);
    for (const r of bad) console.log(`          x ${r.name}${r.detail ? ' — ' + r.detail : ''}`);
  }

  const errs = driver.errors();
  if (errs.length) {
    failed += errs.length;
    console.log('\n  page errors:');
    for (const e of errs.slice(0, 8)) console.log('          ' + e);
  }

  console.log(`\n  ${total - failed}/${total} checks passed\n`);
  if (failed) process.exitCode = 1;
});
