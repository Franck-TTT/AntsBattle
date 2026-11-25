/** Level layout rules (src/layout.ts): what the check, the editor widget and the game agree on. */
import { worldTest, expect } from '@gameengine/test';
import { DEFAULT_BASE as BASE_CELL, COLS, DEFAULT_NESTS as NESTS, MAX_NESTS, ROWS } from '../src/grid.ts';
import { Board } from '../src/schema.gen.ts';
import { FLOW_COLORS } from '../src/looks.ts';
import { checkLayout, layoutPaths } from '../src/layout.ts';

const cell = (col: number, row: number) => row * COLS + col;
const messages = (r: ReturnType<typeof checkLayout>) => r.issues.map((i) => i.message);

worldTest('a clean layout has no issues and its paths reach the base', async () => {
  const r = checkLayout({ blocks: [{ shape: 'b2x2', col: 0, row: 4 }], weapons: [{ kind: 'tower', col: 1, row: 4 }] });
  expect(r.issues.length).toBe(0);
  expect(r.cells[cell(1, 5)]).toBe(1);
  expect(r.weaponAt[cell(1, 4)]).toBe(0);
  const on = layoutPaths(r);
  expect(on[BASE_CELL]).toBe(1);
  for (const n of NESTS) expect(on[n.cell]).toBe(1);
});

worldTest('blocks off the board, overlapping or on a nest or the base are reported and left out', async () => {
  const r = checkLayout({
    blocks: [
      { shape: 'b3x1', col: 5, row: 3 }, // off the right edge
      { shape: 'b2x2', col: 1, row: 5 },
      { shape: 'b1x1', col: 2, row: 6 }, // overlaps the 2×2
      { shape: 'b1x1', col: 3, row: 0 }, // the first nest
      { shape: 'b1x1', col: 3, row: 10 }, // the base
    ],
    weapons: [],
  });
  expect(messages(r)).toEqual([
    'Block b3x1 at (5, 3) does not fit on the board',
    'Block b1x1 at (2, 6) overlaps another block',
    'Block b1x1 at (3, 0) covers a nest or the base',
    'Block b1x1 at (3, 10) covers a nest or the base',
  ]);
  expect(r.issues[1]!.entry).toEqual({ list: 'blocks', index: 2 });
  expect(r.cells[cell(5, 3)]).toBe(0);
  expect(r.blockAt[cell(2, 6)]).toBe(1);
});

worldTest('weapons need a block of their own', async () => {
  const r = checkLayout({
    blocks: [{ shape: 'b1x1', col: 2, row: 5 }],
    weapons: [
      { kind: 'tower', col: 4, row: 5 }, // bare ground
      { kind: 'tower', col: 2, row: 5 },
      { kind: 'cannon', col: 2, row: 5 }, // same cell
      { kind: 'cannon', col: 9, row: 5 }, // off the board
    ],
  });
  expect(messages(r)).toEqual([
    'Weapon tower at (4, 5) does not stand on a block',
    'Weapon cannon at (2, 5) shares its cell with another weapon',
    'Weapon cannon at (9, 5) is off the board',
  ]);
  expect(r.weaponAt[cell(2, 5)]).toBe(1);
});

worldTest('a layout that closes the path is reported', async () => {
  const r = checkLayout({ blocks: [{ shape: 'b3x1', col: 0, row: 5 }, { shape: 'b3x1', col: 3, row: 5 }, { shape: 'b1x1', col: 6, row: 5 }], weapons: [] });
  expect(messages(r)).toEqual(['The blocks close every path from 3 nests to the base']);
  expect(r.issues[0]!.entry).toBe(null);
});

