/**
 * Drag and drop. Blocks (1×1 to 2×2 and 1×3 footprints) come from the tray, drop on free cells,
 * block the ants and never move again. Weapons come from the tray or off a block, drop only on a
 * free block cell (mines and boost pads: on a free ground cell, where the ants walk), and can be moved again after their cooldown.
 * Nothing drops on a no-build cell (Board.noBuild: the level's, and the 8 around each nest). A hovered drop gets a live
 * validity check and path preview; a refused one snaps back. A tap (no drag) on a weapon, in the
 * offer or on the board, opens its info popup instead and pauses the run (WeaponInfo). Sim code: the pointer arrives as
 * recorded input, so a replay reproduces every placement.
 */
import { burstAt, defineSystem, entityAt, math, query, read, teleport, write, Drag, LocalTransform, NO_ENTITY, PointerDown, PointerState, PointerUp, Tap, type EntityId, type Query, type SystemContext } from '@gameengine/runtime';
import { Block, Board, Boost, Enemy, FxHost, Item, ItemPlaced, Offer, OfferRerolled, Panel, Placement, PlacementRefused, Run, SettingsMenu, WeaponInfo, WeaponInfoClosed } from '../schema.gen.ts';
import { CELLS, cellAt, isMarker, nestsReach, cellX, cellY, flowField, footprintAt, footprintCell, footprintX, footprintY, nearestCell, nextCell, REROLL_SLOT, slotAt, tracePath, trayX, type PanelLayout } from '../grid.ts';

/** Scratch copy of the Panel resource: fully written before every read. */
const panel: PanelLayout = { x: 0, trayY: 0, hudY: 0, scale: 1 };
import { DRAG_SPEED, GHOST_LIFT, MOVE_COOLDOWN, ON_GROUND, SHAPES, itemPrice, rerollPrice, shapeCells, type BlockShapeName, type ItemKindName } from '../balance.ts';
import { ITEM_NAMES as ITEM_KINDS, FX_NAMES as FX_KINDS, SHAPE_NAMES } from '../kinds.ts';
import { recomputeBoard } from './board.ts';
import { drawOffer, sellOffer } from './offer.ts';
import { spawnBlock, spawnItem } from './spawn.ts';

const blocked = new Uint8Array(CELLS);
const dist = new Int16Array(CELLS);
const queue = new Int16Array(CELLS);

const REASONS = ['ok', 'offBoard', 'occupied', 'blocks', 'gold', 'enemy', 'noBlock', 'fixed', 'noBuild'] as const;
type Reason = (typeof REASONS)[number];
const RETURN_STEPS = 16;
const WALL = ITEM_KINDS.indexOf('wall');
/** Weapons laid on the ground, where the ants walk, instead of on a block. */
const GROUND = ITEM_KINDS.map((k) => ON_GROUND.has(k));

const oldDist = new Int16Array(CELLS);
const newPath = new Int16Array(CELLS);

/**
 * Moves the enemies a new block landed on onto the new path from their nest, as far from the
 * nest as they had walked on the old one (`oldDist`: the field before the block). Sim code.
 */
