/**
 * Move grace window: a block or weapon the player placed can be moved for MOVE_GRACE game seconds
 * after its first drop (a move does not restart it), then it is locked; a tap still opens a
 * weapon's info. The window counts game time, so a popup pause freezes it; 0 means no limit.
 */
import { expect, expectSignal, recordedSignals } from '@gameengine/test';
import { worldTest } from './play.ts';
import { Block, Board, Item, Placement, PlacementRefused, Run, WeaponInfo, WeaponInfoClosed } from '../src/schema.gen.ts';
import { MoveGrace, SetOffer } from '../src/offer.cheats.ts';
import { SetGold } from '../src/run.cheats.ts';
import { COLS, cellX, cellY, footprintX, footprintY, trayX, trayY } from '../src/grid.ts';
import { Panel } from '../src/schema.gen.ts';
import { GHOST_LIFT, MOVE_GRACE, SHAPES } from '../src/balance.ts';

type Ctx = Parameters<Parameters<typeof worldTest>[1]>[0];

const PHONE: [number, number, number, [number, number, number, number]] = [393, 852, 3, [0, 59, 0, 34]];
const cell = (col: number, row: number) => row * COLS + col;
const fromSlot = (t: Ctx, slot: number): [number, number] => { const p = t.world.resource(Panel); return [trayX(slot, p), trayY(p)]; };
const fromCell = (c: number): [number, number] => [cellX(c), cellY(c)];
/** Steps of 1/60 s that outlast the whole window, with a margin. */
const PAST_WINDOW = Math.ceil(MOVE_GRACE * 60) + 30;

/** Drags from a world point so the ghost ends centred on (x, y), then releases. */
async function dragAt(t: Ctx, from: [number, number], x: number, y: number): Promise<void> {
  const [sx, sy] = t.input.worldToScreen(from);
  const [tx, ty] = t.input.worldToScreen([x, y - GHOST_LIFT]);
  t.input.pointer('down', sx, sy);
  await t.step(1);
  for (let i = 1; i <= 6; i++) {
    t.input.pointer('move', sx + ((tx - sx) * i) / 6, sy + ((ty - sy) * i) / 6);
    await t.step(1);
  }
  await t.step(4);
  t.input.pointer('up', tx, ty);
  await t.step(2);
}

/** A quick tap: down, two steps, up on the same spot. */
async function tapAt(t: Ctx, at: [number, number]): Promise<void> {
  const [sx, sy] = t.input.worldToScreen(at);
  t.input.pointer('down', sx, sy);
  await t.step(2);
  t.input.pointer('up', sx, sy);
  await t.step(2);
}

async function block(t: Ctx, topLeft: number, shape: keyof typeof SHAPES): Promise<void> {
  const [w, h] = SHAPES[shape];
  await t.cheat(SetOffer, { a: shape, b: 'tower', c: 'cannon' });
  await dragAt(t, fromSlot(t, 0), footprintX(topLeft, w), footprintY(topLeft, h));
}
async function tower(t: Ctx, at: number): Promise<void> {
  await t.cheat(SetOffer, { a: 'b1x1', b: 'tower', c: 'tower' });
  await dragAt(t, fromSlot(t, 1), cellX(at), cellY(at));
}

/** A b3x1 block on row 3 with a tower on its left cell, gold to spare. */
async function setup(t: Ctx): Promise<void> {
  t.input.view(...PHONE);
  await t.step(2);
  await t.cheat(SetGold, { gold: 999 });
  await block(t, cell(1, 3), 'b3x1');
  await tower(t, cell(1, 3));
}

worldTest('the sheet gives a move grace window', () => {
  expect(MOVE_GRACE).toBeGreaterThan(0);
});

worldTest('a placed weapon can be moved during its grace window', async (t) => {
  await setup(t);
  const [tw] = t.world.entities(Item);
  const grace = t.world.get(tw!, Item).grace;
  expect(grace).toBeGreaterThan(0);
  expect(grace).toBeLessThan(MOVE_GRACE);
  expect(t.world.resource(Run).graced).toBe(2);
  await dragAt(t, fromCell(cell(1, 3)), cellX(cell(3, 3)), cellY(cell(3, 3)));
  expect(t.world.get(tw!, Item).cell).toBe(cell(3, 3));
  expect(t.world.resource(Board).weapons[cell(1, 3)]).toBe(0);
  expect(t.world.resource(Board).weapons[cell(3, 3)]).toBe(2);
});

worldTest('a weapon is locked once its window closes: a drag is refused (moveLocked), a tap still opens its info', async (t) => {
  await setup(t);
  const [tw] = t.world.entities(Item);
  await t.step(PAST_WINDOW);
  expect(t.world.get(tw!, Item).grace).toBe(0);
  expect(t.world.resource(Run).graced).toBe(0);
  const refusals = t.world.resource(Run).refusals;
  await dragAt(t, fromCell(cell(1, 3)), cellX(cell(3, 3)), cellY(cell(3, 3)));
  expect(t.world.get(tw!, Item).cell).toBe(cell(1, 3));
  expect(t.world.resource(Placement).active).toBe(false);
  expect(t.world.resource(Run).refusals).toBe(refusals + 1);
  expectSignal(PlacementRefused, { reason: 'moveLocked' });
  // Not the steel look of pre-placed items: it stays a player item.
  expect(t.world.get(tw!, Item).locked).toBe(false);
  await tapAt(t, fromCell(cell(1, 3)));
  const info = t.world.resource(WeaponInfo);
  expect(info.open).toBe(true);
  expect(info.kind).toBe('tower');
  expect(info.cell).toBe(cell(1, 3));
  expect(t.world.resource(Run).refusals).toBe(refusals + 1);
});

