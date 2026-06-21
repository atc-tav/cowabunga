import { JUMP, GRAVITY, LUIGI_GRAVITY } from './constants';
import { TX } from './sprites';

export type CharacterId = 'mario' | 'luigi' | 'toad' | 'peach';

export interface CharacterStats {
  id: CharacterId;
  label: string;
  /** HUD + score-popup colour. */
  color: string;
  jumpUnloaded: number; // px/sec (positive magnitude; launched upward)
  jumpCarrying: number;
  gravity: number; // px/sec^2 (Luigi falls slower)
  carryMod: number; // × run speed while carrying
  decel: number; // per-frame vx multiplier on release (lower = more slide)
  pluckMs: number;
  canFloat: boolean; // Peach
  canCharge: boolean; // Toad crouch-jump
  tex: { run0: string; run1: string; jump: string; carry: string };
}

/**
 * The four playable characters and their distinct feel — the heart of SMB2.
 * Unloaded run speed is identical for everyone (spec §3.2 CHECK); the stats here
 * are what differentiate them: jump arcs, carry penalties, slide, pluck speed,
 * and the special abilities (Peach float, Toad charged jump, Luigi floaty fall).
 */
export const CHARACTERS: Record<CharacterId, CharacterStats> = {
  mario: {
    id: 'mario',
    label: 'MARIO',
    color: '#d82800',
    jumpUnloaded: JUMP.marioUnloaded,
    jumpCarrying: JUMP.marioCarrying,
    gravity: GRAVITY,
    carryMod: 0.85,
    decel: 0.85,
    pluckMs: 400,
    canFloat: false,
    canCharge: false,
    tex: { run0: TX.marioRun0, run1: TX.marioRun1, jump: TX.marioJump, carry: TX.marioCarry },
  },
  luigi: {
    id: 'luigi',
    label: 'LUIGI',
    color: '#00a800',
    jumpUnloaded: JUMP.luigiUnloaded, // ~2x Mario height
    jumpCarrying: JUMP.luigiCarrying, // heavy penalty -> ~unloaded Mario
    gravity: LUIGI_GRAVITY, // floatier descent
    carryMod: 0.75,
    decel: 0.7, // slides when stopping
    pluckMs: 400,
    canFloat: false,
    canCharge: false,
    tex: { run0: TX.luigiRun0, run1: TX.luigiRun1, jump: TX.luigiJump, carry: TX.luigiCarry },
  },
  toad: {
    id: 'toad',
    label: 'TOAD',
    color: '#f8f8f8',
    jumpUnloaded: JUMP.toadUnloaded, // lowest base jump
    jumpCarrying: JUMP.toadCarrying,
    gravity: GRAVITY,
    carryMod: 0.97, // barely penalised carrying
    decel: 0.88,
    pluckMs: 100, // fastest pluck
    canFloat: false,
    canCharge: true,
    tex: { run0: TX.toadRun0, run1: TX.toadRun1, jump: TX.toadJump, carry: TX.toadCarry },
  },
  peach: {
    id: 'peach',
    label: 'PEACH',
    color: '#f878f8',
    jumpUnloaded: JUMP.peachUnloaded,
    jumpCarrying: JUMP.peachCarrying,
    gravity: GRAVITY,
    carryMod: 0.7,
    decel: 0.83,
    pluckMs: 400,
    canFloat: true, // hover at apex
    canCharge: false,
    tex: { run0: TX.peachRun0, run1: TX.peachRun1, jump: TX.peachJump, carry: TX.peachCarry },
  },
};

export const CHARACTER_ORDER: CharacterId[] = ['mario', 'luigi', 'toad', 'peach'];
