import { PlatformSegment } from '../../shared/Platformer';
import {
  LEVEL1_GIRDERS,
  buildLadders,
  STAGE100_GIRDERS,
  stage100Ladders,
  stage100Rivets,
  DK_X,
  PAULINE_X,
  Ladder,
  Rivet,
} from './levels';
import { HAMMER_SPOTS } from './constants';

/**
 * NES Donkey Kong runs a loop of stages: 25m (barrels) → 75m (elevators) →
 * 100m (rivets) → repeat, faster each lap. 75m slots in next; today the order
 * is 25m → 100m. The scene cycles `STAGE_ORDER`, bumping the loop on wrap.
 */
export type StageId = '25m' | '75m' | '100m';

export const STAGE_ORDER: StageId[] = ['25m', '100m'];

/** Everything the scene needs to lay out and run a stage. */
export interface StageConfig {
  id: StageId;
  girders: PlatformSegment[];
  ladders: Ladder[];
  rivets: Rivet[]; // empty unless it's a rivet stage
  dkGirder: number;
  dkX: number;
  paulineGirder: number;
  paulineX: number;
  startGirder: number;
  hammers: { g: number; x: number }[];
  barrels: boolean; // DK throws barrels (25m)
  fireBandTop: number; // fireballs roam girders [top..bottom]
  fireBandBottom: number;
  fireCount: number;
  rivetsWin: boolean; // clear by removing every rivet (100m) vs reaching Pauline
}

export function buildStage(id: StageId): StageConfig {
  if (id === '100m') {
    return {
      id,
      girders: STAGE100_GIRDERS,
      ladders: stage100Ladders(),
      rivets: stage100Rivets(),
      dkGirder: 0,
      dkX: 96,
      paulineGirder: 0,
      paulineX: 124,
      startGirder: STAGE100_GIRDERS.length - 1,
      hammers: [], // no hammer on 100m (NES)
      barrels: false,
      fireBandTop: 1,
      fireBandBottom: 4,
      fireCount: 3,
      rivetsWin: true,
    };
  }
  // 25m (barrels)
  return {
    id: '25m',
    girders: LEVEL1_GIRDERS,
    ladders: buildLadders(),
    rivets: [],
    dkGirder: 0,
    dkX: DK_X,
    paulineGirder: 0,
    paulineX: PAULINE_X,
    startGirder: LEVEL1_GIRDERS.length - 1,
    hammers: HAMMER_SPOTS,
    barrels: true,
    fireBandTop: 1,
    fireBandBottom: 2,
    fireCount: 1,
    rivetsWin: false,
  };
}
