import { expect } from '@gameengine/test';
import { worldTest } from './play.ts';
import { LocalTransform, Shape } from '@gameengine/runtime';
import { Base, Block, Board, BoardTile, Enemy, Item, NestMound, NestSpot, Offer, Placement, Run, TraySlot } from '../src/schema.gen.ts';
import { SetOffer } from '../src/offer.cheats.ts';
import { NextWave, Swarm } from '../src/stress.cheats.ts';
import { LoadLevel } from '../src/level.cheats.ts';

/** A fixed layout for tests (order 0: off the level menu); designers edit assets/levels/ freely. */
const FIXTURE = 'assets/test-data/layout-fixture.level.json';
/** A level with its own nests (bottom right, then left) and its base at the top. */
const MARKERS = 'assets/test-data/markers-fixture.level.json';
/** The largest board (10 × 14, base bottom right) and the smallest (4 × 4, default nests and base). */
const SIZE_MAX = 'assets/test-data/size-max-fixture.level.json';
const SIZE_MIN = 'assets/test-data/size-min-fixture.level.json';
import { CELLS, COLS, DEFAULT_COLS, DEFAULT_ROWS, viewRect, DEFAULT_BASE as BASE_CELL, DEFAULT_NESTS as NESTS, REROLL_SLOT, cellX, cellY, footprintX, footprintY, nearestCell, trayX, trayY } from '../src/grid.ts';
import { DRAG_SPEED, FREE_WALLS, GHOST_LIFT, MOVE_COOLDOWN, SHAPES, START_GOLD, START_LIVES, rerollPrice } from '../src/balance.ts';

type Ctx = Parameters<Parameters<typeof worldTest>[1]>[0];

const PHONE: [number, number, number, [number, number, number, number]] = [393, 852, 3, [0, 59, 0, 34]];
const cell = (col: number, row: number) => row * COLS + col;

/** Drags from a world point so the ghost ends centred on (x, y), then releases. */
async function dragAt(t: Ctx, from: [number, number], x: number, y: number, hold = 4): Promise<void> {
  const [sx, sy] = t.input.worldToScreen(from);
  const [tx, ty] = t.input.worldToScreen([x, y - GHOST_LIFT]);
  t.input.pointer('down', sx, sy);
  await t.step(1);
  for (let i = 1; i <= 6; i++) {
    t.input.pointer('move', sx + ((tx - sx) * i) / 6, sy + ((ty - sy) * i) / 6);
    await t.step(1);
  }
  await t.step(hold);
  t.input.pointer('up', tx, ty);
  await t.step(2);
}

const fromSlot = (slot: number): [number, number] => [trayX(slot, DEFAULT_COLS), trayY(DEFAULT_ROWS)];
const fromCell = (c: number): [number, number] => [cellX(c), cellY(c)];

/** Puts `shape` on offer (slot 0) and drops it with its top-left cell at `topLeft`. */
async function block(t: Ctx, topLeft: number, shape: keyof typeof SHAPES = 'b1x1'): Promise<void> {
  const [w, h] = SHAPES[shape];
  await t.cheat(SetOffer, { a: shape, b: 'tower', c: 'cannon' });
  await dragAt(t, fromSlot(0), footprintX(topLeft, w), footprintY(topLeft, h));
}
async function weapon(t: Ctx, kind: 'tower' | 'cannon', at: number): Promise<void> {
  await t.cheat(SetOffer, { a: 'b1x1', b: kind, c: kind });
  await dragAt(t, fromSlot(1), cellX(at), cellY(at));
}

worldTest('a run starts with gold, lives and an open path', async ({ world, step }) => {
  await step(2);
  const run = world.resource(Run);
  expect(run.phase).toBe('playing');
  expect(run.lives).toBe(START_LIVES);
  expect(run.gold).toBe(START_GOLD);
  expect(world.resource(Board).pathLen).toBe(11);
});

