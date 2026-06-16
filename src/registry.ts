import Phaser from 'phaser';
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
    id: 'sandbox',
    title: 'TEST',
    key: 'game-sandbox',
    resolution: { width: 224, height: 288 },
    SceneClass: SandboxScene,
  },
  // Games land here one at a time: Pac-Man -> Galaga -> Donkey Kong ->
  // Mario Bros. -> Dig Dug.
];
