import Phaser from 'phaser';
import { drawPixelArt } from '../shared/textures';

/**
 * Animated "TV channel" previews for the title-screen carousel. Each preview is
 * a tiny, self-contained looping vignette evoking one game — drifting sprites,
 * a bouncing ball, a rolling barrel — drawn from menu-owned primitives and a
 * couple of pixel-art motifs.
 *
 * Deliberately decoupled from the games themselves: nothing here imports from
 * `src/games/`, so the game-focused work can churn freely without touching the
 * menu. A game with no bespoke preview falls back to a generic drifting card.
 *
 * Coordinates are LOCAL to the preview layer (0..width, 0..height) — MainMenu
 * positions and rounded-masks the layer to sit inside the TV screen.
 */
export interface Preview {
  /** Advance the vignette. `delta` is milliseconds, so motion is FPS-independent. */
  update(time: number, delta: number): void;
  /** Stop any timers/tweens. Display objects die with the layer container. */
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

// --- shared pixel-art motifs (cached globally by drawPixelArt) ---------------

function ensureSprites(scene: Phaser.Scene): void {
  drawPixelArt(
    scene,
    'mnu_ghost',
    [' BBBBB ', 'BBBBBBB', 'BBWBBWB', 'BBWBBWB', 'BBBBBBB', 'BBBBBBB', 'B B B B'],
    { B: 0xff4dd2, W: 0xffffff },
  );
  drawPixelArt(
    scene,
    'mnu_ship',
    ['   W   ', '   W   ', '  WWW  ', ' WWRWW ', ' WWWWW ', 'WWRWRWW', 'W W W W'],
    { W: 0xe8f0ff, R: 0xd82800 },
  );
  drawPixelArt(
    scene,
    'mnu_bee',
    [' Y   Y ', '  YYY  ', ' YRRRY ', 'YRRRRRY', ' YRRRY ', '  YYY  ', ' Y   Y '],
    { Y: 0xffd000, R: 0xd82800 },
  );
}

// --- small helpers -----------------------------------------------------------

/** Add a game object to the layer and return it (typed). */
function add<T extends Phaser.GameObjects.GameObject>(
  layer: Phaser.GameObjects.Container,
  obj: T,
): T {
  layer.add(obj);
  return obj;
}

function fillBackground(
  scene: Phaser.Scene,
  layer: Phaser.GameObjects.Container,
  bounds: PreviewBounds,
  color: number,
): void {
  add(layer, scene.add.rectangle(0, 0, bounds.width, bounds.height, color).setOrigin(0));
}

// --- previews ----------------------------------------------------------------

const pacman: PreviewFactory = (scene, layer, b) => {
  fillBackground(scene, layer, b, 0x000000);
  const midY = Math.round(b.height * 0.55);
  const dots: Phaser.GameObjects.Rectangle[] = [];
  for (let x = 12; x < b.width - 6; x += 14) {
    dots.push(add(layer, scene.add.rectangle(x, midY, 3, 3, 0xffd9b3)));
  }
  const pac = add(layer, scene.add.arc(0, midY, 7, 40, 320, false, 0xfff200));
  const ghost = add(layer, scene.add.image(0, midY, 'mnu_ghost'));
  ghost.setScale(2);

  let t = 0;
  let px = -10;
  return {
    update(_time, delta) {
      t += delta;
      px += delta * 0.045;
      if (px > b.width + 12) {
        px = -10;
        dots.forEach((d) => d.setVisible(true));
      }
      pac.x = px;
      const mouth = 8 + (Math.sin(t * 0.02) * 0.5 + 0.5) * 32;
      pac.setStartAngle(mouth);
      pac.setEndAngle(360 - mouth);
      ghost.x = px - 24;
      dots.forEach((d) => {
        if (d.visible && Math.abs(d.x - px) < 7) d.setVisible(false);
      });
    },
    destroy() {},
  };
};

const galaga: PreviewFactory = (scene, layer, b) => {
  fillBackground(scene, layer, b, 0x000010);
  const stars: { obj: Phaser.GameObjects.Rectangle; sp: number }[] = [];
  for (let i = 0; i < 26; i++) {
    const obj = add(
      layer,
      scene.add.rectangle(
        Math.random() * b.width,
        Math.random() * b.height,
        1,
        1,
        0x8899ff,
      ),
    );
    stars.push({ obj, sp: 0.02 + Math.random() * 0.06 });
  }
  const ship = add(layer, scene.add.image(b.width / 2, b.height - 12, 'mnu_ship'));
  ship.setScale(2);
  const bees = [0, 1].map((i) =>
    add(layer, scene.add.image(0, 18 + i * 16, 'mnu_bee')).setScale(2),
  );
  const bullet = add(layer, scene.add.rectangle(0, -10, 2, 6, 0xffffff));

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
      bees.forEach((bee, i) => {
        bee.x = b.width / 2 + Math.sin(t * 0.002 + i * 1.6) * (b.width * 0.32);
        bee.y = 18 + i * 16 + Math.sin(t * 0.004 + i) * 6;
      });
      bulletY -= delta * 0.18;
      if (bulletY < -8) {
        bulletY = b.height - 18;
        bullet.x = ship.x;
      }
      bullet.y = bulletY;
    },
    destroy() {},
  };
};

