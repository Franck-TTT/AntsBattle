/**
 * Level layouts: the nests, the base, and the blocks and weapons a LevelDef puts on the board when
 * a run starts, locked (never moved, never destroyed). Sim code: data assets are content,
 * identical on every device.
 */
import { loadData, type SystemContext } from '@gameengine/runtime';
import { Board, Level, LevelDef } from '../schema.gen.ts';
import { CELLS, COLS } from '../grid.ts';
import { ITEM_NAMES } from '../kinds.ts';
import { checkLayout, type Layout } from '../layout.ts';
import { WAVE_COUNT } from '../balance.ts';

/** Waves a level plays: its `waves`, within 1 and every wave of the sheet. */
export const levelWaves = (def: { waves?: number }): number => Math.max(1, Math.min(WAVE_COUNT, def.waves ?? WAVE_COUNT));
import { spawnBlock, spawnItem } from './spawn.ts';

const EMPTY: Layout = { blocks: [], weapons: [] };

/**
 * Puts the current level on an empty board: its size, nests and base in `Board` (the defaults when it
 * has none, or no level is set), then its blocks and weapons. Entries that break a layout rule
 * (src/layout.ts) are skipped; the `game/level-layout` check reports them. The caller recomputes
 * the flow field.
 */
export function loadLevel(ctx: SystemContext): void {
  const ref = ctx.get(Level).data;
  const def = ref ? loadData(LevelDef, ref) : EMPTY;
  const layout = checkLayout(def);
  const b = ctx.resource(Board);
  b.cols[0] = layout.cols;
  b.rows[0] = layout.rows;
  b.nestCount[0] = layout.nests.length;
  layout.nests.forEach((n, i) => {
    b.nestCell[i] = n.cell;
    b.nestWave[i] = n.fromWave;
  });
  b.baseCell[0] = layout.base;
  b.waveCount[0] = levelWaves(def as { waves?: number });
  for (let c = 0; c < CELLS; c++) {
    b.cells[c] = layout.cells[c]!;
    b.noBuild[c] = layout.noBuild[c]!;
  }
  def.blocks.forEach((blk, i) => {
    const top = blk.row * COLS + blk.col;
    if (layout.blockAt[top] === i) spawnBlock(ctx, blk.shape as Parameters<typeof spawnBlock>[1], top, 0, true);
  });
  def.weapons.forEach((wp, i) => {
    const cell = wp.row * COLS + wp.col;
    if (layout.weaponAt[cell] !== i) return;
    b.weapons[cell] = ITEM_NAMES.indexOf(wp.kind as (typeof ITEM_NAMES)[number]);
    spawnItem(ctx, wp.kind as Parameters<typeof spawnItem>[1], cell, 0, true);
  });
}
