import { expect } from '@gameengine/test';
import { renderTest } from './play.ts';
import { Board, Item, Placement, Run } from '../src/schema.gen.ts';
import { SetOffer } from '../src/offer.cheats.ts';
import { NextWave } from '../src/stress.cheats.ts';
import { COLS, DEFAULT_COLS, DEFAULT_ROWS, cellX, cellY, footprintX, footprintY, trayX, trayY } from '../src/grid.ts';
import { GHOST_LIFT, START_LIVES } from '../src/balance.ts';

const PHONE: [number, number, number, [number, number, number, number]] = [393, 852, 3, [0, 59, 0, 34]];
const cell = (col: number, row: number) => row * COLS + col;

renderTest('mid-drag shows the ghost, the hovered cell and the new path', async ({ step, input, render, world, cheat }) => {
  input.view(...PHONE);
  await step(420);
  // Two blocks and a tower already on the board, bought from a chosen offer.
  await cheat(SetOffer, { a: 'b3x1', b: 'b1x1', c: 'tower' });
  for (const [slot, x, y] of [[0, footprintX(cell(0, 6), 3), footprintY(cell(0, 6), 1)], [1, cellX(cell(5, 6)), cellY(cell(5, 6))], [2, cellX(cell(1, 6)), cellY(cell(1, 6))]] as const) {
    const [sx, sy] = input.worldToScreen([trayX(slot, DEFAULT_COLS), trayY(DEFAULT_ROWS)]);
    const [tx, ty] = input.worldToScreen([x, y - GHOST_LIFT]);
    input.pointer('down', sx, sy);
    await step(1);
    input.pointer('move', tx, ty);
    await step(2);
    input.pointer('up', tx, ty);
    await step(2);
  }
  expect(world.entities(Item).length).toBe(1);
  // Hold a 2×2 block over the column.
  await cheat(SetOffer, { a: 'b2x2', b: 'cannon', c: 'b1x3' });
  const [sx, sy] = input.worldToScreen([trayX(0, DEFAULT_COLS), trayY(DEFAULT_ROWS)]);
  const [tx, ty] = input.worldToScreen([footprintX(cell(3, 8), 2), footprintY(cell(3, 8), 2) - GHOST_LIFT]);
  input.pointer('down', sx, sy);
  await step(1);
  for (let i = 1; i <= 5; i++) {
    input.pointer('move', sx + ((tx - sx) * i) / 5, sy + ((ty - sy) * i) / 5);
    await step(1);
  }
  await step(4);
  expect(world.resource(Placement).valid).toBe(true);
  render.expectScreenshot('drag', { width: 393, height: 852 });
});

renderTest('losing shows the defeat screen and restart starts a new run', async ({ step, input, render, world, ui }) => {
  input.view(...PHONE);
  await step(60 * 150);
  expect(world.resource(Run).phase).toBe('lost');
  await step(40);
  render.expectScreenshot('defeat', { width: 393, height: 852 });
  // Tap the button like a finger (down, hold, up) where it is drawn.
  const r = ui.rect('restart')!;
  const [x, y] = [r.x + r.width / 2, r.y + r.height / 2];
  input.pointer('down', x, y);
  await step(2);
  input.pointer('up', x, y);
  await step(3);
  const run = world.resource(Run);
  expect(run.phase).toBe('playing');
  expect(run.lives).toBe(START_LIVES);
  expect(run.runId).toBe(2);
});

renderTest('three open nests each draw their path to the base', async ({ step, input, render, world, cheat }) => {
  input.view(...PHONE);
  await step(2);
  for (let i = 0; i < 7; i++) {
    await cheat(NextWave, {});
    await step(2);
  }
  await step(200);
  expect(world.resource(Run).wave).toBe(7);
  render.expectScreenshot('nests', { width: 393, height: 852 });
});

renderTest('merged flows take the colour of the highest-priority nest; the preview keeps the colours', async ({ step, input, render, world, cheat }) => {
  input.view(...PHONE);
  await step(2);
  for (let i = 0; i < 7; i++) {
    await cheat(NextWave, {});
    await step(2);
  }
  // A barrier on row 5 with its gap on the left: every flow ends up in the left column.
  const drop = async (topLeft: number, hold: boolean) => {
    await cheat(SetOffer, { a: 'b3x1', b: 'tower', c: 'cannon' });
    const [sx, sy] = input.worldToScreen([trayX(0, DEFAULT_COLS), trayY(DEFAULT_ROWS)]);
    const [tx, ty] = input.worldToScreen([footprintX(topLeft, 3), footprintY(topLeft, 1) - GHOST_LIFT]);
    input.pointer('down', sx, sy);
    await step(1);
    input.pointer('move', tx, ty);
    await step(3);
    if (hold) return;
    input.pointer('up', tx, ty);
    await step(2);
  };
  await drop(cell(1, 5), false);
  await drop(cell(4, 5), false);
  expect(world.resource(Board).cells[cell(0, 5)]).toBe(0);
  await step(120); // past the wave banner
  render.expectScreenshot('flows', { width: 393, height: 852 });
  // Hold another barrier on row 8, gap on the right: the preview reroutes all three.
  await drop(cell(0, 8), true);
  await step(3);
  expect(world.resource(Placement).valid).toBe(true);
  render.expectScreenshot('preview', { width: 393, height: 852 });
});
