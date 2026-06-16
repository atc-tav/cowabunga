import Phaser from 'phaser';

/**
 * Play a one-shot sprite animation from a list of texture keys, then destroy
 * it. The reusable "burst" primitive — explosions in Galaga now, and Donkey
 * Kong / Dig Dug later. Frame textures are game-specific; the playback is not.
 */
export function playFrames(
  scene: Phaser.Scene,
  x: number,
  y: number,
  keys: string[],
  frameMs = 60,
  depth = 20,
): void {
  if (keys.length === 0) {
    return;
  }
  const img = scene.add.image(x, y, keys[0]).setDepth(depth);
  let i = 1;
  scene.time.addEvent({
    delay: frameMs,
    repeat: keys.length - 1,
    callback: () => {
      if (i < keys.length) {
        img.setTexture(keys[i]);
        i++;
      } else {
        img.destroy();
      }
    },
  });
}
