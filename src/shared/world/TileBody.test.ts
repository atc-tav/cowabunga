import { describe, it, expect } from 'vitest';
import { TileBody } from './TileBody';
import { TileSolids } from './TileWorld';

/** A tiny hand-rolled solids map for tests: a set of "col,row" solid cells. */
function solids(
  cells: Array<[number, number]>,
  tileSize = 16,
  offsetX = 0,
  offsetY = 0,
): TileSolids {
  const set = new Set(cells.map(([c, r]) => `${c},${r}`));
  return {
    tileSize,
    offsetX,
    offsetY,
    isSolid: (col, row) => set.has(`${col},${row}`),
  };
}

const GRAVITY = 1000;

describe('TileBody vertical collision', () => {
  it('falls and lands exactly on top of a floor tile', () => {
    // Floor at row 10 across columns 0..4; body centred over col 2, above it.
    const floor = solids([
      [0, 10],
      [1, 10],
      [2, 10],
      [3, 10],
      [4, 10],
    ]);
    const body = new TileBody(40, 100, 12, 16); // centre over col 2 (x 32..48)

    // Simulate ~2s of falling in 16ms steps.
    for (let i = 0; i < 120; i++) {
      body.update(16, GRAVITY, floor);
    }

    // Floor top is at row 10 * 16 = 160; feet should rest there.
    expect(body.onGround).toBe(true);
    expect(body.bottom).toBeCloseTo(160, 5);
    expect(body.vy).toBe(0);
  });

  it('bonks its head on a ceiling when jumping', () => {
    const ceiling = solids([[2, 4]]); // single block at col 2, row 4 (y 64..80)
    const body = new TileBody(40, 120, 12, 16);
    body.onGround = true;
    body.jump(400);

    let hitCeiling = false;
    for (let i = 0; i < 60; i++) {
      body.update(16, GRAVITY, ceiling);
      if (body.contacts.ceiling) {
        hitCeiling = true;
        break;
      }
    }

    expect(hitCeiling).toBe(true);
    // Head pinned to the underside of the block (bottom edge = 80).
    expect(body.top).toBeCloseTo(80, 5);
    expect(body.vy).toBe(0);
  });
});

describe('TileBody horizontal collision', () => {
  it('stops against a wall to its right', () => {
    const wall = solids([
      [5, 0],
      [5, 1],
      [5, 2],
    ]); // wall column at col 5 (x 80..96)
    const body = new TileBody(40, 16, 12, 16); // centred in row 1
    for (let i = 0; i < 60; i++) {
      body.vx = 200; // a scene re-applies input intent every frame
      body.update(16, 0, wall);
    }

    expect(body.contacts.right).toBe(true);
    // Right edge pinned to the wall's left face (x = 80).
    expect(body.right).toBeCloseTo(80, 5);
    expect(body.vx).toBe(0);
  });

  it('walks along a floor without snagging on it sideways', () => {
    const floor = solids([
      [0, 2],
      [1, 2],
      [2, 2],
      [3, 2],
      [4, 2],
      [5, 2],
    ]); // floor at row 2 (top y = 32)
    const body = new TileBody(8, 24, 12, 16); // centre 24 ⇒ feet at 32 = floor top
    body.onGround = true;

    for (let i = 0; i < 30; i++) {
      body.vx = 120;
      body.update(16, GRAVITY, floor);
      // Never falsely reports a side contact while strolling along the floor.
      expect(body.contacts.right).toBe(false);
    }

    expect(body.onGround).toBe(true);
    expect(body.x).toBeGreaterThan(8); // actually moved right
  });
});
