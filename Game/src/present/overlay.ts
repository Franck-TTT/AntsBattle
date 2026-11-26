/**
 * Immediate-mode overlay drawn each frame from sim state: the ants' path, the path preview while
 * dragging, the hovered cell, the item under the finger, range rings, move grace rings, HP bars.
 * Presentation only (LateUpdate): it writes pooled visuals, never sim state.
 */
import { defineSystem, query, read, visualPool, withTag, write, LocalTransform, PointerState, RenderTime, Shape, Sprite, VisualOffset, parseColor, type Chunk, type VisualPoolFrame } from '@gameengine/runtime';
import { Big, Block, Board, Enemy, Item, Placement, Run } from '../schema.gen.ts';
import { cellX, cellY, CELLS, DEFAULT_COLS, DEFAULT_ROWS, boardRect, footprintCell, tracePath } from '../grid.ts';

// Scratch for tracing a path: fully written by tracePath before it is read.
const pathScratch = new Uint8Array(CELLS);
// Segments already drawn this frame (key: smaller cell × CELLS + larger cell), cleared before use.
const claimed = new Uint8Array(CELLS * CELLS);
import { GHOST_LIFT, ITEMS, SHAPES, moveGraceOf, type BlockShapeName, type ItemKindName } from '../balance.ts';
import { ITEM_NAMES, SHAPE_NAMES } from '../kinds.ts';
import { COLORS, FLOW_COLORS, ITEM_DETAIL_X, ITEM_LOOKS, ORDER, blockBody, blockTop, type ShapeLook } from '../looks.ts';

export const shapes = visualPool({ name: 'shapes', prefab: 'assets/prefabs/shape.prefab.json', size: 640, draws: Shape });
export const rings = visualPool({ name: 'rings', prefab: 'assets/prefabs/ring.prefab.json', size: 40, draws: Sprite });
export const shapesPool = shapes.system;
export const ringsPool = rings.system;

const KINDS = ['Rect', 'Circle', 'Line', 'Ring', 'Polygon'] as const;
const linear = (hex: string, alpha = 1): [number, number, number, number] => {
  const c = parseColor(hex);
  return [c[0], c[1], c[2], c[3] * alpha];
};

// Colours resolved once (plain constants, presentation only).
const C = {
  // Lowered after the 2026-11-26 playtest (were 0.6, 0.2 and 1): the paths sit behind the action.
  flow: FLOW_COLORS.map((c) => linear(c, 0.35)),
  flowDim: FLOW_COLORS.map((c) => linear(c, 0.12)),
  flowPreview: FLOW_COLORS.map((c) => linear(c, 0.6)),
  valid: linear(COLORS.valid, 0.35),
  validRim: linear(COLORS.valid, 0.95),
  invalid: linear(COLORS.invalid, 0.4),
  invalidRim: linear(COLORS.invalid, 1),
  shadow: linear('#000000', 0.28),
  range: linear('#ffffff', 0.5),
  rangeFill: linear('#ffffff', 0.07),
  hpBack: linear(COLORS.hpBack, 0.85),
  hpFill: linear(COLORS.hpFill, 1),
  hpLow: linear('#ff5a3c', 1),
  none: [0, 0, 0, 0] as [number, number, number, number],
};

interface Draw {
  kind: (typeof KINDS)[number];
  w: number;
  h: number;
  radius: number;
  color: readonly number[];
  stroke?: readonly number[];
  strokeWidth?: number;
  thickness?: number;
  sides?: number;
  order: number;
  rot?: number;
}

