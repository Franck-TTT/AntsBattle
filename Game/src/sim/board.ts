/**
 * The board: built once, reset on every run, fitted to the screen. Sim code.
 */
import { added, defineSystem, fitWorldView, query, read, write, Shape, Text2D, ViewInfo, WorldView, type SystemContext } from '@gameengine/runtime';
import { Block, Board, NestLabel, NestOpened, NestSpot, Offer, WaveStarted, Run, Placement, Item, Enemy, Projectile, RestartRequested } from '../schema.gen.ts';
import { BASE_CELL, BOARD_Y, CELLS, COLS, NESTS, NEST_CELL, REROLL_SLOT, ROWS, TRAY_SLOTS, TRAY_SLOT_H, VIEW_RECT, cellX, cellY, flowField, tracePath, trayW, trayX, trayY } from '../grid.ts';
import { FIRST_WAVE_AT, START_GOLD, START_LIVES } from '../balance.ts';
import { COLORS, ORDER } from '../looks.ts';
import { drawOffer } from './offer.ts';

/** HUD bands the board stays clear of, in UI reference px (ui/hud.ui.json's top bar is 190 tall). */
export const FIT = { reserve: { top: 200, bottom: 24, left: 16, right: 16 } } as const;

// Scratch buffers: fully written before every read, no state carried between runs.
const blocked = new Uint8Array(CELLS);
const queue = new Int16Array(CELLS);

/** Recomputes the flow field and the nest→base path from `Board.cells`. */
export function recomputeBoard(ctx: SystemContext): void {
  const b = ctx.resource(Board);
  for (let c = 0; c < CELLS; c++) blocked[c] = b.cells[c]! > 0 ? 1 : 0;
  flowField(blocked, b.dist, queue);
  b.pathLen[0] = tracePath(b.dist, NEST_CELL, b.path);
  b.version[0] = b.version[0]! + 1;
}

const at = (x: number, y: number) => ({ position: [x, y, 0] as [number, number, number], rotation: [0, 0, 0, 1] as [number, number, number, number], scale: [1, 1, 1] as [number, number, number] });

export const BuildBoard = defineSystem({
  name: 'BuildBoard',
  resources: [read(Board)],
  runIf: { resource: Board, field: 'version', op: '==', value: 0 },
  run(ctx) {
    const cmd = ctx.commands;
    // Frame and dirt.
    cmd.spawn({ LocalTransform: at(0, BOARD_Y), Shape: { kind: 'Rect', size: [COLS + 0.36, ROWS + 0.36], radius: 0.3, color: COLORS.frame, order: ORDER.ground, sortingLayer: 'Default' } });
    cmd.spawn({ LocalTransform: at(0, BOARD_Y), Shape: { kind: 'Rect', size: [COLS, ROWS], radius: 0.12, color: COLORS.dirt, order: ORDER.ground, sortingLayer: 'Default' } });
    // Checker tiles for readability of the grid.
    for (let c = 0; c < CELLS; c++) {
      const col = c % COLS;
      const row = (c / COLS) | 0;
      if ((col + row) % 2 === 0) continue;
      cmd.spawn({ LocalTransform: at(cellX(c), cellY(c)), Shape: { kind: 'Rect', size: [0.98, 0.98], radius: 0.08, color: COLORS.dirtDark, order: ORDER.tile, sortingLayer: 'Default' }, BoardTile: {} });
    }
    // The flow field, one entity per cell (SyncFlow fills it).
    for (let c = 0; c < CELLS; c++) cmd.spawn({ FlowCell: { cell: c, dist: -1, next: -1 } });
    // Nests: a mound each; the hole shows once the nest is open, the wave label until then.
    for (let n = 0; n < NESTS.length; n++) {
      const c = NESTS[n]!.cell;
      cmd.spawn({ LocalTransform: at(cellX(c), cellY(c)), Shape: { kind: 'Circle', size: [1.15, 1.0], radius: 0.5, color: COLORS.nest, strokeColor: '#2e1c0e', strokeWidth: 0.08, order: ORDER.base, sortingLayer: 'Default' } });
      cmd.spawn({ LocalTransform: at(cellX(c), cellY(c) + 0.05), Shape: { kind: 'Circle', size: [0.5, 0.42], radius: 0.21, color: COLORS.nestHole, order: ORDER.base + 1, sortingLayer: 'Default', visible: false }, NestSpot: { index: n, open: false } });
      cmd.spawn({ LocalTransform: at(cellX(c), cellY(c) - 0.14), Text2D: { text: `W${NESTS[n]!.fromWave}`, size: 0.36, color: '#f6e7b8', align: 'Center', outlineColor: '#000000', outlineWidth: 0.12, order: ORDER.base + 2, sortingLayer: 'Default' }, NestLabel: { index: n } });
    }
    // The base at the bottom.
    const base = cmd.spawn({
      LocalTransform: at(cellX(BASE_CELL), cellY(BASE_CELL)),
      Shape: { kind: 'Polygon', sides: 6, size: [1.15, 1.15], radius: 0.08, color: COLORS.base, strokeColor: COLORS.baseRim, strokeWidth: 0.1, order: ORDER.base, sortingLayer: 'Default' },
      VisualOffset: {},
      Base: {},
    });
    cmd.spawn({ LocalTransform: at(0, 0.02), Shape: { kind: 'Circle', size: [0.38, 0.38], radius: 0.19, color: COLORS.baseRim, order: ORDER.base + 1, sortingLayer: 'Default' }, Parent: { entity: base } });
    // Tray: three offer slots (their icons follow the offer, see TraySync) and the Reroll button.
    for (let s = 0; s < TRAY_SLOTS; s++) {
      const reroll = s === REROLL_SLOT;
      const slot = cmd.spawn({
        LocalTransform: at(trayX(s), trayY(s)),
        Shape: { kind: 'Rect', size: [trayW(s), TRAY_SLOT_H], radius: 0.26, color: reroll ? COLORS.reroll : COLORS.traySlot, strokeColor: COLORS.trayRim, strokeWidth: 0.06, order: ORDER.tray, sortingLayer: 'Default' },
        VisualOffset: {},
        TraySlot: { slot: s },
      });
      if (reroll) {
        // A circular arrow, drawn with a ring and an arrow head.
        cmd.spawn({ LocalTransform: at(0, 0.2), Shape: { kind: 'Ring', size: [0.62, 0.62], radius: 0.31, thickness: 0.1, color: COLORS.text, order: ORDER.tray + 1, sortingLayer: 'Default' }, Parent: { entity: slot } });
        cmd.spawn({ LocalTransform: { position: [0.28, 0.32, 0], rotation: [0, 0, 1, 0], scale: [1, 1, 1] }, Shape: { kind: 'Polygon', sides: 3, size: [0.26, 0.26], radius: 0.02, color: COLORS.text, order: ORDER.tray + 2, sortingLayer: 'Default' }, Parent: { entity: slot } });
      }
      cmd.spawn({
        LocalTransform: at(0, reroll ? -0.4 : -0.46),
        Text2D: { text: '', size: 0.32, color: COLORS.text, align: 'Center', outlineColor: '#000000', outlineWidth: 0.12, order: ORDER.tray + 4, sortingLayer: 'Default' },
        TrayLabel: { slot: s },
        Parent: { entity: slot },
      });
    }
  },
});

