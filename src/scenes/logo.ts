import Phaser from 'phaser';
import { drawArcTitle, ArcTitleSpec, BLOCK_FONT } from '../shared/titleArt';

/**
 * The COWABUNGA ARCADE title logo — a preset for the shared Title Art engine.
 * The reusable machinery (arc wordmark, banner, twinkling stars, block font)
 * lives in `src/shared/titleArt.ts`; this file is just the menu's configuration.
 */
const COWABUNGA_TITLE: ArcTitleSpec = {
  banner: {
    text: 'CLASSIC ARCADE GAMES',
    width: 200,
    height: 16,
    inset: 9,
    fill: 0xd1232a,
    outline: 0x000000,
    textColor: '#ffffff',
    fontSize: 13,
  },
  wordmark: {
    text: 'COWABUNGA',
    font: BLOCK_FONT,
    fill: 0x86d52a,
    crack: 0x3f7d1e,
    outline: 0x000000,
    pixelSize: 2,
    grow: 0.5,
    growExp: 1.3,
    gapTight: -2,
    targetArc: 200,
    endAngleDeg: 36,
  },
  starColors: [0xfcfc00, 0xffffff, 0x3cbcfc],
};

/** Draw the COWABUNGA title centered on `cx`, starting at `topY`. */
export function drawCowabungaLogo(scene: Phaser.Scene, cx: number, topY: number): void {
  drawArcTitle(scene, cx, topY, COWABUNGA_TITLE);
}
