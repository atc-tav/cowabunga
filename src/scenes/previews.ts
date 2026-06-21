import Phaser from 'phaser';
import { buildPacmanTextures, TX as PAC, ghostFrames } from '../games/pacman/sprites';
import { buildGalagaTextures, TX as GAL, enemyFrame } from '../games/galaga/sprites';
import { buildDKTextures, TX as DK, BARREL_KEYS } from '../games/donkeykong/sprites';
import { buildMarioBrosTextures, TX as MB } from '../games/mariobros/sprites';
import { buildArkanoidTextures, TX as AK, brickTexture } from '../games/arkanoid/sprites';

/**
 * Animated "TV channel" previews for the title-screen carousel. Each preview is
 * a tiny looping vignette built from the SAME programmatic sprites the games
 * use (via their `buildXTextures` + `TX` keys), so the selected game looks
 * identical the instant you launch it — no jarring switch.
 *
 * Coordinates are LOCAL to the preview layer (0..width, 0..height) — MainMenu
 * positions and rounded-masks the layer to sit inside the TV screen.
 */
export interface Preview {
  update(time: number, delta: number): void;
  destroy(): void;
}

export interface PreviewBounds {
  width: number;
  height: number;
}

type PreviewFactory = (
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  bounds: PreviewBounds,
) => Preview;

function add<T extends Phaser.GameObjects.GameObject>(
  layer: Phaser.GameObjects.Container,
  obj: T,
): T {
  layer.add(obj);
  return obj;
}

function background(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  b: PreviewBounds,
  color: number,
): void {
  add(layer, scene.add.rectangle(0, 0, b.width, b.height, color).setOrigin(0));
}

// Pick an animation frame from a list on a fixed cadence.
const frameAt = (keys: string[], t: number, ms = 130) =>
  keys[Math.floor(t / ms) % keys.length];

const pacman: PreviewFactory = (scene, layer, b) => {
  buildPacmanTextures(scene);
  background(scene, layer, b, 0x000000);
  const midY = Math.round(b.height * 0.55);
  const dots: Phaser.GameObjects.Image[] = [];
  for (let x = 14; x < b.width - 8; x += 14) {
    dots.push(add(layer, scene.add.image(x, midY, PAC.dot)));
  }
  const pac = add(layer, scene.add.image(0, midY, PAC.pacOpen));
  const ghost = add(layer, scene.add.image(0, midY, ghostFrames('blinky')[0]));
  const gf = ghostFrames('blinky');

  let t = 0;
  let px = -12;
  return {
    update(_time, delta) {
      t += delta;
      px += delta * 0.045;
      if (px > b.width + 14) {
        px = -12;
        dots.forEach((d) => d.setVisible(true));
      }
      pac.x = px;
      pac.setTexture(Math.floor(t / 110) % 2 ? PAC.pacClosed : PAC.pacOpen);
      ghost.x = px - 26;
      ghost.setTexture(frameAt(gf, t));
      dots.forEach((d) => {
        if (d.visible && Math.abs(d.x - px) < 8) d.setVisible(false);
      });
    },
    destroy() {},
  };
};

const galaga: PreviewFactory = (scene, layer, b) => {
  buildGalagaTextures(scene);
  background(scene, layer, b, 0x000010);
  const stars: { obj: Phaser.GameObjects.Image; sp: number }[] = [];
  for (let i = 0; i < 26; i++) {
    const obj = add(layer, scene.add.image(Math.random() * b.width, Math.random() * b.height, GAL.star));
    stars.push({ obj, sp: 0.02 + Math.random() * 0.06 });
  }
  const ship = add(layer, scene.add.image(b.width / 2, b.height - 8, GAL.ship));
  const bees = [0, 1].map((i) => add(layer, scene.add.image(0, 16 + i * 14, enemyFrame('bee', 0))));
  const bullet = add(layer, scene.add.image(0, -10, GAL.bullet));

  let t = 0;
  let bulletY = -10;
  return {
    update(_time, delta) {
      t += delta;
      for (const s of stars) {
        s.obj.y += s.sp * delta;
        if (s.obj.y > b.height) {
          s.obj.y = 0;
          s.obj.x = Math.random() * b.width;
        }
      }
      const wing = (Math.floor(t / 150) % 2) as 0 | 1;
      bees.forEach((bee, i) => {
        bee.x = b.width / 2 + Math.sin(t * 0.002 + i * 1.6) * (b.width * 0.32);
        bee.y = 16 + i * 14 + Math.sin(t * 0.004 + i) * 6;
        bee.setTexture(enemyFrame('bee', wing));
      });
      bulletY -= delta * 0.18;
      if (bulletY < -8) {
        bulletY = b.height - 16;
        bullet.x = ship.x;
      }
      bullet.y = bulletY;
    },
    destroy() {},
  };
};

const donkeykong: PreviewFactory = (scene, layer, b) => {
  buildDKTextures(scene);
  background(scene, layer, b, 0x000000);
  const girderColor = 0xd82800;
  const girderYs = [b.height - 14, b.height * 0.6, b.height * 0.33];
  for (const y of girderYs) {
    add(layer, scene.add.rectangle(0, y, b.width, 4, girderColor).setOrigin(0, 0.5));
  }
  for (const x of [b.width * 0.3, b.width * 0.7]) {
    add(layer, scene.add.rectangle(x, b.height * 0.33, 4, b.height * 0.27, 0x3cbcff).setOrigin(0.5, 0));
  }
  const kong = add(layer, scene.add.image(22, 16, DK.kong)).setOrigin(0.5);
  add(layer, scene.add.image(b.width - 24, b.height * 0.33 - 8, DK.pauline)).setOrigin(0.5, 1);
  const mario = add(layer, scene.add.image(b.width - 30, girderYs[0] - 9, DK.marioWalk0)).setOrigin(0.5, 1);
  const barrel = add(layer, scene.add.image(0, girderYs[2] - 6, BARREL_KEYS[0])).setOrigin(0.5);

  let t = 0;
  let bx = 0;
  let mx = b.width - 30;
  return {
    update(_time, delta) {
      t += delta;
      bx += delta * 0.05;
      if (bx > b.width + 8) bx = -8;
      barrel.x = bx;
      barrel.setTexture(frameAt(BARREL_KEYS, t, 90));
      mx -= delta * 0.02;
      if (mx < 10) mx = b.width - 10;
      mario.x = mx;
      mario.setTexture(Math.floor(t / 140) % 2 ? DK.marioWalk1 : DK.marioWalk0);
      kong.scaleX = 1 + Math.sin(t * 0.006) * 0.05;
    },
    destroy() {},
  };
};