worldTest('a 1×1 block from the tray drops on the cell under the ghost, for free', async (t) => {
  t.input.view(...PHONE);
  await t.step(2);
  await block(t, cell(3, 5));
  const blocks = t.world.entities(Block);
  expect(blocks.length).toBe(1);
  expect(t.world.get(blocks[0]!, Block).cell).toBe(cell(3, 5));
  const run = t.world.resource(Run);
  expect(run.gold).toBe(START_GOLD);
  expect(run.wallsBuilt).toBe(1);
  const b = t.world.resource(Board);
  expect(b.path.slice(0, b.pathLen).includes(cell(3, 5))).toBe(false);
  expect(b.pathLen).toBe(13);
});

worldTest('bigger blocks take every cell of their footprint', async (t) => {
  t.input.view(...PHONE);
  await t.step(2);
  await block(t, cell(0, 2), 'b2x2');
  await block(t, cell(5, 3), 'b1x3');
  await block(t, cell(4, 8), 'b3x1');
  const b = t.world.resource(Board);
  for (const c of [cell(0, 2), cell(1, 2), cell(0, 3), cell(1, 3), cell(5, 3), cell(5, 4), cell(5, 5), cell(4, 8), cell(5, 8), cell(6, 8)]) expect(b.cells[c]).toBe(1);
  expect(t.world.entities(Block).length).toBe(3);
  expect(t.world.resource(Run).wallsBuilt).toBe(10);
});

worldTest('time slows to 5% while the finger holds an item and comes back after', async (t) => {
  t.input.view(...PHONE);
  await t.step(2);
  await t.cheat(SetOffer, { a: 'b1x1', b: 'tower', c: 'cannon' });
  const [sx, sy] = t.input.worldToScreen(fromSlot(0));
  t.input.pointer('down', sx, sy);
  await t.step(3);
  expect(t.world.resource(Placement).active).toBe(true);
  expect(t.world.resource(Run).speed).toBeCloseTo(DRAG_SPEED, 3);
  t.input.pointer('up', sx, sy);
  await t.step(30);
  expect(t.world.resource(Placement).active).toBe(false);
  expect(t.world.resource(Run).speed).toBe(1);
});

worldTest('a drop that would close the last path is refused and the block goes back', async (t) => {
  t.input.view(...PHONE);
  await t.step(2);
  await block(t, cell(0, 4), 'b3x1');
  await block(t, cell(3, 4), 'b3x1');
  expect(t.world.entities(Block).length).toBe(2);
  await block(t, cell(6, 4));
  expect(t.world.entities(Block).length).toBe(2);
  expect(t.world.resource(Run).refusals).toBe(1);
  expect(t.world.resource(Board).dist[NESTS[0]!.cell]).toBeGreaterThan(0);
});

worldTest('block cells past the free ones cost more each time', async (t) => {
  t.input.view(...PHONE);
  await t.step(2);
  await block(t, cell(0, 3), 'b2x2'); // 4 free
  await block(t, cell(5, 3), 'b2x2'); // 4 free
  expect(t.world.resource(Run).gold).toBe(START_GOLD);
  await block(t, cell(0, 6), 'b2x1'); // cells 9 and 10: 5 + 10
  const run = t.world.resource(Run);
  expect(run.wallsBuilt).toBe(FREE_WALLS + 2);
  expect(run.gold).toBe(START_GOLD - 15);
});

worldTest('weapons only drop on a free block cell', async (t) => {
  t.input.view(...PHONE);
  await t.step(2);
  await weapon(t, 'tower', cell(2, 5));
  expect(t.world.entities(Item).length).toBe(0);
  expect(t.world.resource(Run).gold).toBe(START_GOLD);
  await block(t, cell(1, 5), 'b2x1');
  await weapon(t, 'tower', cell(2, 5));
  expect(t.world.entities(Item).length).toBe(1);
  expect(t.world.resource(Board).weapons[cell(2, 5)]).toBe(2);
  expect(t.world.resource(Run).gold).toBe(START_GOLD - 40);
  // A tower on a block does not change the path.
  expect(t.world.resource(Board).pathLen).toBe(11);
});

