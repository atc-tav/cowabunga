import Phaser from 'phaser';
import { PlatformerBody } from '../../shared/Platformer';
import { TX } from './sprites';
import { SHYGUY_W, SHYGUY_H, TWEETER_W, TWEETER_H, SHYGUY_SPEED, TWEETER_SPEED, SCORE } from './constants';

export type EnemyKind = 'shyRed' | 'shyPink' | 'tweeter';

export interface EnemyKindConfig {
  w: number;
  h: number;
  speed: number;
  /** Pink Shy Guys turn at ledges; red ones walk off (spec §8.1). */
  turnsAtLedge: boolean;
  /** Tweeter hops in arcs (spec §4.2). */
  hops: boolean;
  /** Thrown body bounces on and kills more enemies (false only for Ostro). */
  chainKills: boolean;
  canBePickedUp: boolean;
  score: number;
  tex: [string, string];
  frameMs: number;
}

export const ENEMY_KINDS: Record<EnemyKind, EnemyKindConfig> = {
  shyRed: {
    w: SHYGUY_W,
    h: SHYGUY_H,
    speed: SHYGUY_SPEED,
    turnsAtLedge: false,
    hops: false,
    chainKills: true,
    canBePickedUp: true,
    score: SCORE.shyGuy,
    tex: [TX.shyRed0, TX.shyRed1],
    frameMs: 200,
  },
  shyPink: {
    w: SHYGUY_W,
    h: SHYGUY_H,
    speed: SHYGUY_SPEED,
    turnsAtLedge: true,
    hops: false,
    chainKills: true,
    canBePickedUp: true,
    score: SCORE.shyGuy,
    tex: [TX.shyPink0, TX.shyPink1],
    frameMs: 200,
  },
  tweeter: {
    w: TWEETER_W,
    h: TWEETER_H,
    speed: TWEETER_SPEED,
    turnsAtLedge: true,
    hops: true,
    chainKills: true,
    canBePickedUp: true,
    score: SCORE.tweeter,
    tex: [TX.tweeter0, TX.tweeter1],
    frameMs: 200,
  },
};

export type EnemyState = 'patrol';

/** A live enemy. AI is driven by the scene (it owns the level geometry); the
 *  shared PlatformerBody handles gravity, landing, and ledges. */
export interface Enemy {
  kind: EnemyKind;
  cfg: EnemyKindConfig;
  sprite: Phaser.GameObjects.Image;
  body: PlatformerBody;
  dir: 1 | -1;
  hopTimer: number;
  frame: 0 | 1;
  frameTimer: number;
  alive: boolean;
  /** Marks enemies that emerged from a spawn jar, for the alive-cap accounting. */
  fromJar: boolean;
}

export function createEnemy(
  scene: Phaser.Scene,
  kind: EnemyKind,
  x: number,
  feetY: number,
  dir: 1 | -1,
  fromJar = false,
): Enemy {
  const cfg = ENEMY_KINDS[kind];
  const body = new PlatformerBody(x, feetY - cfg.h / 2, cfg.w, cfg.h);
  body.onGround = true;
  const sprite = scene.add.image(x, feetY, cfg.tex[0]).setOrigin(0.5, 1).setDepth(8);
  return {
    kind,
    cfg,
    sprite,
    body,
    dir,
    hopTimer: Phaser.Math.Between(400, 1200),
    frame: 0,
    frameTimer: 0,
    alive: true,
    fromJar,
  };
}
