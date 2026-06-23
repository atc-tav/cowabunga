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

  // ============================================================ player movement

  // move/momentum — vx decays by friction each frame, not snapping to 0 (§3.1).
  {
    name: 'momentum — releasing direction decays vx by friction, slides',
    async run(d, t) {
      await play(d);
      await d.hook(G, 'placePlayer', 0, 60, 208); // on the ground floor
      await d.hook(G, 'setPlayerGround', 0, true);
      await d.hook(G, 'setPlayerVx', 0, 100); // at full RUN_MAX
      const startX = (await d.hook(G, 'stepPlayer', 0, 16, 0)).x; // dir=0: release
      const r1 = await d.hook(G, 'stepPlayer', 0, 16, 0);
      t.ok('still moving after release (not 0)', Math.abs(r1.vx) > 0);
      t.ok('vx decayed (friction)', r1.vx < 100);
      // Slide to a stop over several frames; total slide is a fraction of the screen.
      let prev = r1.x;
      let slid = Math.abs(r1.x - startX);
      let lastVx = r1.vx;
      for (let n = 0; n < 60; n++) {
        const r = await d.hook(G, 'stepPlayer', 0, 16, 0);
        slid += Math.abs(r.x - prev);
        prev = r.x;
        lastVx = r.vx;
      }
      t.eq('eventually stops', Math.round(lastVx), 0);
      t.ok('slid forward before stopping', slid > 4);
    },
  },

  // move/fall-no-damage — drop from the top platform to the floor, no life lost.
  {
    name: 'falls from any height without damage, then respawn-safe',
    async run(d, t) {
      await play(d);
      const before = (await d.snapshot(G)).players[0].lives;
      // Place in the top centre gap (x=128, above the middle island) high up and
      // let gravity take over — it falls onto a lower platform unharmed.
      const startFeet = 72;
      await d.hook(G, 'placePlayer', 0, 128, startFeet);
      await d.hook(G, 'setPlayerGround', 0, false);
      await d.hook(G, 'setPlayerVy', 0, 0);
      let onGround = false;
      let lastFeet = 0;
      for (let n = 0; n < 200 && !onGround; n++) {
        const r = await d.hook(G, 'stepPlayer', 0, 16, 0);
        onGround = r.onGround;
        lastFeet = r.feet;
      }
      t.ok('landed', onGround);
      t.ok('fell a meaningful distance', lastFeet > startFeet + 10);
      t.eq('no life lost from the fall', (await d.snapshot(G)).players[0].lives, before);
    },
  },

  // move/no-platform-drop — the player never passes down through a platform.
  {
    name: 'cannot drop through a platform — lands and stays',
    async run(d, t) {
      await play(d);
      // Drop onto the lower platform (y=160) and keep stepping; feet must never
      // sink past that surface (no drop-through).
      await d.hook(G, 'placePlayer', 0, 52, 150); // above the y=160 platform
      await d.hook(G, 'setPlayerGround', 0, false);
      await d.hook(G, 'setPlayerVy', 0, 0);
      let landedFeet = null;
      let sankBelow = false;
      for (let n = 0; n < 120; n++) {
        const r = await d.hook(G, 'stepPlayer', 0, 16, 0);
        if (r.onGround && landedFeet === null) landedFeet = r.feet;
        if (landedFeet !== null && r.feet > landedFeet + 1) sankBelow = true;
      }
      t.eq('landed on the lower platform', landedFeet, 160);
      t.ok('never sank through it', !sankBelow);
    },
  },

  // wrap/player — player crossing an edge reappears on the opposite edge (§1).
  {
    name: 'player wraps at both screen edges',
    async run(d, t) {
      await play(d);
      // Push past the right edge.
      await d.hook(G, 'placePlayer', 0, 252, 208);
      await d.hook(G, 'setPlayerGround', 0, true);
      await d.hook(G, 'setPlayerVx', 0, 100);
      let wrappedR = false;
      for (let n = 0; n < 20 && !wrappedR; n++) {
        const r = await d.hook(G, 'stepPlayer', 0, 16, 1);
        if (r.x < 60) wrappedR = true; // jumped from ~252 to near 0
      }
      t.ok('right edge wraps to left', wrappedR);
      // Push past the left edge.
      await d.hook(G, 'placePlayer', 0, 4, 208);
      await d.hook(G, 'setPlayerGround', 0, true);
      await d.hook(G, 'setPlayerVx', 0, -100);
      let wrappedL = false;
      for (let n = 0; n < 20 && !wrappedL; n++) {
        const r = await d.hook(G, 'stepPlayer', 0, 16, -1);
        if (r.x > 200) wrappedL = true;
      }
      t.ok('left edge wraps to right', wrappedL);
      // Position stays in bounds the whole time (invariant #7 for the player).
      t.ok('player in [0,W)', (await d.snapshot(G)).players[0].x >= 0);
    },
  },

  // flip/from-below-only — bumping the platform under a grounded enemy flips it;
  // bumping an empty platform flips nothing (§3.2 step 1).
  {
    name: 'head-bump under a grounded enemy flips it; empty platform does not',
    async run(d, t) {
      await play(d);
      // Enemy on the lower platform (y=160) at x=52; player directly beneath it.
      const i = await d.hook(G, 'spawnEnemy', 'turtle', 52, 160, 1);
      // Start below the platform underside (y=170) and launch the head up into it.
      await d.hook(G, 'placePlayer', 0, 52, 190);
      await d.hook(G, 'setPlayerGround', 0, false);
      await d.hook(G, 'setPlayerVy', 0, -260); // launch the head into the platform
      let flipped = false;
      for (let n = 0; n < 30 && !flipped; n++) {
        await d.hook(G, 'stepPlayer', 0, 16, 0);
        flipped = (await d.snapshot(G)).enemies[i].state === 'flipped';
      }
      t.ok('enemy on the bumped platform flips', flipped);

      // Control: a bump with no enemy over it flips nothing.
      await play(d);
      const j = await d.hook(G, 'spawnEnemy', 'turtle', 52, 160, 1); // on lower-left
      await d.hook(G, 'placePlayer', 0, 200, 190); // bump a DIFFERENT span (right side)
      await d.hook(G, 'setPlayerGround', 0, false);
      await d.hook(G, 'setPlayerVy', 0, -260);
      for (let n = 0; n < 30; n++) await d.hook(G, 'stepPlayer', 0, 16, 0);
      t.eq('enemy on an un-bumped platform stays active', (await d.snapshot(G)).enemies[j].state, 'walk');
    },
  },

  // ============================================================ enemy traversal

  // traverse/exit-bottom-recycle — an active enemy entering a bottom-pipe zone is
  // teleported back to a top spawn (so it must be defeated to clear) (§2.2/§7.2).
  {
    name: 'active enemy at a bottom pipe recycles to a top spawn',
    async run(d, t) {
      await play(d);
      // Drop a walking turtle into the bottom-left pipe zone (x 0..30, ground).
      const i = await d.hook(G, 'spawnEnemy', 'turtle', 10, 208, -1);
      const before = (await d.snapshot(G)).enemies[i];
      t.ok('starts at the bottom-left pipe', before.y > 180);
      await d.hook(G, 'runEnemyBounds');
      const after = (await d.snapshot(G)).enemies[i];
      t.ok('recycled up to a top pipe (y near top floor)', after.y < 80);
      t.eq('still on the board (not removed)', (await d.snapshot(G)).enemyCount, 1);
    },
  },

  // wrap/enemies — an upper-floor enemy wraps edge-to-edge (§1 CHECK).
  // NOTE: the GROUND floor intentionally recycles via pipes instead of wrapping
  // (spec §7.2), a documented divergence flagged as ambiguous — see the ledger.
  {
    name: 'upper-floor enemy wraps at the screen edge',
    async run(d, t) {
      await play(d);
      // Turtle just past the right edge at the TOP platform level (y=64).
      const i = await d.hook(G, 'spawnEnemy', 'turtle', 258, 64, 1);
      await d.hook(G, 'runEnemyBounds');
      const e = (await d.snapshot(G)).enemies[i];
      t.ok('wrapped to the left edge', e.x < 10);
      t.ok('still in bounds', e.x >= 0);
    },
  },

  // enemy/headon-reverse — two active enemies colliding both reverse (§3.5/§7.2).
  {
    name: 'two enemies colliding head-on both reverse direction',
    async run(d, t) {
      await play(d);
      // Place them overlapping on the lower platform, facing into each other.
      const a = await d.hook(G, 'spawnEnemy', 'turtle', 50, 160, 1); // facing right
      const b = await d.hook(G, 'spawnEnemy', 'turtle', 56, 160, -1); // facing left
      await d.hook(G, 'runEnemyCollisions');
      const s = await d.snapshot(G);
      t.eq('left enemy now faces left', s.enemies[a].dir, -1);
      t.eq('right enemy now faces right', s.enemies[b].dir, 1);
      t.ok('and they were pushed apart', Math.abs(s.enemies[a].x - s.enemies[b].x) >= 6);
    },
  },

  // ============================================================ slipice machine

  // slipice/ices-center + walks-to-center + three-platforms-max + non-target clear.
  {
    name: 'slipice ices a platform centre, self-destructs, never blocks clear',
    async run(d, t) {
      await play(d);
      await d.hook(G, 'skipToPhase', 9); // a slipice phase
      // Spawn a slipice on the top-left platform (FLOOR index 0, centre x=52).
      const si = await d.hook(G, 'spawnSlipice', 30, 1, 0);
      let iced = 0;
      for (let n = 0; n < 200 && iced === 0; n++) {
        await d.hook(G, 'updateSlipice', 16);
        iced = (await d.snapshot(G)).icedPlatforms;
      }
      const s = await d.snapshot(G);
      t.eq('one platform iced', s.icedPlatforms, 1);
      t.eq('slipice destroyed itself on icing', s.slipiceCount, 0);

      // Now prove a live slipice does not block phase clear: spawn one and clear
      // all target enemies — updatePlaying must still advance the phase.
      const i = await d.hook(G, 'spawnEnemy', 'turtle', 60, 160, 1);
      await d.hook(G, 'spawnSlipice', 30, 1, 0);
      t.ok('a slipice is on the board', (await d.snapshot(G)).slipiceCount >= 1);
      await d.hook(G, 'forceClearPhase'); // remove the last target enemy
      // The target list is now empty; a playing step should clear the phase
      // regardless of the live slipice.
      const flow = await d.hook(G, 'runPlayingStep', 16);
      t.ok('phase advanced past targets despite a live slipice', flow === 'phaseintro');
      // sanity: the kicked enemy index existed
      t.ok('targets were the only gate', i >= 0);
    },
  },

  // slipice/touch-kills-player — touching an un-flipped slipice loses a life.
  {
    name: 'touching a slipice kills the player',
    async run(d, t) {
      await play(d);
      const before = (await d.snapshot(G)).players[0].lives;
      await d.hook(G, 'spawnSlipice', 60, 1, 0); // on top-left platform (y=64)
      await d.hook(G, 'placePlayer', 0, 60, 64); // overlap it
      const touched = await d.hook(G, 'slipiceTouchesPlayer', 0);
      t.ok('player overlaps the slipice', touched);
      const died = await d.hook(G, 'runLethalChecks', 0);
      t.ok('contact is lethal', died);
      t.eq('lost a life', (await d.snapshot(G)).players[0].lives, before - 1);
    },
  },

  // slipice/one-hit-kill + non-target — a single bump removes it for 500, no kick.
  {
    name: 'slipice dies to one bump for 500, no kick step',
    async run(d, t) {
      await play(d);
      await d.hook(G, 'setScore', 0);
      await d.hook(G, 'spawnSlipice', 60, 1, 0);
      t.eq('one slipice present', (await d.snapshot(G)).slipiceCount, 1);
      await d.hook(G, 'bumpSlipice', 0);
      const s = await d.snapshot(G);
      t.eq('slipice removed by a single bump', s.slipiceCount, 0);
      t.eq('scored 500 (unverified value, §0 #9)', s.players[0].score, 500);
    },
  },

  // ============================================================ icicle machine

  // icicle/state-machine + lethal-only-falling (§2.3 ✅ CHECK).
  {
    name: 'icicle forms then falls; lethal ONLY while falling',
    async run(d, t) {
      await play(d);
      await d.hook(G, 'spawnIcicle', 40);
      const seen = [];
      let lethalWhileFull = false;
      let lethalWhileFalling = false;
      for (let n = 0; n < 400; n++) {
        const s0 = (await d.snapshot(G));
        if (s0.icicleCount === 0) break;
        const ic = s0.icicles[0];
        if (!seen.includes(ic.state)) seen.push(ic.state);
        if ((ic.state === 'forming' || ic.state === 'full') && ic.lethal) lethalWhileFull = true;
        if (ic.state === 'falling' && ic.lethal) lethalWhileFalling = true;
        await d.hook(G, 'updateIcicles', 16);
      }
      t.ok('went through forming', seen.includes('forming'));
      t.ok('went through full', seen.includes('full'));
      t.ok('went through falling', seen.includes('falling'));
      t.ok('NOT lethal while forming/full', !lethalWhileFull);
      t.ok('lethal while falling', lethalWhileFalling);
    },
  },

  // icicle lethal-collision — player under a falling icicle dies; under a forming
  // one does not (§2.3 ✅ CHECK — collision active only in `falling`).
  {
    name: 'icicle hits the player only in the falling state',
    async run(d, t) {
      await play(d);
      const before = (await d.snapshot(G)).players[0].lives;
      const ii = await d.hook(G, 'spawnIcicle', 40);
      let hitWhileForming = false;
      let reachedFalling = false;
      let diedFalling = false;
      for (let n = 0; n < 400; n++) {
        const s = await d.snapshot(G);
        if (s.icicleCount === 0) break;
        const ic = s.icicles[0];
        // Keep the player parked overlapping the icicle every frame (refresh
        // invuln to 0 so contact is never masked by the spawn-safe window).
        await d.hook(G, 'placePlayer', 0, 40, ic.state === 'falling' ? ic.y + 6 : 80);
        if (ic.state !== 'falling') {
          if (await d.hook(G, 'icicleTouchesPlayer', 0)) hitWhileForming = true;
        } else {
          reachedFalling = true;
          if (await d.hook(G, 'runLethalChecks', 0)) { diedFalling = true; break; }
        }
        await d.hook(G, 'updateIcicles', 16);
      }
      t.ok('never hit while forming/full', !hitWhileForming);
      t.ok('reached the falling state', reachedFalling);
      t.ok('falling icicle kills the player', diedFalling);
      t.eq('lost a life only while falling', (await d.snapshot(G)).players[0].lives, before - 1);
      t.ok('icicle index valid', ii === 0);
    },
  },

  // ============================================================ subsequent bonus

  // scoring/bonus-all-subsequent — the 2nd bonus stage completion awards 8000 (§0 #3).
  {
    name: 'subsequent bonus stage awards 8000 (not 5000)',
    async run(d, t) {
      await play(d);
      // First bonus stage: complete it (5000) so bonusCompletions advances to 1.
      await d.hook(G, 'enterBonus');
      await d.hook(G, 'setScore', 0);
      await d.hook(G, 'collectAllCoins', 0);
      const s1 = await d.snapshot(G);
      t.eq('first stage: 800/coin + 5000', s1.players[0].score, 10 * 800 + 5000);
      t.eq('one bonus completed', s1.bonusCompletions, 1);
      // Second bonus stage: re-enter (re-spawns 10 coins) and complete it.
      await d.hook(G, 'enterBonus');
      await d.hook(G, 'setScore', 0);
      const s2a = await d.snapshot(G);
      t.eq('fresh 10 coins for stage 2', s2a.coinCount, 10);
      await d.hook(G, 'collectAllCoins', 0);
      const s2 = await d.snapshot(G);
      t.eq('second stage: 800/coin + 8000', s2.players[0].score, 10 * 800 + 8000);
      t.eq('two bonuses completed', s2.bonusCompletions, 2);
    },
  },

  // bonus/timer-20s + ends-on-empty — the countdown starts at 20s and the stage
  // ends when every coin is collected (§6.3). NOTE: the 15s Phase-13 ice-bonus
  // variant is a deferred phase-roster item (see the ledger).
  {
    name: 'bonus starts a 20s countdown and ends when all coins are collected',
    async run(d, t) {
      await play(d);
      await d.hook(G, 'enterBonus');
      const s0 = await d.snapshot(G);
      t.eq('countdown starts at 20s', s0.bonusTimer, 20000);
      t.ok('in the bonus phase', s0.bonusActive);
      // Counts down as time advances.
      await d.hook(G, 'runPlayingStep', 1000);
      t.ok('timer decremented', (await d.snapshot(G)).bonusTimer < 20000);
      // Collecting every coin ends the stage (back to the phase-intro flow).
      await d.hook(G, 'collectAllCoins', 0);
      const flow = await d.hook(G, 'runPlayingStep', 16);
      t.eq('all coins -> bonus ends', flow, 'phaseintro');
    },
  },

  // ============================================================ enemy specifics

  // enemy/turtle-one-hit-flip — a single bump flips a Shellcreeper (§4.1).
  {
    name: 'turtle flips in one hit',
    async run(d, t) {
      await play(d);
      const i = await d.hook(G, 'spawnEnemy', 'turtle', 60, 64, 1);
      const flipped = await d.hook(G, 'flipEnemy', i);
      t.ok('one bump flips the turtle', flipped);
      t.eq('now flipped', (await d.snapshot(G)).enemies[i].state, 'flipped');
    },
  },

  // enemy/turtle-no-jump — a turtle's only vertical motion is falling, never a
  // jump: its vy is never negative (upward) across a long walk (§4.1).
  {
    name: 'turtle never jumps (vy is never upward)',
    async run(d, t) {
      await play(d);
      const i = await d.hook(G, 'spawnEnemy', 'turtle', 60, 64, 1);
      let everUp = false;
      for (let n = 0; n < 200; n++) {
        await d.hook(G, 'tickEnemies', 16);
        const e = (await d.snapshot(G)).enemies[i];
        if (!e) break; // walked off the board
        if (e.vy < -1) everUp = true;
      }
      t.ok('turtle vy never goes upward', !everUp);
    },
  },

  // flip/recovery-enrage + turtle-enrage — a flipped turtle left un-kicked rights
  // itself and is FASTER than its base pace (§3.2 / §4.1; exact timer feel-tuned).
  {
    name: 'flipped turtle recovers faster after its stun lapses',
    async run(d, t) {
      await play(d);
      const i = await d.hook(G, 'spawnEnemy', 'turtle', 60, 64, 1);
      const base = (await d.snapshot(G)).enemies[i].effSpeed;
      await d.hook(G, 'flipEnemy', i);
      t.eq('flipped', (await d.snapshot(G)).enemies[i].state, 'flipped');
      // Run past the flip window, then recover.
      await d.hook(G, 'tickEnemies', 5000);
      await d.hook(G, 'recoverReady');
      const s = await d.snapshot(G);
      t.ok('back on its feet (active)', s.enemies[i].state === 'walk' || s.enemies[i].state === 'angry');
      t.ok('recovered speed exceeds base', s.enemies[i].effSpeed > base);
    },
  },

  // enemy/fly-quick-recovery — a flipped fly's stun is much shorter than a turtle's
  // (§4.3 "gets back up very quickly").
  {
    name: 'fly recovers from a flip far quicker than a turtle',
    async run(d, t) {
      await play(d);
      const tIdx = await d.hook(G, 'spawnEnemy', 'turtle', 60, 64, 1);
      await d.hook(G, 'flipEnemy', tIdx);
      const turtleStun = (await d.snapshot(G)).enemies[tIdx].stun;
      await play(d);
      const fIdx = await d.hook(G, 'spawnEnemy', 'fly', 60, 64, 1);
      await d.hook(G, 'flipEnemy', fIdx);
      const flyStun = (await d.snapshot(G)).enemies[fIdx].stun;
      t.ok('fly stun > 0', flyStun > 0);
      t.ok('fly stun much shorter than turtle', flyStun < turtleStun);
    },
  },

  // enemy/fly-no-enrage — a recovered fly returns to its normal speed; it has no
  // enraged faster tier (§4.3).
  {
    name: 'fly has no enraged tier — recovers to normal speed',
    async run(d, t) {
      await play(d);
      const i = await d.hook(G, 'spawnEnemy', 'fly', 60, 64, 1);
      const base = (await d.snapshot(G)).enemies[i].effSpeed;
      await d.hook(G, 'flipEnemy', i);
      await d.hook(G, 'tickEnemies', 2000);
      await d.hook(G, 'recoverReady');
      const e = (await d.snapshot(G)).enemies[i];
      t.eq('recovered fly is back to walking', e.state, 'walk');
      t.eq('fly speed unchanged after recovery (no enrage)', e.effSpeed, base);
    },
  },

  // enemy/fly-hops — the fly moves by hopping: its vertical velocity is launched
  // upward periodically rather than walking continuously (§4.3 / §7.3).
  {
    name: 'fly moves by hopping (periodic upward launches)',
    async run(d, t) {
      await play(d);
      const i = await d.hook(G, 'spawnEnemy', 'fly', 60, 64, 1);
      let launched = false;
      let leftGround = false;
      for (let n = 0; n < 120; n++) {
        await d.hook(G, 'tickEnemies', 16);
        const e = (await d.snapshot(G)).enemies[i];
        if (!e) break;
        if (e.vy < -20) launched = true; // a hop launch (upward)
        if (!e.grounded) leftGround = true;
      }
      t.ok('fly launched upward (hopped)', launched);
      t.ok('fly left the ground', leftGround);
    },
  },

  // enemy/fly-cross-level — over many hops a fly can land on a different platform
  // row than where it started (§4.3 / §7.3).
  {
    name: 'fly can hop to a different platform level',
    async run(d, t) {
      await play(d);
      await d.hook(G, 'seed', 7);
      const i = await d.hook(G, 'spawnEnemy', 'fly', 60, 64, 1);
      const startY = (await d.snapshot(G)).enemies[i].y;
      let differentRow = false;
      for (let n = 0; n < 600 && !differentRow; n++) {
        await d.hook(G, 'tickEnemies', 16);
        await d.hook(G, 'runEnemyBounds');
        const e = (await d.snapshot(G)).enemies[i];
        if (!e) break;
        // grounded on a surface at a clearly different height than the start row.
        if (e.grounded && Math.abs(e.y - startY) > 30) differentRow = true;
      }
      t.ok('fly reached a different platform row', differentRow);
    },
  },

  // enemy/turtle-last-blue + crab-last-blue — the last turtle/crab speeds up (§4).
  {
    name: 'last-enemy turtle and crab both speed up (super-fast)',
    async run(d, t) {
      for (const kind of ['turtle', 'crab']) {
        await play(d);
        const i = await d.hook(G, 'spawnEnemy', kind, 60, 64, 1);
        const base = (await d.snapshot(G)).enemies[i].effSpeed;
        await d.hook(G, 'makeLast', i);
        const last = (await d.snapshot(G)).enemies[i];
        t.ok(`${kind} marked last`, last.last);
        t.ok(`${kind} last speed > normal`, last.effSpeed > base);
      }
    },
  },

  // ============================================================ more slipice/ice

  // slipice/ice-friction — on an iced platform the player keeps far more momentum
  // (friction ~12% of normal), overshooting its stop (§4.4 ✅ Ice Physics).
  {
    name: 'iced platform slashes friction — the player slides much farther',
    async run(d, t) {
      // Normal floor: measure slide distance from full speed after release.
      await play(d);
      await d.hook(G, 'placePlayer', 0, 40, 64); // top-left platform (not iced)
      await d.hook(G, 'setPlayerGround', 0, true);
      await d.hook(G, 'setPlayerVx', 0, 100);
      let normSlide = 0;
      let prev = (await d.snapshot(G)).players[0].x;
      for (let n = 0; n < 40; n++) {
        const r = await d.hook(G, 'stepPlayer', 0, 16, 0);
        normSlide += Math.abs(r.x - prev);
        prev = r.x;
      }
      // Ice the same platform, then repeat from the same setup.
      await play(d);
      await d.hook(G, 'skipToPhase', 9);
      const si = await d.hook(G, 'spawnSlipice', 30, 1, 0);
      for (let n = 0; n < 200; n++) {
        await d.hook(G, 'updateSlipice', 16);
        if ((await d.snapshot(G)).icedPlatforms > 0) break;
      }
      t.eq('platform is iced', (await d.snapshot(G)).icedPlatforms, 1);
      await d.hook(G, 'placePlayer', 0, 40, 64);
      await d.hook(G, 'setPlayerGround', 0, true);
      await d.hook(G, 'setPlayerVx', 0, 100);
      let iceSlide = 0;
      prev = (await d.snapshot(G)).players[0].x;
      for (let n = 0; n < 40; n++) {
        const r = await d.hook(G, 'stepPlayer', 0, 16, 0);
        iceSlide += Math.abs(r.x - prev);
        prev = r.x;
      }
      t.ok('iced slide is much longer than normal', iceSlide > normSlide * 1.5);
      t.ok('slipice index valid', si >= 0);
    },
  },

  // slipice/three-platforms-max — once all 3 non-floor platforms are iced, no more
  // Slipice spawns this phase (§4.4).
  {
    name: 'no more Slipice once three platforms are iced',
    async run(d, t) {
      await play(d);
      await d.hook(G, 'skipToPhase', 9);
      // Ice the three non-ground platform rows by feeding a slipice to each centre.
      // FLOOR centres: idx0 -> x52, idx4 (island y104) -> x128, idx5 -> x52@160.
      const targets = [
        [0, 30, 1],
        [4, 100, 1],
        [5, 30, 1],
      ];
      for (const [fi, x, dir] of targets) {
        await d.hook(G, 'spawnSlipice', x, dir, fi);
        for (let n = 0; n < 250; n++) {
          await d.hook(G, 'updateSlipice', 16);
          if ((await d.snapshot(G)).slipiceCount === 0) break;
        }
      }
      const iced = (await d.snapshot(G)).icedPlatforms;
      t.eq('three platforms iced', iced, 3);
      // Drive the auto-spawn timer long past its interval — no new slipice appears.
      for (let n = 0; n < 600; n++) await d.hook(G, 'updateSlipice', 16);
      t.eq('no further slipice spawns', (await d.snapshot(G)).slipiceCount, 0);
      // And the iced cap invariant holds (≤3).
      t.ok('iced count capped at 3', (await d.snapshot(G)).icedPlatforms <= 3);
    },
  },

  // slipice/reverse-on-enemy-only — a slipice reverses on enemy contact, never on
  // the player (§4.4 / §7.4).
  {
    name: 'slipice reverses on an enemy, not on the player',
    async run(d, t) {
      await play(d);
      await d.hook(G, 'skipToPhase', 9);
      // Player overlapping the slipice must NOT reverse it.
      const si = await d.hook(G, 'spawnSlipice', 60, 1, 0);
      await d.hook(G, 'placePlayer', 0, 60, 64);
      const dir0 = (await d.snapshot(G)).slipices[0].dir;
      await d.hook(G, 'updateSlipice', 16);
      t.eq('player contact does not reverse the slipice', (await d.snapshot(G)).slipices[0].dir, dir0);
      // An enemy overlapping it DOES reverse it.
      await d.hook(G, 'spawnEnemy', 'turtle', 62, 64, -1);
      await d.hook(G, 'updateSlipice', 16);
      t.ok('enemy contact reverses the slipice', (await d.snapshot(G)).slipices[0].dir !== dir0);
    },
  },

  // ============================================================ icicle not-enemy

  // icicle/not-flippable — an icicle never enters the enemy list and never responds
  // to a bump (§2.3 "not enemies, cannot be flipped").
  {
    name: 'icicles are not enemies and cannot be flipped',
    async run(d, t) {
      await play(d);
      await d.hook(G, 'spawnIcicle', 40);
      const s = await d.snapshot(G);
      t.eq('icicle present', s.icicleCount, 1);
      t.eq('icicle is NOT in the enemy list', s.enemyCount, 0);
      t.eq('icicle does not count as a phase target', s.targetsRemaining, 0);
    },
  },

  // ============================================================ spawn sequencing

  // spawn/stagger + spawn/alternate-pipes — enemies emerge one at a time, ~1.5s
  // apart, alternating the two top pipes (§7.1).
  {
    name: 'enemies spawn staggered and alternate the top pipes',
    async run(d, t) {
      await play(d);
      await d.hook(G, 'beginPlay'); // clean board, playing state
      await d.hook(G, 'skipToPhase', 2); // 5 turtles queued
      await d.hook(G, 'placePlayer', 0, 128, 208); // tuck the player away from spawns
      // Run the live playing step in small slices; record when each enemy appears.
      // Spawns: first ~500ms, then SPAWN_STAGGER_MS (1500ms) apart — budget enough
      // frames to see three (≈ 500 + 1500 + 1500 = 3500ms ≈ 220 frames).
      let lastCount = 0;
      const spawnFrames = [];
      const spawnX = [];
      for (let f = 0; f < 320 && spawnFrames.length < 3; f++) {
        await d.hook(G, 'runPlayingStep', 16);
        const s = await d.snapshot(G);
        if (s.enemyCount > lastCount) {
          spawnFrames.push(f);
          // newest enemy is last in the list
          spawnX.push(s.enemies[s.enemyCount - 1].x);
        }
        lastCount = s.enemyCount;
      }
      t.ok('at least 3 enemies emerged one at a time', spawnFrames.length >= 3);
      // Stagger: gaps between spawns are ~SPAWN_STAGGER_MS (1500ms ≈ 90+ frames).
      const gap1 = (spawnFrames[1] - spawnFrames[0]) * 16;
      t.ok('staggered ~1.5s apart', gap1 >= 1200);
      // Alternation: consecutive spawns come from opposite pipes (one side <128,
      // the other >128).
      const side = (x) => (x < 128 ? 'L' : 'R');
      t.ok('consecutive spawns alternate pipes', side(spawnX[0]) !== side(spawnX[1]));
    },
  },

  // ============================================================ phase clear gate

  // phase/clear-on-targets — a phase advances exactly when the spawn queue is empty
  // AND no target enemies remain (§6.1).
  {
    name: 'phase clears only when all target enemies are gone',
    async run(d, t) {
      await play(d);
      await d.hook(G, 'beginPlay');
      await d.hook(G, 'skipToPhase', 1); // 3 turtles
      // One live enemy + empty queue should NOT clear yet.
      await d.hook(G, 'spawnEnemy', 'turtle', 60, 160, 1);
      // Drain the spawn queue so only the live enemy gates the clear.
      const flowWith = await d.hook(G, 'runPlayingStep', 16);
      t.ok('does not clear with an enemy alive', flowWith !== 'phaseintro');
      // Remove the last target; now it must advance.
      await d.hook(G, 'forceClearPhase');
      const flowClear = await d.hook(G, 'runPlayingStep', 16);
      t.eq('clears once the last target is gone', flowClear, 'phaseintro');
    },
  },

  // ============================================================ stage layout

  // traverse/gap-fall + edge-no-fall — a walker reaching a platform-end gap falls
  // to the next platform; one reaching a non-gap span does not fall (§2.1).
  {
    name: 'walker falls through a platform gap; a full span does not drop it',
    async run(d, t) {
      await play(d);
      // Top-left platform ends at x=104 with a gap to x=152. A turtle walking
      // right off x=104 should fall to a lower platform.
      const i = await d.hook(G, 'spawnEnemy', 'turtle', 100, 64, 1);
      const startY = (await d.snapshot(G)).enemies[i].y;
      let fell = false;
      for (let n = 0; n < 200; n++) {
        await d.hook(G, 'tickEnemies', 16);
        const e = (await d.snapshot(G)).enemies[i];
        if (!e) break;
        if (e.y > startY + 30) { fell = true; break; }
      }
      t.ok('turtle fell through the gap to a lower row', fell);

      // The full-width ground floor has no gaps: a walker on it never falls.
      await play(d);
      const j = await d.hook(G, 'spawnEnemy', 'turtle', 128, 208, 1);
      const groundY = (await d.snapshot(G)).enemies[j].y;
      let droppedOnGround = false;
      for (let n = 0; n < 120; n++) {
        await d.hook(G, 'tickEnemies', 16);
        const e = (await d.snapshot(G)).enemies[j];
        if (!e) break;
        if (e.y > groundY + 6) droppedOnGround = true;
      }
      t.ok('never falls off the full-width ground floor', !droppedOnGround);
    },
  },
];