export const StartRun = defineSystem({
  name: 'StartRun',
  after: ['BuildBoard'],
  queries: { items: query(read(Item)), blocks: query(read(Block)), enemies: query(read(Enemy)), shots: query(read(Projectile)) },
  resources: [write(Board), write(Run), write(Placement), write(Offer)],
  events: [RestartRequested],
  runIf: { any: [{ resource: Board, field: 'version', op: '==', value: 0 }, { event: RestartRequested }] },
  run(ctx, q) {
    for (const c of q.items.chunks()) for (let i = 0; i < c.length; i++) ctx.commands.despawn(c.entity(i));
    for (const c of q.blocks.chunks()) for (let i = 0; i < c.length; i++) ctx.commands.despawn(c.entity(i));
    for (const c of q.enemies.chunks()) for (let i = 0; i < c.length; i++) ctx.commands.despawn(c.entity(i));
    for (const c of q.shots.chunks()) for (let i = 0; i < c.length; i++) ctx.commands.despawn(c.entity(i));
    const runId = ctx.resource(Run).runId[0]! + 1;
    ctx.set(Run, {
      phase: 'playing', runId, time: 0, speed: 1, wave: 0, lives: START_LIVES, gold: START_GOLD, wallsBuilt: 0,
      nextWaveAt: FIRST_WAVE_AT, group: 0, groupSpawned: 0, spawnAt: 1e9, spawning: false, alive: 0, kills: 0, bossSteps: 0,
      placements: 0, refusals: 0, shots: 0, booms: 0, baseHits: 0, bosses: 0, nestTurn: 0, nestsOpen: 0, goldFrac: 0,
    });
    const b = ctx.resource(Board);
    for (let c = 0; c < CELLS; c++) {
      b.cells[c] = 0;
      b.weapons[c] = 0;
    }
    recomputeBoard(ctx);
    ctx.set(Placement, { active: false, kind: 'none', cell: -1, fromCell: -1, slot: -1, valid: false, previewLen: 0, returnSteps: 0 });
    ctx.setField(Offer, 'sets', 0);
    ctx.setField(Offer, 'rerolls', 0);
    drawOffer(ctx);
  },
});

export const FitView = defineSystem({
  name: 'FitView',
  resources: [read(ViewInfo), write(WorldView), read(Board)],
  runIf: { any: [{ changed: ViewInfo }, { resource: Board, field: 'version', op: '==', value: 0 }] },
  run(ctx) {
    fitWorldView(ctx, VIEW_RECT.x, VIEW_RECT.y, VIEW_RECT.w, VIEW_RECT.h, FIT);
  },
});


/** Opens each nest at its wave: shows its hole, hides its wave label, signals the opening. */
export const NestSync = defineSystem({
  name: 'NestSync',
  after: ['Waves'],
  queries: { holes: query(write(NestSpot)), labels: query(read(NestLabel)) },
  resources: [write(Run)],
  events: [WaveStarted, RestartRequested],
  runIf: { any: [{ event: WaveStarted }, { event: RestartRequested }, { query: query(added(NestSpot)) }] },
  run(ctx, q) {
    const run = ctx.resource(Run);
    const wave = Math.max(1, run.wave[0]!);
    for (const c of q.holes.chunks()) {
      const ns = c.col(NestSpot);
      for (let i = 0; i < c.length; i++) {
        const n = ns.index[i]!;
        const open = NESTS[n]!.fromWave <= wave;
        if ((ns.open[i] === 1) === open) continue;
        ns.open[i] = open ? 1 : 0;
        ctx.commands.setField(c.entity(i), Shape, 'visible', open);
        for (const lc of q.labels.chunks()) {
          const nl = lc.col(NestLabel);
          for (let j = 0; j < lc.length; j++) if (nl.index[j] === n) ctx.commands.setField(lc.entity(j), Text2D, 'text', open ? '' : `W${NESTS[n]!.fromWave}`);
        }
        if (open && NESTS[n]!.fromWave > 1) {
          run.nestsOpen[0] = run.nestsOpen[0]! + 1;
          ctx.signal(NestOpened, { nest: n, wave });
        }
      }
    }
  },
});
