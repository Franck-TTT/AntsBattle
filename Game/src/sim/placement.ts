/**
 * Drag and drop. Blocks (1×1 to 2×2 and 1×3 footprints) come from the tray, drop on free cells,
 * block the ants and never move again. Weapons come from the tray or off a block, drop only on a
 * free block cell, and can be moved again after their cooldown. A hovered drop gets a live
 * validity check and path preview; a refused one snaps back. Sim code: the pointer arrives as
 * recorded input, so a replay reproduces every placement.
 */
import { burstAt, defineSystem, entityAt, query, read, teleport, write, LocalTransform, NO_ENTITY, PointerDown, PointerState, PointerUp, type EntityId, type Query, type SystemContext } from '@gameengine/runtime';
import { Block, Board, Enemy, FxHost, Item, ItemPlaced, Offer, OfferRerolled, Placement, PlacementRefused, Run } from '../schema.gen.ts';
import { CELLS, cellAt, isMarker, nestsReach, cellX, cellY, flowField, footprintAt, footprintCell, footprintX, footprintY, nearestCell, REROLL_SLOT, slotAt, trayX, trayY } from '../grid.ts';
import { DRAG_SPEED, GHOST_LIFT, MOVE_COOLDOWN, SHAPES, itemPrice, rerollPrice, shapeCells, type BlockShapeName, type ItemKindName } from '../balance.ts';
import { ITEM_NAMES as ITEM_KINDS, FX_NAMES as FX_KINDS, SHAPE_NAMES } from '../kinds.ts';
import { recomputeBoard } from './board.ts';
import { drawOffer, sellOffer } from './offer.ts';
import { spawnBlock, spawnItem } from './spawn.ts';

const blocked = new Uint8Array(CELLS);
const dist = new Int16Array(CELLS);
const queue = new Int16Array(CELLS);

const REASONS = ['ok', 'offBoard', 'occupied', 'blocks', 'gold', 'enemy', 'noBlock', 'fixed'] as const;
type Reason = (typeof REASONS)[number];
const RETURN_STEPS = 16;
const WALL = ITEM_KINDS.indexOf('wall');

/** Plays `fx` once at (x, y) from the scene's host of that kind. */
export function fxAt(ctx: SystemContext, hosts: Query, fx: (typeof FX_KINDS)[number], x: number, y: number): void {
  const want = FX_KINDS.indexOf(fx);
  for (const c of hosts.chunks()) {
    const k = c.col(FxHost).kind;
    for (let i = 0; i < c.length; i++) if (k[i] === want) burstAt(c.entity(i), [[x, y]]);
  }
}

