import { CellCode, GAME } from './constants';

/**
 * Stage layouts as rows of cell-code strings (Section 9.3). Each row is exactly
 * `GRID_COLS` (13) characters; a layout uses at most `GRID_ROWS` (18) rows.
 *
 *   '.' empty   'X' gold   'S' silver   W O C G R B V Y = color bricks
 *
 * This slice ships a representative arc of the 32 brick stages; `stageLayout()`
 * cycles through them for higher stage numbers until the full set is authored.
 */
export const STAGES: string[][] = [
  // Stage 1 — simple color rows.
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
  // Stage 2 — gaps and a silver spine.
  [
    'W.W.W.W.W.W.W',
    '.............',
    'OOOOSSSSSOOOO',
    'CCCC.....CCCC',
    'GGGGSSSSSGGGG',
    '.............',
    'RRRR.....RRRR',
    'VVVVVVVVVVVVV',
  ],
  // Stage 3 — gold pillars as redirectors.
  [
    'X...........X',
    'X.RRRRRRRRR.X',
    'X.RBBBBBBBR.X',
    'X.RB.....BR.X',
    'X.RB.SSS.BR.X',
    'X.RB.....BR.X',
    'X.RBBBBBBBR.X',
    'X.RRRRRRRRR.X',
    'X...........X',
  ],
  // Stage 4 — checkerboard with silver accents.
  [
    'Y.Y.Y.Y.Y.Y.Y',
    '.C.C.C.C.C.C.',
    'Y.Y.Y.Y.Y.Y.Y',
    '.S.S.S.S.S.S.',
    'G.G.G.G.G.G.G',
    '.V.V.V.V.V.V.',
    'G.G.G.G.G.G.G',
    'WWWWWWWWWWWWW',
  ],
  // Stage 5 — dense fortress, heavy silver, gold corners.
  [
    'XSSSSSSSSSSSX',
    'SVVVVVVVVVVVS',
    'SVBBBBBBBBBVS',
    'SVBRRRRRRRBVS',
    'SVBR.....RBVS',
    'SVBR.SSS.RBVS',
    'SVBR.....RBVS',
    'SVBRRRRRRRBVS',
    'SVBBBBBBBBBVS',
    'SVVVVVVVVVVVS',
    'XSSSSSSSSSSSX',
  ],
];

export interface ParsedStage {
  /** grid[row][col] cell codes. */
  grid: CellCode[][];
  /** number of bricks that count toward stage clear (not gold, not empty). */
  destroyableCount: number;
}

/** Return the raw layout rows for a 1-based stage number, cycling the set. */
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
