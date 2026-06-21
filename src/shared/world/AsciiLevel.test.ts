import { describe, it, expect } from 'vitest';
import { parseAsciiLevel } from './AsciiLevel';

const LEGEND = {
  X: { solid: true },
  P: { spawn: true },
  E: { spawn: true },
};

describe('parseAsciiLevel', () => {
  const rows = [
    '          ',
    '   P    E ',
    'XXXXXXXXXX',
  ];
  const parsed = parseAsciiLevel(rows, LEGEND, { tileSize: 16 });

  it('reports level dimensions in tiles and pixels', () => {
    expect(parsed.cols).toBe(10);
    expect(parsed.rows).toBe(3);
    expect(parsed.pixelWidth).toBe(160);
    expect(parsed.pixelHeight).toBe(48);
  });

  it('marks legend solids as solid and empties as clear', () => {
    expect(parsed.world.isSolid(0, 2)).toBe(true); // floor
    expect(parsed.world.isSolid(0, 0)).toBe(false); // sky
    expect(parsed.world.isSolid(-1, 2)).toBe(false); // out of bounds ⇒ not solid
  });

  it('extracts spawns at tile centres and erases their tiles', () => {
    const player = parsed.spawns.find((s) => s.char === 'P');
    const enemy = parsed.spawns.find((s) => s.char === 'E');
    expect(player).toMatchObject({ col: 3, row: 1, x: 3 * 16 + 8, y: 1 * 16 + 8 });
    expect(enemy).toMatchObject({ col: 8, row: 1 });

    // A spawn marker is not a solid tile and leaves an empty cell behind.
    expect(parsed.world.isSolid(3, 1)).toBe(false);
    expect(parsed.world.tileAt(3, 1)).toBe(' ');
  });

  it('pads ragged rows to the widest row', () => {
    const ragged = parseAsciiLevel(['X', 'XXXX'], { X: { solid: true } }, { tileSize: 8 });
    expect(ragged.cols).toBe(4);
    expect(ragged.world.isSolid(3, 1)).toBe(true);
    expect(ragged.world.isSolid(3, 0)).toBe(false); // padded empty
  });

  it('honours a world offset when placing spawns', () => {
    const offset = parseAsciiLevel(['P'], LEGEND, { tileSize: 16, offsetX: 100, offsetY: 50 });
    expect(offset.spawns[0]).toMatchObject({ x: 100 + 8, y: 50 + 8 });
  });
});
