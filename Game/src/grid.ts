/**
 * The board grid: 7 columns × 11 rows, one world unit per cell, row 0 at the top (the nest) and
 * row 10 at the bottom (the base). Pure functions, safe in sim code.
 */
export const COLS = 7;
export const ROWS = 11;
export const CELLS = COLS * ROWS;
/** World y of the board's centre. */
export const BOARD_Y = 0.9;
/** Ant nests: their cell and the wave they open on. The first one is open from the start. */
export interface NestDef {
  cell: number;
  fromWave: number;
}
export const NESTS: readonly NestDef[] = [
  { cell: 0 * COLS + 3, fromWave: 1 },
  { cell: 1 * COLS + 0, fromWave: 4 },
  { cell: 1 * COLS + 6, fromWave: 7 },
];
/** The first nest (its path is Board.path). */
export const NEST_CELL = NESTS[0]!.cell;
export const isNest = (cell: number): boolean => NESTS.some((n) => n.cell === cell);
/** True when every nest, open or not yet, can still reach the base through `dist`. */
export const nestsReach = (dist: ArrayLike<number>): boolean => NESTS.every((n) => dist[n.cell]! >= 0);
export const BASE_CELL = (ROWS - 1) * COLS + 3;

/** Tray below the board, one row: the three offers, then the Reroll button on the right. */
export const TRAY_SLOT_W = 1.85;
export const TRAY_REROLL_W = 1.25;
export const TRAY_SLOT_H = 1.4;
export const TRAY_GAP = 0.15;
/** Offer slots are 0–2; the Reroll button is slot 3. */
export const REROLL_SLOT = 3;
export const TRAY_SLOTS = 4;
export const TRAY_Y = BOARD_Y - ROWS / 2 - 0.3 - TRAY_SLOT_H / 2;

/** The rect that must stay on screen: board plus tray, with a small margin. */
export const VIEW_RECT = (() => {
  const top = BOARD_Y + ROWS / 2 + 0.25;
  const bottom = TRAY_Y - TRAY_SLOT_H / 2 - 0.15;
  return { x: 0, y: (top + bottom) / 2, w: COLS + 0.5, h: top - bottom };
})();

export const colOf = (cell: number): number => cell % COLS;
export const rowOf = (cell: number): number => (cell / COLS) | 0;
export const cellX = (cell: number): number => colOf(cell) - (COLS - 1) / 2;
export const cellY = (cell: number): number => BOARD_Y + (ROWS - 1) / 2 - rowOf(cell);

/** The cell under a world point, or -1 off the board. */
export function cellAt(x: number, y: number): number {
  const col = Math.floor(x + COLS / 2);
  const row = Math.floor(BOARD_Y + ROWS / 2 - y);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return -1;
  return row * COLS + col;
}

/** The nearest cell to a world point, clamped onto the board. */
export function nearestCell(x: number, y: number): number {
  let col = Math.floor(x + COLS / 2);
  let row = Math.floor(BOARD_Y + ROWS / 2 - y);
  col = col < 0 ? 0 : col >= COLS ? COLS - 1 : col;
  row = row < 0 ? 0 : row >= ROWS ? ROWS - 1 : row;
  return row * COLS + col;
}

const TRAY_LEFT = -(TRAY_REROLL_W + 3 * (TRAY_SLOT_W + TRAY_GAP)) / 2;
export const trayW = (slot: number): number => (slot === REROLL_SLOT ? TRAY_REROLL_W : TRAY_SLOT_W);
export const trayX = (slot: number): number =>
  slot === REROLL_SLOT ? TRAY_LEFT + 3 * (TRAY_SLOT_W + TRAY_GAP) + TRAY_REROLL_W / 2 : TRAY_LEFT + TRAY_SLOT_W / 2 + slot * (TRAY_SLOT_W + TRAY_GAP);
export const trayY = (_slot: number): number => TRAY_Y;

/** The tray slot under a world point, or -1. */
export function slotAt(x: number, y: number): number {
  if (Math.abs(y - TRAY_Y) > (TRAY_SLOT_H + TRAY_GAP) / 2) return -1;
  for (let s = 0; s < TRAY_SLOTS; s++) if (Math.abs(x - trayX(s)) <= (trayW(s) + TRAY_GAP) / 2) return s;
  return -1;
}

/**
 * The top-left cell of a w×h footprint centred under a world point, or -1 when it does not fit
 * on the board.
 */
export function footprintAt(x: number, y: number, w: number, h: number): number {
  const c = cellAt(x - (w - 1) / 2, y + (h - 1) / 2);
  if (c < 0 || colOf(c) + w > COLS || rowOf(c) + h > ROWS) return -1;
  return c;
}

/** World centre of a w×h footprint whose top-left cell is `cell`. */
export const footprintX = (cell: number, w: number): number => cellX(cell) + (w - 1) / 2;
export const footprintY = (cell: number, h: number): number => cellY(cell) - (h - 1) / 2;

/** The k-th cell of a w×h footprint whose top-left cell is `cell` (row by row). */
export const footprintCell = (cell: number, w: number, k: number): number => cell + ((k / w) | 0) * COLS + (k % w);

/**
 * Neighbour of `cell` in direction `d` (0 down, 1 left, 2 right, 3 up), or -1. Down first so
 * ties lean towards the base and paths run straight.
 */
export function neighbour(cell: number, d: number): number {
  const col = colOf(cell);
  const row = rowOf(cell);
  if (d === 0) return row + 1 < ROWS ? cell + COLS : -1;
  if (d === 1) return col > 0 ? cell - 1 : -1;
  if (d === 2) return col + 1 < COLS ? cell + 1 : -1;
  return row > 0 ? cell - COLS : -1;
}

/**
 * Breadth-first distances to the base over free cells (`blocked[c]` non-zero: blocked). Fills
 * `dist` with steps to the base, -1 for blocked or unreachable cells. `queue` is scratch of CELLS.
 */
export function flowField(blocked: ArrayLike<number>, dist: { [i: number]: number }, queue: Int16Array): void {
  for (let c = 0; c < CELLS; c++) dist[c] = -1;
  if (blocked[BASE_CELL]) return;
  let head = 0;
  let tail = 0;
  dist[BASE_CELL] = 0;
  queue[tail++] = BASE_CELL;
  while (head < tail) {
    const c = queue[head++]!;
    const d = dist[c]! + 1;
    for (let k = 0; k < 4; k++) {
      const n = neighbour(c, k);
      if (n >= 0 && !blocked[n] && dist[n] === -1) {
        dist[n] = d;
        queue[tail++] = n;
      }
    }
  }
}

/** The next cell to walk to from `cell`, following the field (-1 at the base or when stuck). */
export function nextCell(dist: ArrayLike<number>, cell: number): number {
  const here = dist[cell]!;
  let best = -1;
  let bestD = here < 0 ? 0x7fff : here;
  for (let k = 0; k < 4; k++) {
    const n = neighbour(cell, k);
    if (n < 0) continue;
    const d = dist[n]!;
    if (d >= 0 && d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best;
}

/** Writes the path from `from` to the base into `out`; returns its length (0: no path). */
export function tracePath(dist: ArrayLike<number>, from: number, out: { [i: number]: number }): number {
  if (dist[from]! < 0) return 0;
  let c = from;
  let n = 0;
  out[n++] = c;
  while (c !== BASE_CELL && n < CELLS) {
    c = nextCell(dist, c);
    if (c < 0) return 0;
    out[n++] = c;
  }
  return n;
}
