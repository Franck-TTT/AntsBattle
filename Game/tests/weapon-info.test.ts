import { expect } from '@gameengine/test';
import { worldTest } from './play.ts';
import { Item, Offer, Panel, Placement, Run, WeaponInfo, WeaponInfoClosed } from '../src/schema.gen.ts';
import { SetOffer } from '../src/offer.cheats.ts';
import { SetGold } from '../src/run.cheats.ts';
import { LoadLevel } from '../src/level.cheats.ts';
import { COLS, cellX, cellY, footprintX, footprintY, trayX, trayY } from '../src/grid.ts';
import { GHOST_LIFT, START_GOLD } from '../src/balance.ts';

type Ctx = Parameters<Parameters<typeof worldTest>[1]>[0];

const PHONE: [number, number, number, [number, number, number, number]] = [393, 852, 3, [0, 59, 0, 34]];
const cell = (col: number, row: number) => row * COLS + col;
const FIXTURE = 'assets/test-data/layout-fixture.level.json';

const fromSlot = (t: Ctx, slot: number): [number, number] => { const p = t.world.resource(Panel); return [trayX(slot, p), trayY(p)]; };

/** A quick tap where a finger would: down, two steps, up on the same spot. */
async function tapAt(t: Ctx, at: [number, number]): Promise<void> {
  const [sx, sy] = t.input.worldToScreen(at);
  t.input.pointer('down', sx, sy);
  await t.step(2);
  t.input.pointer('up', sx, sy);
  await t.step(2);
}

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

worldTest('a tap on a weapon in the offer opens its info and pauses the run; closing resumes it', async (t) => {
  t.input.view(...PHONE);
  await t.step(2);
  await t.cheat(SetOffer, { a: 'b1x1', b: 'tower', c: 'cannon' });
  await tapAt(t, fromSlot(t, 1));
  const info = t.world.resource(WeaponInfo);
  expect(info.open).toBe(true);
  expect(info.kind).toBe('tower');
  expect(info.slot).toBe(1);
  expect(info.cell).toBe(-1);
  // Nothing bought, nothing held, the run stands still.
  expect(t.world.resource(Placement).active).toBe(false);
  expect(t.world.resource(Offer).sold[1]).toBe(0);
  expect(t.world.resource(Run).gold).toBe(START_GOLD);
  const time = t.world.resource(Run).time;
  await t.step(30);
  expect(t.world.resource(Run).speed).toBe(0);
  expect(t.world.resource(Run).time).toBe(time);
  // Touches on the board do nothing while it is open.
  await tapAt(t, fromSlot(t, 2));
  expect(t.world.resource(WeaponInfo).kind).toBe('tower');

  t.input.emit(WeaponInfoClosed, {});
  await t.step(30);
  expect(t.world.resource(WeaponInfo).open).toBe(false);
  expect(t.world.resource(Run).speed).toBe(1);
  expect(t.world.resource(Run).time).toBeGreaterThan(time);
});

worldTest('a drag from the offer still buys the weapon, with no info popup', async (t) => {
  t.input.view(...PHONE);
  await t.step(2);
  await t.cheat(SetOffer, { a: 'b2x1', b: 'tower', c: 'cannon' });
  await dragAt(t, fromSlot(t, 0), footprintX(cell(1, 5), 2), footprintY(cell(1, 5), 1));
  await t.cheat(SetOffer, { a: 'b1x1', b: 'tower', c: 'tower' });
  await dragAt(t, fromSlot(t, 1), cellX(cell(2, 5)), cellY(cell(2, 5)));
  expect(t.world.entities(Item).length).toBe(1);
  expect(t.world.resource(WeaponInfo).open).toBe(false);
});

worldTest('a tap on a block in the offer opens no popup', async (t) => {
  t.input.view(...PHONE);
  await t.step(2);
  await t.cheat(SetOffer, { a: 'b1x1', b: 'tower', c: 'cannon' });
  await tapAt(t, fromSlot(t, 0));
  expect(t.world.resource(WeaponInfo).open).toBe(false);
});

worldTest('a tap on a weapon too expensive still opens its info, without a refusal', async (t) => {
  t.input.view(...PHONE);
  await t.step(2);
  await t.cheat(SetGold, { gold: 0 });
  await t.cheat(SetOffer, { a: 'b1x1', b: 'cannon', c: 'tower' });
  await tapAt(t, fromSlot(t, 1));
  expect(t.world.resource(WeaponInfo).open).toBe(true);
  expect(t.world.resource(WeaponInfo).kind).toBe('cannon');
  expect(t.world.resource(Run).refusals).toBe(0);
});

worldTest('a dragged weapon too expensive is still refused', async (t) => {
  t.input.view(...PHONE);
  await t.step(2);
  await t.cheat(SetGold, { gold: 0 });
  await t.cheat(SetOffer, { a: 'b1x1', b: 'cannon', c: 'tower' });
  await dragAt(t, fromSlot(t, 1), cellX(cell(3, 5)), cellY(cell(3, 5)));
  expect(t.world.resource(WeaponInfo).open).toBe(false);
  expect(t.world.resource(Run).refusals).toBe(1);
});

worldTest('a tap on a weapon on the board, even a locked one, opens its info and leaves it in place', async (t) => {
  t.input.view(...PHONE);
  await t.step(2);
  await t.cheat(LoadLevel, { level: FIXTURE });
  await t.step(2);
  // The fixture's locked tower at (1, 4).
  await tapAt(t, [cellX(cell(1, 4)), cellY(cell(1, 4))]);
  const info = t.world.resource(WeaponInfo);
  expect(info.open).toBe(true);
  expect(info.kind).toBe('tower');
  expect(info.cell).toBe(cell(1, 4));
  expect(t.world.resource(Run).refusals).toBe(0);
});
