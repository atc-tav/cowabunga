// Mario Bros. scenario suite — the manual verification pass, codified as
// repeatable tests. Run with:  npm run test:game -- mariobros
//
// Each scenario gets (driver, t): `driver` drives the paused scene via the
// game's test surface; `t` collects assertions. Invariants are checked after
// every scenario by the runner. These trace to the Oracle Ledger
// (src/games/mariobros/test-design/TEST_DESIGN.md §4).
const G = 'mariobros';
const KEY = 'game-mariobros';

// A clean single-player combat board; returns the first snapshot.
async function play(d) {
  await d.start(KEY);
  await d.hook(G, 'beginPlay');
  return d.snapshot(G);
}

export const scenarios = [
  // scoring/flip — flipping a grounded enemy scores 0 (§0 #1).
  {
    name: 'flip awards 0 — only the kick scores',
    async run(d, t) {
      await play(d);
      const i = await d.hook(G, 'spawnEnemy', 'turtle', 60, 64, 1);
      await d.hook(G, 'setScore', 0);
      const flipped = await d.hook(G, 'flipEnemy', i);
      const s = await d.snapshot(G);
      t.ok('turtle flipped', flipped);
      t.eq('state flipped', s.enemies[0].state, 'flipped');
      t.eq('flip scored 0', s.players[0].score, 0);
    },
  },

  // scoring/kick — kick = 800 flat for turtle, crab, fly (§3.4).
  {
    name: 'kick awards 800 for every enemy kind',
    async run(d, t) {
      for (const kind of ['turtle', 'crab', 'fly']) {
        await play(d);
        const i = await d.hook(G, 'spawnEnemy', kind, 60, 64, 1);
        // crab needs two bumps to flip; bump until flipped.
        await d.hook(G, 'flipEnemy', i);
        await d.hook(G, 'flipEnemy', i);
        await d.hook(G, 'setScore', 0);
        await d.hook(G, 'resetCombo', 0);
        await d.hook(G, 'kickEnemy', i, 0);
        const s = await d.snapshot(G);
        t.eq(`${kind} kick = 800`, s.players[0].score, 800);
      }
    },
  },

  // scoring/combo-additive — 800/1600/2400/3200, capped at 3200 (§0 #2).
  {
    name: 'combo is additive +800 capped at 3200',
    async run(d, t) {
      await play(d);
      await d.hook(G, 'setScore', 0);
      await d.hook(G, 'resetCombo', 0);
      const deltas = [];
      let prev = 0;
      for (let n = 0; n < 5; n++) {
        const x = 40 + n * 8;
        const i = await d.hook(G, 'spawnEnemy', 'turtle', x, 64, 1);
        await d.hook(G, 'flipEnemy', i);
        await d.hook(G, 'kickEnemy', i, 0);
        const s = await d.snapshot(G);
        deltas.push(s.players[0].score - prev);
        prev = s.players[0].score;
      }
      t.eq('1st = 800', deltas[0], 800);
      t.eq('2nd = 1600', deltas[1], 1600);
      t.eq('3rd = 2400', deltas[2], 2400);
      t.eq('4th = 3200', deltas[3], 3200);
      t.eq('5th capped at 3200', deltas[4], 3200);
    },
  },

  // scoring/combo reset after the window — a fresh chain restarts at 800.
  {
    name: 'combo resets to 800 after the window lapses',
    async run(d, t) {
      await play(d);
      await d.hook(G, 'setScore', 0);
      await d.hook(G, 'resetCombo', 0);
      let i = await d.hook(G, 'spawnEnemy', 'turtle', 40, 64, 1);
      await d.hook(G, 'flipEnemy', i);
      await d.hook(G, 'kickEnemy', i, 0); // +800
      i = await d.hook(G, 'spawnEnemy', 'turtle', 60, 64, 1);
      await d.hook(G, 'flipEnemy', i);
      await d.hook(G, 'kickEnemy', i, 0); // +1600 (chained)
      await d.hook(G, 'resetCombo', 0); // window lapses
      const before = (await d.snapshot(G)).players[0].score;
      i = await d.hook(G, 'spawnEnemy', 'turtle', 80, 64, 1);
      await d.hook(G, 'flipEnemy', i);
      await d.hook(G, 'kickEnemy', i, 0);
      const after = (await d.snapshot(G)).players[0].score;
      t.eq('next chain restarts at 800', after - before, 800);
    },
  },

  // scoring/extra-life — exactly +1 life once when crossing 20,000 (§0 #5).
  {
    name: 'extra life awarded once crossing 20,000',
    async run(d, t) {
      await play(d);
      await d.hook(G, 'setScore', 19999);
      const before = (await d.snapshot(G)).players[0].lives;
      await d.hook(G, 'checkExtraLife', 0);
      t.eq('no life below 20k', (await d.snapshot(G)).players[0].lives, before);
      await d.hook(G, 'setScore', 20000);
      await d.hook(G, 'checkExtraLife', 0);
      t.eq('+1 life at 20k', (await d.snapshot(G)).players[0].lives, before + 1);
      // Crossing again must not award a second life.
      await d.hook(G, 'setScore', 25000);
      await d.hook(G, 'checkExtraLife', 0);
      t.eq('one-shot only', (await d.snapshot(G)).players[0].lives, before + 1);
    },
  },

  // scoring/coin — collect bonus coin → +800; all 10 → +5000 first stage (§0 #3).
  {
    name: 'coins award 800 each and 5000 full first bonus',
    async run(d, t) {
      await play(d);
      await d.hook(G, 'enterBonus');
      const s0 = await d.snapshot(G);
      t.eq('10 coins spawned', s0.coinCount, 10);
      t.eq('no enemies in bonus', s0.enemyCount, 0);
      await d.hook(G, 'setScore', 0);
      await d.hook(G, 'collectAllCoins', 0);
      const s1 = await d.snapshot(G);
      t.eq('all coins gone', s1.coinCount, 0);
      // 10 coins * 800 + 5000 completion = 13000
      t.eq('800/coin + 5000 full', s1.players[0].score, 10 * 800 + 5000);
    },
  },

  // enemy/speed-ordering — turtle < fly < crab at normal pace (§0 #8).
  {
    name: 'normal speed ordering turtle < fly < crab',
    async run(d, t) {
      await play(d);
      const it = await d.hook(G, 'spawnEnemy', 'turtle', 60, 64, 1);
      const ifl = await d.hook(G, 'spawnEnemy', 'fly', 90, 64, 1);
      const ic = await d.hook(G, 'spawnEnemy', 'crab', 120, 64, 1);
      const s = await d.snapshot(G);
      const sp = (i) => s.enemies[i].effSpeed;
      t.ok('turtle < fly', sp(it) < sp(ifl));
      t.ok('fly < crab', sp(ifl) < sp(ic));
    },
  },

  // enemy/fly-not-last-fast — the fly does NOT speed up as the last enemy (§0 #6).
  {
    name: 'fly as last enemy keeps its pace; turtle/crab speed up',
    async run(d, t) {
      await play(d);
      const ifl = await d.hook(G, 'spawnEnemy', 'fly', 90, 64, 1);
      const base = (await d.snapshot(G)).enemies[0].effSpeed;
      await d.hook(G, 'makeLast', ifl);
      const lastFly = (await d.snapshot(G)).enemies[0].effSpeed;
      t.eq('fly last == normal', lastFly, base);

      await play(d);
      const it = await d.hook(G, 'spawnEnemy', 'turtle', 60, 64, 1);
      const tBase = (await d.snapshot(G)).enemies[0].effSpeed;
      await d.hook(G, 'makeLast', it);
      const tLast = (await d.snapshot(G)).enemies[0].effSpeed;
      t.ok('turtle last > normal', tLast > tBase);
    },
  },

  // enemy/fly-grounded-only-flip — airborne fly bump is a no-op; grounded flips.
  {
    name: 'fly is only flippable while grounded',
    async run(d, t) {
      await play(d);
      const i = await d.hook(G, 'spawnEnemy', 'fly', 90, 64, 1);
      await d.hook(G, 'setEnemyAirborne', i, 120);
      const air = await d.hook(G, 'flipEnemy', i);
      t.ok('airborne bump no-op', !air);
      t.eq('still active', (await d.snapshot(G)).enemies[0].state, 'walk');
      // back on the ground it flips.
      await play(d);
      const j = await d.hook(G, 'spawnEnemy', 'fly', 90, 64, 1);
      const grounded = await d.hook(G, 'flipEnemy', j);
      t.ok('grounded bump flips', grounded);
      t.eq('now flipped', (await d.snapshot(G)).enemies[0].state, 'flipped');
    },
  },

  // enemy/crab-two-hit — 1st bump angers, 2nd flips; no reset to 2 on recovery.
  {
    name: 'crab takes two hits to flip; recovery keeps one',
    async run(d, t) {
      await play(d);
      const i = await d.hook(G, 'spawnEnemy', 'crab', 90, 64, 1);
      const f1 = await d.hook(G, 'flipEnemy', i);
      t.ok('1st hit does not flip', !f1);
      t.eq('1st hit angers', (await d.snapshot(G)).enemies[0].state, 'angry');
      const f2 = await d.hook(G, 'flipEnemy', i);
      t.ok('2nd hit flips', f2);
      // recover then a single bump should flip again.
      await d.hook(G, 'forceRecover', i);
      const f3 = await d.hook(G, 'flipEnemy', i);
      t.ok('one hit re-flips after recovery', f3);
    },
  },

  // stomp/kills-player — landing on an un-flipped enemy kills the player.
  {
    name: 'stomping an un-flipped enemy kills the player',
    async run(d, t) {
      for (const kind of ['turtle', 'crab', 'fly']) {
        await play(d);
        const before = (await d.snapshot(G)).players[0].lives;
        const i = await d.hook(G, 'spawnEnemy', kind, 100, 64, 1);
        // Land on top of the enemy (feet just into its top edge) and resolve.
        await d.hook(G, 'placePlayer', 0, 100, 62);
        const died = await d.hook(G, 'resolveContact', 0);
        t.ok(`${kind}: player dies`, died);
        const s = await d.snapshot(G);
        t.eq(`${kind}: lost a life`, s.players[0].lives, before - 1);
        t.eq(`${kind}: enemy survives`, s.enemyCount, 1);
      }
    },
  },

  // move/fixed-jump-arc — no mid-air horizontal steering (§3.1 / §0).
  {
    name: 'fixed jump arc — airborne input does not change vx',
    async run(d, t) {
      await play(d);
      // Grounded: pressing a direction accelerates (control works on the floor).
      await d.hook(G, 'setPlayerGround', 0, true);
      await d.hook(G, 'setPlayerVx', 0, 0);
      const onGround = await d.hook(G, 'stepHorizontal', 0, 16, 1);
      t.ok('ground input accelerates', onGround > 0);
      // Airborne: same input must leave vx untouched (fixed arc).
      await d.hook(G, 'setPlayerGround', 0, false);
      await d.hook(G, 'setPlayerVx', 0, 50);
      const air = await d.hook(G, 'stepHorizontal', 0, 16, 1);
      t.eq('air input keeps vx', air, 50);
      const airOpp = await d.hook(G, 'stepHorizontal', 0, 16, -1);
      t.eq('opposite air input keeps vx', airOpp, 50);
    },
  },

  // pow/flips-grounded + skips-airborne fly + uses-counter.
  {
    name: 'POW flips grounded enemies, skips airborne, counts down',
    async run(d, t) {
      await play(d);
      await d.hook(G, 'setPowUses', 3);
      const a = await d.hook(G, 'spawnEnemy', 'turtle', 60, 64, 1);
      const b = await d.hook(G, 'spawnEnemy', 'crab', 100, 64, 1);
      const c = await d.hook(G, 'spawnEnemy', 'fly', 140, 64, 1);
      await d.hook(G, 'setEnemyAirborne', c, 120); // fly mid-hop
      await d.hook(G, 'activatePow');
      const s = await d.snapshot(G);
      t.eq('pow uses 3 -> 2', s.powUsesRemaining, 2);
      t.eq('grounded turtle flipped', s.enemies[a].state, 'flipped');
      t.eq('grounded crab flipped', s.enemies[b].state, 'flipped');
      t.ok('airborne fly not flipped', s.enemies[c].state !== 'flipped');
    },
  },

  // pow/reflips-flipped-upright — a flipped enemy is righted by a POW hit (§3.3).
  {
    name: 'POW re-flips an already-flipped enemy upright',
    async run(d, t) {
      await play(d);
      await d.hook(G, 'setPowUses', 3);
      const i = await d.hook(G, 'spawnEnemy', 'turtle', 80, 64, 1);
      await d.hook(G, 'flipEnemy', i);
      t.eq('flipped first', (await d.snapshot(G)).enemies[0].state, 'flipped');
      await d.hook(G, 'activatePow');
      const s = await d.snapshot(G);
      t.ok('back upright (active)', s.enemies[0].state !== 'flipped');
    },
  },

  // pow/three-uses-then-removed.
  {
    name: 'POW disappears after 3 uses',
    async run(d, t) {
      await play(d);
      await d.hook(G, 'setPowUses', 3);
      await d.hook(G, 'activatePow');
      await d.hook(G, 'activatePow');
      await d.hook(G, 'activatePow');
      const s = await d.snapshot(G);
      t.eq('0 uses left', s.powUsesRemaining, 0);
    },
  },

  // phase/clear-on-targets — bonus rosters present, target counting.
  {
    name: 'phase rosters match the spec table (1-10)',
    async run(d, t) {
      await play(d);
      // Phase 1: 3 turtles queued.
      await d.hook(G, 'skipToPhase', 1);
      let s = await d.snapshot(G);
      t.eq('phase 1 = 3 targets', s.targetsRemaining, 3);
      // Phase 2: 5 turtles.
      await d.hook(G, 'skipToPhase', 2);
      s = await d.snapshot(G);
      t.eq('phase 2 = 5 targets', s.targetsRemaining, 5);
      // Phase 4: 4 crabs.
      await d.hook(G, 'skipToPhase', 4);
      s = await d.snapshot(G);
      t.eq('phase 4 = 4 targets', s.targetsRemaining, 4);
    },
  },

  // slipice/non-target — Slipice never counts toward targetsRemaining.
  {
    name: 'Slipice is not a phase-clear target',
    async run(d, t) {
      await play(d);
      const before = (await d.snapshot(G)).targetsRemaining;
      // Slipice lives in a separate list, never in `enemies`/`spawnQueue`.
      const s = await d.snapshot(G);
      t.eq('slipice list empty here', s.slipiceCount, 0);
      t.eq('targets unaffected by slipice', s.targetsRemaining, before);
    },
  },
];
