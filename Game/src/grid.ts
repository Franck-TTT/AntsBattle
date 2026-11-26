/**
 * The board grid. Each level has its own size, `cols` × `rows` (Board.cols, Board.rows), up to
 * COLS × ROWS. Cells are numbered on the largest grid (`row * COLS + col`), so a cell keeps its
 * number and its world position whatever the level's size: the level's board is the top-left
 * `cols` × `rows` of it, and the default 7 × 11 board stands where it always has. One world unit
 * per cell, row 0 at the top. Each level also puts its nests and base where it likes
 * (Board.nestCell, Board.baseCell). Pure functions, safe in sim code.
 */
/** The largest board a level can have (schema MAX_COLS, MAX_ROWS; a test keeps them equal). */
export const COLS = 10;
export const ROWS = 14;
export const CELLS = COLS * ROWS;
/** The smallest board a level can have. */
export const MIN_COLS = 4;
export const MIN_ROWS = 4;
/** The size of a level that does not give one. */
export const DEFAULT_COLS = 7;
export const DEFAULT_ROWS = 11;
/** World y of the default board's centre. */
export const BOARD_Y = 0.9;
/** Most nests a level can have: the size of Board.nestCell (schema MAX_NESTS; a test keeps them equal). */
export const MAX_NESTS = 5;
/** An ant nest: its cell and the wave it opens on. */
export interface NestDef {
  cell: number;
  fromWave: number;
}
/**
 * Nests and base of a level that does not place its own, on a `cols` × `rows` board: a nest at the
 * top centre (open from the start), two more on the sides (waves 4 and 7), the base at the bottom centre.
 */
export function defaultNests(cols: number): NestDef[] {
  return [
    { cell: 0 * COLS + (cols >> 1), fromWave: 1 },
    { cell: 1 * COLS + 0, fromWave: 4 },
    { cell: 1 * COLS + cols - 1, fromWave: 7 },
  ];
}
export const defaultBase = (cols: number, rows: number): number => (rows - 1) * COLS + (cols >> 1);
/** The default board's nests and base. */
export const DEFAULT_NESTS: readonly NestDef[] = defaultNests(DEFAULT_COLS);
export const DEFAULT_BASE = defaultBase(DEFAULT_COLS, DEFAULT_ROWS);

/** Where a level's nests and base stand: the Board resource's fields, or plain arrays (tests, tools). */
export interface Markers {
  readonly nestCount: ArrayLike<number>;
  readonly nestCell: ArrayLike<number>;
  readonly nestWave: ArrayLike<number>;
  readonly baseCell: ArrayLike<number>;
}
export const DEFAULT_MARKERS: Markers = {
  nestCount: [DEFAULT_NESTS.length],
  nestCell: DEFAULT_NESTS.map((n) => n.cell),
  nestWave: DEFAULT_NESTS.map((n) => n.fromWave),
  baseCell: [DEFAULT_BASE],
};
/** True on a nest or the base: nothing may be built there. */
export function isMarker(m: Markers, cell: number): boolean {
  if (cell === m.baseCell[0]) return true;
  for (let n = 0; n < m.nestCount[0]!; n++) if (m.nestCell[n] === cell) return true;
  return false;
}
/**
 * Fills `out` (CELLS) with 1 on every cell of a `cols` × `rows` board the player can place nothing
 * on: the `painted` cells (a level's no-build zone) and the 8 cells around each nest, open or not yet.
 */
export function noBuildCells(m: Markers, cols: number, rows: number, painted: readonly number[], out: Uint8Array): Uint8Array {
  out.fill(0);
  for (const c of painted) if (onBoard(c, cols, rows)) out[c] = 1;
  for (let n = 0; n < m.nestCount[0]!; n++) {
    const nc = m.nestCell[n]!;
    const col = colOf(nc);
    const row = rowOf(nc);
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const c2 = col + dc;
        const r2 = row + dr;
        if ((dr || dc) && c2 >= 0 && r2 >= 0 && c2 < cols && r2 < rows) out[r2 * COLS + c2] = 1;
      }
    }
  }
  return out;
}
/** True when every nest, open or not yet, can still reach the base through `dist`. */
export function nestsReach(m: Markers, dist: ArrayLike<number>): boolean {
  for (let n = 0; n < m.nestCount[0]!; n++) if (dist[m.nestCell[n]!]! < 0) return false;
  return true;
}