const mariobros: PreviewFactory = (scene, layer, b) => {
  buildMarioBrosTextures(scene);
  background(scene, layer, b, 0x000022);
  const platY = [b.height * 0.4, b.height * 0.68, b.height - 8];
  for (const y of platY) {
    add(layer, scene.add.rectangle(0, y, b.width, 5, 0x3a9d3a).setOrigin(0, 0.5));
  }
  const mario = add(layer, scene.add.image(20, platY[2] - 3, MB.marioRun0)).setOrigin(0.5, 1);
  const shell = add(layer, scene.add.image(b.width - 20, platY[1] - 3, MB.shellWalk0)).setOrigin(0.5, 1);

  let t = 0;
  let mDir = 1;
  let sDir = -1;
  return {
    update(_time, delta) {
      t += delta;
      mario.x += mDir * delta * 0.04;
      if (mario.x > b.width - 12 || mario.x < 12) {
        mDir *= -1;
        mario.setFlipX(mDir < 0);
      }
      mario.setTexture(Math.floor(t / 130) % 2 ? MB.marioRun1 : MB.marioRun0);
      shell.x += sDir * delta * 0.03;
      if (shell.x > b.width - 12 || shell.x < 12) sDir *= -1;
      shell.setTexture(Math.floor(t / 160) % 2 ? MB.shellWalk1 : MB.shellWalk0);
    },
    destroy() {},
  };
};

const arkanoid: PreviewFactory = (scene, layer, b) => {
  buildArkanoidTextures(scene);
  background(scene, layer, b, 0x000000);
  const codes = ['R', 'O', 'Y', 'G', 'C'] as const;
  const bw = 16;
  const bh = 8;
  const cols = Math.floor((b.width - 8) / bw);
  const ox = Math.round((b.width - cols * bw) / 2);
  const bricks: Phaser.GameObjects.Image[] = [];
  for (let r = 0; r < codes.length; r++) {
    for (let c = 0; c < cols; c++) {
      bricks.push(
        add(layer, scene.add.image(ox + c * bw, 8 + r * (bh + 1), brickTexture(codes[r])).setOrigin(0)),
      );
    }
  }
  const paddle = add(layer, scene.add.image(b.width / 2, b.height - 6, AK.vausNormal)).setOrigin(0.5);
  const ball = add(layer, scene.add.image(b.width / 2, b.height / 2, AK.ball)).setOrigin(0.5);
  let vx = 0.07;
  let vy = -0.06;

  return {
    update(_time, delta) {
      ball.x += vx * delta;
      ball.y += vy * delta;
      if (ball.x < 3 || ball.x > b.width - 3) vx *= -1;
      if (ball.y < 3) vy *= -1;
      if (ball.y > b.height - 3) {
        vy = -Math.abs(vy);
        ball.y = b.height - 3;
      }
      paddle.x += (ball.x - paddle.x) * Math.min(1, delta * 0.01);
      paddle.x = Phaser.Math.Clamp(paddle.x, 16, b.width - 16);
      let remaining = 0;
      for (const br of bricks) {
        if (!br.visible) continue;
        remaining++;
        if (
          ball.x > br.x - 2 &&
          ball.x < br.x + bw + 2 &&
          ball.y > br.y - 2 &&
          ball.y < br.y + bh + 2
        ) {
          br.setVisible(false);
          vy *= -1;
        }
      }
      if (remaining === 0) bricks.forEach((br) => br.setVisible(true));
    },
    destroy() {},
  };
};

const fallback: PreviewFactory = (scene, layer, b) => {
  background(scene, layer, b, 0x101020);
  const palette = [0xd82800, 0xffd000, 0x3cbcfc, 0x00b050, 0xff4dd2];
  const blocks: { obj: Phaser.GameObjects.Rectangle; vx: number; vy: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const obj = add(layer, scene.add.rectangle(b.width / 2, b.height / 2, 6, 6, palette[i % palette.length]));
    blocks.push({ obj, vx: (Math.random() - 0.5) * 0.12, vy: (Math.random() - 0.5) * 0.12 });
  }
  return {
    update(_time, delta) {
      for (const bl of blocks) {
        bl.obj.x += bl.vx * delta;
        bl.obj.y += bl.vy * delta;
        if (bl.obj.x < 3 || bl.obj.x > b.width - 3) bl.vx *= -1;
        if (bl.obj.y < 3 || bl.obj.y > b.height - 3) bl.vy *= -1;
      }
    },
    destroy() {},
  };
};

const FACTORIES: Record<string, PreviewFactory> = {
  pacman,
  galaga,
  donkeykong,
  mariobros,
  arkanoid,
};

/** Build the animated preview for a game id, falling back to a generic card. */
export function buildPreview(
  id: string,
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  bounds: PreviewBounds,
): Preview {
  const factory = FACTORIES[id] ?? fallback;
  return factory(scene, layer, bounds);
}
