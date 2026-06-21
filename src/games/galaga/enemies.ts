import Phaser from 'phaser';
import { PathFollower } from '../../shared/PathFollower';
import {
  WIDTH,
  EnemyType,
  FORM_COL_GAP,
  FORM_ROW_GAP,
  FORM_TOP,
  ENEMY_SCORE_FORMATION,
  ENEMY_SCORE_ATTACK,
  BOSS_HITS,
  ENTRY_STAGGER_MS,
} from './constants';
import { enemyFrame } from './sprites';
import { makeEntryPath } from './entryPaths';

export type EnemyState = 'entering' | 'formed' | 'diving' | 'capturing' | 'challenge';

export interface Enemy {
  sprite: Phaser.GameObjects.Image;
  type: EnemyType;
  /** points when shot while seated in formation. */
  points: number;
  /** points when shot while flying in / diving / capturing. */
  attackPoints: number;
  /** remaining hits to destroy (Boss Galaga = 2, others = 1). */
  hits: number;
  /** Boss Galaga that has taken its first hit (renders damaged). */
  damaged: boolean;
  home: { x: number; y: number };
  follower: PathFollower;
  startDelay: number;
  elapsed: number;
  state: EnemyState;
  fireTimer: number;
  hasCaptive: boolean;
}

// 40-enemy formation on a shared 10-wide column grid: a centered Boss row of 4,
// two Butterfly rows of 8, and two Bee rows of 10. Narrower rows centre on the
// same grid so every row's columns line up vertically.
const GRID_COLS = 10;
const ROW_SPEC: { type: EnemyType; count: number }[] = [
  { type: 'boss', count: 4 },
  { type: 'butterfly', count: 8 },
  { type: 'butterfly', count: 8 },
  { type: 'bee', count: 10 },
  { type: 'bee', count: 10 },
];

/**
 * Build the formation as a fly-in: every enemy starts off-screen and follows a
 * scripted curve to its slot on a stagger. Once arrived, the scene takes over
 * the breathing sway.
 */
export function buildFormation(scene: Phaser.Scene, entrySpeed: number): Enemy[] {
  const enemies: Enemy[] = [];
  const gridStartX = WIDTH / 2 - ((GRID_COLS - 1) * FORM_COL_GAP) / 2;
  let index = 0;

  ROW_SPEC.forEach((spec, row) => {
    const y = FORM_TOP + row * FORM_ROW_GAP;
    const startCol = (GRID_COLS - spec.count) / 2;
    for (let k = 0; k < spec.count; k++) {
      const home = { x: gridStartX + (startCol + k) * FORM_COL_GAP, y };
      const fromLeft = index % 2 === 0;
      const points = makeEntryPath(home, fromLeft);
      const sprite = scene.add.image(points[0].x, points[0].y, enemyFrame(spec.type, 0)).setDepth(8);
      enemies.push({
        sprite,
        type: spec.type,
        points: ENEMY_SCORE_FORMATION[spec.type],
        attackPoints: ENEMY_SCORE_ATTACK[spec.type],
        hits: spec.type === 'boss' ? BOSS_HITS : 1,
        damaged: false,
        home,
        follower: new PathFollower(points, entrySpeed),
        startDelay: index * ENTRY_STAGGER_MS,
        elapsed: 0,
        state: 'entering',
        fireTimer: 0,
        hasCaptive: false,
      });
      index++;
    }
  });

  return enemies;
}
