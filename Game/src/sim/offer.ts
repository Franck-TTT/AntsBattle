/**
 * The item offer: three items drawn from OFFER_POOL with the sim's random stream. A new set is
 * drawn once all three are bought, or early by a paid reroll. Sim code.
 */
import type { SystemContext } from '@gameengine/runtime';
import { BlockShape, ItemKind, Offer, Run } from '../schema.gen.ts';
import { OFFER_POOL, OFFER_SIZE, SINGLE_PICK, offeredAt, type OfferDef } from '../balance.ts';

const BLOCKS = OFFER_POOL.filter((d) => d.kind === 'wall');
const WEAPONS = OFFER_POOL.filter((d) => d.kind !== 'wall');

function pick(ctx: SystemContext, pool: readonly OfferDef[]): OfferDef {
  let total = 0;
  for (const d of pool) total += d.weight;
  let r = ctx.rng.range(0, total);
  for (const d of pool) {
    if (r < d.weight) return d;
    r -= d.weight;
  }
  return pool[pool.length - 1]!;
}

/**
 * Draws a new set into the Offer resource (the caller declares write(Offer) and Run): exactly one
 * block, in a random slot, and weapons in the others. Weapons need blocks, so a set always holds
 * one. Only weapons whose Min Wave / Max Wave window holds the current wave come up (the sheet
 * check makes sure every wave has one; all of them otherwise, never an empty pool).
 */
export function drawOffer(ctx: SystemContext): void {
  const o = ctx.resource(Offer);
  const wave = ctx.resource(Run).wave[0]!;
  const now = WEAPONS.filter((d) => offeredAt(d.kind, wave));
  const weapons = now.length > 0 ? now : WEAPONS;
  const blockSlot = ctx.rng.range(0, OFFER_SIZE);
  for (let s = 0; s < OFFER_SIZE; s++) {
    const d = pick(ctx, s === blockSlot ? BLOCKS : weapons);
    o.kinds[s] = ItemKind[d.kind];
    o.shapes[s] = BlockShape[d.shape];
    o.sold[s] = 0;
  }
  o.sets[0] = o.sets[0]! + 1;
  o.version[0] = o.version[0]! + 1;
}

/** Whether the single-pick variant is on: the cheat's override, else the sheet's flag. */
export function singlePickOn(singlePick: number): boolean {
  return singlePick === 1 || (singlePick === 0 && SINGLE_PICK);
}

/**
 * Marks an offer slot bought; draws the next set once all three are gone, or at once in the
 * single-pick variant (free: the reroll count and price do not move).
 */
export function sellOffer(ctx: SystemContext, slot: number): void {
  const o = ctx.resource(Offer);
  o.sold[slot] = 1;
  o.version[0] = o.version[0]! + 1;
  let left = 0;
  for (let s = 0; s < OFFER_SIZE; s++) if (!o.sold[s]) left++;
  if (left === 0 || singlePickOn(o.singlePick[0]!)) drawOffer(ctx);
}
