/**
 * Spawning blocks and weapons on the board, shared by drag and drop, level layouts and cheats. Sim code.
 */
import { type EntityId, type SystemContext } from '@gameengine/runtime';
import { cellX, cellY, footprintX, footprintY } from '../grid.ts';
import { ON_GROUND, SHAPES, type BlockShapeName, type ItemKindName } from '../balance.ts';
import { BLOCK_TONES, ITEM_LOOKS, LOCKED_RING, ORDER, blockBuildings, blockPad, buildingLayers, shapeValue, type ShapeLook } from '../looks.ts';

export type WeaponKind = Exclude<ItemKindName, 'none' | 'wall'>;

const child = (ctx: SystemContext, parent: EntityId, x: number, y: number, look: ShapeLook, order: number): void => {
  ctx.commands.spawn({
    LocalTransform: { position: [x, y, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
    Shape: shapeValue(look, order),
    Parent: { entity: parent },
  });
};

/** Draw order of a block building's shadow, face, roof and rim. */
export const BLOCK_LAYER_ORDER = [ORDER.base, ORDER.block, ORDER.enemy, ORDER.item] as const;

/** Spawns a block of `shape` whose top-left cell is `cell`: a pad and its buildings. `locked`: pre-placed by the level (grey ruins). */
export function spawnBlock(ctx: SystemContext, shape: BlockShapeName, cell: number, time: number, locked = false): EntityId {
  const [w, h] = SHAPES[shape];
  const e = ctx.commands.spawn({
    LocalTransform: { position: [footprintX(cell, w), footprintY(cell, h), 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
    Shape: shapeValue(blockPad(w, h, locked), ORDER.highlight),
    VisualOffset: {},
    Block: { shape, cell, placedAt: time, locked },
  });
  // Shadow on the pad, then face, roof and rim. Roofs share the enemies' order and rims the items':
  // ants never walk on blocks, and a weapon's body leaves its block's north rim uncovered.
  const tone = locked ? BLOCK_TONES.locked : BLOCK_TONES.player;
  for (const b of blockBuildings(cell, w, h)) {
    for (const l of buildingLayers(b, tone)) child(ctx, e, l.x, l.y, l.look, BLOCK_LAYER_ORDER[l.layer]);
  }
  return e;
}

/**
 * Spawns a weapon standing on the block cell `cell` (a mine or a boost pad: lying on the ground cell, under the ants).
 * `locked`: pre-placed by the level (steel mounting ring), never moved.
 */
export function spawnItem(ctx: SystemContext, kind: WeaponKind, cell: number, time: number, locked = false): EntityId {
  const look = ITEM_LOOKS[kind];
  const ground = ON_GROUND.has(kind);
  const order = ground ? ORDER.base : ORDER.item;
  const e = ctx.commands.spawn({
    LocalTransform: { position: [cellX(cell), cellY(cell), 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
    Shape: shapeValue(look.body, order),
    VisualOffset: {},
    Item: { kind, cell, cooldown: 0, reload: ground ? 0 : 0.4, aim: Math.PI / 2, placedAt: time, locked },
  });
  // A barrel sits off-centre and turns with the aim; ground and support items keep their detail centred.
  const centred = ground || kind === 'radar' || kind === 'bank';
  if (look.detail) child(ctx, e, centred ? 0 : 0.16, 0, look.detail, order + 1);
  if (locked) child(ctx, e, 0, 0, LOCKED_RING, ORDER.enemy);
  return e;
}
