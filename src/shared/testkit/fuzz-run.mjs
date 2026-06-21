// Fuzz / soak runner:  node src/shared/testkit/fuzz-run.mjs <gameId> [seconds]
// Boots the game live, drives it with a game-specific bot for a while, and
// samples invariants after every input tick — catching crashes, exceptions,
// and "impossible state" regressions over long random play.
//
// Note: invariants are sampled per input tick (~tens of ms), not per frame.
// True per-frame, reproducible fuzzing wants the seeded-RNG + fixed-step tick
// seam (deferred — see test-design/DEVLOG.md).
import { pathToFileURL } from 'node:url';
import { withHarness } from './harness.mjs';

const gameId = process.argv[2] || 'arkanoid';
const durationMs = (Number(process.argv[3]) || 15) * 1000;
const { fuzz } = await import(pathToFileURL(`src/games/${gameId}/testing/fuzz.mjs`).href);

await withHarness(async (driver) => {
  console.log(`\n  fuzz — ${gameId} for ${durationMs / 1000}s\n`);
  await driver.startLive(fuzz.sceneKey);

  const violations = new Map(); // rule -> { detail, count }
  let ticks = 0;
  const end = Date.now() + durationMs;
  while (Date.now() < end) {
    await fuzz.tick(driver);
    let inv = [];
    try {
      inv = await driver.invariants(gameId);
    } catch {
      /* surface briefly gone (scene restart) */
    }
    for (const v of inv) {
      const e = violations.get(v.rule) || { detail: v.detail, count: 0 };
      e.count++;
      e.detail = v.detail;
      violations.set(v.rule, e);
    }
    ticks++;
  }

  const errors = driver.errors();
  console.log(`  drove ${ticks} input ticks`);
  if (violations.size === 0 && errors.length === 0) {
    console.log('  no invariant violations, no exceptions — clean\n');
    return;
  }
  if (violations.size) {
    console.log('\n  INVARIANT VIOLATIONS:');
    for (const [rule, e] of violations) console.log(`        x ${rule} (x${e.count}) — ${e.detail}`);
  }
  if (errors.length) {
    console.log('\n  EXCEPTIONS:');
    for (const e of errors.slice(0, 8)) console.log('        ' + e);
  }
  console.log('');
  process.exitCode = 1;
});
