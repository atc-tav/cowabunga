import Phaser from 'phaser';
import {
  WIDTH,
  EnemyType,
  FORM_COLS,
  FORM_COL_GAP,
  FORM_ROW_GAP,
  FORM_TOP,
  ENEMY_SCORE,
} from './constants';
import { enemyFrame } from './sprites';

export interface Enemy {
  sprite: Phaser.GameObjects.Image;
  type: EnemyType;
  points: number;
}

// Which enemy type sits on each formation row (top -> bottom).
const ROW_TYPES: EnemyType[] = ['boss', 'butterfly', 'butterfly', 'bee', 'bee'];
// Bosses only occupy the centre columns of the top row.
const BOSS_COLUMNS = [2, 3, 4, 5];

/**
 * Build the classic Galaga block formation: a boss row up top, butterflies in
 * the middle, bees at the bottom. Static placement for this slice — the
 * scripted fly-in entrance comes next.
 */
export function buildFormation(scene: Phaser.Scene): Enemy[] {
  const enemies: Enemy[] = [];
  const startX = WIDTH / 2 - ((FORM_COLS - 1) * FORM_COL_GAP) / 2;

  ROW_TYPES.forEach((type, row) => {
    const y = FORM_TOP + row * FORM_ROW_GAP;
    for (let col = 0; col < FORM_COLS; col++) {
      if (type === 'boss' && !BOSS_COLUMNS.includes(col)) {
        continue;
      }
      const x = startX + col * FORM_COL_GAP;
      const sprite = scene.add.image(x, y, enemyFrame(type, 0)).setDepth(8);
      enemies.push({ sprite, type, points: ENEMY_SCORE[type] });
    }
  });

  return enemies;
}
