/**
 * Level layout rules, shared by the sim (src/sim/level.ts), the `game/level-layout` check and the
 * Level Layout editor widget. Pure functions over plain data: no runtime imports.
 */
import { CELLS, COLS, DEFAULT_COLS, DEFAULT_ROWS, MAX_NESTS, MIN_COLS, MIN_ROWS, ROWS, defaultBase, defaultNests, flowField, footprintCell, tracePath, type Markers, type NestDef } from './grid.ts';
import { ON_GROUND, SHAPES, type ItemKindName } from './balance.ts';

export interface LayoutBlock {
  readonly shape: string;
  readonly col: number;
  readonly row: number;
}
export interface LayoutWeapon {
  readonly kind: string;
  readonly col: number;
  readonly row: number;
}
export interface LayoutNest {
  readonly col: number;
  readonly row: number;
  readonly fromWave: number;
}
export interface LayoutCell {
  readonly col: number;
  readonly row: number;
}
export interface Layout {
  /** Board size; absent: the default 7 × 11. */
  readonly cols?: number | undefined;
  readonly rows?: number | undefined;
  readonly blocks: readonly LayoutBlock[];
  readonly weapons: readonly LayoutWeapon[];
  /** Absent: the default nests for the board's size. */
  readonly nests?: readonly LayoutNest[] | undefined;
  /** Absent: the default base for the board's size. */
  readonly base?: LayoutCell | undefined;
}

/** One problem in a layout: the cells it is about, and the entry at fault (null: the layout as a whole). */
export interface LayoutIssue {
  readonly message: string;
  readonly cells: readonly number[];
  readonly entry: { readonly list: 'blocks' | 'weapons' | 'nests' | 'base' | 'size'; readonly index: number } | null;
}

export interface LayoutResult {
  readonly issues: readonly LayoutIssue[];
  /** The board size the game uses: the layout's when valid, else the default. */
  readonly cols: number;
  readonly rows: number;
  /** The nests and base the game uses: the layout's valid ones, else the defaults. */
  readonly nests: readonly NestDef[];
  readonly base: number;
  /** The same as Markers, for the grid helpers. */
  readonly markers: Markers;
  /** 1 on every cell a valid block covers. */
  readonly cells: Uint8Array;
  /** Index of the valid block covering each cell, -1 for none. */
  readonly blockAt: Int16Array;
  /** Index of the valid weapon on each cell, -1 for none. */
  readonly weaponAt: Int16Array;
  /** Steps to the base per cell over the valid blocks, -1 blocked, unreachable or off the board. */
  readonly dist: Int16Array;
}

const where = (col: number, row: number): string => `(${col}, ${row})`;
const inside = (col: number, row: number, cols: number, rows: number): boolean => col >= 0 && row >= 0 && col < cols && row < rows;

/** The board size a layout asks for (unchecked), the default where it says nothing. */
export function layoutSize(layout: Layout): { cols: number; rows: number } {
  return { cols: layout.cols ?? DEFAULT_COLS, rows: layout.rows ?? DEFAULT_ROWS };
}

/** The cells of a block, or null when its shape is unknown or it does not fit on a `cols` × `rows` board. */
export function blockCells(shape: string, col: number, row: number, cols: number, rows: number): number[] | null {
  const size = (SHAPES as Record<string, readonly [number, number] | undefined>)[shape];
  if (!size) return null;
  const [w, h] = size;
  if (col < 0 || row < 0 || col + w > cols || row + h > rows) return null;
  const top = row * COLS + col;
  const out: number[] = [];
  for (let k = 0; k < w * h; k++) out.push(footprintCell(top, w, k));
  return out;
}

/** The layout's nests and base as written, or the defaults for its size where it says nothing (for editors). */
export function layoutMarkers(layout: Layout): { nests: LayoutNest[]; base: LayoutCell } {
  const { cols, rows } = layoutSize(layout);
  const nests = layout.nests ?? defaultNests(cols).map((n) => ({ col: n.cell % COLS, row: (n.cell / COLS) | 0, fromWave: n.fromWave }));
  const b = defaultBase(cols, rows);
  const base = layout.base ?? { col: b % COLS, row: (b / COLS) | 0 };
  return { nests: nests.map((n) => ({ ...n })), base: { ...base } };
}

/**
 * Checks a layout. Entries come in order: an entry that breaks a rule is left out of the result
 * (the game skips it too); a closed path is reported but keeps every block. A layout without a
 * valid size, base or nest falls back to the defaults.
 */
