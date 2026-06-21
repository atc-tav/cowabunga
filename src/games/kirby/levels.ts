import { PlatformSegment, surfaceY } from '../../shared/Platformer';
import type { EnemyKindId } from './enemies';

/**
 * Vegetable Valley 1-1 — the first vertical slice's single stage. A short
 * 3-screen horizontal room: solid grass with one hover-the-gap pit, two
 * floating ledges, four enemies (two of which grant a Copy Ability), and a
 * goal door at the far right. Full ROM-accurate geometry is a later content
 * pass (spec §14 flags level data as unauthored).
 */

export const GROUND_Y = 188; // px — top surface of the grass (feet rest here)
export const STAGE_WIDTH = 1216; // px — ~5 screens wide

/** Solid terrain. `thickness` marks a segment as standing-on ground. */
export const TERRAIN: PlatformSegment[] = [
  { x1: 0, x2: 284, y1: GROUND_Y, y2: GROUND_Y, thickness: 40 }, // left grass
  { x1: 344, x2: STAGE_WIDTH, y1: GROUND_Y, y2: GROUND_Y, thickness: 40 }, // right grass (after the pit)
  { x1: 120, x2: 196, y1: 150, y2: 150, thickness: 8 }, // floating ledge A
  { x1: 432, x2: 520, y1: 138, y2: 138, thickness: 8 }, // floating ledge B
  { x1: 820, x2: 900, y1: 150, y2: 150, thickness: 8 }, // floating ledge C
];

/** The pit between the two grass spans — fall in and you lose a life (§2.3). */
export const PIT = { x1: 284, x2: 344 } as const;

export const KIRBY_START = { x: 36, y: GROUND_Y };

/** Goal door — touch it to clear the stage. */
export const DOOR_POS = { x: 1180, y: GROUND_Y };

export interface EnemySpawn {
  kind: EnemyKindId;
  x: number;
  y: number;
  /** Patrol bounds for ground walkers (ignored by flyers). */
  minX?: number;
  maxX?: number;
}

export const ENEMY_SPAWNS: EnemySpawn[] = [
  { kind: 'waddleDee', x: 150, y: GROUND_Y, minX: 24, maxX: 260 },
  { kind: 'waddleDee', x: 160, y: 150, minX: 124, maxX: 192 },
  { kind: 'bronto', x: 314, y: 120 }, // hovers over the pit
  { kind: 'waddleDoo', x: 430, y: GROUND_Y, minX: 360, maxX: 560 }, // → Beam
  { kind: 'sparky', x: 620, y: GROUND_Y, minX: 560, maxX: 700 }, // → Spark
  { kind: 'sirKibble', x: 760, y: GROUND_Y, minX: 700, maxX: 800 }, // → Cutter
  { kind: 'hotHead', x: 880, y: GROUND_Y, minX: 820, maxX: 940 }, // → Fire
  { kind: 'rocky', x: 1010, y: GROUND_Y, minX: 960, maxX: 1060 }, // → Stone
  { kind: 'chilly', x: 1110, y: GROUND_Y, minX: 1070, maxX: 1150 }, // → Freeze
];

/** Topmost terrain surface directly under world x, or undefined over a pit. */
export function surfaceAt(x: number): number | undefined {
  let best: number | undefined;
  for (const s of TERRAIN) {
    if (x < s.x1 || x > s.x2) {
      continue;
    }
    const sy = surfaceY(s, x);
    if (best === undefined || sy < best) {
      best = sy;
    }
  }
  return best;
}