export const DragItems = defineSystem({
  name: 'DragItems',
  after: ['StartRun'],
  queries: {
    items: query(write(Item), write(LocalTransform)),
    blocks: query(write(Block)),
    enemies: query(read(Enemy), read(LocalTransform)),
    fx: query(read(FxHost)),
  },
  resources: [write(Placement), write(Run), write(Board), write(Offer), read(PointerState)],
  events: [PointerDown, PointerUp],
  runIf: [
    { resource: Run, field: 'phase', value: 'playing' },
    { any: [{ event: PointerDown }, { event: PointerUp }, { resource: Placement, field: 'active' }, { resource: Placement, field: 'returnSteps' }] },
  ],
  run(ctx, q) {
    const p = ctx.resource(Placement);
    const run = ctx.resource(Run);
    const board = ctx.resource(Board);
    const cols = board.cols[0]!;
    const rows = board.rows[0]!;
    if (p.returnSteps[0]! > 0) p.returnSteps[0] = p.returnSteps[0]! - 1;

    const refuse = (reason: Reason): void => {
      run.refusals[0] = run.refusals[0]! + 1;
      ctx.signal(PlacementRefused, { reason });
    };

    /** A block of `shape` with its top-left cell at `cell`: free cells, affordable, path kept. */
    const evaluateBlock = (shape: BlockShapeName, cell: number): Reason => {
      p.previewLen[0] = 0;
      if (cell < 0) return 'offBoard';
      const [w] = SHAPES[shape];
      const n = shapeCells(shape);
      for (let k = 0; k < n; k++) {
        const c = footprintCell(cell, w, k);
        if (isMarker(board, c) || board.cells[c]! > 0) return 'occupied';
      }
      if (run.gold[0]! < itemPrice('wall', run.wallsBuilt[0]!, shape)) return 'gold';
      for (let c = 0; c < CELLS; c++) blocked[c] = board.cells[c]! > 0 ? 1 : 0;
      for (let k = 0; k < n; k++) blocked[footprintCell(cell, w, k)] = 1;
      flowField(blocked, dist, queue, board.baseCell[0]!, cols, rows);
      // Every nest, open or not yet, must keep a way to the base.
      if (!nestsReach(board, dist)) return 'blocks';
      for (const c of q.enemies.chunks()) {
        const pos = c.col(LocalTransform).position;
        for (let i = 0; i < c.length; i++) {
          const ec = nearestCell(pos[i * 3]!, pos[i * 3 + 1]!, cols, rows);
          if (blocked[ec] && board.cells[ec] === 0) return 'enemy';
          if (dist[ec]! < 0) return 'blocks';
        }
      }
      for (let c = 0; c < CELLS; c++) p.previewDist[c] = dist[c]!;
      p.previewLen[0] = 1;
      return 'ok';
    };

    /** A weapon on `cell`: only on a block cell without a weapon. */
    const evaluateWeapon = (kind: number, cell: number, fromCell: number): Reason => {
      p.previewLen[0] = 0;
      if (cell < 0) return 'offBoard';
      if (cell === fromCell) return 'ok';
      if (board.cells[cell] === 0) return 'noBlock';
      if (board.weapons[cell]! > 0) return 'occupied';
      if (fromCell < 0 && run.gold[0]! < itemPrice(ITEM_KINDS[kind]!, run.wallsBuilt[0]!)) return 'gold';
      return 'ok';
    };

    const hoverCell = (kind: number, shape: BlockShapeName, gx: number, gy: number): number => {
      if (kind !== WALL) return cellAt(gx, gy, cols, rows);
      const [w, h] = SHAPES[shape];
      return footprintAt(gx, gy, w, h, cols, rows);
    };
    const evaluate = (kind: number, shape: BlockShapeName, cell: number, fromCell: number): Reason =>
      kind === WALL ? evaluateBlock(shape, cell) : evaluateWeapon(kind, cell, fromCell);

    const setHeld = (e: EntityId, held: boolean): void => {
      for (const c of q.items.chunks()) for (let i = 0; i < c.length; i++) if (c.entity(i) === e) c.setField(Item, i, 'held', held);
    };

    // Pick up.
    if (!p.active[0]) {
      for (const d of ctx.events.read(PointerDown)) {
        const slot = slotAt(d.world[0], d.world[1], cols, rows);
        if (slot === REROLL_SLOT) {
          // Reroll: pay for a new set of three.
          const offer = ctx.resource(Offer);
          const price = rerollPrice(offer.rerolls[0]!);
          p.slot[0] = slot;
          if (run.gold[0]! < price) {
            refuse('gold');
            break;
          }
          run.gold[0] = run.gold[0]! - price;
          offer.rerolls[0] = offer.rerolls[0]! + 1;
          drawOffer(ctx);
          ctx.signal(OfferRerolled, { price });
          break;
        }
        if (slot >= 0) {
          const offer = ctx.resource(Offer);
          if (offer.sold[slot]) break;
          const kind = ITEM_KINDS[offer.kinds[slot]!]! as Exclude<ItemKindName, 'none'>;
          const shape = SHAPE_NAMES[offer.shapes[slot]!]!;
          p.slot[0] = slot;
          if (run.gold[0]! < itemPrice(kind, run.wallsBuilt[0]!, shape)) {
            refuse('gold');
            break;
          }
          ctx.set(Placement, { active: true, kind, shape, fromItem: NO_ENTITY, fromCell: -1, slot, cell: -2, valid: false, returnSteps: 0 });
          break;
        }
        const cell = cellAt(d.world[0], d.world[1], cols, rows);
        if (cell < 0 || board.cells[cell] === 0) continue;
        if (board.weapons[cell]! > 0) {
          // A weapon: movable once its cooldown is over, unless the level pre-placed it.
          for (const c of q.items.chunks()) {
            const it = c.col(Item);
            for (let i = 0; i < c.length; i++) {
              if (it.cell[i] !== cell) continue;
              if (it.locked[i]) {
                c.setField(Item, i, 'denySteps', 14);
                refuse('fixed');
              } else if (it.cooldown[i]! > 0) {
                c.setField(Item, i, 'denySteps', 14);
                refuse('occupied');
              } else {
                c.setField(Item, i, 'held', true);
                ctx.set(Placement, { active: true, kind: ITEM_KINDS[it.kind[i]!]!, shape: 'b1x1', fromItem: c.entity(i), fromCell: cell, slot: -1, cell: -2, valid: false, returnSteps: 0 });
              }
            }
          }
        } else {
          // A bare block: blocks never move.
          for (const c of q.blocks.chunks()) {
            const b = c.col(Block);
            for (let i = 0; i < c.length; i++) {
              const [w] = SHAPES[SHAPE_NAMES[b.shape[i]!]!];
              const n = shapeCells(SHAPE_NAMES[b.shape[i]!]!);
              for (let k = 0; k < n; k++) if (footprintCell(b.cell[i]!, w, k) === cell) c.setField(Block, i, 'denySteps', 12);
            }
          }
          refuse('fixed');
        }
        break;
      }
      if (!p.active[0]) return;
      run.speed[0] = DRAG_SPEED;
    }

    // Follow the finger: the ghost sits above it, the hovered cell is the one under the ghost.
    const ps = ctx.resource(PointerState);
    const gx = ps.world[0]!;
    const gy = ps.world[1]! + GHOST_LIFT;
    p.x[0] = gx;
    p.y[0] = gy;
    const kind = p.kind[0]!;
    const shape = SHAPE_NAMES[p.shape[0]!]!;
    const fromCell = p.fromCell[0]!;
    const cell = hoverCell(kind, shape, gx, gy);
    if (cell !== p.cell[0]) {
      const r = evaluate(kind, shape, cell, fromCell);
      p.cell[0] = cell;
      p.valid[0] = r === 'ok' ? 1 : 0;
      p.reason[0] = REASONS.indexOf(r);
    }

    const released = ctx.events.count(PointerUp) > 0 || !ps.down[0];
    if (!released) return;

    // Drop: check again (enemies moved while the finger hovered).
    const r = evaluate(kind, shape, cell, fromCell);
    const fromItem = entityAt(p.fromItem, 0);
    const kindName = ITEM_KINDS[kind]! as Exclude<ItemKindName, 'none'>;
    p.active[0] = 0;
    p.cell[0] = -1;
    p.previewLen[0] = 0;
    if (r === 'ok' && cell !== fromCell) {
      const time = run.time[0]!;
      if (kindName === 'wall') {
        const cost = itemPrice('wall', run.wallsBuilt[0]!, shape);
        const [w, h] = SHAPES[shape];
        run.gold[0] = run.gold[0]! - cost;
        run.wallsBuilt[0] = run.wallsBuilt[0]! + shapeCells(shape);
        spawnBlock(ctx, shape, cell, time);
        for (let k = 0; k < shapeCells(shape); k++) board.cells[footprintCell(cell, w, k)] = 1;
        recomputeBoard(ctx);
        fxAt(ctx, q.fx, 'dust', footprintX(cell, w), footprintY(cell, h));
        ctx.signal(ItemPlaced, { kind: kindName, shape, cell, moved: false, cost });
      } else if (fromCell < 0) {
        const cost = itemPrice(kindName, run.wallsBuilt[0]!);
        run.gold[0] = run.gold[0]! - cost;
        spawnItem(ctx, kindName, cell, time);
        board.weapons[cell] = kind;
        fxAt(ctx, q.fx, 'dust', cellX(cell), cellY(cell));
        ctx.signal(ItemPlaced, { kind: kindName, shape: 'b1x1', cell, moved: false, cost });
      } else {
        for (const c of q.items.chunks()) for (let i = 0; i < c.length; i++) {
          if (c.entity(i) !== fromItem) continue;
          const it = c.col(Item);
          it.cell[i] = cell;
          it.cooldown[i] = MOVE_COOLDOWN;
          it.placedAt[i] = time;
          it.held[i] = 0;
          const pos = c.col(LocalTransform).position;
          pos[i * 3] = cellX(cell);
          pos[i * 3 + 1] = cellY(cell);
          teleport(fromItem);
        }
        board.weapons[fromCell] = 0;
        board.weapons[cell] = kind;
        fxAt(ctx, q.fx, 'dust', cellX(cell), cellY(cell));
        ctx.signal(ItemPlaced, { kind: kindName, shape: 'b1x1', cell, moved: true, cost: 0 });
      }
      if (fromCell < 0) sellOffer(ctx, p.slot[0]!);
      run.placements[0] = run.placements[0]! + 1;
      return;
    }
    if (fromItem !== NO_ENTITY) setHeld(fromItem, false);
    if (cell === fromCell) return;
    // Refused or dropped off the board: fly back to where it came from.
    p.returnSteps[0] = RETURN_STEPS;
    p.retKind[0] = kind;
    p.retShape[0] = p.shape[0]!;
    p.retFromX[0] = gx;
    p.retFromY[0] = gy;
    p.retToX[0] = fromCell >= 0 ? cellX(fromCell) : trayX(p.slot[0]!, cols);
    p.retToY[0] = fromCell >= 0 ? cellY(fromCell) : trayY(rows);
    if (r !== 'offBoard') refuse(r);
  },
});

/** Game speed: almost frozen while a finger holds an item, eased back after. */
export const GameSpeed = defineSystem({
  name: 'GameSpeed',
  after: ['DragItems'],
  resources: [write(Run), read(Placement)],
  runIf: [{ resource: Run, field: 'phase', value: 'playing' }],
  run(ctx) {
    const run = ctx.resource(Run);
    let target = ctx.resource(Placement).active[0] ? DRAG_SPEED : 1;
    if (run.bossSteps[0]! > 0) {
      run.bossSteps[0] = run.bossSteps[0]! - 1;
      target = Math.min(target, 0.25);
    }
    const s = run.speed[0]!;
    run.speed[0] = target < s ? target : Math.min(target, s + ctx.dt * 5);
    run.time[0] = run.time[0]! + ctx.dt * run.speed[0]!;
  },
});