export function checkLayout(layout: Layout): LayoutResult {
  const issues: LayoutIssue[] = [];

  // The size first: everything else must fit in it.
  let { cols, rows } = layoutSize(layout);
  if (!(Number.isInteger(cols) && cols >= MIN_COLS && cols <= COLS && Number.isInteger(rows) && rows >= MIN_ROWS && rows <= ROWS)) {
    issues.push({ message: `The board is ${cols} × ${rows}: it must be ${MIN_COLS} to ${COLS} columns by ${MIN_ROWS} to ${ROWS} rows`, cells: [], entry: { list: 'size', index: 0 } });
    cols = DEFAULT_COLS;
    rows = DEFAULT_ROWS;
  }
  const { nests: wantNests, base: wantBase } = layoutMarkers({ ...layout, cols, rows });

  // The base, then the nests.
  let base = defaultBase(cols, rows);
  if (inside(wantBase.col, wantBase.row, cols, rows)) base = wantBase.row * COLS + wantBase.col;
  else issues.push({ message: `The base at ${where(wantBase.col, wantBase.row)} is off the board`, cells: [], entry: { list: 'base', index: 0 } });
  const nests: NestDef[] = [];
  wantNests.forEach((n, index) => {
    const entry = { list: 'nests' as const, index };
    const cell = n.row * COLS + n.col;
    if (!inside(n.col, n.row, cols, rows)) issues.push({ message: `Nest ${index + 1} at ${where(n.col, n.row)} is off the board`, cells: [], entry });
    else if (nests.length >= MAX_NESTS) issues.push({ message: `Nest ${index + 1}: a level has at most ${MAX_NESTS} nests`, cells: [cell], entry });
    else if (cell === base) issues.push({ message: `Nest ${index + 1} at ${where(n.col, n.row)} stands on the base`, cells: [cell], entry });
    else if (nests.some((o) => o.cell === cell)) issues.push({ message: `Nest ${index + 1} at ${where(n.col, n.row)} shares its cell with another nest`, cells: [cell], entry });
    else if (!(n.fromWave >= 1)) issues.push({ message: `Nest ${index + 1} opens on wave ${n.fromWave}: the first wave is 1`, cells: [cell], entry });
    else nests.push({ cell, fromWave: n.fromWave });
  });
  if (!nests.length) {
    issues.push({ message: 'The level has no nest', cells: [], entry: null });
    nests.push(...defaultNests(cols).filter((n) => n.cell !== base));
  } else if (!nests.some((n) => n.fromWave === 1)) {
    issues.push({ message: 'No nest opens on wave 1: the first wave would have nowhere to come from', cells: nests.map((n) => n.cell), entry: null });
  }
  const isMarkerCell = (c: number): boolean => c === base || nests.some((n) => n.cell === c);

  const cells = new Uint8Array(CELLS);
  const blockAt = new Int16Array(CELLS).fill(-1);
  const weaponAt = new Int16Array(CELLS).fill(-1);
  layout.blocks.forEach((b, index) => {
    const entry = { list: 'blocks' as const, index };
    const fp = blockCells(b.shape, b.col, b.row, cols, rows);
    if (!fp) {
      issues.push({ message: `Block ${b.shape} at ${where(b.col, b.row)} does not fit on the board`, cells: inside(b.col, b.row, cols, rows) ? [b.row * COLS + b.col] : [], entry });
      return;
    }
    const taken = fp.filter((c) => cells[c]);
    if (taken.length) {
      issues.push({ message: `Block ${b.shape} at ${where(b.col, b.row)} overlaps another block`, cells: taken, entry });
      return;
    }
    const special = fp.filter(isMarkerCell);
    if (special.length) {
      issues.push({ message: `Block ${b.shape} at ${where(b.col, b.row)} covers a nest or the base`, cells: special, entry });
      return;
    }
    for (const c of fp) {
      cells[c] = 1;
      blockAt[c] = index;
    }
  });
  layout.weapons.forEach((w, index) => {
    const entry = { list: 'weapons' as const, index };
    if (!inside(w.col, w.row, cols, rows)) {
      issues.push({ message: `Weapon ${w.kind} at ${where(w.col, w.row)} is off the board`, cells: [], entry });
      return;
    }
    const c = w.row * COLS + w.col;
    if (ON_GROUND.has(w.kind as ItemKindName)) {
      // Mines and boost pads lie on a free ground cell, where the ants walk.
      if (cells[c] || isMarkerCell(c)) {
        issues.push({ message: `Weapon ${w.kind} at ${where(w.col, w.row)} must lie on a free ground cell (not a block, a nest or the base)`, cells: [c], entry });
        return;
      }
    } else if (!cells[c]) {
      issues.push({ message: `Weapon ${w.kind} at ${where(w.col, w.row)} does not stand on a block`, cells: [c], entry });
      return;
    }
    if (weaponAt[c]! >= 0) {
      issues.push({ message: `Weapon ${w.kind} at ${where(w.col, w.row)} shares its cell with another weapon`, cells: [c], entry });
      return;
    }
    weaponAt[c] = index;
  });
  const dist = new Int16Array(CELLS);
  flowField(cells, dist, new Int16Array(CELLS), base, cols, rows);
  const cut = nests.filter((n) => dist[n.cell]! < 0).map((n) => n.cell);
  if (cut.length) issues.push({ message: `The blocks close every path from ${cut.length > 1 ? `${cut.length} nests` : 'a nest'} to the base`, cells: cut, entry: null });
  const markers: Markers = { nestCount: [nests.length], nestCell: nests.map((n) => n.cell), nestWave: nests.map((n) => n.fromWave), baseCell: [base] };
  return { issues, cols, rows, nests, base, markers, cells, blockAt, weaponAt, dist };
}

/** Every cell on the ants' path from each nest to the base, for a preview (1 on the path). */
export function layoutPaths(result: LayoutResult): Uint8Array {
  const on = new Uint8Array(CELLS);
  const path = new Int16Array(CELLS);
  for (const n of result.nests) {
    const len = tracePath(result.dist, n.cell, path);
    for (let i = 0; i < len; i++) on[path[i]!] = 1;
  }
  return on;
}
