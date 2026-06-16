import Phaser from 'phaser';
import { PacmanScene } from './games/pacman/PacmanScene';
import { GalagaScene } from './games/galaga/GalagaScene';
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
    id: 'sandbox',
    title: 'TEST',
    key: 'game-sandbox',
    resolution: { width: 224, height: 288 },
    SceneClass: SandboxScene,
  },
  // More games land here one at a time: Donkey Kong -> Mario Bros. -> Dig Dug.
];
