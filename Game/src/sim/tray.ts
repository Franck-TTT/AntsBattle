/**
 * The tray follows the offer: each slot's icon is rebuilt when the offer changes, prices and
 * greyed-out slots when gold changes. Written only when something changed. Sim code.
 */
import { added, defineSystem, query, read, write, LocalTransform, Shape, Text2D, type EntityId, type SystemContext } from '@gameengine/runtime';
import { Boost, EnemyKilled, ItemPlaced, Offer, OfferRerolled, RestartRequested, Run, TrayCoin, TrayIcon, TrayLabel, TraySlot } from '../schema.gen.ts';
import { OFFER_SIZE, SHAPES, itemPrice, rerollPrice, type BlockShapeName, type ItemKindName } from '../balance.ts';
import { REROLL_SLOT } from '../grid.ts';
import { ITEM_NAMES, SHAPE_NAMES } from '../kinds.ts';
import { COIN, COIN_DIM, COLORS, ITEM_DETAIL_X, ITEM_LOOKS, ORDER, blockBody, blockTop, shapeValue, type ShapeLook } from '../looks.ts';

/** Price layout: the coin, a gap, then the amount, centred together. Digit width is an estimate of the label font at size 0.32. */
const COIN_D = 0.24;
const COIN_GAP = 0.05;
const DIGIT_W = 0.2;

function spawnIcons(ctx: SystemContext, parent: EntityId, slot: number, kind: Exclude<ItemKindName, 'none'>, shape: BlockShapeName): void {
  const icon = (look: ShapeLook, k: number, order: number, x = 0) =>
    ctx.commands.spawn({
      LocalTransform: { position: [x, 0.16, 0], rotation: [0, 0, 0, 1], scale: [k, k, 1] },
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
  // A weapon looks as it does on the board, at board size: no block under it, its barrel to the right.
  const look = ITEM_LOOKS[kind];
  icon(look.body, 1, ORDER.tray + 2);
  if (look.detail) icon(look.detail, 1, ORDER.tray + 3, ITEM_DETAIL_X);
}

export const TraySync = defineSystem({
  name: 'TraySync',
  after: ['Combat'],
  queries: { slots: query(write(TraySlot)), labels: query(read(TrayLabel), write(LocalTransform)), coins: query(read(TrayCoin), write(LocalTransform)), icons: query(read(TrayIcon)) },
  resources: [read(Run), read(Offer), read(Boost)],
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
          price = rerollPrice(offer.rerolls[0]!, offer.freeRerolls[0]!);
          text = `${price}`;
        } else if (slot < OFFER_SIZE) {
          sold = offer.sold[slot] === 1;
          const kind = ITEM_NAMES[offer.kinds[slot]!]! as Exclude<ItemKindName, 'none'>;
          const shape = SHAPE_NAMES[offer.shapes[slot]!]!;
          price = itemPrice(kind, run.wallsBuilt[0]!, shape, ctx.resource(Boost).freeWalls[0]!);
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
        // A coin before every paid price; a free or sold slot shows its text alone, centred.
        const coin = !sold && price > 0;
        const textW = text.length * DIGIT_W;
        const total = COIN_D + COIN_GAP + textW;
        for (const lc of q.labels.chunks()) {
          const tl = lc.col(TrayLabel);
          const pos = lc.col(LocalTransform).position;
          for (let j = 0; j < lc.length; j++) {
            if (tl.slot[j] !== slot) continue;
            pos[j * 3] = coin ? total / 2 - textW / 2 : 0;
            ctx.commands.setField(lc.entity(j), Text2D, 'text', text);
            ctx.commands.setField(lc.entity(j), Text2D, 'color', !ok ? '#9a93a0' : price === 0 ? '#7dffa1' : '#ffc51f');
          }
        }
        for (const cc of q.coins.chunks()) {
          const tc = cc.col(TrayCoin);
          const pos = cc.col(LocalTransform).position;
          for (let j = 0; j < cc.length; j++) {
            if (tc.slot[j] !== slot) continue;
            pos[j * 3] = -total / 2 + COIN_D / 2;
            ctx.commands.setField(cc.entity(j), Shape, 'visible', coin);
            ctx.commands.setField(cc.entity(j), Shape, 'color', ok ? COIN.color : COIN_DIM.color);
            ctx.commands.setField(cc.entity(j), Shape, 'strokeColor', ok ? COIN.strokeColor! : COIN_DIM.strokeColor);
          }
        }
      }
    }
  },
});
