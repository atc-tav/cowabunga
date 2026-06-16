import Phaser from 'phaser';
import { PathFollower } from '../../shared/PathFollower';
import {
  WIDTH,
  EnemyType,
  FORM_COLS,
  FORM_COL_GAP,
  FORM_ROW_GAP,
  FORM_TOP,
  ENEMY_SCORE,
  ENTRY_STAGGER_MS,
} from './constants';
import { enemyFrame } from './sprites';
import { makeEntryPath } from './entryPaths';

export type EnemyState = 'entering' | 'formed' | 'diving' | 'capturing';

export interface Enemy {
  sprite: Phaser.GameObjects.Image;
  type: EnemyType;
  points: number;
  home: { x: number; y: number };
  follower: PathFollower;
  startDelay: number;
  elapsed: number;
  state: EnemyState;
  fireTimer: number;
  hasCaptive: boolean;
}

const ROW_TYPES: EnemyType[] = ['boss', 'butterfly', 'butterfly', 'bee', 'bee'];
const BOSS_COLUMNS = [2, 3, 4, 5];

/**
 * Build the formation as a fly-in: every enemy starts off-screen and follows a
 * scripted curve to its slot on a stagger. Once arrived, the scene takes over
 * the breathing sway.
 */
export function buildFormation(scene: Phaser.Scene, entrySpeed: number): Enemy[] {
  const enemies: Enemy[] = [];
  const startX = WIDTH / 2 - ((FORM_COLS - 1) * FORM_COL_GAP) / 2;
  let index = 0;

  ROW_TYPES.forEach((type, row) => {
    const y = FORM_TOP + row * FORM_ROW_GAP;
    for (let col = 0; col < FORM_COLS; col++) {
      if (type === 'boss' && !BOSS_COLUMNS.includes(col)) {
        continue;
      }
      const home = { x: startX + col * FORM_COL_GAP, y };
      const fromLeft = index % 2 === 0;
      const points = makeEntryPath(home, fromLeft);
      const sprite = scene.add.image(points[0].x, points[0].y, enemyFrame(type, 0)).setDepth(8);
      enemies.push({
        sprite,
        type,
        points: ENEMY_SCORE[type],
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
