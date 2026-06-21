import { CellCode, GAME } from './constants';

/**
 * The 32 brick stages as rows of cell-code strings (Section 9.3). Each row is
 * exactly `GRID_COLS` (13) characters; a layout uses at most `GRID_ROWS` (18)
 * rows. Stage 33 is the DOH boss and has no layout here.
 *
 *   '.' empty   'X' gold   'S' silver   W O C G R B V Y = color bricks
 *
 * Difficulty arc (Section 9.2): 1–5 simple, 6–12 introduce gold + red/blue,
 * 13–20 dense, 21–28 maze-like with heavy gold, 29–32 near-max density. Gold
 * is used only as accents/frames — never to fully seal destroyable bricks off
 * from the open playfield below.
 */
export const STAGES: string[][] = [
  // 1 — classic color rows.
  [
    '.............',
    'OOOOOOOOOOOOO',
    'CCCCCCCCCCCCC',
    'GGGGGGGGGGGGG',
    'RRRRRRRRRRRRR',
    'BBBBBBBBBBBBB',
    'VVVVVVVVVVVVV',
    '.............',
  ],
  // 2 — columns.
  [
    'W.W.W.W.W.W.W',
    'W.W.W.W.W.W.W',
    'O.O.O.O.O.O.O',
    'O.O.O.O.O.O.O',
    'C.C.C.C.C.C.C',
    'C.C.C.C.C.C.C',
  ],
  // 3 — pyramid.
  [
    '......Y......',
    '.....YYY.....',
    '....OOOOO....',
    '...CCCCCCC...',
    '..GGGGGGGGG..',
    '.RRRRRRRRRRR.',
    'BBBBBBBBBBBBB',
  ],
  // 4 — checkerboard with a silver band.
  [
    'Y.Y.Y.Y.Y.Y.Y',
    '.C.C.C.C.C.C.',
    'Y.Y.Y.Y.Y.Y.Y',
    '.G.G.G.G.G.G.',
    'SSSSSSSSSSSSS',
    '.V.V.V.V.V.V.',
    'W.W.W.W.W.W.W',
  ],
  // 5 — concentric diamond.
  [
    '......R......',
    '.....RBR.....',
    '....RBVBR....',
    '...RBVCVBR...',
    '..RBVCGCVBR..',
    '...RBVCVBR...',
    '....RBVBR....',
    '.....RBR.....',
    '......R......',
  ],
  // 6 — gold side pillars (open bottom).
  [
    'X...........X',
    'X.RRRRRRRRR.X',
    'X.BBBBBBBBB.X',
    'X.GGGGGGGGG.X',
    'X.OOOOOOOOO.X',
    'X.CCCCCCCCC.X',
    'X...........X',
  ],
  // 7 — descending zigzag.
  [
    'RRR..........',
    '.RRR.........',
    '..RRR........',
    '...BBB.......',
    '....BBB......',
    '.....BBB.....',
    '......GGG....',
    '.......GGG...',
    '........GGG..',
    '.........YYY.',
  ],
  // 8 — brick wall with silver mortar.
  [
    'OOOOOOOOOOOOO',
    'SSSSSSSSSSSSS',
    'CCCCCCCCCCCCC',
    'SSSSSSSSSSSSS',
    'GGGGGGGGGGGGG',
    'SSSSSSSSSSSSS',
    'RRRRRRRRRRRRR',
  ],
  // 9 — plus sign.
  [
    '.....VVV.....',
    '.....VVV.....',
    '.....VVV.....',
    'GGGGGGGGGGGGG',
    'GGG.......GGG',
    '.....BBB.....',
    '.....BBB.....',
    '.....BBB.....',
  ],
  // 10 — hourglass with gold corners.
  [
    'XRRRRRRRRRRRX',
    '.BBBBBBBBBBB.',
    '..GGGGGGGGG..',
    '...OOOOOOO...',
    '....CCCCC....',
    '...OOOOOOO...',
    '..GGGGGGGGG..',
    '.BBBBBBBBBBB.',
    'XRRRRRRRRRRRX',
  ],
  // 11 — vertical stripes with silver.
  [
    'R.B.S.G.S.B.R',
    'R.B.S.G.S.B.R',
    'R.B.S.G.S.B.R',
    'R.B.S.G.S.B.R',
    'R.B.S.G.S.B.R',
    'R.B.S.G.S.B.R',
  ],
  // 12 — gold lattice.
  [
    'X.X.X.X.X.X.X',
    '.OOO.OOO.OOO.',
    'X.X.X.X.X.X.X',
    '.CCC.CCC.CCC.',
    'X.X.X.X.X.X.X',
    '.GGG.GGG.GGG.',
    'X.X.X.X.X.X.X',
  ],
  // 13 — dense slab with a central void.
  [
    'OOOOOOOOOOOOO',
    'CCCCCCCCCCCCC',
    'GGGGGGGGGGGGG',
    'RRRRR...RRRRR',
    'BBBB.....BBBB',
    'RRRRR...RRRRR',
    'GGGGGGGGGGGGG',
    'SSSSSSSSSSSSS',
  ],
  // 14 — interlocking diamonds.
  [
    '.O.O.O.O.O.O.',
    'O.O.O.O.O.O.O',
    '.S.S.S.S.S.S.',
    'S.S.S.S.S.S.S',
    '.G.G.G.G.G.G.',
    'G.G.G.G.G.G.G',
    '.R.R.R.R.R.R.',
  ],
  // 15 — nested fortress (open bottom).
  [
    'BRRRRRRRRRRRB',
    'BRSSSSSSSSSRB',
    'BRSGGGGGGGSRB',
    'BRSG.....GSRB',
    'BRSGGGGGGGSRB',
    'BRSSSSSSSSSRB',
    'BRRRRRRRRRRRB',
  ],
  // 16 — opposing chevrons.
  [
    'VV.........VV',
    '.VV.......VV.',
    '..VV.....VV..',
    '...VV...VV...',
    '....VV.VV....',
    '.....VVV.....',
    '....BB.BB....',
    '...BB...BB...',
    '..BB.....BB..',
    '.BB.......BB.',
    'BB.........BB',
  ],
  // 17 — gold weave.
  [
    'RXRXRXRXRXRXR',
    'R.R.R.R.R.R.R',
    'RXRXRXRXRXRXR',
    'G.G.G.G.G.G.G',
    'GXGXGXGXGXGXG',
    'G.G.G.G.G.G.G',
    'GXGXGXGXGXGXG',
  ],
  // 18 — heart.
  [
    '..RR.....RR..',
    '.RRRR...RRRR.',
    'RRRRRR.RRRRRR',
    'RRRRRRRRRRRRR',
    'RRRRRRRRRRRRR',
    '.RRRRRRRRRRR.',
    '..RRRRRRRRR..',
    '...RRRRRRR...',
    '....RRRRR....',
    '.....RRR.....',
    '......R......',
  ],
  // 19 — offset brick wall.
  [
    'CCCCCCCCCCCCC',
    '.CC.CC.CC.CC.',
    'GGGGGGGGGGGGG',
    '.GG.GG.GG.GG.',
    'RRRRRRRRRRRRR',
    '.RR.RR.RR.RR.',
    'VVVVVVVVVVVVV',
  ],
  // 20 — gold cross over orange field.
  [
    'XOOOOOOOOOOOX',
    'OXOOOOOOOOOXO',
    'OOXOOOOOOOXOO',
    'OOOXOOOOOXOOO',
    'OOOOXOOOXOOOO',
    'OOOOOXOXOOOOO',
    'OOOOOOXOOOOOO',
    'OOOOOXOXOOOOO',
    'OOOOXOOOXOOOO',
  ],
  // 21 — gold/silver maze columns.
  [
    'XSXSXSXSXSXSX',
    'X.X.X.X.X.X.X',
    'XSXSXSXSXSXSX',
    'X.X.X.X.X.X.X',
    'XSXSXSXSXSXSX',
  ],
  // 22 — twin diamonds.
  [
    '...V.....V...',
    '..VVV...VVV..',
    '.VVVVV.VVVVV.',
    'VVVVVVVVVVVVV',
    '.VVVVV.VVVVV.',
    '..VVV...VVV..',
    '...V.....V...',
  ],
  // 23 — gold-rimmed vault (open bottom).
  [
    'XXXXXXXXXXXXX',
    'XSSSSSSSSSSSX',
    'XSRRRRRRRRRSX',
    'XSR.......RSX',
    'XSR.GGGGG.RSX',
    'XSR.......RSX',
    'XSRRRRRRRRRSX',
    'XSSSSSSSSSSSX',
  ],
  // 24 — window grid.
  [
    'GGGGGGGGGGGGG',
    'G.G.G.G.G.G.G',
    'GGGGGGGGGGGGG',
    'G.G.G.G.G.G.G',
    'GGGGGGGGGGGGG',
    'G.G.G.G.G.G.G',
    'GGGGGGGGGGGGG',
  ],
  // 25 — gold chevron with silver edges.
  [
    'XX.........XX',
    'SXX.......XXS',
    '.SXX.....XXS.',
    '..SXX...XXS..',
    '...SXX.XXS...',
    '....SXXXS....',
    '.....SXS.....',
  ],
  // 26 — layered keep (open bottom).
  [
    'RRRRRRRRRRRRR',
    'RSSSSSSSSSSSR',
    'RSBBBBBBBBBSR',
    'RSBGGGGGGGBSR',
    'RSBG.....GBSR',
    'RSBGGGGGGGBSR',
    'RSBBBBBBBBBSR',
    'RSSSSSSSSSSSR',
  ],
  // 27 — gold/silver lattice.
  [
    'X.S.X.S.X.S.X',
    '.B.B.B.B.B.B.',
    'S.X.S.X.S.X.S',
    '.B.B.B.B.B.B.',
    'X.S.X.S.X.S.X',
    '.B.B.B.B.B.B.',
    'S.X.S.X.S.X.S',
  ],
  // 28 — silver-capped columns with a gold band.
  [
    'S.S.S.S.S.S.S',
    'R.R.R.R.R.R.R',
    'R.R.R.R.R.R.R',
    'X.X.X.X.X.X.X',
    'B.B.B.B.B.B.B',
    'B.B.B.B.B.B.B',
    'S.S.S.S.S.S.S',
  ],
  // 29 — dense banded board with gold/silver accents.
  [
    'VVVVVVVVVVVVV',
    'VSVSVSVSVSVSV',
    'VVVVVVVVVVVVV',
    'RXRXRXRXRXRXR',
    'RRRRRRRRRRRRR',
    'BSBSBSBSBSBSB',
    'BBBBBBBBBBBBB',
    'GXGXGXGXGXGXG',
    'GGGGGGGGGGGGG',
  ],
  // 30 — silver-and-gold wall.
  [
    'SSSSSSSSSSSSS',
    'SXSXSXSXSXSXS',
    'SSSSSSSSSSSSS',
    'XSXSXSXSXSXSX',
    'SSSSSSSSSSSSS',
    'SXSXSXSXSXSXS',
    'SSSSSSSSSSSSS',
  ],
  // 31 — banded gauntlet with embedded gold.
  [
    'RRRRRRRRRRRRR',
    'RXR.R.R.R.RXR',
    'RRRRRRRRRRRRR',
    'GGGGGGGGGGGGG',
    'GXG.G.G.G.GXG',
    'GGGGGGGGGGGGG',
    'BBBBBBBBBBBBB',
    'BXB.B.B.B.BXB',
    'BBBBBBBBBBBBB',
  ],
  // 32 — final near-max density.
  [
    'SVSVSVSVSVSVS',
    'VRVRVRVRVRVRV',
    'RBRBRBRBRBRBR',
    'BGBGBGBGBGBGB',
    'GYGYGYGYGYGYG',
    'YOYOYOYOYOYOY',
    'OWOWOWOWOWOWO',
    'SSSSSSSSSSSSS',
    'XOXOXOXOXOXOX',
  ],
];