export const colOf = (cell: number): number => cell % COLS;
export const rowOf = (cell: number): number => (cell / COLS) | 0;
/** True when `cell` is on a `cols` × `rows` board. */
export const onBoard = (cell: number, cols: number, rows: number): boolean => cell >= 0 && colOf(cell) < cols && rowOf(cell) < rows;
/** World position of a cell's centre: the same on every board size. */
export const cellX = (cell: number): number => colOf(cell) - (DEFAULT_COLS - 1) / 2;
export const cellY = (cell: number): number => BOARD_Y + (DEFAULT_ROWS - 1) / 2 - rowOf(cell);
/** Column and row under a world x or y (may fall off the board). */
export const colAt = (x: number): number => Math.floor(x + DEFAULT_COLS / 2);
export const rowAt = (y: number): number => Math.floor(BOARD_Y + DEFAULT_ROWS / 2 - y);
/** World rect of a `cols` × `rows` board: centre and size. */
export function boardRect(cols: number, rows: number): { x: number; y: number; w: number; h: number } {
  return { x: cellX(0) - 0.5 + cols / 2, y: cellY(0) + 0.5 - rows / 2, w: cols, h: rows };
}

/** The cell under a world point on a `cols` × `rows` board, or -1 off it. */
export function cellAt(x: number, y: number, cols: number, rows: number): number {
  const col = colAt(x);
  const row = rowAt(y);
  if (col < 0 || col >= cols || row < 0 || row >= rows) return -1;
  return row * COLS + col;
}

/** The nearest cell to a world point, clamped onto a `cols` × `rows` board. */
export function nearestCell(x: number, y: number, cols: number, rows: number): number {
  let col = colAt(x);
  let row = rowAt(y);
  col = col < 0 ? 0 : col >= cols ? cols - 1 : col;
  row = row < 0 ? 0 : row >= rows ? rows - 1 : row;
  return row * COLS + col;
}

/** Tray below the board, one row: the three offers, then the Reroll button on the right. */
export const TRAY_SLOT_W = 1.85;
export const TRAY_REROLL_W = 1.25;
export const TRAY_SLOT_H = 1.4;
export const TRAY_GAP = 0.15;
/** Offer slots are 0–2; the Reroll button is slot 3. */
export const REROLL_SLOT = 3;
export const TRAY_SLOTS = 4;
/** Width of the whole tray. */
export const TRAY_W = TRAY_REROLL_W + 3 * (TRAY_SLOT_W + TRAY_GAP);
export const trayW = (slot: number): number => (slot === REROLL_SLOT ? TRAY_REROLL_W : TRAY_SLOT_W);
/**
 * The bottom panel: the tray, then the HUD bar above it, pinned to the bottom of the safe area at
 * the same on-screen size on every level. Sizes in UI reference px (1080 × 1920 reference); the
 * board is fitted into the screen above it (FitView), so a level's size changes only the cells.
 */
/** UI reference px per tray unit (TRAY_* sizes): the tray is about as wide as the HUD bar. */
export const PANEL_REF_PER_UNIT = 132;
const PANEL_MARGIN_REF = 24;
const PANEL_GAP_REF = 20;
/** Height of the HUD bar (ui/docs/hud-bar.ui.json, 38 pt on a 393 pt wide phone). */
const HUD_REF = 104;
/** Screen band the panel takes at the bottom, above the safe area: the board stays clear of it. */
export const PANEL_RESERVE_REF = PANEL_MARGIN_REF + TRAY_SLOT_H * PANEL_REF_PER_UNIT + 2 * PANEL_GAP_REF + HUD_REF;

/** Where the panel stands in the world: written into the Panel resource by FitView. */
export interface PanelLayout {
  x: number;
  trayY: number;
  hudY: number;
  /** World units per tray unit. */
  scale: number;
}

/**
 * The panel's world placement for a world view (centre, half height `orthoSize`) on a screen of
 * `height` points with `safeLeft`/`safeRight`/`safeBottom` insets, the UI drawing `uiScale` points
 * per reference px.
 */
export function panelLayout(cx: number, cy: number, orthoSize: number, height: number, safeLeft: number, safeRight: number, safeBottom: number, uiScale: number, out: PanelLayout): PanelLayout {
  const worldPerPt = (2 * orthoSize) / Math.max(height, 1);
  const worldPerRef = worldPerPt * uiScale;
  const scale = worldPerRef * PANEL_REF_PER_UNIT;
  const bottom = cy - orthoSize + safeBottom * worldPerPt + PANEL_MARGIN_REF * worldPerRef;
  out.x = cx + ((safeLeft - safeRight) / 2) * worldPerPt;
  out.trayY = bottom + (scale * TRAY_SLOT_H) / 2;
  out.hudY = bottom + scale * TRAY_SLOT_H + (PANEL_GAP_REF + HUD_REF / 2) * worldPerRef;
  out.scale = scale;
  return out;
}

