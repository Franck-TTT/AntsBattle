import { worldTest } from './play.ts';
import { Board, Item, Block, Offer, Panel, Run } from '../src/schema.gen.ts';
import { SetOffer } from '../src/offer.cheats.ts';
import { COLS, cellX, cellY, footprintX, footprintY, trayX, trayY } from '../src/grid.ts';
const cell = (c: number, r: number) => r * COLS + c;
worldTest('zz debug tray', async (t) => {
  t.input.view(390, 844, 3, [0, 47, 0, 34]);
  await t.step(2);
  const p = t.world.resource(Panel);
  console.log('panel', JSON.stringify(p), 'slots', [0,1,2,3].map((s) => t.input.worldToScreen([trayX(s, p), trayY(p)]).map(Math.round).join(',')).join(' | '));
  const drag = async (from: [number, number], x: number, y: number) => {
    const [sx, sy] = t.input.worldToScreen(from); const [tx, ty] = t.input.worldToScreen([x, y - 0]);
    t.input.pointer('down', sx, sy); await t.step(1);
    for (let i = 1; i <= 6; i++) { t.input.pointer('move', sx + ((tx - sx) * i) / 6, sy + ((ty - sy) * i) / 6); await t.step(1); }
    await t.step(4); t.input.pointer('up', tx, ty); await t.step(2);
  };
  console.log('gold0', t.world.resource(Run).gold, 'walls', t.world.resource(Run).wallsBuilt);
  await t.cheat(SetOffer, { a: 'b2x1', b: 'tower', c: 'cannon' });
  await drag([trayX(0, p), trayY(p)], footprintX(cell(1, 5), 2), footprintY(cell(1, 5), 1));
  console.log('after block gold', t.world.resource(Run).gold, 'walls', t.world.resource(Run).wallsBuilt, 'blocks', t.world.entities(Block).length);
});
