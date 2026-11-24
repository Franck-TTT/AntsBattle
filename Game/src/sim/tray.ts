/**
 * The tray follows the offer: each slot's icon is rebuilt when the offer changes, prices and
 * greyed-out slots when gold changes. Written only when something changed. Sim code.
 */
import { added, defineSystem, query, read, write, Shape, Text2D, type EntityId, type SystemContext } from '@gameengine/runtime';
import { EnemyKilled, ItemPlaced, Offer, OfferRerolled, RestartRequested, Run, TrayIcon, TrayLabel, TraySlot } from '../schema.gen.ts';
import { OFFER_SIZE, SHAPES, itemPrice, rerollPrice, type BlockShapeName, type ItemKindName } from '../balance.ts';
import { REROLL_SLOT } from '../grid.ts';
import { ITEM_NAMES, SHAPE_NAMES } from '../kinds.ts';
import { COLORS, ITEM_LOOKS, ORDER, blockBody, blockTop, shapeValue, type ShapeLook } from '../looks.ts';

function spawnIcons(ctx: SystemContext, parent: EntityId, slot: number, kind: Exclude<ItemKindName, 'none'>, shape: BlockShapeName): void {
  const icon = (look: ShapeLook, k: number, order: number) =>
    ctx.commands.spawn({
      LocalTransform: { position: [0, 0.16, 0], rotation: [0, 0, 0, 1], scale: [k, k, 1] },
      Shape: shapeValue(look, order),
      Parent: { entity: parent },
      TrayIcon: { slot },
    });
  if (kind === 'wall') {
    const [w, h] = SHAPES[shape];
    const k = Math.min(0.78 / h, 1.4 / w);
    icon(blockBody(w, h), k, ORDER.tray + 1);
    icon(blockTop(w, h), k, ORDER.tray + 2);
    return;
  }
  // A weapon is shown on a small block: it only drops on blocks.
  const look = ITEM_LOOKS[kind];
  icon(blockBody(1, 1), 0.78, ORDER.tray + 1);
  icon(look.body, 0.78, ORDER.tray + 2);
  if (look.detail) icon(look.detail, 0.78, ORDER.tray + 3);
}

export const TraySync = defineSystem({
  name: 'TraySync',
  after: ['Combat'],
  queries: { slots: query(write(TraySlot)), labels: query(read(TrayLabel)), icons: query(read(TrayIcon)) },
  resources: [read(Run), read(Offer)],
  // Prices change on a kill, a drop, a reroll or a restart; icons when the offer changes.
  runIf: { any: [{ event: EnemyKilled }, { event: ItemPlaced }, { event: OfferRerolled }, { event: RestartRequested }, { changed: Offer }, { query: query(added(TraySlot)) }] },
  run(ctx, q) {
    const run = ctx.resource(Run);
    const offer = ctx.resource(Offer);
    const gold = run.gold[0]!;
    const version = offer.version[0]!;
    for (const c of q.slots.chunks()) {
      const ts = c.col(TraySlot);
      for (let i = 0; i < c.length; i++) {
        const slot = ts.slot[i]!;
        const e = c.entity(i);
        let price = 0;
        let sold = false;
        let text = '';
        if (slot === REROLL_SLOT) {
          price = rerollPrice(offer.rerolls[0]!);
          text = `${price}`;
        } else if (slot < OFFER_SIZE) {
          sold = offer.sold[slot] === 1;
          const kind = ITEM_NAMES[offer.kinds[slot]!]! as Exclude<ItemKindName, 'none'>;
          const shape = SHAPE_NAMES[offer.shapes[slot]!]!;
          price = itemPrice(kind, run.wallsBuilt[0]!, shape);
          text = sold ? '' : price === 0 ? 'FREE' : `${price}`;
          if (ts.shownVersion[i] !== version) {
            for (const ic of q.icons.chunks()) {
              const ti = ic.col(TrayIcon);
              for (let j = 0; j < ic.length; j++) if (ti.slot[j] === slot) ctx.commands.despawn(ic.entity(j));
            }
            if (!sold) spawnIcons(ctx, e, slot, kind, shape);
          }
        }
        const ok = !sold && gold >= price;
        if (ts.shownVersion[i] === version && ts.shownPrice[i] === price && (ts.affordable[i] === 1) === ok) continue;
        ts.shownVersion[i] = version;
        ts.shownPrice[i] = price;
        ts.affordable[i] = ok ? 1 : 0;
        const base = slot === REROLL_SLOT ? COLORS.reroll : COLORS.traySlot;
        ctx.commands.setField(e, Shape, 'color', ok ? base : COLORS.trayDisabled);
        ctx.commands.setField(e, Shape, 'strokeColor', ok ? COLORS.trayRim : '#7a7380');
        for (const lc of q.labels.chunks()) {
          const tl = lc.col(TrayLabel);
          for (let j = 0; j < lc.length; j++) {
            if (tl.slot[j] !== slot) continue;
            ctx.commands.setField(lc.entity(j), Text2D, 'text', text);
            ctx.commands.setField(lc.entity(j), Text2D, 'color', !ok ? '#9a93a0' : price === 0 ? '#7dffa1' : '#ffc51f');
          }
        }
      }
    }
  },
});
