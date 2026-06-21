import { PlatformSegment } from '../../shared/Platformer';
import { EnemyKind } from './enemies';
import { PLATFORM_THICKNESS } from './constants';

export interface GrassSpawn {
  x: number; // centre on the ground
  /** Deterministic item this tuft yields, fixed at level load (spec §3.5). */
  item: 'veg';
}
export interface EnemySpawn {
  kind: EnemyKind;
  x: number;
  dir: 1 | -1;
}
export interface PointSpawn {
  x: number;
  y: number;
}

export interface LevelData {
  name: string;
  width: number;
  height: number;
  groundY: number; // top surface of the main ground
  platforms: PlatformSegment[];
  start: { x: number };
  grass: GrassSpawn[];
  jars: PointSpawn[];
  enemies: EnemySpawn[];
  cherries: PointSpawn[];
  crystal: PointSpawn; // grab to open the gate
  gate: PointSpawn; // mask gate — the exit
}

const GROUND_Y = 200;
const W = 1760;

// A floating ledge: standing surface with a solid underside (thickness) so a
// rising jump bonks it, matching the shared PlatformerBody contract.
const ledge = (x1: number, x2: number, y: number): PlatformSegment => ({
  x1,
  x2,
  y1: y,
  y2: y,
  thickness: PLATFORM_THICKNESS,
});

// Main ground with one jumpable pit (lethal) around x=520..584.
const ground = (x1: number, x2: number): PlatformSegment => ({ x1, x2, y1: GROUND_Y, y2: GROUND_Y });

/**
 * World 1-1 — a hand-authored horizontal Grasslands slice. The spec (§14) flags
 * full ROM-accurate geometry as out of scope, so this is an original layout that
 * exercises every system in the slice: plucking grass, carrying/throwing veggies
 * and enemies, a spawn jar, cherries → Starman, and the Crystal Ball → Mask Gate
 * exit.
 */
export const WORLD_1_1: LevelData = {
  name: 'WORLD 1-1',
  width: W,
  height: 224,
  groundY: GROUND_Y,
  platforms: [
    ground(0, 520),
    ground(584, W),
    ledge(300, 392, 150),
    ledge(700, 824, 150),
    ledge(900, 980, 120),
    ledge(1180, 1300, 150),
    ledge(1320, 1420, 110),
  ],
  start: { x: 48 },
  grass: [
    { x: 150, item: 'veg' },
    { x: 230, item: 'veg' },
    { x: 430, item: 'veg' },
    { x: 660, item: 'veg' },
    { x: 1080, item: 'veg' },
    { x: 1480, item: 'veg' },
  ],
  jars: [{ x: 1000, y: GROUND_Y }],
  enemies: [
    { kind: 'shyRed', x: 340, dir: -1 },
    { kind: 'shyPink', x: 470, dir: 1 },
    { kind: 'tweeter', x: 760, dir: -1 },
    { kind: 'shyPink', x: 760, dir: 1 },
    { kind: 'shyRed', x: 1240, dir: -1 },
    { kind: 'tweeter', x: 1360, dir: -1 },
  ],
  cherries: [
    { x: 346, y: 134 },
    { x: 660, y: 184 },
    { x: 762, y: 134 },
    { x: 940, y: 104 },
    { x: 1360, y: 94 },
  ],
  crystal: { x: 1500, y: 168 },
  gate: { x: 1690, y: GROUND_Y - 24 },
};
