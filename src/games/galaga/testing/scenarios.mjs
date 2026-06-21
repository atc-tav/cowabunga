// Galaga scenario suite — locks in the P0 rules/scoring work and the
// dual-fighter aim fix. Run with:  npm run test:game -- galaga
const G = 'galaga';
const KEY = 'game-galaga';
const FORM_COL_GAP = 22; // dual ships sit one formation column apart

export const scenarios = [
  {
    name: 'formation is 40 enemies (4 boss / 16 butterfly / 20 bee)',
    async run(d, t) {
      await d.start(KEY);
      const c = await d.hook(G, 'composition');
      t.eq('total 40', c.total, 40);
      t.eq('4 boss', c.boss, 4);
      t.eq('16 butterfly', c.butterfly, 16);
      t.eq('20 bee', c.bee, 20);
    },
  },
  {
    name: 'Boss Galaga takes 2 hits, turns red after the first',
    async run(d, t) {
      await d.start(KEY);
      await d.hook(G, 'isolateBoss'); // leave only the Boss at index 0
      await d.hook(G, 'setEnemyPos', 0, 30, 30);
      await d.hook(G, 'clearBullets');
      await d.hook(G, 'injectBullet', 30, 30);
      await d.hook(G, 'runCheckHits');
      const info = await d.hook(G, 'enemyInfo', 0);
      t.ok('survives first hit', info.alive);
      t.eq('hits now 1', info.hits, 1);
      t.ok('flagged damaged', info.damaged);
      t.eq('red texture', info.tex, 'galaga-boss-hit');
      const scoreBefore = (await d.snapshot(G)).score;
      await d.hook(G, 'injectBullet', 30, 30);
      await d.hook(G, 'runCheckHits');
      const scoreAfter = (await d.snapshot(G)).score;
      t.eq('destroyed on 2nd hit', await d.hook(G, 'enemyCount'), 0);
      t.eq('worth 400 (attacking)', scoreAfter - scoreBefore, 400);
    },
  },
  {
    name: 'scoring — formation vs attacking values',
    async run(d, t) {
      await d.start(KEY);
      t.eq('bee 50/100', await d.hook(G, 'scoreCheck', 'bee'), { formed: 50, diving: 100 });
      t.eq('butterfly 80/160', await d.hook(G, 'scoreCheck', 'butterfly'), { formed: 80, diving: 160 });
      t.eq('boss 150/400', await d.hook(G, 'scoreCheck', 'boss'), { formed: 150, diving: 400 });
    },
  },
  {
    name: 'extra life at 20,000, next threshold 70,000',
    async run(d, t) {
      await d.start(KEY);
      await d.hook(G, 'setScore', 19999);
      await d.hook(G, 'forceExtraLifeCheck');
      const before = (await d.snapshot(G)).lives;
      await d.hook(G, 'setScore', 20000);
      await d.hook(G, 'forceExtraLifeCheck');
      const s = await d.snapshot(G);
      t.eq('gained a life', s.lives, before + 1);
      t.eq('next at 70k', s.nextExtraLife, 70000);
    },
  },
  {
    name: 'single fighter — max 2 bullets on screen',
    async run(d, t) {
      await d.start(KEY);
      await d.hook(G, 'clearBullets');
      for (let i = 0; i < 4; i++) await d.hook(G, 'fire');
      t.eq('capped at 2', (await d.snapshot(G)).bulletCount, 2);
    },
  },
  {
    name: 'dual fighter — twin shots one column apart, max 4 bullets',
    async run(d, t) {
      await d.start(KEY);
      await d.hook(G, 'setDual', true);
      await d.hook(G, 'clearBullets');
      await d.hook(G, 'fire');
      const xs = await d.hook(G, 'bulletXs');
      t.eq('two shots', xs.length, 2);
      t.eq('one column apart', Math.abs(xs[0] - xs[1]), FORM_COL_GAP);
      for (let i = 0; i < 4; i++) await d.hook(G, 'fire');
      t.eq('capped at 4', (await d.snapshot(G)).bulletCount, 4);
    },
  },
];
