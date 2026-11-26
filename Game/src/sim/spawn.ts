/**
 * Spawning blocks and weapons on the board, shared by drag and drop, level layouts and cheats. Sim code.
 */
import { type EntityId, type SystemContext } from '@gameengine/runtime';
import { cellX, cellY, footprintX, footprintY } from '../grid.ts';
import { SHAPES, type BlockShapeName, type ItemKindName } from '../balance.ts';
import { ITEM_LOOKS, LOCKED_RING, ORDER, blockBody, blockDetails, blockTop, shapeValue, type ShapeLook } from '../looks.ts';

export type WeaponKind = Exclude<ItemKindName, 'none' | 'wall'>;

const child = (ctx: SystemContext, parent: EntityId, x: number, y: number, look: ShapeLook, order: number): void => {
  ctx.commands.spawn({
    LocalTransform: { position: [x, y, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
    Shape: shapeValue(look, order),
    Parent: { entity: parent },
  });
};

/**
 * Spawns a block of `shape` whose top-left cell is `cell`. `locked`: pre-placed by the level (steel, riveted).
 * `grace`: game seconds it can still be moved (the caller counts it in Run.graced).
 */
export function spawnBlock(ctx: SystemContext, shape: BlockShapeName, cell: number, time: number, locked = false, grace = 0): EntityId {
  const [w, h] = SHAPES[shape];
  const e = ctx.commands.spawn({
    LocalTransform: { position: [footprintX(cell, w), footprintY(cell, h), 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
    Shape: shapeValue(blockBody(w, h), ORDER.block),
    VisualOffset: {},
    Block: { shape, cell, placedAt: time, locked, grace },
  });
  // Pre-placed blocks look the same as the player's.
  for (const d of blockDetails(w, h, cell)) child(ctx, e, d.x, d.y, d.look, ORDER.blockDetail);
  child(ctx, e, 0, 0.04, blockTop(w, h), ORDER.block);
  return e;
}

/**
 * Spawns a weapon standing on the block cell `cell`. `locked`: pre-placed by the level (steel mounting ring), never moved.
 * `grace`: game seconds it can still be moved (the caller counts it in Run.graced).
 */
export function spawnItem(ctx: SystemContext, kind: WeaponKind, cell: number, time: number, locked = false, grace = 0): EntityId {
  const look = ITEM_LOOKS[kind];
  const e = ctx.commands.spawn({
    LocalTransform: { position: [cellX(cell), cellY(cell), 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
    Shape: shapeValue(look.body, ORDER.item),
    VisualOffset: {},
    Item: { kind, cell, grace, reload: 0.4, aim: Math.PI / 2, placedAt: time, locked },
  });
  if (look.detail) child(ctx, e, 0.16, 0, look.detail, ORDER.item + 1);
  if (locked) child(ctx, e, 0, 0, LOCKED_RING, ORDER.enemy);
  return e;
}
