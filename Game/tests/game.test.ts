import { worldTest, expect } from '@gameengine/test';
import { LocalTransform } from '@gameengine/runtime';
import { Block, Board, Enemy, Item, NestSpot, Offer, Placement, Run } from '../src/schema.gen.ts';
import { SetOffer } from '../src/offer.cheats.ts';
import { NextWave, Swarm } from '../src/stress.cheats.ts';
import { BASE_CELL, CELLS, COLS, NESTS, NEST_CELL, REROLL_SLOT, cellX, cellY, footprintX, footprintY, nearestCell, trayX, trayY } from '../src/grid.ts';
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

const fromSlot = (slot: number): [number, number] => [trayX(slot), trayY(slot)];
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
  expect(t.world.resource(Board).dist[NEST_CELL]).toBeGreaterThan(0);
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
      expect(t.world.resource(Board).cells[nearestCell(x!, y!)]).toBe(0);
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

worldTest('every weapon hits an area: one tower shot can kill several ants', async (t) => {
  t.input.view(...PHONE);
  await t.step(2);
  await block(t, cell(2, 1));
  await weapon(t, 'tower', cell(2, 1));
  await t.cheat(Swarm, { count: 60 });
  await t.step(120);
  const run = t.world.resource(Run);
  expect(run.kills).toBeGreaterThan(run.shots);
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

worldTest('the board helpers agree on the grid', async () => {
  expect(nearestCell(cellX(BASE_CELL), cellY(BASE_CELL))).toBe(BASE_CELL);
  expect(CELLS).toBe(77);
});
worldTest.replay('tests/replays/towers_shoot_ants_and_kills_pay_gold.greplay');