worldTest('blocks never move', async (t) => {
  t.input.view(...PHONE);
  await t.step(2);
  await block(t, cell(1, 3));
  await dragAt(t, fromCell(cell(1, 3)), cellX(cell(5, 3)), cellY(cell(5, 3)));
  const [b] = t.world.entities(Block);
  expect(t.world.get(b!, Block).cell).toBe(cell(1, 3));
  expect(t.world.resource(Board).cells[cell(5, 3)]).toBe(0);
});

worldTest('a level layout starts the run with locked blocks and weapons, every nest still reaching the base', async (t) => {
  await t.step(2);
  expect(t.world.entities(Block).length).toBe(0);
  await t.cheat(LoadLevel, { level: FIXTURE });
  await t.step(2);
  const blocks = t.world.entities(Block);
  const items = t.world.entities(Item);
  expect(blocks.length).toBe(8);
  expect(items.length).toBe(7);
  for (const e of blocks) expect(t.world.get(e, Block).locked).toBe(true);
  for (const e of items) expect(t.world.get(e, Item).locked).toBe(true);
  const b = t.world.resource(Board);
  expect(Array.from(b.cells).filter((v) => v === 1).length).toBe(20);
  expect(b.weapons[cell(4, 2)]).toBe(3); // cannon
  expect(b.weapons[cell(2, 7)]).toBe(2); // tower
  for (const n of NESTS) expect(b.dist[n.cell]).toBeGreaterThan(0);
  expect(t.world.resource(Run).gold).toBe(START_GOLD);
});

worldTest('pre-placed weapons never move', async (t) => {
  t.input.view(...PHONE);
  await t.step(2);
  await t.cheat(LoadLevel, { level: FIXTURE });
  await t.step(2);
  // The fixture's tower on the 2×2 block at (0, 4) tries to move to a free cell of the same block.
  await dragAt(t, fromCell(cell(1, 4)), cellX(cell(0, 5)), cellY(cell(0, 5)));
  const b = t.world.resource(Board);
  expect(b.weapons[cell(1, 4)]).toBe(2);
  expect(b.weapons[cell(0, 5)]).toBe(0);
  expect(t.world.resource(Placement).active).toBe(false);
  expect(t.world.resource(Run).refusals).toBe(1);
});

worldTest('a level places its own nests and base: the field, the markers and the ants follow them', async (t) => {
  t.input.view(...PHONE);
  await t.step(2);
  await t.cheat(LoadLevel, { level: MARKERS });
  await t.step(2);
  const b = t.world.resource(Board);
  expect(b.nestCount).toBe(2);
  expect(Array.from(b.nestCell).slice(0, 2)).toEqual([cell(6, 10), cell(0, 8)]);
  expect(Array.from(b.nestWave).slice(0, 2)).toEqual([1, 2]);
  expect(b.baseCell).toBe(cell(3, 0));
  expect(b.dist[cell(3, 0)]).toBe(0);
  expect(b.path[0]).toBe(cell(6, 10));
  expect(b.path[b.pathLen - 1]).toBe(cell(3, 0));
  // The mounds and the base stand on the level's cells; the unused third nest slot hides.
  for (const e of t.world.entities(NestMound)) {
    const n = t.world.get(e, NestMound).index;
    const [x, y] = t.world.get(e, LocalTransform).position;
    if (n < 2) {
      const c = b.nestCell[n]!;
      expect(x).toBeCloseTo(cellX(c), 4);
      expect(y).toBeCloseTo(cellY(c), 4);
    }
    expect(t.world.get(e, Shape).visible).toBe(n < 2);
  }
  const [base] = t.world.entities(Base);
  const [bx, by] = t.world.get(base!, LocalTransform).position;
  expect(bx).toBeCloseTo(cellX(cell(3, 0)), 4);
  expect(by).toBeCloseTo(cellY(cell(3, 0)), 4);
  // Nothing is built on a nest or the base.
  await block(t, cell(6, 10));
  await block(t, cell(3, 0));
  expect(t.world.entities(Block).length).toBe(1);
  // Wave 1 comes out of the first nest, at the bottom right.
  await t.cheat(NextWave, {});
  await t.step(60);
  const ants = t.world.entities(Enemy).map((e) => t.world.get(e, LocalTransform).position);
  expect(ants.length).toBeGreaterThan(0);
  for (const [x, y] of ants) expect(y!).toBeLessThan(cellY(cell(0, 0)) + 0.6);
  expect(ants.some(([x, y]) => Math.abs(x! - cellX(cell(6, 10))) < 1.5 && Math.abs(y! - cellY(cell(6, 10))) < 1.5)).toBe(true);
});