function moveCrushed(enemies: Query, oldDist: Int16Array, dist: ArrayLike<number>, cells: ArrayLike<number>, cols: number, rows: number): void {
  for (const c of enemies.chunks()) {
    const en = c.col(Enemy);
    const tr = c.col(LocalTransform);
    for (let i = 0; i < c.length; i++) {
      if (en.remaining[i]! < 0) continue;
      const x = tr.position[i * 3]!;
      const y = tr.position[i * 3 + 1]!;
      const ec = nearestCell(x, y, cols, rows);
      if (!cells[ec]) continue;
      const nest = en.nest[i]!;
      // Walked so far on the old path: whole cells from the nest, plus how far past this cell's centre.
      let walked = Math.max(0, oldDist[nest]! - oldDist[ec]!);
      const on = nextCell(oldDist, ec);
      if (on >= 0) walked = Math.max(0, walked + (x - cellX(ec)) * (cellX(on) - cellX(ec)) + (y - cellY(ec)) * (cellY(on) - cellY(ec)));
      const len = tracePath(dist, nest, newPath);
      if (len < 2) continue;
      // Never past the cell before the base: the walk takes it from there.
      const at = Math.min(walked, len - 2);
      const k = Math.floor(at);
      const f = at - k;
      const a = newPath[k]!;
      const b = newPath[k + 1]!;
      const hx = cellX(b) - cellX(a);
      const hy = cellY(b) - cellY(a);
      const lane = en.lane[i]!;
      tr.position[i * 3] = cellX(a) + hx * f - hy * lane;
      tr.position[i * 3 + 1] = cellY(a) + hy * f + hx * lane;
      en.hx[i] = hx;
      en.hy[i] = hy;
      tr.rotation[i * 4 + 2] = (hy >= 0 ? 1 : -1) * math.sqrt(Math.max(0, (1 - hx) * 0.5));
      tr.rotation[i * 4 + 3] = math.sqrt(Math.max(0, (1 + hx) * 0.5));
      en.kx[i] = 0;
      en.ky[i] = 0;
      en.remaining[i] = len - 1 - at;
      teleport(c.entity(i));
    }
  }
}

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
    enemies: query(write(Enemy), write(LocalTransform)),
    fx: query(read(FxHost)),
  },
  resources: [write(Placement), write(Run), write(Board), write(Offer), write(WeaponInfo), read(Panel), read(PointerState), read(Boost)],
  events: [PointerDown, PointerUp, Tap, Drag],
  runIf: [
    { resource: Run, field: 'phase', value: 'playing' },
    { resource: WeaponInfo, field: 'open', op: '==', value: 0 },
    { resource: SettingsMenu, field: 'open', op: '==', value: 0 },
    { any: [{ event: PointerDown }, { event: PointerUp }, { event: Tap }, { event: Drag }, { resource: Placement, field: 'active' }, { resource: Placement, field: 'returnSteps' }] },
  ],
  run(ctx, q) {
    const p = ctx.resource(Placement);
    const run = ctx.resource(Run);
    const board = ctx.resource(Board);
    const boost = ctx.resource(Boost);
    const freeWalls = boost.freeWalls[0]!;
    const cols = board.cols[0]!;
    const rows = board.rows[0]!;
    const pr = ctx.resource(Panel);
    panel.x = pr.x[0]!;
    panel.trayY = pr.trayY[0]!;
    panel.hudY = pr.hudY[0]!;
    panel.scale = pr.scale[0]!;
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
        if (isMarker(board, c) || board.cells[c]! > 0 || board.weapons[c]! > 0) return 'occupied';
        if (board.noBuild[c]) return 'noBuild';
      }
      if (run.gold[0]! < itemPrice('wall', run.wallsBuilt[0]!, shape, freeWalls)) return 'gold';
      for (let c = 0; c < CELLS; c++) blocked[c] = board.cells[c]! > 0 ? 1 : 0;
      for (let k = 0; k < n; k++) blocked[footprintCell(cell, w, k)] = 1;
      flowField(blocked, dist, queue, board.baseCell[0]!, cols, rows);
      // Every nest, open or not yet, must keep a way to the base.
      if (!nestsReach(board, dist)) return 'blocks';
      for (const c of q.enemies.chunks()) {
        const pos = c.col(LocalTransform).position;
        for (let i = 0; i < c.length; i++) {
          const ec = nearestCell(pos[i * 3]!, pos[i * 3 + 1]!, cols, rows);
          // Under the new block: crushed onto the new path on the drop (moveCrushed).
          if (blocked[ec] && board.cells[ec] === 0) continue;
          if (dist[ec]! < 0) return 'blocks';
        }
      }
      for (let c = 0; c < CELLS; c++) p.previewDist[c] = dist[c]!;
      p.previewLen[0] = 1;
      return 'ok';
    };

    /** A weapon on `cell`: only on a block cell without a weapon; a mine or a boost pad only on a free ground cell. */
    const evaluateWeapon = (kind: number, cell: number, fromCell: number): Reason => {
      p.previewLen[0] = 0;
      if (cell < 0) return 'offBoard';
      if (cell === fromCell) return 'ok';
      if (GROUND[kind]) {
        if (board.cells[cell]! > 0 || isMarker(board, cell)) return 'occupied';
        if (board.noBuild[cell]) return 'noBuild';
      } else if (board.cells[cell] === 0) return 'noBlock';
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

    /** Opens the info popup of the weapon in offer `slot` or on board `cell`: the run pauses (GameSpeed). */
    const openInfo = (kind: number, slot: number, cell: number): void => {
      const info = ctx.resource(WeaponInfo);
      ctx.set(WeaponInfo, { open: true, kind: ITEM_KINDS[kind]!, slot, cell, opens: info.opens[0]! + 1 });
    };
    /** The weapon under a point: an unsold offer slot or a board cell holding one. */
    const weaponAt = (x: number, y: number): { kind: number; slot: number; cell: number } | null => {
      const slot = slotAt(x, y, panel);
      if (slot === REROLL_SLOT) return null;
      if (slot >= 0) {
        const offer = ctx.resource(Offer);
        const kind = offer.kinds[slot]!;
        return offer.sold[slot] || kind === WALL ? null : { kind, slot, cell: -1 };
      }
      const cell = cellAt(x, y, cols, rows);
      return cell >= 0 && board.weapons[cell]! > 0 ? { kind: board.weapons[cell]!, slot: -1, cell } : null;
    };

    const setHeld = (e: EntityId, held: boolean): void => {
      for (const c of q.items.chunks()) for (let i = 0; i < c.length; i++) if (c.entity(i) === e) c.setField(Item, i, 'held', held);
    };

    // Pick up.
    if (!p.active[0]) {
      for (const d of ctx.events.read(PointerDown)) {
        const slot = slotAt(d.world[0], d.world[1], panel);
        if (slot === REROLL_SLOT) {
          // Reroll: pay for a new set of three.
          const offer = ctx.resource(Offer);
          const price = rerollPrice(offer.rerolls[0]!, offer.freeRerolls[0]!);
          p.slot[0] = slot;
          if (run.gold[0]! < price) {
            refuse('gold');
            break;
          }
          run.gold[0] = run.gold[0]! - price;
          // A free reroll (upgrade) leaves the price curve where it is.
          if (offer.freeRerolls[0]! > 0) offer.freeRerolls[0] = offer.freeRerolls[0]! - 1;
          else offer.rerolls[0] = offer.rerolls[0]! + 1;
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
            // A weapon: a tap still opens its info, so the refusal waits for a drag (below).
            if (kind === 'wall') refuse('gold');
            break;
          }
          ctx.set(Placement, { active: true, kind, shape, fromItem: NO_ENTITY, fromCell: -1, slot, cell: -2, valid: false, returnSteps: 0 });
          break;
        }
        const cell = cellAt(d.world[0], d.world[1], cols, rows);
        // A free cell holds nothing to pick up, unless a mine or a boost pad lies on it.
        if (cell < 0 || (board.cells[cell] === 0 && board.weapons[cell] === 0)) continue;
        if (board.weapons[cell]! > 0) {
          // A weapon: movable once its cooldown is over, unless the level pre-placed it.
          for (const c of q.items.chunks()) {
            const it = c.col(Item);
            for (let i = 0; i < c.length; i++) {
              if (it.cell[i] !== cell) continue;
              // Locked or cooling down: a tap opens its info, a drag is refused (below).
              if (!it.locked[i] && it.cooldown[i]! <= 0) {
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
      if (!p.active[0]) {
        // A tap on a weapon nothing picked up (unaffordable, locked, cooling down): its info.
        for (const t of ctx.events.read(Tap)) {
          const w = weaponAt(t.world[0], t.world[1]);
          if (w) return openInfo(w.kind, w.slot, w.cell);
        }
        // A drag from it: refused, as the press used to be.
        for (const d of ctx.events.read(Drag)) {
          if (d.phase !== 'Start') continue;
          const w = weaponAt(d.start[0], d.start[1]);
          if (!w) continue;
          if (w.slot >= 0) {
            refuse('gold');
            continue;
          }
          for (const c of q.items.chunks()) {
            const it = c.col(Item);
            for (let i = 0; i < c.length; i++) {
              if (it.cell[i] !== w.cell) continue;
              c.setField(Item, i, 'denySteps', 14);
              refuse(it.locked[i] ? 'fixed' : 'occupied');
            }
          }
        }
        return;
      }
      run.speed[0] = DRAG_SPEED * boost.drag[0]!;
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

    // A tap on a weapon picked up (no drag): put it back and show its info instead of dropping it.
    if (kind !== WALL && ctx.events.count(Tap) > 0) {
      const fromItem = entityAt(p.fromItem, 0);
      if (fromItem !== NO_ENTITY) setHeld(fromItem, false);
      p.active[0] = 0;
      p.cell[0] = -1;
      p.previewLen[0] = 0;
      return openInfo(kind, fromCell >= 0 ? -1 : p.slot[0]!, fromCell);
    }

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
        const cost = itemPrice('wall', run.wallsBuilt[0]!, shape, freeWalls);
        const [w, h] = SHAPES[shape];
        run.gold[0] = run.gold[0]! - cost;
        run.wallsBuilt[0] = run.wallsBuilt[0]! + 1;
        spawnBlock(ctx, shape, cell, time);
        for (let c = 0; c < CELLS; c++) oldDist[c] = board.dist[c]!;
        for (let k = 0; k < shapeCells(shape); k++) board.cells[footprintCell(cell, w, k)] = 1;
        recomputeBoard(ctx);
        moveCrushed(q.enemies, oldDist, board.dist, board.cells, cols, rows);
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
    p.retToX[0] = fromCell >= 0 ? cellX(fromCell) : trayX(p.slot[0]!, panel);
    p.retToY[0] = fromCell >= 0 ? cellY(fromCell) : panel.trayY;
    if (r !== 'offBoard') refuse(r);
  },
});

/** Game speed: almost frozen while a finger holds an item, eased back after. */
export const GameSpeed = defineSystem({
  name: 'GameSpeed',
  after: ['DragItems'],
  resources: [write(Run), read(Placement), read(Boost), read(WeaponInfo), read(SettingsMenu)],
  runIf: [{ resource: Run, field: 'phase', value: 'playing' }],
  run(ctx) {
    const run = ctx.resource(Run);
    // The weapon info and settings popups pause the run: game time stands still until they close.
    if (ctx.resource(WeaponInfo).open[0] || ctx.resource(SettingsMenu).open[0]) {
      run.speed[0] = 0;
      return;
    }
    let target = ctx.resource(Placement).active[0] ? DRAG_SPEED * ctx.resource(Boost).drag[0]! : 1;
    if (run.bossSteps[0]! > 0) {
      run.bossSteps[0] = run.bossSteps[0]! - 1;
      target = Math.min(target, 0.25);
    }
    const s = run.speed[0]!;
    run.speed[0] = target < s ? target : Math.min(target, s + ctx.dt * 5);
    run.time[0] = run.time[0]! + ctx.dt * run.speed[0]!;
  },
});

/** The weapon info popup closed: the run resumes (GameSpeed eases the speed back up). */
export const CloseWeaponInfo = defineSystem({
  name: 'CloseWeaponInfo',
  before: ['GameSpeed'],
  resources: [write(WeaponInfo)],
  events: [WeaponInfoClosed],
  runIf: { event: WeaponInfoClosed },
  run(ctx) {
    ctx.set(WeaponInfo, { open: false });
  },
});
