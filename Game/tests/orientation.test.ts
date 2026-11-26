/** Landscape: the panel (HUD bar and tray) stands right of the board, everything inside the safe area; the screen can turn mid-run. */
import { expect } from '@gameengine/test';
import { renderTest, worldTest } from './play.ts';
import { Block, Board, Panel } from '../src/schema.gen.ts';
import { LoadLevel } from '../src/level.cheats.ts';
import { SetOffer } from '../src/offer.cheats.ts';
import { COLS, REROLL_SLOT, TRAY_REROLL_W, TRAY_SLOT_H, TRAY_SLOT_W, boardRect, cellX, cellY, trayX } from '../src/grid.ts';
import { GHOST_LIFT } from '../src/balance.ts';

type V = [number, number, number, [number, number, number, number]];
// Notched phone and 16:9 phone turned sideways, iPad and fold inner screen in landscape.
const LANDSCAPE: Record<string, V> = {
  'iphone 15 pro': [852, 393, 3, [59, 0, 59, 21]],
  'iphone se': [667, 375, 2, [0, 0, 0, 0]],
  ipad: [1080, 810, 2, [0, 20, 0, 0]],
  'fold inner': [829, 690, 2.625, [0, 28, 0, 16]],
};
const PORTRAIT: V = [393, 852, 3, [0, 59, 0, 34]];
const SIZE_MAX = 'assets/test-data/size-max-fixture.level.json';
const EPS = 0.5;

for (const [name, view] of Object.entries(LANDSCAPE)) {
  worldTest(`landscape ${name}: the board and the side panel stay whole, side by side`, async (t) => {
    for (const level of [null, SIZE_MAX]) {
      t.input.view(...view);
      await t.step(2);
      if (level) {
        await t.cheat(LoadLevel, { level });
        await t.step(3);
      }
      const b = t.world.resource(Board);
      const p = t.world.resource(Panel);
      const r = boardRect(b.cols, b.rows);
      const [w, h, , [left, top, right, bottom]] = view;
      const trayLeft = trayX(0, p) - (TRAY_SLOT_W / 2) * p.scale;
      const trayRight = trayX(REROLL_SLOT, p) + (TRAY_REROLL_W / 2) * p.scale;
      const corners = [[r.x - r.w / 2, r.y + r.h / 2], [r.x + r.w / 2, r.y - r.h / 2], [trayLeft, p.trayY + (TRAY_SLOT_H / 2) * p.scale], [trayRight, p.trayY - (TRAY_SLOT_H / 2) * p.scale]] as const;
      for (const [x, y] of corners) {
        const [sx, sy] = t.input.worldToScreen([x, y]);
        expect(sx).toBeGreaterThanOrEqual(left - EPS);
        expect(sx).toBeLessThanOrEqual(w - right + EPS);
        expect(sy).toBeGreaterThanOrEqual(top - EPS);
        expect(sy).toBeLessThanOrEqual(h - bottom + EPS);
      }
      // The panel is right of the board, the HUD bar above the tray.
      expect(trayLeft).toBeGreaterThan(r.x + r.w / 2);
      expect(p.hudY).toBeGreaterThan(p.trayY);
    }
  });
}

worldTest('turning the phone mid-run moves the panel and a drag from the tray still lands', async (t) => {
  t.input.view(...PORTRAIT);
  await t.step(2);
  const portraitTray = t.world.resource(Panel).trayY;
  t.input.view(...LANDSCAPE['iphone 15 pro']!);
  await t.step(2);
  const p = t.world.resource(Panel);
  expect(p.trayY).not.toBe(portraitTray);
  await t.cheat(SetOffer, { a: 'b1x1', b: 'b1x1', c: 'b1x1' });
  const cell = 5 * COLS + 1;
  const [sx, sy] = t.input.worldToScreen([trayX(0, p), p.trayY]);
  const [tx, ty] = t.input.worldToScreen([cellX(cell), cellY(cell) - GHOST_LIFT]);
  t.input.pointer('down', sx, sy);
  await t.step(1);
  for (let i = 1; i <= 6; i++) {
    t.input.pointer('move', sx + ((tx - sx) * i) / 6, sy + ((ty - sy) * i) / 6);
    await t.step(1);
  }
  await t.step(4);
  t.input.pointer('up', tx, ty);
  await t.step(3);
  expect(t.world.entities(Block).length).toBe(1);
});

renderTest('landscape phone: board left, HUD and tray right, wave banner on the board', async ({ step, input, render }) => {
  const v = LANDSCAPE['iphone 15 pro']!;
  input.view(...v);
  await step(240);
  render.expectScreenshot('landscape', { width: v[0], height: v[1] });
});