worldTest('a level sets its board size: the field, the grid, the tray, the camera and drops follow it', async (t) => {
  t.input.view(...PHONE);
  await t.step(2);
  await t.cheat(LoadLevel, { level: SIZE_MAX });
  await t.step(3);
  let b = t.world.resource(Board);
  expect([b.cols, b.rows]).toEqual([10, 14]);
  expect(b.dist[cell(9, 13)]).toBe(0);
  expect(b.path[0]).toBe(cell(0, 0));
  expect(b.path[b.pathLen - 1]).toBe(cell(9, 13));
  // The grid is redrawn at the level's size, and the tray sits under it.
  expect(t.world.entities(BoardTile).some((e) => { const [w, h] = t.world.get(e, Shape).size; return w === 10 && h === 14; })).toBe(true);
  for (const e of t.world.entities(TraySlot)) {
    const [x, y] = t.world.get(e, LocalTransform).position;
    expect(x).toBeCloseTo(trayX(t.world.get(e, TraySlot).slot, 10), 4);
    expect(y).toBeCloseTo(trayY(14), 4);
  }
  // A block drops past the default board's right edge and bottom.
  await t.cheat(SetOffer, { a: 'b1x1', b: 'tower', c: 'cannon' });
  await dragAt(t, [trayX(0, 10), trayY(14)], cellX(cell(8, 12)), cellY(cell(8, 12)));
  expect(t.world.resource(Board).cells[cell(8, 12)]).toBe(1);

  await t.cheat(LoadLevel, { level: SIZE_MIN });
  await t.step(3);
  b = t.world.resource(Board);
  expect([b.cols, b.rows]).toEqual([4, 4]);
  // A level without nests or base gets the default ones for its size.
  expect(b.nestCell[0]).toBe(cell(2, 0));
  expect(b.baseCell).toBe(cell(2, 3));
  expect(b.dist[cell(5, 2)]).toBe(-1);
  // Off the 4 × 4 board nothing lands.
  await t.cheat(SetOffer, { a: 'b1x1', b: 'tower', c: 'cannon' });
  await dragAt(t, [trayX(0, 4), trayY(4)], cellX(cell(5, 2)), cellY(cell(5, 2)));
  expect(t.world.entities(Block).length).toBe(0);
});

worldTest('the largest and smallest boards stay whole on screen, on thin phones and tablets', async (t) => {
  // 9:22 phone with a notch, 3:4 tablet: the extremes of the portrait shapes we ship on.
  const views: [number, number, number, [number, number, number, number]][] = [
    [360, 880, 3, [0, 47, 0, 34]],
    [768, 1024, 2, [0, 24, 0, 20]],
  ];
  for (const level of [SIZE_MAX, SIZE_MIN]) {
    for (const view of views) {
      t.input.view(...view);
      await t.step(2);
      await t.cheat(LoadLevel, { level });
      await t.step(3);
      const b = t.world.resource(Board);
      const r = viewRect(b.cols, b.rows);
      const [w, h, , [, top, , bottom]] = view;
      for (const [x, y] of [[r.x - r.w / 2, r.y + r.h / 2], [r.x + r.w / 2, r.y - r.h / 2]] as const) {
        const [sx, sy] = t.input.worldToScreen([x, y]);
        expect(sx).toBeGreaterThanOrEqual(-0.5);
        expect(sx).toBeLessThanOrEqual(w + 0.5);
        expect(sy).toBeGreaterThanOrEqual(top - 0.5);
        expect(sy).toBeLessThanOrEqual(h - bottom + 0.5);
      }
    }
  }
});

