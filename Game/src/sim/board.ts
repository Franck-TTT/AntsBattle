/**
 * The board: built once, reset on every run (its grid redrawn at the level's size), fitted to the screen. Sim code.
 */
import { added, defineSystem, fitWorldView, query, read, teleport, withTag, write, LocalTransform, Shape, Text2D, ViewInfo, WorldView, type Commands, type SystemContext } from '@gameengine/runtime';
import { Base, Block, Board, BoardTile, Level, TraySlot, NestLabel, NestMound, NestOpened, NestSpot, Offer, WaveStarted, Run, Placement, Item, Enemy, Projectile, RestartRequested } from '../schema.gen.ts';
import { CELLS, DEFAULT_BASE, DEFAULT_COLS, DEFAULT_NESTS, DEFAULT_ROWS, MAX_NESTS, REROLL_SLOT, TRAY_SLOTS, TRAY_SLOT_H, boardRect, cellX, cellY, flowField, tracePath, trayW, trayX, trayY, viewRect } from '../grid.ts';
import { FIRST_WAVE_AT, START_GOLD, START_LIVES } from '../balance.ts';
import { COIN, COLORS, DIE, ORDER, shapeValue } from '../looks.ts';
import { drawOffer } from './offer.ts';
import { loadLevel } from './level.ts';

/** HUD bands the board stays clear of, in UI reference px (ui/hud.ui.json's top bar is 190 tall). */
export const FIT = { reserve: { top: 200, bottom: 24, left: 16, right: 16 } } as const;

// Scratch buffers: fully written before every read, no state carried between runs.
const blocked = new Uint8Array(CELLS);
const queue = new Int16Array(CELLS);

/** Recomputes the flow field and the first nest's path to the base from `Board.cells`. */
export function recomputeBoard(ctx: SystemContext): void {
  const b = ctx.resource(Board);
  for (let c = 0; c < CELLS; c++) blocked[c] = b.cells[c]! > 0 ? 1 : 0;
  flowField(blocked, b.dist, queue, b.baseCell[0]!, b.cols[0]!, b.rows[0]!);
  b.pathLen[0] = tracePath(b.dist, b.nestCell[0]!, b.path);
  b.version[0] = b.version[0]! + 1;
}

const at = (x: number, y: number) => ({ position: [x, y, 0] as [number, number, number], rotation: [0, 0, 0, 1] as [number, number, number, number], scale: [1, 1, 1] as [number, number, number] });

/**
 * Space and its grid (Geometry Wars style) around a `cols` × `rows` board: a faint half-cell grid over
 * the whole screen, a brighter one on the board with cell edges stronger than the half lines, a neon
 * frame. Every piece is a BoardTile, so a new level's size can redraw them.
 */
function spawnGrid(cmd: Commands, cols: number, rows: number): void {
  const line = (x: number, y: number, w: number, h: number, color: string, order: number) =>
    cmd.spawn({ LocalTransform: at(x, y), Shape: { kind: 'Rect', size: [w, h], radius: 0, color, order, sortingLayer: 'Default' }, BoardTile: {} });
  const r = boardRect(cols, rows);
  const hw = cols / 2;
  const hh = rows / 2;
  const FAR = 14;
  // Far grid, outside the board only (nothing overlaps at the same order).
  for (let k = -FAR * 2; k <= FAR * 2; k++) {
    const dx = k / 2;
    const x = r.x + dx;
    if (dx < -hw || dx > hw) line(x, r.y, 0.025, FAR * 2, COLORS.gridFar, ORDER.ground);
    else {
      line(x, r.y + (hh + FAR) / 2, 0.025, FAR - hh, COLORS.gridFar, ORDER.ground);
      line(x, r.y - (hh + FAR) / 2, 0.025, FAR - hh, COLORS.gridFar, ORDER.ground);
    }
    const y = r.y + dx;
    if (dx < -hh || dx > hh) line(r.x, y, FAR * 2, 0.025, COLORS.gridFar, ORDER.ground);
    else {
      line(r.x - (hw + FAR) / 2, y, FAR - hw, 0.025, COLORS.gridFar, ORDER.ground);
      line(r.x + (hw + FAR) / 2, y, FAR - hw, 0.025, COLORS.gridFar, ORDER.ground);
    }
  }
  cmd.spawn({ LocalTransform: at(r.x, r.y), Shape: { kind: 'Rect', size: [cols, rows], radius: 0, color: COLORS.board, order: ORDER.ground, sortingLayer: 'Default' }, BoardTile: {} });
  for (let k = 1; k < cols * 2; k++) line(r.x - hw + k / 2, r.y, k % 2 === 0 ? 0.04 : 0.02, rows, k % 2 === 0 ? COLORS.gridMajor : COLORS.grid, ORDER.tile);
  for (let k = 1; k < rows * 2; k++) line(r.x, r.y - hh + k / 2, cols, k % 2 === 0 ? 0.04 : 0.02, k % 2 === 0 ? COLORS.gridMajor : COLORS.grid, ORDER.tile);
  cmd.spawn({ LocalTransform: at(r.x, r.y), Shape: { kind: 'Rect', size: [cols + 0.14, rows + 0.14], radius: 0.04, color: '#00000000', strokeColor: COLORS.frame, strokeWidth: 0.07, order: ORDER.highlight, sortingLayer: 'Default' }, BoardTile: {} });
}