worldTest('nests and base: defaults when absent, rules when placed', async () => {
  const none = checkLayout({ blocks: [], weapons: [] });
  expect(none.base).toBe(BASE_CELL);
  expect(none.nests.map((n) => n.cell)).toEqual(NESTS.map((n) => n.cell));
  const moved = checkLayout({ blocks: [], weapons: [], nests: [{ col: 0, row: 10, fromWave: 1 }], base: { col: 6, row: 0 } });
  expect(moved.issues.length).toBe(0);
  expect(moved.base).toBe(cell(6, 0));
  expect(moved.dist[cell(6, 0)]).toBe(0);
  expect(layoutPaths(moved)[cell(0, 10)]).toBe(1);
  const bad = checkLayout({
    blocks: [{ shape: 'b1x1', col: 1, row: 1 }],
    weapons: [],
    nests: [
      { col: 1, row: 1, fromWave: 2 }, // under a block
      { col: 6, row: 0, fromWave: 2 }, // on the base
      { col: 2, row: 2, fromWave: 3 },
      { col: 2, row: 2, fromWave: 4 }, // same cell
      { col: 9, row: 2, fromWave: 4 }, // off the board
      { col: 3, row: 3, fromWave: 0 }, // before the first wave
      { col: 4, row: 4, fromWave: 5 },
      { col: 5, row: 5, fromWave: 6 },
      { col: 0, row: 6, fromWave: 7 },
      { col: 6, row: 7, fromWave: 8 }, // a 6th valid nest
    ],
    base: { col: 6, row: 0 },
  });
  expect(bad.issues.map((i) => i.message)).toEqual([
    'Nest 2 at (6, 0) stands on the base',
    'Nest 4 at (2, 2) shares its cell with another nest',
    'Nest 5 at (9, 2) is off the board',
    'Nest 6 opens on wave 0: the first wave is 1',
    'Nest 10: a level has at most 5 nests',
    'No nest opens on wave 1: the first wave would have nowhere to come from',
    'Block b1x1 at (1, 1) covers a nest or the base',
  ]);
  expect(bad.nests.map((n) => n.cell)).toEqual([cell(1, 1), cell(2, 2), cell(4, 4), cell(5, 5), cell(0, 6)]);
  const offBase = checkLayout({ blocks: [], weapons: [], base: { col: 3, row: 12 } });
  expect(offBase.issues.map((i) => i.message)).toEqual(['The base at (3, 12) is off the board']);
  expect(offBase.base).toBe(BASE_CELL);
});

worldTest('MAX_NESTS and the largest board match the Board arrays', async ({ world, step }) => {
  await step(1);
  expect(world.resource(Board).nestCell.length).toBe(MAX_NESTS);
  expect(world.resource(Board).nestWave.length).toBe(MAX_NESTS);
  // The largest board: what the Board arrays hold.
  expect(world.resource(Board).cells.length).toBe(COLS * ROWS);
  // One path colour per nest.
  expect(FLOW_COLORS.length).toBe(MAX_NESTS);
});

worldTest('board size: within limits, and everything must fit in it', async () => {
  const big = checkLayout({ cols: 10, rows: 14, blocks: [{ shape: 'b3x1', col: 7, row: 13 }], weapons: [], nests: [{ col: 9, row: 0, fromWave: 1 }], base: { col: 0, row: 13 } });
  expect(big.issues.length).toBe(0);
  expect([big.cols, big.rows]).toEqual([10, 14]);
  const small = checkLayout({ cols: 4, rows: 4, blocks: [{ shape: 'b2x1', col: 3, row: 0 }], weapons: [{ kind: 'tower', col: 5, row: 1 }], nests: [{ col: 6, row: 0, fromWave: 1 }, { col: 0, row: 0, fromWave: 1 }], base: { col: 1, row: 3 } });
  expect(small.issues.map((i) => i.message)).toEqual([
    'Nest 1 at (6, 0) is off the board',
    'Block b2x1 at (3, 0) does not fit on the board',
    'Weapon tower at (5, 1) is off the board',
  ]);
  // Defaults follow the size: top-centre nest, bottom-centre base.
  const sized = checkLayout({ cols: 5, rows: 9, blocks: [], weapons: [] });
  expect(sized.nests[0]!.cell).toBe(cell(2, 0));
  expect(sized.base).toBe(cell(2, 8));
  expect(sized.dist[cell(6, 0)]).toBe(-1);
  for (const [cols, rows] of [[3, 8], [11, 8], [6, 3], [6, 15], [6.5, 8]]) {
    const bad = checkLayout({ cols, rows, blocks: [], weapons: [] });
    expect(bad.issues[0]!.message).toBe(`The board is ${cols} × ${rows}: it must be 4 to 10 columns by 4 to 14 rows`);
    expect([bad.cols, bad.rows]).toEqual([7, 11]);
  }
});