worldTest('a moved weapon cannot move again until its cooldown ends', async (t) => {
  t.input.view(...PHONE);
  await t.step(2);
  await block(t, cell(1, 3), 'b3x1');
  await block(t, cell(4, 6), 'b2x1');
  await weapon(t, 'tower', cell(1, 3));
  await dragAt(t, fromCell(cell(1, 3)), cellX(cell(3, 3)), cellY(cell(3, 3)));
  const [tw] = t.world.entities(Item);
  expect(t.world.get(tw!, Item).cell).toBe(cell(3, 3));
  expect(t.world.get(tw!, Item).cooldown).toBeGreaterThan(MOVE_COOLDOWN - 0.5);
  // Not onto bare ground, and not while cooling down.
  await dragAt(t, fromCell(cell(3, 3)), cellX(cell(4, 6)), cellY(cell(4, 6)));
  expect(t.world.get(tw!, Item).cell).toBe(cell(3, 3));
  await t.step(Math.ceil(MOVE_COOLDOWN * 60) + 10);
  await dragAt(t, fromCell(cell(3, 3)), cellX(cell(3, 8)), cellY(cell(3, 8)));
  expect(t.world.get(tw!, Item).cell).toBe(cell(3, 3));
  await dragAt(t, fromCell(cell(3, 3)), cellX(cell(5, 6)), cellY(cell(5, 6)));
  expect(t.world.get(tw!, Item).cell).toBe(cell(5, 6));
  expect(t.world.resource(Board).weapons[cell(3, 3)]).toBe(0);
});

worldTest('ants reroute around a new block at once and never walk into blocked cells', async (t) => {
  t.input.view(...PHONE);
  await t.step(400);
  expect(t.world.entities(Enemy).length).toBeGreaterThan(1);
  await block(t, cell(2, 8), 'b3x1');
  expect(t.world.entities(Block).length).toBe(1);
  let reachedBase = 0;
  for (let s = 0; s < 600; s++) {
    await t.step(1);
    for (const e of t.world.entities(Enemy)) {
      const [x, y] = t.world.get(e, LocalTransform).position;
      expect(t.world.resource(Board).cells[nearestCell(x!, y!, DEFAULT_COLS, DEFAULT_ROWS)]).toBe(0);
    }
    reachedBase = t.world.resource(Run).baseHits;
  }
  expect(reachedBase).toBeGreaterThan(0);
});

worldTest('running out of lives loses the run', async (t) => {
  await t.step(60 * 120);
  const run = t.world.resource(Run);
  expect(run.phase).toBe('lost');
  expect(run.lives).toBe(0);
});

worldTest('towers shoot ants and kills pay gold', async (t) => {
  t.input.view(...PHONE);
  await t.step(2);
  await block(t, cell(2, 5));
  await weapon(t, 'tower', cell(2, 5));
  expect(t.world.resource(Run).gold).toBe(START_GOLD - 40);
  await t.step(60 * 14);
  const run = t.world.resource(Run);
  expect(run.kills).toBeGreaterThan(3);
  expect(run.gold).toBeGreaterThan(START_GOLD - 40);
});

worldTest('the offer shows three items and draws a new set once all three are bought', async (t) => {
  t.input.view(...PHONE);
  await t.step(2);
  const first = t.world.resource(Offer);
  expect(first.sets).toBe(1);
  expect(first.kinds.filter((k) => k === 1).length).toBe(1); // exactly one block per set
  await t.cheat(SetOffer, { a: 'b1x1', b: 'b1x1', c: 'b1x1' });
  await dragAt(t, fromSlot(0), cellX(cell(0, 2)), cellY(cell(0, 2)));
  expect(t.world.resource(Offer).sold).toEqual([1, 0, 0]);
  // A bought slot stays empty.
  await dragAt(t, fromSlot(0), cellX(cell(1, 2)), cellY(cell(1, 2)));
  expect(t.world.entities(Block).length).toBe(1);
  await dragAt(t, fromSlot(1), cellX(cell(1, 2)), cellY(cell(1, 2)));
  await dragAt(t, fromSlot(2), cellX(cell(2, 2)), cellY(cell(2, 2)));
  const next = t.world.resource(Offer);
  expect(next.sets).toBe(2);
  expect(next.sold).toEqual([0, 0, 0]);
  expect(next.kinds.filter((k) => k === 1).length).toBe(1);
});

