import Phaser from 'phaser';
import { drawPixelArt } from '../../shared/textures';

/**
 * DOH — the stage-33 boss (Section 7). A large Moai head drawn from an ASCII
 * grid and baked at `DOH_PIXEL` device-pixels per cell so it fills the upper
 * ~40% of the playfield. Damage is shown by tinting the one texture toward red.
 */
export const DOH_PIXEL = 7;

// 26 cols × 14 rows. D=stone, B=brow, E=eye socket, P=lip, M=mouth opening.
const DOH_ART: string[] = [
  '  DDDDDDDDDDDDDDDDDDDDDD  ',
  ' DDDDDDDDDDDDDDDDDDDDDDDD ',
  'DDDDDDDDDDDDDDDDDDDDDDDDDD',
  'BBBBBBBBBBBBBBBBBBBBBBBBBB',
  'DDEEEEEDDDDDDDDDDEEEEEDDDD',
  'DDEEEEEDDDDDDDDDDEEEEEDDDD',
  'DDEEEEEDDDDDDDDDDEEEEEDDDD',
  'DDDDDDDDDDDDDDDDDDDDDDDDDD',
  'DDDDDDDDDDDDDDDDDDDDDDDDDD',
  'DDDDDPPPPPPPPPPPPPPPPDDDDD',
  'DDDDDP  MMMMMMMMMM  PDDDDD',
  'DDDDDPPPPPPPPPPPPPPPPDDDDD',
  'DDDDDDDDDDDDDDDDDDDDDDDDDD',
  ' DDDDDDDDDDDDDDDDDDDDDDDD ',
];

// Diamond projectile (6×6). K = bright core.
const DOH_PROJECTILE: string[] = [
  '  KK  ',
  ' KKKK ',
  'KKKKKK',
  ' KKKK ',
  '  KK  ',
  '      ',
];

export const DOH_TX = {
  body: 'ak-doh',
  projectile: 'ak-doh-proj',
} as const;

export function buildDohTextures(scene: Phaser.Scene): void {
  const w = DOH_ART[0].length;
  for (const row of DOH_ART) {
    if (row.length !== w) {
      throw new Error(`DOH art row width mismatch: ${row.length} !== ${w}`);
    }
  }
  drawPixelArt(
    scene,
    DOH_TX.body,
    DOH_ART,
    { D: 0x9a8a78, B: 0x6a5a48, E: 0x201818, P: 0x7a6a58, M: 0x120c0c },
    DOH_PIXEL,
  );
  drawPixelArt(scene, DOH_TX.projectile, DOH_PROJECTILE, { K: 0xfff080 });
}
