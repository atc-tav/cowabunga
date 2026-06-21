/**
 * NES Donkey Kong runs a loop of stages: 25m (barrels) → 75m (elevators) →
 * 100m (rivets) → repeat, faster each lap. Only 25m is built so far; 75m and
 * 100m slot into this order in later slices. The scene cycles `STAGE_ORDER`,
 * incrementing the loop count each time it wraps.
 */
export type StageId = '25m' | '75m' | '100m';

export const STAGE_ORDER: StageId[] = ['25m'];