export const BuildBoard = defineSystem({
  name: 'BuildBoard',
  resources: [read(Board)],
  runIf: { resource: Board, field: 'version', op: '==', value: 0 },
  run(ctx) {
    const cmd = ctx.commands;
    // The flow field, one entity per cell (SyncFlow fills it).
    for (let c = 0; c < CELLS; c++) cmd.spawn({ FlowCell: { cell: c, dist: -1, next: -1 } });
    // Nest slots: a mound each, with its hole (shown once the nest is open) and its wave label
    // (until then). PlaceMarkers moves them onto the level's nests and hides the unused ones.
    for (let n = 0; n < MAX_NESTS; n++) {
      const c = DEFAULT_NESTS[n % DEFAULT_NESTS.length]!.cell;
      const mound = cmd.spawn({ LocalTransform: at(cellX(c), cellY(c)), Shape: { kind: 'Polygon', sides: 6, size: [0.95, 0.95], radius: 0, color: COLORS.nest, strokeColor: COLORS.nestRim, strokeWidth: 0.07, order: ORDER.base, sortingLayer: 'Default' }, NestMound: { index: n } });
      cmd.spawn({ LocalTransform: at(0, 0), Shape: { kind: 'Polygon', sides: 6, size: [0.42, 0.42], radius: 0, color: COLORS.nestHole, order: ORDER.base + 1, sortingLayer: 'Default', visible: false }, NestSpot: { index: n, open: false }, Parent: { entity: mound } });
      cmd.spawn({ LocalTransform: at(0, -0.14), Text2D: { text: '', size: 0.36, color: COLORS.nestRim, align: 'Center', outlineColor: '#000000', outlineWidth: 0.12, order: ORDER.base + 2, sortingLayer: 'Default' }, NestLabel: { index: n }, Parent: { entity: mound } });
    }
    // The base (PlaceMarkers moves it onto the level's).
    const base = cmd.spawn({
      LocalTransform: at(cellX(DEFAULT_BASE), cellY(DEFAULT_BASE)),
      Shape: { kind: 'Polygon', sides: 6, size: [1.15, 1.15], radius: 0, color: COLORS.base, strokeColor: COLORS.baseRim, strokeWidth: 0.08, order: ORDER.base, sortingLayer: 'Default' },
      VisualOffset: {},
      Base: {},
    });
    cmd.spawn({ LocalTransform: at(0, 0), Shape: { kind: 'Polygon', sides: 6, size: [0.4, 0.4], radius: 0, color: COLORS.baseRim, order: ORDER.base + 1, sortingLayer: 'Default' }, Parent: { entity: base } });
    // Tray: three offer slots (their icons follow the offer, see TraySync) and the Reroll button.
    // PlaceMarkers moves it under the level's board.
    for (let s = 0; s < TRAY_SLOTS; s++) {
      const reroll = s === REROLL_SLOT;
      const slot = cmd.spawn({
        LocalTransform: at(trayX(s, DEFAULT_COLS), trayY(DEFAULT_ROWS)),
        Shape: { kind: 'Rect', size: [trayW(s), TRAY_SLOT_H], radius: 0.06, color: reroll ? COLORS.reroll : COLORS.traySlot, strokeColor: COLORS.trayRim, strokeWidth: 0.06, order: ORDER.tray, sortingLayer: 'Default' },
        VisualOffset: {},
        TraySlot: { slot: s },
      });
      if (reroll) {
        // A tilted die: a face and five pips.
        const die = cmd.spawn({ LocalTransform: { position: [0, 0.16, 0], rotation: DIE.rotation, scale: [1, 1, 1] }, Shape: shapeValue(DIE.face, ORDER.tray + 1), Parent: { entity: slot } });
        for (const [px, py] of DIE.pips) cmd.spawn({ LocalTransform: at(px, py), Shape: shapeValue(DIE.pip, ORDER.tray + 2), Parent: { entity: die } });
      }
      // Price: a coin then the amount, laid out by TraySync.
      cmd.spawn({ LocalTransform: at(0, reroll ? -0.4 : -0.46), Shape: shapeValue(COIN, ORDER.tray + 4), TrayCoin: { slot: s }, Parent: { entity: slot } });
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
  queries: { items: query(read(Item)), blocks: query(read(Block)), enemies: query(read(Enemy)), shots: query(read(Projectile)), tiles: query(read(LocalTransform), withTag(BoardTile)) },
  resources: [write(Board), write(Run), write(Placement), write(Offer), read(Level)],
  events: [RestartRequested],
  runIf: { any: [{ resource: Board, field: 'version', op: '==', value: 0 }, { event: RestartRequested }, { changed: Level }] },
  run(ctx, q) {
    for (const c of q.items.chunks()) for (let i = 0; i < c.length; i++) ctx.commands.despawn(c.entity(i));
    for (const c of q.blocks.chunks()) for (let i = 0; i < c.length; i++) ctx.commands.despawn(c.entity(i));
    for (const c of q.enemies.chunks()) for (let i = 0; i < c.length; i++) ctx.commands.despawn(c.entity(i));
    for (const c of q.shots.chunks()) for (let i = 0; i < c.length; i++) ctx.commands.despawn(c.entity(i));
    // The game opens on the level menu over the scene's level; a restart or a new level plays.
    const boot = ctx.resource(Board).version[0] === 0 && ctx.events.count(RestartRequested) === 0;
    const runId = ctx.resource(Run).runId[0]! + 1;
    ctx.set(Run, {
      phase: boot ? 'menu' : 'playing', runId, time: 0, speed: 1, wave: 0, lives: START_LIVES, gold: START_GOLD, wallsBuilt: 0,
      nextWaveAt: FIRST_WAVE_AT, group: 0, groupSpawned: 0, spawnAt: 1e9, spawning: false, alive: 0, kills: 0, bossSteps: 0,
      placements: 0, refusals: 0, shots: 0, booms: 0, baseHits: 0, bosses: 0, nestTurn: 0, nestsOpen: 0, goldFrac: 0,
    });
    const b = ctx.resource(Board);
    for (let c = 0; c < CELLS; c++) {
      b.cells[c] = 0;
      b.weapons[c] = 0;
    }
    loadLevel(ctx);
    recomputeBoard(ctx);
    // The grid at the level's size (a new level may be another size).
    for (const c of q.tiles.chunks()) for (let i = 0; i < c.length; i++) ctx.commands.despawn(c.entity(i));
    spawnGrid(ctx.commands, b.cols[0]!, b.rows[0]!);
    ctx.set(Placement, { active: false, kind: 'none', cell: -1, fromCell: -1, slot: -1, valid: false, previewLen: 0, returnSteps: 0 });
    ctx.setField(Offer, 'sets', 0);
    ctx.setField(Offer, 'rerolls', 0);
    drawOffer(ctx);
  },
});

/** Moves the nest mounds, the base and the tray onto the level's board; nest slots the level does not use hide. */
export const PlaceMarkers = defineSystem({
  name: 'PlaceMarkers',
  after: ['StartRun'],
  queries: { mounds: query(read(NestMound), write(LocalTransform)), base: query(write(LocalTransform), withTag(Base)), tray: query(read(TraySlot), write(LocalTransform)) },
  resources: [read(Board), read(Level)],
  events: [RestartRequested],
  runIf: { any: [{ query: query(added(NestMound)) }, { event: RestartRequested }, { changed: Level }] },
  run(ctx, q) {
    const b = ctx.resource(Board);
    for (const c of q.mounds.chunks()) {
      const m = c.col(NestMound);
      const pos = c.col(LocalTransform).position;
      for (let i = 0; i < c.length; i++) {
        const n = m.index[i]!;
        const used = n < b.nestCount[0]!;
        if (used) {
          pos[i * 3] = cellX(b.nestCell[n]!);
          pos[i * 3 + 1] = cellY(b.nestCell[n]!);
          teleport(c.entity(i));
        }
        ctx.commands.setField(c.entity(i), Shape, 'visible', used);
      }
    }
    for (const c of q.base.chunks()) {
      const pos = c.col(LocalTransform).position;
      for (let i = 0; i < c.length; i++) {
        pos[i * 3] = cellX(b.baseCell[0]!);
        pos[i * 3 + 1] = cellY(b.baseCell[0]!);
        teleport(c.entity(i));
      }
    }
    for (const c of q.tray.chunks()) {
      const ts = c.col(TraySlot);
      const pos = c.col(LocalTransform).position;
      for (let i = 0; i < c.length; i++) {
        pos[i * 3] = trayX(ts.slot[i]!, b.cols[0]!);
        pos[i * 3 + 1] = trayY(b.rows[0]!);
        teleport(c.entity(i));
      }
    }
  },
});

export const FitView = defineSystem({
  name: 'FitView',
  after: ['StartRun'],
  resources: [read(ViewInfo), write(WorldView), read(Board), read(Level)],
  events: [RestartRequested],
  runIf: { any: [{ changed: ViewInfo }, { resource: Board, field: 'version', op: '==', value: 0 }, { changed: Level }, { event: RestartRequested }, { query: query(added(NestMound)) }] },
  run(ctx) {
    const b = ctx.resource(Board);
    const r = viewRect(b.cols[0]! || DEFAULT_COLS, b.rows[0]! || DEFAULT_ROWS);
    fitWorldView(ctx, r.x, r.y, r.w, r.h, FIT);
  },
});


/** Opens each nest at its wave: shows its hole, hides its wave label, signals the opening. */
export const NestSync = defineSystem({
  name: 'NestSync',
  after: ['Waves', 'StartRun'],
  queries: { holes: query(write(NestSpot)), labels: query(read(NestLabel)) },
  resources: [write(Run), read(Board), read(Level)],
  events: [WaveStarted, RestartRequested],
  runIf: { any: [{ event: WaveStarted }, { event: RestartRequested }, { changed: Level }, { query: query(added(NestSpot)) }] },
  run(ctx, q) {
    const run = ctx.resource(Run);
    const b = ctx.resource(Board);
    const wave = Math.max(1, run.wave[0]!);
    for (const c of q.holes.chunks()) {
      const ns = c.col(NestSpot);
      for (let i = 0; i < c.length; i++) {
        const n = ns.index[i]!;
        const used = n < b.nestCount[0]!;
        const opens = b.nestWave[n]!;
        const open = used && opens <= wave;
        const opened = open && ns.open[i] === 0;
        ns.open[i] = open ? 1 : 0;
        ctx.commands.setField(c.entity(i), Shape, 'visible', open);
        for (const lc of q.labels.chunks()) {
          const nl = lc.col(NestLabel);
          for (let j = 0; j < lc.length; j++) if (nl.index[j] === n) ctx.commands.setField(lc.entity(j), Text2D, 'text', used && !open ? `W${opens}` : '');
        }
        if (opened && opens > 1) {
          run.nestsOpen[0] = run.nestsOpen[0]! + 1;
          ctx.signal(NestOpened, { nest: n, wave });
        }
      }
    }
  },
});
