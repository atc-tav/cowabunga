import type { EnemyKindId } from './enemies';

/**
 * A phase is cleared once every enemy in its roster has been spawned and then
 * defeated. Rosters follow the arcade's escalation (turtles → crabs → flies →
 * mixes); after the last entry the list loops, with enemies a little faster each
 * lap (see LOOP_SPEED_STEP).
 *
 * Bonus phases (coin collection) and Slipice/icicle phases from the spec land
 * in later slices; these are the combat phases.
 */
export interface PhaseDef {
  roster: EnemyKindId[];
  /** Slipice (Freezie) prowls this phase, icing platforms. */
  slipice?: boolean;
  /** Icicles form on the top platform's underside and drop. */
  icicles?: boolean;
}

export const PHASES: PhaseDef[] = [
  { roster: ['turtle', 'turtle', 'turtle'] },
  { roster: ['turtle', 'turtle', 'turtle', 'turtle', 'turtle'] },
  { roster: ['crab', 'crab', 'crab', 'crab'] },
  { roster: ['turtle', 'turtle', 'crab', 'crab', 'crab', 'crab'] },
  { roster: ['fly', 'fly', 'fly', 'fly'] },
  { roster: ['fly', 'fly', 'fly', 'crab', 'crab'] },
  { roster: ['turtle', 'turtle', 'turtle', 'turtle', 'fly'], slipice: true },
  { roster: ['crab', 'crab', 'crab', 'crab', 'fly'], slipice: true },
  { roster: ['crab', 'crab', 'fly', 'fly'], slipice: true, icicles: true },
];
