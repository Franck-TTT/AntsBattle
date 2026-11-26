/**
 * The board: built once, reset on every run (its grid redrawn at the level's size), fitted to the screen. Sim code.
 */
import { added, defineSystem, fitWorldView, math, uiScale, query, read, teleport, withTag, write, LocalTransform, Shape, Text2D, ViewInfo, WorldView, type Commands, type EntityId, type SystemContext } from '@gameengine/runtime';
import { Base, BaseLabel, Block, Board, Boost, ItemKind, Panel, BoardTile, Level, TraySlot, NestLabel, NestMound, NestOpened, NestSpot, Offer, WaveStarted, Run, Placement, Item, Enemy, Projectile, Puddle, RestartRequested } from '../schema.gen.ts';
import { CELLS, DEFAULT_BASE, DEFAULT_COLS, DEFAULT_NESTS, DEFAULT_ROWS, MAX_NESTS, REROLL_SLOT, PANEL_RESERVE_REF, TRAY_SLOTS, TRAY_SLOT_H, boardRect, cellX, cellY, flowField, isMarker, type Markers, panelLayout, tracePath, trayW, trayX, viewRect, type PanelLayout } from '../grid.ts';
import { FIRST_WAVE_AT, OFFER_SIZE } from '../balance.ts';
import { progress } from '../meta.ts';
import { applyBoost, runGold, runLives } from './progress.ts';
import { COIN, COLORS, ORDER, REROLL_ICON, shapeValue } from '../looks.ts';
import { drawOffer } from './offer.ts';
import { loadLevel } from './level.ts';

/** Screen margins the board stays clear of, in UI reference px: the bottom one is the panel (tray and HUD, grid.ts PANEL_RESERVE_REF). */
/** Top: 36 margin + the 120 settings gear (.hud-gear in ui/game.style.css) + 16 gap. */
export const FIT = { reserve: { top: 172, bottom: PANEL_RESERVE_REF, left: 16, right: 16 }, uiReference: [1080, 1920] } as const;
/** Scratch panel placement: fully written by panelLayout before every read. */
const panel: PanelLayout = { x: 0, trayY: 0, hudY: 0, scale: 1 };

// Scratch buffers: fully written before every read, no state carried between runs.
const blocked = new Uint8Array(CELLS);
const queue = new Int16Array(CELLS);

/** Two circular arrows on the Reroll button (see REROLL_ICON). */
function spawnRerollIcon(cmd: Commands, slot: EntityId): void {
  const { radius: r, arcs, segments: n, segment, tip } = REROLL_ICON;
  const icon = cmd.spawn({ LocalTransform: { position: [0, 0.16, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] }, Parent: { entity: slot } });
  const deg = math.PI / 180;
  const rot = (a: number): [number, number, number, number] => [0, 0, math.sin(a / 2), math.cos(a / 2)];
  for (const [from, to] of arcs) {
    const step = ((to - from) / n) * deg;
    const length = r * math.abs(step) * 1.25;
    for (let i = 0; i <= n - 1; i++) {
      const a = from * deg + step * (i + 0.5);
      cmd.spawn({
        LocalTransform: { position: [r * math.cos(a), r * math.sin(a), 0], rotation: rot(a + math.PI / 2), scale: [1, 1, 1] },
        Shape: { ...shapeValue(segment, ORDER.tray + 1), size: [length, segment.size[1]] },
        Parent: { entity: icon },
      });
    }
    // The tip sits on the circle just past the arc's end and points along it (clockwise).
    const a = (to - 12) * deg;
    cmd.spawn({ LocalTransform: { position: [r * math.cos(a), r * math.sin(a), 0], rotation: rot(a - math.PI), scale: [1, 1, 1] }, Shape: shapeValue(tip, ORDER.tray + 2), Parent: { entity: icon } });
  }
}

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
 * The board's grid for a `cols` × `rows` board: one line per cell edge, a neon frame, a faint
 * half-cell grid over the space outside the board only, and a cross on each no-build cell and nest.
 * Every piece is a BoardTile, so a new level can redraw them.
 */