function put(f: VisualPoolFrame, x: number, y: number, d: Draw, scale = 1): boolean {
  if (!f.show(x, y, 0, scale)) return false;
  const c = f.chunk as Chunk;
  const i = f.row;
  const s = c.col(Shape);
  s.kind[i] = KINDS.indexOf(d.kind);
  s.size[i * 2] = d.w;
  s.size[i * 2 + 1] = d.h;
  s.radius[i] = d.radius;
  s.thickness[i] = d.thickness ?? 0.1;
  s.sides[i] = d.sides ?? 6;
  s.strokeWidth[i] = d.strokeWidth ?? 0;
  s.order[i] = d.order;
  for (let k = 0; k < 4; k++) {
    s.color[i * 4 + k] = d.color[k]!;
    s.strokeColor[i * 4 + k] = d.stroke ? d.stroke[k]! : 0;
  }
  const r = c.col(VisualOffset).rotation;
  const a = (d.rot ?? 0) / 2;
  r[i * 4] = 0;
  r[i * 4 + 1] = 0;
  r[i * 4 + 2] = Math.sin(a);
  r[i * 4 + 3] = Math.cos(a);
  return true;
}

function lookDraw(l: ShapeLook, order: number, alpha: number, rot = 0, tint?: readonly number[]): Draw {
  const col = linear(l.color, alpha);
  if (tint) for (let k = 0; k < 3; k++) col[k] = col[k]! * 0.55 + tint[k]! * 0.45;
  return {
    kind: l.kind, w: l.size[0], h: l.size[1], radius: l.radius, sides: l.sides, thickness: l.thickness,
    color: col, stroke: l.strokeColor ? linear(l.strokeColor, alpha) : undefined, strokeWidth: l.strokeWidth, order, rot,
  };
}

/** What the finger carries: a block of its shape, or a weapon. */
function ghostLooks(kind: Exclude<ItemKindName, 'none'>, shape: BlockShapeName): [ShapeLook, ShapeLook | null] {
  if (kind !== 'wall') return [ITEM_LOOKS[kind].body, ITEM_LOOKS[kind].detail];
  const [w, h] = SHAPES[shape];
  return [blockBody(w, h), blockTop(w, h)];
}

/**
 * Dots along a path of cells, `per` dots per segment, marching towards the base with `phase`
 * (0..1). A segment already in `claimed` (drawn by a higher-priority flow) is skipped; the ones
 * drawn here are claimed.
 */
function drawPath(f: VisualPoolFrame, cells: ArrayLike<number>, len: number, per: number, phase: number, color: readonly number[], size: number, order: number, claimed: Uint8Array): void {
  const dot: Draw = { kind: 'Circle', w: size, h: size, radius: size / 2, color, order };
  for (let k = 0; k + 1 < len; k++) {
    const a = cells[k]!;
    const b = cells[k + 1]!;
    const key = a < b ? a * CELLS + b : b * CELLS + a;
    if (claimed[key]) continue;
    claimed[key] = 1;
    const ax = cellX(a), ay = cellY(a), bx = cellX(b), by = cellY(b);
    for (let j = 0; j < per; j++) {
      const t = (j + phase) / per;
      if (!put(f, ax + (bx - ax) * t, ay + (by - ay) * t, dot)) return;
    }
  }
}

