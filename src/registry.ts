import Phaser from 'phaser';
import { PacmanScene } from './games/pacman/PacmanScene';
import { GalagaScene } from './games/galaga/GalagaScene';
import { DKScene } from './games/donkeykong/DKScene';
import { MarioBrosScene } from './games/mariobros/MarioBrosScene';
import { ArkanoidScene } from './games/arkanoid/ArkanoidScene';
import { PrivacyPolicyScene } from './games/privacypolicy/PrivacyPolicyScene';
import { SandboxScene } from './games/sandbox/SandboxScene';

export interface GameResolution {
  width: number;
  height: number;
}

/**
 * The single source of truth for which games exist. Adding a game = adding one
 * entry here: `main.ts` registers its scene and `MainMenu` builds a tile for
 * it automatically. `key` must match the scene's Phaser key.
 */
export interface GameEntry {
  id: string;
  title: string;
  key: string;
  resolution: GameResolution;
  SceneClass: new () => Phaser.Scene;
  /**
   * Hidden entries are still registered as scenes (so they remain reachable /
   * playable), but the MainMenu carousel skips them. Used for the `sandbox`
   * smoke-test harness, which we keep in the repo but off the title screen.
   */
  hidden?: boolean;
}

export const GAMES: GameEntry[] = [
  {
    id: 'pacman',
    title: 'PAC-MAN',
    key: 'game-pacman',
    resolution: { width: 224, height: 288 },
    SceneClass: PacmanScene,
  },
  {
    id: 'galaga',
    title: 'GALAGA',
    key: 'game-galaga',
    resolution: { width: 224, height: 288 },
    SceneClass: GalagaScene,
  },
  {
    id: 'donkeykong',
    title: 'DONKEY KONG',
    key: 'game-dk',
    resolution: { width: 224, height: 240 },
    SceneClass: DKScene,
  },
  {
    id: 'mariobros',
    title: 'MARIO BROS',
    key: 'game-mariobros',
    resolution: { width: 256, height: 240 },
    SceneClass: MarioBrosScene,
  },
  {
    id: 'arkanoid',
    title: 'ARKANOID',
    key: 'game-arkanoid',
    resolution: { width: 224, height: 256 },
    SceneClass: ArkanoidScene,
  },
  {
    id: 'privacypolicy',
    title: 'PRIVACY POLICY',
    key: 'game-privacypolicy',
    resolution: { width: 224, height: 288 },
    SceneClass: PrivacyPolicyScene,
    // Easter egg — visible for now; we'll hide it once it's dialed in.
  },
  {
    id: 'sandbox',
    title: 'TEST',
    key: 'game-sandbox',
    resolution: { width: 224, height: 288 },
    SceneClass: SandboxScene,
    hidden: true,
  },
  // More games land here one at a time: Mario Bros. -> Dig Dug.
];