function spawnGrid(cmd: Commands, cols: number, rows: number, noBuild: ArrayLike<number>, nests: Markers): void {
  const line = (x: number, y: number, w: number, h: number, color: string = COLORS.gridMajor, order: number = ORDER.tile) =>
    cmd.spawn({ LocalTransform: at(x, y), Shape: { kind: 'Rect', size: [w, h], radius: 0, color, order, sortingLayer: 'Default' }, BoardTile: {} });
  const r = boardRect(cols, rows);
  const hw = cols / 2;
  const hh = rows / 2;
  const FAR = 14;
  // Far grid, outside the board only: lines crossing the board are cut into the parts above and below it.
  const far = (x: number, y: number, w: number, h: number) => line(x, y, w, h, COLORS.gridFar, ORDER.ground);
  for (let k = -FAR * 2; k <= FAR * 2; k++) {
    const d = k / 2;
    if (d < -hw || d > hw) far(r.x + d, r.y, 0.025, FAR * 2);
    else {
      far(r.x + d, r.y + (hh + FAR) / 2, 0.025, FAR - hh);
      far(r.x + d, r.y - (hh + FAR) / 2, 0.025, FAR - hh);
    }
    if (d < -hh || d > hh) far(r.x, r.y + d, FAR * 2, 0.025);
    else {
      far(r.x - (hw + FAR) / 2, r.y + d, FAR - hw, 0.025);
      far(r.x + (hw + FAR) / 2, r.y + d, FAR - hw, 0.025);
    }
  }
  cmd.spawn({ LocalTransform: at(r.x, r.y), Shape: { kind: 'Rect', size: [cols, rows], radius: 0, color: COLORS.board, order: ORDER.ground, sortingLayer: 'Default' }, BoardTile: {} });
  // No-build cells and nests: a thin cross from corner to corner, under the paths and the mounds.
  const diag = (a: number): [number, number, number, number] => [0, 0, math.sin(a / 2), math.cos(a / 2)];
  for (let c = 0; c < CELLS; c++) {
    if (!noBuild[c] && !(isMarker(nests, c) && c !== nests.baseCell[0])) continue;
    for (const a of [math.PI / 4, -math.PI / 4]) {
      cmd.spawn({ LocalTransform: { position: [cellX(c), cellY(c), 0], rotation: diag(a), scale: [1, 1, 1] }, Shape: { kind: 'Rect', size: [1.4142135623730951, 0.015], radius: 0.0075, color: COLORS.noBuild, order: ORDER.tile, sortingLayer: 'Default' }, BoardTile: {} });
    }
  }
  for (let k = 1; k < cols; k++) line(r.x - hw + k, r.y, 0.04, rows);
  for (let k = 1; k < rows; k++) line(r.x, r.y - hh + k, cols, 0.04);
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
    // Lives left, on the base itself (BaseLives writes the number).
    cmd.spawn({ LocalTransform: at(0, -0.03), Text2D: { text: '', size: 0.42, color: COLORS.baseRim, align: 'Center', outlineColor: '#000000', outlineWidth: 0.12, order: ORDER.base + 2, sortingLayer: 'Default' }, BaseLabel: { shown: -1 }, Parent: { entity: base } });
    // Tray: three offer slots (their icons follow the offer, see TraySync) and the Reroll button.
    // FitView pins it to the bottom of the screen.
    for (let s = 0; s < TRAY_SLOTS; s++) {
      const reroll = s === REROLL_SLOT;
      const slot = cmd.spawn({
        LocalTransform: at(0, 0),
        Shape: { kind: 'Rect', size: [trayW(s), TRAY_SLOT_H], radius: 0.06, color: reroll ? COLORS.reroll : COLORS.traySlot, strokeColor: COLORS.trayRim, strokeWidth: 0.06, order: ORDER.tray, sortingLayer: 'Default' },
        VisualOffset: {},
        TraySlot: { slot: s },
      });
      if (reroll) {
        spawnRerollIcon(cmd, slot);
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
  queries: { items: query(read(Item)), blocks: query(read(Block)), enemies: query(read(Enemy)), shots: query(read(Projectile)), puddles: query(read(Puddle)), tiles: query(read(LocalTransform), withTag(BoardTile)) },
  resources: [write(Board), write(Run), write(Placement), write(Offer), write(Boost), read(Level)],
  events: [RestartRequested],
  runIf: { any: [{ resource: Board, field: 'version', op: '==', value: 0 }, { event: RestartRequested }, { changed: Level }] },
  run(ctx, q) {
    for (const c of q.items.chunks()) for (let i = 0; i < c.length; i++) ctx.commands.despawn(c.entity(i));
    for (const c of q.blocks.chunks()) for (let i = 0; i < c.length; i++) ctx.commands.despawn(c.entity(i));
    for (const c of q.enemies.chunks()) for (let i = 0; i < c.length; i++) ctx.commands.despawn(c.entity(i));
    for (const c of q.shots.chunks()) for (let i = 0; i < c.length; i++) ctx.commands.despawn(c.entity(i));
    for (const c of q.puddles.chunks()) for (let i = 0; i < c.length; i++) ctx.commands.despawn(c.entity(i));
    // The game opens on the level menu over the scene's level; a restart or a new level plays.
    const boot = ctx.resource(Board).version[0] === 0 && ctx.events.count(RestartRequested) === 0;
    const runId = ctx.resource(Run).runId[0]! + 1;
    // The meta upgrades this run plays with (src/meta.ts, src/sim/progress.ts).
    const meta = progress.get();
    applyBoost(ctx, meta);
    ctx.set(Run, {
      phase: boot ? 'menu' : 'playing', runId, time: 0, speed: 1, wave: 0, lives: runLives(meta), gold: runGold(meta), wallsBuilt: 0,
      nextWaveAt: FIRST_WAVE_AT, group: 0, groupSpawned: 0, spawnAt: 1e9, spawning: false, alive: 0, kills: 0, bossSteps: 0,
      placements: 0, refusals: 0, shots: 0, booms: 0, baseHits: 0, bosses: 0, nestTurn: 0, nestsOpen: 0, goldFrac: 0,
      paid: false, stars: 0, newStars: 0, coinsWon: 0,
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
    spawnGrid(ctx.commands, b.cols[0]!, b.rows[0]!, b.noBuild, b);
    ctx.set(Placement, { active: false, kind: 'none', cell: -1, fromCell: -1, slot: -1, valid: false, previewLen: 0, returnSteps: 0 });
    ctx.setField(Offer, 'sets', 0);
    ctx.setField(Offer, 'rerolls', 0);
    ctx.setField(Offer, 'freeRerolls', 0);
    drawOffer(ctx);
    // Free first tower (upgrade): the first set holds a tower in its first weapon slot.
    if (ctx.resource(Boost).freeTower[0]) {
      const o = ctx.resource(Offer);
      for (let s = 0; s < OFFER_SIZE; s++) {
        if (o.kinds[s] === ItemKind.wall) continue;
        o.kinds[s] = ItemKind.tower;
        break;
      }
    }
  },
});

/** Moves the nest mounds and the base onto the level's board; nest slots the level does not use hide. */
export const PlaceMarkers = defineSystem({
  name: 'PlaceMarkers',
  after: ['StartRun'],
  queries: { mounds: query(read(NestMound), write(LocalTransform)), base: query(write(LocalTransform), withTag(Base)) },
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
  },
});

/**
 * Fits the level's board into the screen above the bottom panel, then pins the panel (tray and
 * HUD) to the bottom of the safe area at the same on-screen size whatever the board's size.
 */
export const FitView = defineSystem({
  name: 'FitView',
  after: ['StartRun'],
  queries: { tray: query(read(TraySlot), write(LocalTransform)) },
  resources: [read(ViewInfo), write(WorldView), write(Panel), read(Board), read(Level)],
  events: [RestartRequested],
  runIf: { any: [{ changed: ViewInfo }, { resource: Board, field: 'version', op: '==', value: 0 }, { changed: Level }, { event: RestartRequested }, { query: query(added(NestMound)) }, { query: query(added(TraySlot)) }] },
  run(ctx, q) {
    const b = ctx.resource(Board);
    const r = viewRect(b.cols[0]! || DEFAULT_COLS, b.rows[0]! || DEFAULT_ROWS);
    fitWorldView(ctx, r.x, r.y, r.w, r.h, FIT);
    const v = ctx.resource(ViewInfo);
    const wv = ctx.resource(WorldView);
    const w = v.width[0]!;
    const h = v.height[0]!;
    panelLayout(wv.center[0]!, wv.center[1]!, wv.orthoSize[0]!, h, v.safeArea[0]!, v.safeArea[2]!, v.safeArea[3]!, uiScale(w, h, FIT), panel);
    ctx.set(Panel, panel);
    for (const c of q.tray.chunks()) {
      const ts = c.col(TraySlot);
      const t = c.col(LocalTransform);
      for (let i = 0; i < c.length; i++) {
        t.position[i * 3] = trayX(ts.slot[i]!, panel);
        t.position[i * 3 + 1] = panel.trayY;
        t.scale[i * 3] = panel.scale;
        t.scale[i * 3 + 1] = panel.scale;
        teleport(c.entity(i));
      }
    }
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

/** Writes the lives left on the base when they change (a hit, a restart, a new board). */
export const BaseLives = defineSystem({
  name: 'BaseLives',
  after: ['Combat'],
  queries: { labels: query(write(BaseLabel)) },
  resources: [read(Run)],
  run(ctx, q) {
    const lives = ctx.resource(Run).lives[0]!;
    for (const c of q.labels.chunks()) {
      const bl = c.col(BaseLabel);
      for (let i = 0; i < c.length; i++) {
        if (bl.shown[i] === lives) continue;
        bl.shown[i] = lives;
        ctx.commands.setField(c.entity(i), Text2D, 'text', `${lives}`);
      }
    }
  },
});
