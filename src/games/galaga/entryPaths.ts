import type { Pt } from '../../shared/PathFollower';
import { WIDTH, HEIGHT, ENTRY_STEPS, DIVE_STEPS } from './constants';

function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, steps: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const a = u * u * u;
    const b = 3 * u * u * t;
    const c = 3 * u * t * t;
    const d = t * t * t;
    pts.push({
      x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
      y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    });
  }
  return pts;
}

/**
 * A swooping cubic-bezier entry route from off-screen (top-left or top-right)
 * that ends exactly on the enemy's formation slot, so the follower "arrives"
 * home with no snapping.
 */
export function makeEntryPath(home: Pt, fromLeft: boolean): Pt[] {
  const p0 = fromLeft ? { x: -20, y: 60 } : { x: WIDTH + 20, y: 60 };
  const p1 = fromLeft ? { x: 60, y: -20 } : { x: WIDTH - 60, y: -20 };
  const p2 = { x: home.x + (fromLeft ? -40 : 40), y: home.y + 60 };
  return cubic(p0, p1, p2, home, ENTRY_STEPS);
}

/**
 * A flowing flythrough path for a challenge-stage chain: sweeps across the
 * screen toward the player and exits off the far side (the enemy never settles
 * into a formation). Several variants give the "flowing chains" look.
 */
export function makeChallengePath(variant: number): Pt[] {
  switch (variant % 6) {
    case 0: // diagonal swoop, left -> right
      return cubic(
        { x: -20, y: 30 },
        { x: WIDTH * 0.4, y: HEIGHT * 0.75 },
        { x: WIDTH * 0.7, y: HEIGHT * 0.12 },
        { x: WIDTH + 20, y: HEIGHT * 0.85 },
        30,
      );
    case 1: // diagonal swoop, right -> left
      return cubic(
        { x: WIDTH + 20, y: 30 },
        { x: WIDTH * 0.6, y: HEIGHT * 0.75 },
        { x: WIDTH * 0.3, y: HEIGHT * 0.12 },
        { x: -20, y: HEIGHT * 0.85 },
        30,
      );
    case 2: // big S down the middle
      return cubic(
        { x: WIDTH / 2, y: -20 },
        { x: -10, y: HEIGHT * 0.55 },
        { x: WIDTH + 10, y: HEIGHT * 0.55 },
        { x: WIDTH / 2, y: HEIGHT + 20 },
        30,
      );
    case 3: // loop on the left
      return loop({ x: -20, y: 60 }, { x: WIDTH * 0.32, y: HEIGHT * 0.42 }, 40, { x: WIDTH + 20, y: HEIGHT * 0.6 });
    case 4: // loop on the right
      return loop({ x: WIDTH + 20, y: 60 }, { x: WIDTH * 0.68, y: HEIGHT * 0.42 }, 40, { x: -20, y: HEIGHT * 0.6 });
    default: // side-to-side zig-zag descending
      return zigzag();
  }
}

/** A descending loop: enter, circle around a centre, then exit across. */
function loop(enter: Pt, centre: Pt, radius: number, exit: Pt): Pt[] {
  const pts: Pt[] = [enter];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (i / steps) * Math.PI * 2;
    pts.push({ x: centre.x + Math.cos(a) * radius, y: centre.y + Math.sin(a) * radius });
  }
  pts.push(exit);
  return pts;
}

/** A side-to-side zig-zag from the top to the bottom. */
function zigzag(): Pt[] {
  const pts: Pt[] = [];
  const rows = 5;
  for (let i = 0; i <= rows; i++) {
    const y = -20 + ((HEIGHT + 40) * i) / rows;
    const x = i % 2 === 0 ? WIDTH * 0.15 : WIDTH * 0.85;
    pts.push({ x, y });
  }
  return pts;
}
export function makeApproachPath(home: Pt, hoverX: number, hoverY: number): Pt[] {
  const p1 = { x: home.x, y: home.y + 40 };
  const p2 = { x: hoverX, y: hoverY - 40 };
  return cubic(home, p1, p2, { x: hoverX, y: hoverY }, ENTRY_STEPS);
}

/**
 * A dive curve: peel out of the formation, swoop down toward the player's
 * column (aimX), and exit off the bottom of the screen.
 */
export function makeDivePath(home: Pt, aimX: number): Pt[] {
  const bias = aimX < WIDTH / 2 ? 40 : -40;
  const p0 = home;
  const p1 = { x: home.x, y: home.y + 50 };
  const p2 = { x: aimX, y: HEIGHT - 60 };
  const p3 = { x: aimX + bias, y: HEIGHT + 30 };
  return cubic(p0, p1, p2, p3, DIVE_STEPS);
}
