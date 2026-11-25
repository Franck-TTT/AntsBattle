/**
 * Balance probe: a scripted player takes what the offer gives. Blocks go onto the next free spot
 * of a serpentine (barrier rows with a gap at alternating ends, never closing the path); weapons
 * go on the free block cell that covers most of the ants' path; it rerolls when nothing on offer
 * is usable. A decent player should win with lives to spare; doing nothing must lose.
 */
import { expect } from '@gameengine/test';
import { worldTest } from './play.ts';
import { Block, Board, Item, Offer, Run } from '../src/schema.gen.ts';
import { CELLS, COLS, DEFAULT_BASE, DEFAULT_COLS, DEFAULT_MARKERS, DEFAULT_ROWS, REROLL_SLOT, isMarker, nestsReach, ROWS, cellX, cellY, flowField, footprintCell, footprintX, footprintY, trayX, trayY } from '../src/grid.ts';
import { GHOST_LIFT, ITEMS, SHAPES, START_LIVES, itemPrice, rerollPrice, type BlockShapeName } from '../src/balance.ts';
import { ITEM_NAMES, SHAPE_NAMES } from '../src/kinds.ts';

// Barrier rows and the column each leaves open, alternating sides.
const BARRIERS: [number, number][] = [[2, 6], [4, 0], [6, 6], [8, 0]];

function blockSpot(cells: ArrayLike<number>, shape: BlockShapeName): number {
  const [w, h] = SHAPES[shape];
  const blocked = new Uint8Array(CELLS);
  const dist = new Int16Array(CELLS);
  const queue = new Int16Array(CELLS);
  for (const [row, gap] of BARRIERS) {
    for (let col = 0; col + w <= DEFAULT_COLS; col++) {
      const anchor = row * COLS + col;
      if (row + h > DEFAULT_ROWS) continue;
      let ok = true;
      for (let k = 0; k < w * h && ok; k++) {
        const c = footprintCell(anchor, w, k);
        const r = (c / COLS) | 0;
        const gapHere = BARRIERS.some(([br, bg]) => br === r && bg === c % COLS);
        if (cells[c] || isMarker(DEFAULT_MARKERS, c) || gapHere) ok = false;
      }
      if (!ok) continue;
      for (let c = 0; c < CELLS; c++) blocked[c] = cells[c] ? 1 : 0;
      for (let k = 0; k < w * h; k++) blocked[footprintCell(anchor, w, k)] = 1;
      flowField(blocked, dist, queue, DEFAULT_BASE, DEFAULT_COLS, DEFAULT_ROWS);
      if (nestsReach(DEFAULT_MARKERS, dist)) return anchor;
    }
  }
  return -1;
}

function weaponSpot(cells: ArrayLike<number>, weapons: ArrayLike<number>, path: ArrayLike<number>, pathLen: number, range: number): number {
  let best = -1;
  let bestScore = 0;
  for (let c = 0; c < CELLS; c++) {
    if (!cells[c] || weapons[c]) continue;
    let score = 0;
    for (let k = 0; k < pathLen; k++) {
      const p = path[k]!;
      const dx = cellX(p) - cellX(c);
      const dy = cellY(p) - cellY(c);
      if (dx * dx + dy * dy <= range * range) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return best;
}

worldTest('a scripted player taking what the offer gives wins the run', async ({ world, step, input }) => {
  input.view(393, 852, 3, [0, 59, 0, 34]);
  await step(2);
  let maxWave = 0;
  let bought = 0;
  let rerolls = 0;
  const press = async (from: [number, number], to: [number, number] | null) => {
    const [sx, sy] = input.worldToScreen(from);
    input.pointer('down', sx, sy);
    await step(1);
    const [tx, ty] = to ? input.worldToScreen([to[0], to[1] - GHOST_LIFT]) : [sx, sy];
    input.pointer('move', tx!, ty!);
    await step(2);
    input.pointer('up', tx!, ty!);
    await step(2);
  };
  for (let s = 0; s < 60 * 400 && world.resource(Run).phase === 'playing'; s += 30) {
    maxWave = world.resource(Run).wave;
    for (let tries = 0; tries < 6; tries++) {
      const run = world.resource(Run);
      const offer = world.resource(Offer);
      const board = world.resource(Board);
      let acted = false;
      let usable = false;
      for (let slot = 0; slot < 3 && !acted; slot++) {
        if (offer.sold[slot]) continue;
        const kind = ITEM_NAMES[offer.kinds[slot]!]!;
        const shape = SHAPE_NAMES[offer.shapes[slot]!]!;
        if (kind === 'none') continue;
        let target: [number, number] | null = null;
        if (kind === 'wall') {
          const a = blockSpot(board.cells, shape);
          const [w, h] = SHAPES[shape];
          if (a >= 0) target = [footprintX(a, w), footprintY(a, h)];
        } else {
          const c = weaponSpot(board.cells, board.weapons, board.path, board.pathLen, ITEMS[kind].range);
          if (c >= 0) target = [cellX(c), cellY(c)];
        }
        if (!target) continue;
        usable = true;
        if (run.gold < itemPrice(kind, run.wallsBuilt, shape)) continue;
        const before = world.entities(Item).length + world.entities(Block).length;
        await press([trayX(slot, DEFAULT_COLS), trayY(DEFAULT_ROWS)], target);
        acted = world.entities(Item).length + world.entities(Block).length > before;
        if (acted) bought++;
      }
      if (acted) continue;
      // Nothing usable on offer: pay for a new set when it leaves a cushion.
      if (!usable && run.gold >= rerollPrice(offer.rerolls) + 30) {
        await press([trayX(REROLL_SLOT, DEFAULT_COLS), trayY(DEFAULT_ROWS)], null);
        rerolls++;
        continue;
      }
      break;
    }
    await step(25);
  }
  const run = world.resource(Run);
  console.log(`nests open ${run.nestsOpen}, turn ${run.nestTurn}`);
  console.log(`balance: phase=${run.phase} wave=${maxWave} lives=${run.lives}/${START_LIVES} gold=${run.gold} kills=${run.kills} bought=${bought} rerolls=${rerolls} time=${run.time.toFixed(0)}s`);
  expect(run.phase).toBe('won');
});
