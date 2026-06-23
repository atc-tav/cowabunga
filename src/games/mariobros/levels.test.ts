// Mode-1 unit tests for the static stage layout (pure data — no Phaser/DOM).
// Traces to the Oracle Ledger rows stage/platform-rows and stage/pipes-present
// (specs/mario-bros-arcade.md §2.1, §2.2).
import { describe, it, expect } from 'vitest';
import { FLOORS, PIPES, topPipeSpawns, bottomPipeZones } from './levels';
import { WIDTH } from './constants';

describe('stage/platform-rows (§2.1)', () => {
  it('defines four platform rows top→bottom', () => {
    // Group segment heights into rows (the middle row is split into side
    // platforms at y112 + a slightly raised centre island at y104).
    const ys = [...new Set(FLOORS.map((f) => f.y1))].sort((a, b) => a - b);
    const rows = ys.reduce<number[]>((acc, y) => {
      if (acc.length === 0 || y - acc[acc.length - 1] > 12) acc.push(y);
      return acc;
    }, []);
    // top (~64), middle (~104-112), lower-mid (160), floor (208).
    expect(rows.length).toBe(4);
    expect(rows[0]).toBe(64); // top
    expect(rows[rows.length - 1]).toBe(208); // floor
  });

  it('the floor is full-width with no gaps', () => {
    const floor = FLOORS.filter((f) => f.y1 === 208);
    expect(floor.length).toBe(1);
    expect(floor[0].x1).toBe(0);
    expect(floor[0].x2).toBe(WIDTH);
  });

  it('upper rows have edge gaps (not full-width) so walkers can fall through', () => {
    // Top and lower-mid rows are split into two spans with a centre gap.
    const top = FLOORS.filter((f) => f.y1 === 64);
    expect(top.length).toBeGreaterThan(1);
    const covered = top.some((f) => f.x1 === 0) && top.some((f) => f.x2 === WIDTH);
    const hasGap = Math.max(...top.map((f) => f.x1)) > Math.min(...top.map((f) => f.x2));
    expect(covered).toBe(true); // reaches both edges (for wrap)
    expect(hasGap).toBe(true); // but with a centre gap
  });
});

describe('stage/pipes-present (§2.2)', () => {
  it('has exactly 4 pipes: 2 top (spawn) + 2 bottom (exit)', () => {
    expect(PIPES.length).toBe(4);
    expect(PIPES.filter((p) => p.role === 'top').length).toBe(2);
    expect(PIPES.filter((p) => p.role === 'bottom').length).toBe(2);
  });

  it('top pipes sit at the corners and yield two distinct spawn points', () => {
    const spawns = topPipeSpawns();
    expect(spawns.length).toBe(2);
    // One spawns walking right (left pipe), one walking left (right pipe).
    expect(spawns.map((s) => s.dir).sort()).toEqual([-1, 1]);
    // They are on opposite sides of the screen.
    const xs = spawns.map((s) => s.x).sort((a, b) => a - b);
    expect(xs[0]).toBeLessThan(WIDTH / 2);
    expect(xs[1]).toBeGreaterThan(WIDTH / 2);
  });

  it('bottom pipes define exit zones at both floor corners', () => {
    const zones = bottomPipeZones();
    expect(zones.length).toBe(2);
    expect(Math.min(...zones.map(([a]) => a))).toBe(0); // left zone reaches x=0
    expect(Math.max(...zones.map(([, b]) => b))).toBe(WIDTH); // right reaches x=W
  });
});