export interface ParsedStage {
  /** grid[row][col] cell codes. */
  grid: CellCode[][];
  /** number of bricks that count toward stage clear (not gold, not empty). */
  destroyableCount: number;
}

/** Return the raw layout rows for a 1-based stage number (cycles past 32). */
export function stageLayout(stage: number): string[] {
  const idx = (Math.max(1, stage) - 1) % STAGES.length;
  return STAGES[idx];
}

/**
 * Validate + parse a layout into a grid (Section 9.3 check). Throws on a
 * malformed layout so authoring mistakes surface immediately.
 */
export function parseStage(rows: string[]): ParsedStage {
  if (rows.length > GAME.gridRows) {
    throw new Error(`Stage has ${rows.length} rows, max ${GAME.gridRows}`);
  }
  const grid: CellCode[][] = [];
  let destroyableCount = 0;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (row.length !== GAME.gridCols) {
      throw new Error(`Stage row ${r} has ${row.length} cols, expected ${GAME.gridCols}`);
    }
    const cells: CellCode[] = [];
    for (const ch of row) {
      const code = ch as CellCode;
      cells.push(code);
      if (code !== '.' && code !== 'X') {
        destroyableCount++;
      }
    }
    grid.push(cells);
  }
  return { grid, destroyableCount };
}