const donkeykong: PreviewFactory = (scene, layer, b) => {
  fillBackground(scene, layer, b, 0x000000);
  const girderColor = 0xd82800;
  const girderYs = [b.height - 16, b.height * 0.6, b.height * 0.33];
  for (const y of girderYs) {
    add(layer, scene.add.rectangle(0, y, b.width, 4, girderColor).setOrigin(0, 0.5));
  }
  // ladders
  for (const x of [b.width * 0.3, b.width * 0.7]) {
    add(
      layer,
      scene.add.rectangle(x, b.height * 0.33, 4, b.height * 0.27, 0x3cbcff).setOrigin(0.5, 0),
    );
  }
  // Kong (top-left) + princess marker
  const kong = add(layer, scene.add.ellipse(20, 16, 22, 18, 0x8b4513));
  add(layer, scene.add.ellipse(15, 14, 4, 4, 0xffffff));
  add(layer, scene.add.ellipse(24, 14, 4, 4, 0xffffff));
  const barrel = add(layer, scene.add.ellipse(0, girderYs[2] - 6, 12, 9, 0xc98a3a));

  let bx = 0;
  let t = 0;
  return {
    update(_time, delta) {
      t += delta;
      bx += delta * 0.05;
      if (bx > b.width + 8) bx = -8;
      barrel.x = bx;
      barrel.y = girderYs[2] - 6 + Math.sin(t * 0.02) * 1.5;
      kong.scaleX = 1 + Math.sin(t * 0.006) * 0.06;
    },
    destroy() {},
  };
};

const mariobros: PreviewFactory = (scene, layer, b) => {
  fillBackground(scene, layer, b, 0x000022);
  const platY = [b.height * 0.4, b.height * 0.68, b.height - 10];
  for (const y of platY) {
    add(layer, scene.add.rectangle(0, y, b.width, 5, 0x3a9d3a).setOrigin(0, 0.5));
  }
  // POW block
  add(layer, scene.add.rectangle(b.width / 2, b.height - 22, 12, 9, 0x3cbcff));

  // Mario: a small two-rect figure in a flippable sub-container.
  const mario = add(layer, scene.add.container(20, b.height - 16));
  mario.add(scene.add.rectangle(0, 0, 8, 8, 0xd82800).setOrigin(0.5, 1)); // body
  mario.add(scene.add.rectangle(0, -8, 6, 5, 0xffc9a0).setOrigin(0.5, 1)); // head
  // Shellcreeper walking the middle platform.
  const turtle = add(layer, scene.add.ellipse(b.width - 20, platY[1] - 6, 12, 9, 0x00b050));

  let mDir = 1;
  let tDir = -1;
  return {
    update(_time, delta) {
      mario.x += mDir * delta * 0.04;
      if (mario.x > b.width - 12 || mario.x < 12) {
        mDir *= -1;
        mario.scaleX = mDir;
      }
      turtle.x += tDir * delta * 0.03;
      if (turtle.x > b.width - 12 || turtle.x < 12) tDir *= -1;
    },
    destroy() {},
  };
};

const arkanoid: PreviewFactory = (scene, layer, b) => {
  fillBackground(scene, layer, b, 0x000000);
  const cols = 7;
  const rowColors = [0xd82800, 0xffa000, 0x00b050, 0x3cbcff];
  const bw = Math.floor((b.width - 8) / cols);
  const bh = 7;
  const bricks: Phaser.GameObjects.Rectangle[] = [];
  for (let r = 0; r < rowColors.length; r++) {
    for (let c = 0; c < cols; c++) {
      const brick = add(
        layer,
        scene.add
          .rectangle(4 + c * bw, 8 + r * (bh + 2), bw - 2, bh, rowColors[r])
          .setOrigin(0),
      );
      bricks.push(brick);
    }
  }
  const paddle = add(layer, scene.add.rectangle(b.width / 2, b.height - 8, 26, 5, 0x3cbcff));
  const ball = add(layer, scene.add.arc(b.width / 2, b.height / 2, 3, 0, 360, false, 0xffffff));
  let vx = 0.07;
  let vy = -0.06;

  const reset = () => bricks.forEach((br) => br.setVisible(true));
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
      // Paddle eases toward the ball.
      paddle.x += (ball.x - paddle.x) * Math.min(1, delta * 0.01);
      paddle.x = Phaser.Math.Clamp(paddle.x, 14, b.width - 14);
      // Brick collisions.
      let remaining = 0;
      for (const br of bricks) {
        if (!br.visible) continue;
        remaining++;
        if (
          ball.x > br.x - 2 &&
          ball.x < br.x + br.width + 2 &&
          ball.y > br.y - 2 &&
          ball.y < br.y + br.height + 2
        ) {
          br.setVisible(false);
          vy *= -1;
        }
      }
      if (remaining === 0) reset();
    },
    destroy() {},
  };
};

const fallback: PreviewFactory = (scene, layer, b) => {
  fillBackground(scene, layer, b, 0x101020);
  const palette = [0xd82800, 0xffd000, 0x3cbcff, 0x00b050, 0xff4dd2];
  const blocks: { obj: Phaser.GameObjects.Rectangle; vx: number; vy: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const obj = add(
      layer,
      scene.add.rectangle(
        b.width / 2,
        b.height / 2,
        6,
        6,
        palette[i % palette.length],
      ),
    );
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
  ensureSprites(scene);
  const factory = FACTORIES[id] ?? fallback;
  return factory(scene, layer, bounds);
}
