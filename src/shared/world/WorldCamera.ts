import Phaser from 'phaser';
import { TileWorld } from './TileWorld';

export interface WorldCameraOptions {
  /** Follow smoothing per axis: 1 = snap (RL-deterministic), <1 = ease. */
  lerpX?: number;
  lerpY?: number;
  /** A box (in screen px) the target moves within before the camera scrolls. */
  deadzoneWidth?: number;
  deadzoneHeight?: number;
  /** Round scroll to whole pixels so pixel-art stays crisp (default true). */
  roundPixels?: boolean;
}

/**
 * A thin wrapper over Phaser's built-in camera follow, set up for a scrolling
 * tile world: clamp to level bounds, follow a target with optional deadzone.
 *
 * The camera's position is a pure function of the followed target (game state),
 * so it stays deterministic and is safe for the RL dojo — unlike `screenShake`,
 * it does not need the juice gate. Pin HUD/UI with `setScrollFactor(0)` so it
 * rides the viewport instead of the world (the shared HUD already does this).
 */
export class WorldCamera {
  private readonly cam: Phaser.Cameras.Scene2D.Camera;

  constructor(scene: Phaser.Scene) {
    this.cam = scene.cameras.main;
  }

  /** Clamp scrolling to the level's pixel bounds. Call once after parsing. */
  bindTo(world: TileWorld): this {
    this.cam.setBounds(world.offsetX, world.offsetY, world.pixelWidth, world.pixelHeight);
    return this;
  }

  setBounds(x: number, y: number, width: number, height: number): this {
    this.cam.setBounds(x, y, width, height);
    return this;
  }

  follow(target: Phaser.GameObjects.GameObject, opts: WorldCameraOptions = {}): this {
    const { lerpX = 1, lerpY = 1, deadzoneWidth, deadzoneHeight, roundPixels = true } = opts;
    this.cam.startFollow(target, roundPixels, lerpX, lerpY);
    if (deadzoneWidth !== undefined && deadzoneHeight !== undefined) {
      this.cam.setDeadzone(deadzoneWidth, deadzoneHeight);
    }
    return this;
  }

  stopFollow(): this {
    this.cam.stopFollow();
    return this;
  }

  /** Jump the camera to centre on a world point (e.g. at level start). */
  centerOn(x: number, y: number): this {
    this.cam.centerOn(x, y);
    return this;
  }
}
