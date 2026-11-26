/** QA and tests: put chosen items on offer. */
import { write } from '@gameengine/runtime';
import { defineCheat } from '@gameengine/runtime/cheats';
import { BlockShape, ItemKind, Offer } from './schema.gen.ts';

const ITEMS = ['b1x1', 'b2x1', 'b1x2', 'b3x1', 'b1x3', 'b2x2', 'tower', 'cannon', 'frost', 'mine', 'boostPad', 'mortar', 'flamethrower', 'radar', 'bank'] as const;
const WEAPONS = new Set<string>(['tower', 'cannon', 'frost', 'mine', 'boostPad', 'mortar', 'flamethrower', 'radar', 'bank']);

export const SetOffer = defineCheat({
  id: 'offer.set',
  group: 'Offer',
  title: 'Put three chosen items on offer',
  params: {
    a: { type: 'enum', values: ITEMS, default: 'b1x1' },
    b: { type: 'enum', values: ITEMS, default: 'tower' },
    c: { type: 'enum', values: ITEMS, default: 'cannon' },
  },
  resources: [write(Offer)],
  run(ctx, { a, b, c }) {
    const o = ctx.resource(Offer);
    [a, b, c].forEach((item, s) => {
      const weapon = WEAPONS.has(item);
      o.kinds[s] = weapon ? ItemKind[item as 'tower'] : ItemKind.wall;
      o.shapes[s] = weapon ? BlockShape.b1x1 : BlockShape[item as 'b1x1'];
      o.sold[s] = 0;
    });
    o.version[0] = o.version[0]! + 1;
  },
});
