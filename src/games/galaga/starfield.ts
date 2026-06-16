import Phaser from 'phaser';
import { STAR_COUNT, STAR_SPEEDS } from './constants';
import { COLORS } from './palette';
import { TX } from './sprites';

const STAR_TINTS = [COLORS.star1, COLORS.star2, COLORS.star3];

interface Star {
  img: Phaser.GameObjects.Image;
  speed: number;
}

/**
 * A scrolling parallax starfield — the signature Galaga backdrop. Stars fall
 * downward at three speed tiers and wrap to the top. Kept local to Galaga: it's
 * the only space game in the collection, so sharing it would be premature.
 */
export class Starfield {
  private readonly stars: Star[] = [];

  constructor(
    scene: Phaser.Scene,
    private readonly width: number,
    private readonly height: number,
  ) {
    for (let i = 0; i < STAR_COUNT; i++) {
      const tier = i % STAR_SPEEDS.length;
      const img = scene.add
        .image(Phaser.Math.Between(0, width), Phaser.Math.Between(0, height), TX.star)
        .setDepth(0)
        .setTint(STAR_TINTS[tier]);
      this.stars.push({ img, speed: STAR_SPEEDS[tier] });
    }
  }

  update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    for (const star of this.stars) {
      star.img.y += star.speed * dt;
      if (star.img.y > this.height + 2) {
        star.img.y = -2;
        star.img.x = Phaser.Math.Between(0, this.width);
      }
    }
  }
}
