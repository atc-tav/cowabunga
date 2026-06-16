import type { Pt } from '../../shared/PathFollower';
import { WIDTH, ENTRY_STEPS } from './constants';

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