export const Overlay = defineSystem({
  name: 'Overlay',
  stage: 'LateUpdate',
  queries: { pool: shapes.query(), rings: rings.query(), enemies: query(read(Enemy), read(LocalTransform), withTag(Big)), items: query(read(Item), read(LocalTransform)), blocks: query(read(Block), read(LocalTransform)) },
  resources: [read(Board), read(Placement), read(Run), read(PointerState), read(RenderTime)],
  run(ctx, q) {
    const s = ctx.local(() => ({
      t: 0,
      back: { kind: 'Rect', w: 0, h: 0.12, radius: 0.06, color: C.hpBack, order: ORDER.bar } as Draw,
      fill: { kind: 'Rect', w: 0, h: 0.07, radius: 0.035, color: C.hpFill, order: ORDER.bar + 1 } as Draw,
    }));
    s.t += ctx.resource(RenderTime).realDelta[0]!;
    const board = ctx.resource(Board);
    const p = ctx.resource(Placement);
    const run = ctx.resource(Run);
    const f = shapes.begin(q.pool);
    const dragging = p.active[0] === 1;
    const playing = run.phase[0] === 0;

    // The ants' paths, one colour per nest. Where flows share a segment it takes the colour of
    // the highest-priority nest (the level's nest order: white, then blue, then yellow). While a drop is
    // hovered the current paths fade and the preview shows the new ones in the same colours,
    // with bigger, brighter dots.
    if (playing) {
      const wave = Math.max(1, run.wave[0]!);
      const showPreview = dragging && p.valid[0] === 1 && p.previewLen[0]! > 0;
      claimed.fill(0);
      const nests = board.nestCount[0]!;
      for (let n = 0; n < nests; n++) {
        if (board.nestWave[n]! > wave) continue;
        const len = tracePath(board.dist, board.nestCell[n]!, pathScratch);
        drawPath(f, pathScratch, len, 2, (run.time[0]! * 1.2) % 1, showPreview ? C.flowDim[n % C.flowDim.length]! : C.flow[n % C.flow.length]!, 0.13, ORDER.path, claimed);
      }
      if (showPreview) {
        claimed.fill(0);
        for (let n = 0; n < nests; n++) {
          if (board.nestWave[n]! > wave) continue;
          const len = tracePath(p.previewDist, board.nestCell[n]!, pathScratch);
          drawPath(f, pathScratch, len, 3, (s.t * 2.5) % 1, C.flowPreview[n % C.flowPreview.length]!, 0.19, ORDER.path + 1, claimed);
        }
      }
    }

    // HP bars on wounded enemies (two reused draw records: no allocation per bar).
    const hpBack = s.back;
    const hpFill = s.fill;
    for (const c of q.enemies.chunks()) {
      const en = c.col(Enemy);
      const pos = c.col(LocalTransform).position;
      for (let i = 0; i < c.length; i++) {
        const hp = en.hp[i]!;
        const max = en.maxHp[i]!;
        if (hp >= max || hp <= 0 || en.remaining[i]! < 0) continue;
        const w = en.kind[i] === 3 ? 1.1 : en.kind[i] === 2 ? 0.6 : 0.42;
        const x = pos[i * 3]!;
        const y = pos[i * 3 + 1]! + (en.kind[i] === 3 ? 0.72 : 0.36);
        const k = hp / max;
        hpBack.w = w + 0.06;
        put(f, x, y, hpBack);
        hpFill.w = w * k;
        hpFill.color = k < 0.35 ? C.hpLow : C.hpFill;
        put(f, x - (w * (1 - k)) / 2, y, hpFill);
      }
    }

    // The item under the finger.
    if (dragging) {
      const kind = ITEM_NAMES[p.kind[0]!]!;
      if (kind !== 'none') {
        const ps = ctx.resource(PointerState);
        // This frame's touch: no lag behind the finger.
        const gx = ps.world[0]!;
        const gy = ps.world[1]! + GHOST_LIFT;
        const cell = p.cell[0]!;
        const valid = p.valid[0] === 1;
        const shape = SHAPE_NAMES[p.shape[0]!]!;
        const [w, h] = kind === 'wall' ? SHAPES[shape] : [1, 1];
        if (cell >= 0) {
          // The cells it would take, green or red.
          for (let k = 0; k < w * h; k++) {
            const c = footprintCell(cell, w, k);
            put(f, cellX(c), cellY(c), { kind: 'Rect', w: 0.96, h: 0.96, radius: 0.14, color: valid ? C.valid : C.invalid, stroke: valid ? C.validRim : C.invalidRim, strokeWidth: 0.07, order: ORDER.highlight });
          }
          const range = kind === 'wall' ? 0 : ITEMS[kind].range;
          if (range > 0 && valid) put(f, cellX(cell), cellY(cell), { kind: 'Circle', w: range * 2, h: range * 2, radius: range, color: C.rangeFill, stroke: C.range, strokeWidth: 0.04, order: ORDER.highlight + 1 });
        }
        const [body, detail] = ghostLooks(kind, shape);
        const bob = 1.08 + Math.sin(s.t * 9) * 0.02;
        put(f, gx + 0.08, gy - 0.16, { kind: 'Rect', w: w * 0.9, h: h * 0.75, radius: 0.3, color: C.shadow, order: ORDER.ghost - 1 });
        const tint = cell >= 0 && !valid ? C.invalidRim : undefined;
        put(f, gx, gy, lookDraw(body, ORDER.ghost, 0.95, 0, tint), bob);
        if (detail) put(f, gx + (kind === 'wall' ? 0 : ITEM_DETAIL_X * bob), gy, lookDraw(detail, ORDER.ghost + 1, 0.95, 0, tint), bob);
      }
    } else if (p.returnSteps[0]! > 0) {
      // Refused: fly back to the tray (or the cell it came from) with a shake.
      const kind = ITEM_NAMES[p.retKind[0]!]!;
      if (kind !== 'none') {
        const t = 1 - p.returnSteps[0]! / 16;
        const e = 1 - (1 - t) * (1 - t) * (1 - t);
        const shake = Math.sin(t * Math.PI * 6) * 0.14 * (1 - t);
        const x = p.retFromX[0]! + (p.retToX[0]! - p.retFromX[0]!) * e + shake;
        const y = p.retFromY[0]! + (p.retToY[0]! - p.retFromY[0]!) * e;
        const [body, detail] = ghostLooks(kind, SHAPE_NAMES[p.retShape[0]!]!);
        const sc = (1.1 - 0.3 * e) * (kind === 'wall' ? 1 - 0.4 * e : 1);
        put(f, x, y, lookDraw(body, ORDER.ghost, 1 - 0.4 * e, 0, C.invalidRim), sc);
        if (detail) put(f, x + (kind === 'wall' ? 0 : ITEM_DETAIL_X * sc), y, lookDraw(detail, ORDER.ghost + 1, 1 - 0.4 * e, 0, C.invalidRim), sc);
      }
    }
    f.end();

    // Move grace rings: an arc on each block and weapon still movable, emptying as its window runs
    // out. Skipped outright once every building is locked (Run.graced 0); a held one shows none.
    const rf = rings.begin(q.rings);
    const graceWindow = moveGraceOf(p.moveGrace[0]!);
    if (run.graced[0]! > 0 && graceWindow > 0) {
      for (const c of q.items.chunks()) {
        const it = c.col(Item);
        const pos = c.col(LocalTransform).position;
        for (let i = 0; i < c.length; i++) {
          const g = it.grace[i]!;
          if (g <= 0 || it.held[i]) continue;
          if (!rf.show(pos[i * 3]!, pos[i * 3 + 1]!, 0, 1)) break;
          (rf.chunk as Chunk).col(Sprite).fillAmount[rf.row] = Math.min(1, g / graceWindow);
        }
      }
      for (const c of q.blocks.chunks()) {
        const b = c.col(Block);
        const pos = c.col(LocalTransform).position;
        for (let i = 0; i < c.length; i++) {
          const g = b.grace[i]!;
          // A 1×1 block carrying a weapon: the weapon's ring already sits on that spot.
          if (g <= 0 || b.held[i] || (b.shape[i] === 0 && board.weapons[b.cell[i]!]! > 0)) continue;
          if (!rf.show(pos[i * 3]!, pos[i * 3 + 1]!, 0, 1)) break;
          (rf.chunk as Chunk).col(Sprite).fillAmount[rf.row] = Math.min(1, g / graceWindow);
        }
      }
    }
    rf.end();
  },
});

// The default board's extents, for tests and tools (a level's own: boardRect(Board.cols, Board.rows)).
export const BOARD_RECT = boardRect(DEFAULT_COLS, DEFAULT_ROWS);