worldTest('moving a weapon does not restart its window', async (t) => {
  await setup(t);
  const [tw] = t.world.entities(Item);
  // Most of the window, then a move.
  await t.step(Math.floor(MOVE_GRACE * 60 * 0.6));
  const before = t.world.get(tw!, Item).grace;
  await dragAt(t, fromCell(cell(1, 3)), cellX(cell(3, 3)), cellY(cell(3, 3)));
  expect(t.world.get(tw!, Item).cell).toBe(cell(3, 3));
  expect(t.world.get(tw!, Item).grace).toBeLessThan(before);
  // What was left runs out: it is locked where it was moved to.
  await t.step(Math.ceil(MOVE_GRACE * 60 * 0.5));
  expect(t.world.get(tw!, Item).grace).toBe(0);
  await dragAt(t, fromCell(cell(3, 3)), cellX(cell(2, 3)), cellY(cell(2, 3)));
  expect(t.world.get(tw!, Item).cell).toBe(cell(3, 3));
  expectSignal(PlacementRefused, { reason: 'moveLocked' });
});

worldTest('a popup pause freezes the window', async (t) => {
  await setup(t);
  const [tw] = t.world.entities(Item);
  await tapAt(t, fromCell(cell(1, 3)));
  expect(t.world.resource(WeaponInfo).open).toBe(true);
  await t.step(10);
  const grace = t.world.get(tw!, Item).grace;
  expect(grace).toBeGreaterThan(0);
  await t.step(PAST_WINDOW);
  expect(t.world.get(tw!, Item).grace).toBe(grace);
  t.input.emit(WeaponInfoClosed, {});
  await t.step(30);
  expect(t.world.resource(WeaponInfo).open).toBe(false);
  expect(t.world.get(tw!, Item).grace).toBeLessThan(grace);
  // Still inside its window: it moves.
  await dragAt(t, fromCell(cell(1, 3)), cellX(cell(3, 3)), cellY(cell(3, 3)));
  expect(t.world.get(tw!, Item).cell).toBe(cell(3, 3));
});

worldTest('a window of 0 means no limit: nothing locks, nothing counts down', async (t) => {
  t.input.view(...PHONE);
  await t.step(2);
  await t.cheat(MoveGrace, { seconds: 0 });
  await t.cheat(SetGold, { gold: 999 });
  await block(t, cell(1, 3), 'b3x1');
  await tower(t, cell(1, 3));
  expect(t.world.resource(Run).graced).toBe(0);
  await t.step(PAST_WINDOW * 2);
  await dragAt(t, fromCell(cell(1, 3)), cellX(cell(3, 3)), cellY(cell(3, 3)));
  const [tw] = t.world.entities(Item);
  expect(t.world.get(tw!, Item).cell).toBe(cell(3, 3));
  expect(t.world.resource(Placement).moveGrace).toBe(0);
  // Blocks too.
  await dragAt(t, fromCell(cell(2, 3)), footprintX(cell(2, 6), 3), footprintY(cell(2, 6), 1));
  const [b] = t.world.entities(Block);
  expect(t.world.get(b!, Block).cell).toBe(cell(2, 6));
  expect(recordedSignals(PlacementRefused)).toHaveLength(0);
});

worldTest('a placed block moves with its weapons during its window, for free, then locks', async (t) => {
  await setup(t);
  const run = t.world.resource(Run);
  const gold = run.gold;
  const walls = run.wallsBuilt;
  // Grab a bare cell of the block (the tower stands on its left cell).
  await dragAt(t, fromCell(cell(2, 3)), footprintX(cell(2, 6), 3), footprintY(cell(2, 6), 1));
  const [b] = t.world.entities(Block);
  const [tw] = t.world.entities(Item);
  expect(t.world.get(b!, Block).cell).toBe(cell(2, 6));
  expect(t.world.get(b!, Block).held).toBe(false);
  expect(t.world.get(tw!, Item).cell).toBe(cell(2, 6));
  const board = t.world.resource(Board);
  for (const c of [cell(1, 3), cell(2, 3), cell(3, 3)]) expect(board.cells[c]).toBe(0);
  for (const c of [cell(2, 6), cell(3, 6), cell(4, 6)]) expect(board.cells[c]).toBe(1);
  expect(board.weapons[cell(1, 3)]).toBe(0);
  expect(board.weapons[cell(2, 6)]).toBe(2);
  expect(t.world.resource(Run).gold).toBe(gold);
  expect(t.world.resource(Run).wallsBuilt).toBe(walls);
  // Window over: the block shakes and stays.
  await t.step(PAST_WINDOW);
  expect(t.world.get(b!, Block).grace).toBe(0);
  await dragAt(t, fromCell(cell(3, 6)), footprintX(cell(2, 3), 3), footprintY(cell(2, 3), 1));
  expect(t.world.get(b!, Block).cell).toBe(cell(2, 6));
  expect(t.world.get(b!, Block).locked).toBe(false);
  expectSignal(PlacementRefused, { reason: 'moveLocked' });
});

worldTest('a tap on a movable block leaves it where it stands', async (t) => {
  await setup(t);
  await tapAt(t, fromCell(cell(3, 3)));
  const [b] = t.world.entities(Block);
  expect(t.world.get(b!, Block).cell).toBe(cell(1, 3));
  expect(t.world.get(b!, Block).held).toBe(false);
  expect(t.world.resource(Placement).active).toBe(false);
  expect(t.world.resource(WeaponInfo).open).toBe(false);
});