worldTest('reroll draws a new set for gold, dearer each time, refused when broke', async (t) => {
  t.input.view(...PHONE);
  await t.step(2);
  const tap = async (slot: number) => {
    const [x, y] = t.input.worldToScreen(fromSlot(slot));
    t.input.pointer('down', x, y);
    await t.step(1);
    t.input.pointer('up', x, y);
    await t.step(2);
  };
  await tap(REROLL_SLOT);
  expect(t.world.resource(Offer).sets).toBe(2);
  expect(t.world.resource(Run).gold).toBe(START_GOLD - rerollPrice(0));
  await tap(REROLL_SLOT);
  expect(t.world.resource(Run).gold).toBe(START_GOLD - rerollPrice(0) - rerollPrice(1));
  while (t.world.resource(Run).gold >= rerollPrice(t.world.resource(Offer).rerolls)) await tap(REROLL_SLOT);
  const sets = t.world.resource(Offer).sets;
  await tap(REROLL_SLOT);
  expect(t.world.resource(Offer).sets).toBe(sets);
  expect(t.world.resource(Run).refusals).toBeGreaterThan(0);
});

worldTest('a tower shot hits its target alone: never more kills than shots', async (t) => {
  t.input.view(...PHONE);
  await t.step(2);
  await block(t, cell(2, 1));
  await weapon(t, 'tower', cell(2, 1));
  await t.cheat(Swarm, { count: 60 });
  await t.step(120);
  const run = t.world.resource(Run);
  expect(run.kills).toBeGreaterThan(0);
  expect(run.kills).toBeLessThanOrEqual(run.shots);
});

worldTest('nests open at their wave and ants leave every open nest in turn', async (t) => {
  t.input.view(...PHONE);
  const spawnedNear = (cell: number) =>
    t.world.entities(Enemy).filter((e) => {
      const [x, y] = t.world.get(e, LocalTransform).position;
      return Math.abs(x! - cellX(cell)) < 0.5 && Math.abs(y! - cellY(cell)) < 0.5;
    }).length;
  await t.step(2);
  expect(t.world.all(NestSpot).filter((n) => n.value.open).length).toBe(1);
  while (t.world.resource(Run).wave < NESTS[1]!.fromWave) {
    await t.cheat(NextWave, {});
    await t.step(2);
  }
  await t.step(90);
  const open = t.world.all(NestSpot).filter((n) => n.value.open).map((n) => n.value.index);
  expect(open).toEqual([0, 1]);
  expect(t.world.resource(Run).nestsOpen).toBe(1);
  // Some of the fresh ants are still standing near the new nest.
  let near = 0;
  for (let i = 0; i < 20 && near === 0; i++) {
    near = spawnedNear(NESTS[1]!.cell);
    await t.step(5);
  }
  expect(near).toBeGreaterThan(0);
});

worldTest('a block that would cut off a nest that is not open yet is refused', async (t) => {
  t.input.view(...PHONE);
  await t.step(2);
  // The left nest (cell 0,1) opens later; wall in all but one of its sides, then try the last.
  await block(t, cell(0, 0));
  await block(t, cell(1, 1));
  expect(t.world.entities(Block).length).toBe(2);
  await block(t, cell(0, 2));
  expect(t.world.entities(Block).length).toBe(2);
  expect(t.world.resource(Run).refusals).toBe(1);
});

worldTest('the board helpers agree on the grid', async (t) => {
  await t.step(2);
  expect(nearestCell(cellX(BASE_CELL), cellY(BASE_CELL), DEFAULT_COLS, DEFAULT_ROWS)).toBe(BASE_CELL);
  // Cells are numbered on the largest board; the Board arrays hold all of them.
  expect(CELLS).toBe(COLS * 14);
  expect(t.world.resource(Board).cells.length).toBe(CELLS);
  expect(t.world.resource(Board).cols).toBe(DEFAULT_COLS);
  expect(t.world.resource(Board).rows).toBe(DEFAULT_ROWS);
});
worldTest.replay('tests/replays/towers_shoot_ants_and_kills_pay_gold.greplay');