/** Centre x of a tray slot. */
export function trayX(slot: number, p: PanelLayout): number {
  const left = -TRAY_W / 2;
  const local = slot === REROLL_SLOT ? left + 3 * (TRAY_SLOT_W + TRAY_GAP) + TRAY_REROLL_W / 2 : left + TRAY_SLOT_W / 2 + slot * (TRAY_SLOT_W + TRAY_GAP);
  return p.x + local * p.scale;
}
/** Centre line of the tray. */
export const trayY = (p: PanelLayout): number => p.trayY;

/** The tray slot under a world point, or -1. */
export function slotAt(x: number, y: number, p: PanelLayout): number {
  if (Math.abs(y - p.trayY) > ((TRAY_SLOT_H + TRAY_GAP) / 2) * p.scale) return -1;
  for (let s = 0; s < TRAY_SLOTS; s++) if (Math.abs(x - trayX(s, p)) <= ((trayW(s) + TRAY_GAP) / 2) * p.scale) return s;
  return -1;
}

/**
 * Smallest board the camera frames: smaller levels keep the cells of this size instead of
 * blowing them up (largest cell on screen).
 */
export const FIT_MIN_COLS = 6;
export const FIT_MIN_ROWS = 8;
/** The rect that must stay on screen above the panel: a `cols` × `rows` board with a small margin. */
export function viewRect(cols: number, rows: number): { x: number; y: number; w: number; h: number } {
  const b = boardRect(cols, rows);
  return { x: b.x, y: b.y, w: Math.max(cols, FIT_MIN_COLS) + 0.5, h: Math.max(rows, FIT_MIN_ROWS) + 0.5 };
}

/**
 * The top-left cell of a w×h footprint centred under a world point, or -1 when it does not fit
 * on a `cols` × `rows` board.
 */
export function footprintAt(x: number, y: number, w: number, h: number, cols: number, rows: number): number {
  const c = cellAt(x - (w - 1) / 2, y + (h - 1) / 2, cols, rows);
  if (c < 0 || colOf(c) + w > cols || rowOf(c) + h > rows) return -1;
  return c;
}

/** World centre of a w×h footprint whose top-left cell is `cell`. */
export const footprintX = (cell: number, w: number): number => cellX(cell) + (w - 1) / 2;
export const footprintY = (cell: number, h: number): number => cellY(cell) - (h - 1) / 2;

/** The k-th cell of a w×h footprint whose top-left cell is `cell` (row by row). */
export const footprintCell = (cell: number, w: number, k: number): number => cell + ((k / w) | 0) * COLS + (k % w);

/**
 * Neighbour of `cell` in direction `d` (0 down, 1 left, 2 right, 3 up) on the largest grid, or -1.
 * Down first so ties lean towards the base and paths run straight.
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
 * Breadth-first distances to the base at `base` over the free cells of a `cols` × `rows` board
 * (`blocked[c]` non-zero: blocked). Fills `dist` with steps to the base, -1 for blocked,
 * unreachable or off-board cells. `queue` is scratch of CELLS.
 */
export function flowField(blocked: ArrayLike<number>, dist: { [i: number]: number }, queue: Int16Array, base: number, cols: number, rows: number): void {
  for (let c = 0; c < CELLS; c++) dist[c] = -1;
  if (blocked[base] || !onBoard(base, cols, rows)) return;
  let head = 0;
  let tail = 0;
  dist[base] = 0;
  queue[tail++] = base;
  while (head < tail) {
    const c = queue[head++]!;
    const d = dist[c]! + 1;
    for (let k = 0; k < 4; k++) {
      const n = neighbour(c, k);
      if (n >= 0 && !blocked[n] && dist[n] === -1 && colOf(n) < cols && rowOf(n) < rows) {
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

/** Writes the path from `from` to the base (the cell at distance 0) into `out`; returns its length (0: no path). */
export function tracePath(dist: ArrayLike<number>, from: number, out: { [i: number]: number }): number {
  if (dist[from]! < 0) return 0;
  let c = from;
  let n = 0;
  out[n++] = c;
  while (dist[c] !== 0 && n < CELLS) {
    c = nextCell(dist, c);
    if (c < 0) return 0;
    out[n++] = c;
  }
  return n;
}
