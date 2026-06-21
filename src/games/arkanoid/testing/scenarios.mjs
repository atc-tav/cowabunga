// Arkanoid scenario suite — the manual verification pass, codified as
// repeatable tests. Run with:  npm run test:game -- arkanoid
//
// Each scenario gets (driver, t): `driver` drives the paused scene via the
// game's test surface; `t` collects assertions. Invariants are checked after
// every scenario by the runner.
const G = 'arkanoid';
const KEY = 'game-arkanoid';
const CENTER = 112; // Vaus rest x (screen 224 wide)

export const scenarios = [
  {
    name: 'capsule E — enlarge, second is a no-op',
    async run(d, t) {
      await d.start(KEY);
      await d.hook(G, 'setVausMode', 'normal');
      await d.hook(G, 'applyCapsule', 'E');
      let s = await d.snapshot(G);
      t.ok('enlarged', s.enlarged);
      t.eq('width 44', s.vausWidth, 44);
      await d.hook(G, 'applyCapsule', 'E');
      s = await d.snapshot(G);
      t.eq('still 44 (no double)', s.vausWidth, 44);
    },
  },
  {
    name: 'capsule L/C — mutually exclusive',
    async run(d, t) {
      await d.start(KEY);
      await d.hook(G, 'applyCapsule', 'L');
      let s = await d.snapshot(G);
      t.eq('L -> laser', s.vausMode, 'laser');
      t.ok('L clears catch', !s.catchMode);
      await d.hook(G, 'applyCapsule', 'C');
      s = await d.snapshot(G);
      t.eq('C -> normal', s.vausMode, 'normal');
      t.ok('C sets catch', s.catchMode);
      await d.hook(G, 'applyCapsule', 'L');
      s = await d.snapshot(G);
      t.eq('L again -> laser', s.vausMode, 'laser');
      t.ok('L clears catch again', !s.catchMode);
    },
  },
  {
    name: 'capsule S — drops ball speed to 1.5',
    async run(d, t) {
      await d.start(KEY);
      await d.hook(G, 'setBallSpeed', 3.0);
      await d.hook(G, 'applyCapsule', 'S');
      const s = await d.snapshot(G);
      t.approx('speed ~1.5', s.ballSpeed, 1.5, 0.001);
    },
  },
  {
    name: 'capsule P — extra life',
    async run(d, t) {
      await d.start(KEY);
      const before = (await d.snapshot(G)).lives;
      await d.hook(G, 'applyCapsule', 'P');
      t.eq('+1 life', (await d.snapshot(G)).lives, before + 1);
    },
  },
  {
    name: 'capsule D — splits into 3 balls',
    async run(d, t) {
      await d.start(KEY);
      await d.hook(G, 'clearBalls');
      await d.hook(G, 'spawnBall', CENTER, 200, 0.2, -0.97, false);
      await d.hook(G, 'applyCapsule', 'D');
      t.eq('3 balls', (await d.snapshot(G)).ballCount, 3);
    },
  },
  {
    name: 'capsule B — opens the break portal',
    async run(d, t) {
      await d.start(KEY);
      await d.hook(G, 'applyCapsule', 'B');
      t.ok('portal open', (await d.snapshot(G)).portalOpen);
    },
  },
  {
    name: 'laser destroys a brick and is consumed',
    async run(d, t) {
      await d.start(KEY);
      await d.hook(G, 'startPlaying'); // lasers only act during play
      const brick = await d.hook(G, 'firstAliveBrick');
      const before = (await d.snapshot(G)).destroyableRemaining;
      // place the beam just below the brick so it rises into it (real geometry)
      await d.hook(G, 'pushLaser', brick.x, brick.y + 6);
      await d.hook(G, 'updateLasers', 16);
      const s = await d.snapshot(G);
      t.eq('one fewer brick', before - s.destroyableRemaining, 1);
      t.eq('beam consumed', s.laserCount, 0);
    },
  },
  {
    name: 'catch — ball sticks to paddle, releases upward',
    async run(d, t) {
      await d.start(KEY);
      await d.hook(G, 'setCatchMode', true);
      await d.hook(G, 'clearBalls');
      const i = await d.hook(G, 'spawnBall', CENTER, 235, 0, 1, false);
      const caught = await d.hook(G, 'resolvePaddle', i);
      t.ok('caught on contact', caught);
      await d.hook(G, 'releaseBall', i);
      const dir = await d.hook(G, 'ballDir', i);
      t.ok('released upward', dir.diry < 0);
      t.ok('no longer caught', !dir.caught);
    },
  },
  {
    name: 'enemy — deflects ball both axes, dies to laser not ball',
    async run(d, t) {
      await d.start(KEY);
      const e = await d.hook(G, 'spawnEnemy', 'unira');
      await d.hook(G, 'clearBalls');
      const i = await d.hook(G, 'spawnBall', e.x, e.y, 0.4, -0.9, false);
      const before = await d.hook(G, 'ballDir', i);
      await d.hook(G, 'setEnemyPos', e.index, e.x, e.y);
      await d.hook(G, 'resolveEnemies', i);
      const after = await d.hook(G, 'ballDir', i);
      t.ok('vx flipped', Math.sign(after.dirx) !== Math.sign(before.dirx));
      t.ok('vy flipped', Math.sign(after.diry) !== Math.sign(before.diry));
      t.ok('ball did not kill enemy', (await d.hook(G, 'enemyCount')) >= 1);
      t.ok('laser kills enemy', await d.hook(G, 'killEnemyAt', e.x, e.y));
    },
  },
  {
    name: 'multiball — life lost only when all balls are gone',
    async run(d, t) {
      await d.start(KEY);
      await d.hook(G, 'startPlaying');
      await d.hook(G, 'clearBalls');
      const a = await d.hook(G, 'spawnBall', 60, 230, 0, 1, false);
      const b = await d.hook(G, 'spawnBall', 100, 230, 0, 1, false);
      await d.hook(G, 'spawnBall', 140, 200, 0, 1, false);
      await d.hook(G, 'setBall', a, 60, 999, 0, 1, false);
      await d.hook(G, 'setBall', b, 100, 999, 0, 1, false);
      await d.hook(G, 'updateBalls', 16);
      let s = await d.snapshot(G);
      t.eq('one ball survives', s.ballCount, 1);
      t.eq('still playing', s.flow, 'playing');
      await d.hook(G, 'setBall', 0, 140, 999, 0, 1, false);
      await d.hook(G, 'updateBalls', 16);
      s = await d.snapshot(G);
      t.eq('no balls left', s.ballCount, 0);
      t.eq('now dying', s.flow, 'dying');
    },
  },
  {
    name: 'extra life — awarded crossing 20,000',
    async run(d, t) {
      await d.start(KEY);
      await d.hook(G, 'setScore', 19999);
      await d.hook(G, 'forceExtraLifeCheck');
      const before = (await d.snapshot(G)).lives;
      await d.hook(G, 'setScore', 20000);
      await d.hook(G, 'forceExtraLifeCheck');
      t.eq('gained a life at 20k', (await d.snapshot(G)).lives, before + 1);
    },
  },
  {
    name: 'DOH — laser does nothing, 16 ball hits = victory',
    async run(d, t) {
      await d.start(KEY);
      await d.hook(G, 'loadStage', 33);
      let s = await d.snapshot(G);
      t.ok('DOH active', s.dohActive);
      t.eq('16 hits to start', s.dohHits, 16);
      const c = await d.hook(G, 'dohCenter');
      await d.hook(G, 'pushLaser', c.x, c.y);
      await d.hook(G, 'updateLasers', 16);
      s = await d.snapshot(G);
      t.eq('laser no effect', s.dohHits, 16);
      t.eq('beam consumed by DOH', s.laserCount, 0);
      await d.hook(G, 'registerDohHits', 16);
      s = await d.snapshot(G);
      t.eq('DOH defeated', s.dohHits, 0);
      t.eq('victory', s.flow, 'victory');
    },
  },
  {
    name: 'DOH — projectile on the Vaus is instant death',
    async run(d, t) {
      await d.start(KEY);
      await d.hook(G, 'loadStage', 33);
      await d.hook(G, 'startPlaying');
      await d.hook(G, 'spawnProjectileOnVaus');
      await d.hook(G, 'moveProjectiles', 16);
      t.eq('dying', (await d.snapshot(G)).flow, 'dying');
    },
  },
];
