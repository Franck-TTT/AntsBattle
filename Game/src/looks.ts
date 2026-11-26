/**
 * Placeholder art: every look of the game is a few SDF shapes defined here, so an art direction
 * swap (ants and bugs, or a fantasy horde) touches this file and nothing else.
 * Sorting orders on the Default layer, back to front.
 */
import { SWARM, type ItemKindName, type EnemyKindName } from './balance.ts';

export const ORDER = { ground: 0, tile: 1, path: 2, highlight: 3, base: 4, block: 5, blockDetail: 6, enemy: 7, item: 8, shot: 10, tray: 11, bar: 15, ghost: 16 } as const;

export const COLORS = {
  /** Neon arcade look: near-black space, a blue grid, outlined shapes that glow. */
  space: '#05060f',
  board: '#080a1c',
  frame: '#3f6bff',
  gridMajor: '#2f45d6',
  /** The board's cell lines: gridMajor at 45% (lowered after the 2026-11-26 playtest). */
  gridLine: '#2f45d673',
  gridFar: '#121a5c',
  preview: '#ffd84a',
  valid: '#3dff6e',
  invalid: '#ff2e4d',
  /** No-build cells and nests: a thin cross, the colour of the board's grid lines (gridMajor). */
  noBuild: '#2f45d6',
  nest: '#12051a',
  nestRim: '#ff2ec8',
  nestHole: '#ff2ec8',
  base: '#0b1f4d',
  baseRim: '#4fc3ff',
  traySlot: '#0a0c1e',
  trayRim: '#ffc51f',
  trayDisabled: '#07070d',
  reroll: '#160a2a',
  text: '#ffffff',
  hpBack: '#14051a',
  hpFill: '#3dff6e',
  ring: '#ffffff',
} as const;

export interface ShapeLook {
  kind: 'Rect' | 'Circle' | 'Ring' | 'Polygon';
  size: [number, number];
  radius: number;
  sides?: number;
  thickness?: number;
  color: string;
  strokeColor?: string;
  strokeWidth?: number;
}

/** The coin drawn left of every price in the tray (same gold as the HUD's gold chip). */
export const COIN: ShapeLook = { kind: 'Circle', size: [0.24, 0.24], radius: 0.12, color: '#ffc51f', strokeColor: '#b8860b', strokeWidth: 0.045 };
export const COIN_DIM = { color: '#5a5260', strokeColor: '#3a3440' } as const;

/**
 * The Reroll button's icon: two arrows chasing each other round a circle (clockwise), each an arc
 * of short rounded segments with a triangle tip. Angles in degrees, counter-clockwise from +x.
 */
export const REROLL_ICON = {
  radius: 0.25,
  /** Each arrow's arc, from its tail to its tip; the second is the first turned half a circle. */
  arcs: [[148, 38], [328, 218]] as [number, number][],
  segments: 6,
  segment: { kind: 'Rect', size: [0.08, 0.1], radius: 0.04, color: '#ffffff' } as ShapeLook,
  tip: { kind: 'Polygon', size: [0.27, 0.27], radius: 0.02, sides: 3, color: '#ffffff' } as ShapeLook,
};

/** Body and detail of each item; the detail turns with the barrel, set ITEM_DETAIL_X off the centre. Dark fill, neon rim. */
export const ITEM_DETAIL_X = 0.16;
export const ITEM_LOOKS: Record<Exclude<ItemKindName, 'none'>, { body: ShapeLook; detail: ShapeLook | null }> = {
  wall: {
    body: { kind: 'Rect', size: [0.9, 0.9], radius: 0.04, color: '#0b1030', strokeColor: '#3f6bff', strokeWidth: 0.06 },
    detail: { kind: 'Rect', size: [0.5, 0.06], radius: 0, color: '#3f6bff' },
  },
  tower: {
    body: { kind: 'Polygon', size: [0.62, 0.62], radius: 0.02, sides: 6, color: '#031a20', strokeColor: '#29f2ff', strokeWidth: 0.07 },
    detail: { kind: 'Rect', size: [0.5, 0.1], radius: 0, color: '#bffcff', strokeColor: '#29f2ff', strokeWidth: 0.03 },
  },
  cannon: {
    body: { kind: 'Polygon', size: [0.72, 0.72], radius: 0.02, sides: 8, color: '#1c0d03', strokeColor: '#ff8a1f', strokeWidth: 0.07 },
    detail: { kind: 'Rect', size: [0.58, 0.22], radius: 0, color: '#1c0d03', strokeColor: '#ff8a1f', strokeWidth: 0.05 },
  },
  frost: {
    body: { kind: 'Polygon', size: [0.64, 0.64], radius: 0.02, sides: 4, color: '#031420', strokeColor: '#7fd8ff', strokeWidth: 0.07 },
    detail: { kind: 'Rect', size: [0.46, 0.12], radius: 0.06, color: '#e6f8ff', strokeColor: '#7fd8ff', strokeWidth: 0.03 },
  },
  /** Flat on the ground, under the ants: a dark disc with a red neon rim and a light. */
  mine: {
    body: { kind: 'Circle', size: [0.46, 0.46], radius: 0.23, color: '#1f0408', strokeColor: '#ff2e4d', strokeWidth: 0.06 },
    detail: { kind: 'Circle', size: [0.12, 0.12], radius: 0.06, color: '#ff2e4d' },
  },
  /** Flat on the ground, under the ants: an amber plate with a chevron. */
  boostPad: {
    body: { kind: 'Rect', size: [0.7, 0.7], radius: 0.1, color: '#1f1403', strokeColor: '#ffb020', strokeWidth: 0.06 },
    detail: { kind: 'Polygon', size: [0.34, 0.34], radius: 0.02, sides: 3, color: '#ffb020' },
  },
  mortar: {
    body: { kind: 'Polygon', size: [0.66, 0.66], radius: 0.02, sides: 5, color: '#071f03', strokeColor: '#3dff6e', strokeWidth: 0.07 },
    detail: { kind: 'Rect', size: [0.4, 0.24], radius: 0.08, color: '#071f03', strokeColor: '#3dff6e', strokeWidth: 0.05 },
  },
  flamethrower: {
    body: { kind: 'Polygon', size: [0.62, 0.62], radius: 0.02, sides: 6, color: '#200803', strokeColor: '#ff5a1f', strokeWidth: 0.07 },
    detail: { kind: 'Rect', size: [0.46, 0.16], radius: 0.04, color: '#200803', strokeColor: '#ff5a1f', strokeWidth: 0.04 },
  },
  /** Support: no barrel; a dish ring, centred. */
  radar: {
    body: { kind: 'Circle', size: [0.6, 0.6], radius: 0.3, color: '#031a20', strokeColor: '#29f2ff', strokeWidth: 0.06 },
    detail: { kind: 'Ring', size: [0.34, 0.34], radius: 0.17, thickness: 0.06, color: '#29f2ff' },
  },
  /** Support: a vault with a coin, centred. */
  bank: {
    body: { kind: 'Rect', size: [0.6, 0.6], radius: 0.08, color: '#1f1803', strokeColor: '#ffc51f', strokeWidth: 0.06 },
    detail: { kind: 'Circle', size: [0.26, 0.26], radius: 0.13, color: '#ffc51f', strokeColor: '#b8860b', strokeWidth: 0.04 },
  },
};

/** Enemies are plain outlined shapes, one colour each; the "head" is an inner shape on big kinds. */
export const ENEMY_LOOKS: Record<EnemyKindName, { body: ShapeLook; head: ShapeLook; headX: number }> = {
  ant: {
    body: { kind: 'Rect', size: [0.3, 0.3], radius: 0, color: '#1f0412', strokeColor: '#ff2e88', strokeWidth: 0.055 },
    head: { kind: 'Rect', size: [0.1, 0.1], radius: 0, color: '#ff2e88' },
    headX: 0,
  },
  fast: {
    body: { kind: 'Polygon', size: [0.34, 0.34], radius: 0, sides: 3, color: '#1f1a03', strokeColor: '#ffe02e', strokeWidth: 0.055 },
    head: { kind: 'Circle', size: [0.1, 0.1], radius: 0.05, color: '#ffe02e' },
    headX: 0,
  },
  beetle: {
    body: { kind: 'Polygon', size: [0.56, 0.56], radius: 0, sides: 4, color: '#031f0c', strokeColor: '#3dff6e', strokeWidth: 0.07 },
    head: { kind: 'Polygon', size: [0.24, 0.24], radius: 0, sides: 4, color: '#00000000', strokeColor: '#3dff6e', strokeWidth: 0.05 },
    headX: 0,
  },
  boss: {
    body: { kind: 'Polygon', size: [1.05, 1.05], radius: 0, sides: 8, color: '#1a0424', strokeColor: '#d23cff', strokeWidth: 0.1 },
    head: { kind: 'Polygon', size: [0.5, 0.5], radius: 0, sides: 6, color: '#00000000', strokeColor: '#ffc51f', strokeWidth: 0.07 },
    headX: 0,
  },
};

/**
 * Path colours by nest, in priority order: a segment several flows share takes the first one's.
 * Ice blue, blue, yellow, amber, lavender: one per nest, so MAX_NESTS (src/grid.ts) is their count.
 */
export const FLOW_COLORS = ['#9ae6ff', '#3f8cff', '#ffe02e', '#ff9e3d', '#c58cff'] as const;

/** Enemy body colours by EnemyKind index (restored after a hit flash). Keep in step with ENEMY_LOOKS. */
export const ENEMY_BODY_COLORS = ['#1f0412', '#1f1a03', '#031f0c', '#1a0424'] as const;
/** Body fill of a slowed (frosted) enemy. */
export const FROST_COLOR = '#2a7fb0';
/** Body fill of a hasted enemy (boost pad). */
export const HASTE_COLOR = '#8a5a00';
/** A mortar's puddle, drawn on the ground under the ants, of radius `r` cells. */
export const PUDDLE = { color: '#3dff6e66', alpha: 0.4 } as const;
export const puddleLook = (r: number): ShapeLook => ({ kind: 'Circle', size: [r * 2, r * 2], radius: r, color: PUDDLE.color });

/** Enemies shrink at swarm scale so a column of hundreds still reads as a column. */
export function enemyScale(kind: EnemyKindName): number {
  if (SWARM <= 1 || kind === 'boss') return 1;
  return kind === 'beetle' ? 0.8 : 0.62;
}

/** A w×h block: a dark slab with a neon rim and a faint inner rim, one per footprint. */
export function blockBody(w: number, h: number): ShapeLook {
  return { kind: 'Rect', size: [w - 0.1, h - 0.1], radius: 0.18, color: '#1d3570', strokeColor: '#3f6bff', strokeWidth: 0.06 };
}
export function blockTop(w: number, h: number): ShapeLook {
  return { kind: 'Rect', size: [w - 0.4, h - 0.4], radius: 0.02, color: '#00000000', strokeColor: '#3f6bff66', strokeWidth: 0.03 };
}

/**
 * Flat "city plan" details inside a block, one small layout per footprint cell (rooftops, a
 * helipad, a row of tanks). Dim and unoutlined so they stay under the bloom threshold: no glow.
 */
/** Off for now (art test kept for later): set to true to draw the details again. */
const SHOW_BLOCK_DETAILS = false;
const DETAIL = '#18225a';
const rr = (w: number, h: number, r = 0.035): ShapeLook => ({ kind: 'Rect', size: [w, h], radius: r, color: DETAIL });
const circ = (d: number): ShapeLook => ({ kind: 'Circle', size: [d, d], radius: d / 2, color: DETAIL });
const CELL_DETAILS: { x: number; y: number; look: ShapeLook }[][] = [
  // Tall roof top-left, three stacked tanks right, a long roof at the bottom.
  [
    { x: -0.12, y: 0.1, look: rr(0.18, 0.3) },
    { x: 0.13, y: 0.14, look: rr(0.16, 0.08, 0.04) },
    { x: 0.13, y: 0.03, look: rr(0.16, 0.08, 0.04) },
    { x: 0.13, y: -0.08, look: rr(0.16, 0.08, 0.04) },
    { x: 0.02, y: -0.19, look: rr(0.36, 0.1) },
  ],
  // Helipad: a ring with an H, a low roof under it.
  [
    { x: 0, y: 0.06, look: { kind: 'Ring', size: [0.32, 0.32], radius: 0.16, thickness: 0.035, color: DETAIL } },
    { x: -0.05, y: 0.06, look: rr(0.035, 0.15, 0) },
    { x: 0.05, y: 0.06, look: rr(0.035, 0.15, 0) },
    { x: 0, y: 0.06, look: rr(0.1, 0.035, 0) },
    { x: -0.04, y: -0.19, look: rr(0.3, 0.09) },
  ],
  // Two roofs side by side and a square courtyard.
  [
    { x: -0.11, y: 0.12, look: rr(0.2, 0.2) },
    { x: 0.13, y: 0.12, look: rr(0.14, 0.2) },
    { x: 0, y: -0.14, look: rr(0.44, 0.16) },
  ],
  // Park: a few round trees along a path.
  [
    { x: 0, y: -0.02, look: rr(0.46, 0.05, 0.025) },
    { x: -0.14, y: 0.13, look: circ(0.14) },
    { x: 0.06, y: 0.15, look: circ(0.1) },
    { x: 0.17, y: 0.1, look: circ(0.08) },
    { x: -0.06, y: -0.16, look: circ(0.12) },
    { x: 0.14, y: -0.17, look: circ(0.1) },
  ],
  // Car park: two rows of bays.
  [
    ...[-0.15, -0.05, 0.05, 0.15].map((x) => ({ x, y: 0.12, look: rr(0.06, 0.16, 0.02) })),
    ...[-0.15, -0.05, 0.05, 0.15].map((x) => ({ x, y: -0.12, look: rr(0.06, 0.16, 0.02) })),
  ],
  // Roundabout: a ring with an island and two roads leaving it.
  [
    { x: 0, y: 0, look: { kind: 'Ring', size: [0.3, 0.3], radius: 0.15, thickness: 0.05, color: DETAIL } },
    { x: 0, y: 0, look: circ(0.08) },
    { x: 0, y: 0.2, look: rr(0.05, 0.1, 0) },
    { x: 0.2, y: 0, look: rr(0.1, 0.05, 0) },
  ],
  // L-shaped block with a small annex.
  [
    { x: -0.12, y: 0.02, look: rr(0.16, 0.42) },
    { x: 0.06, y: -0.14, look: rr(0.22, 0.14) },
    { x: 0.12, y: 0.13, look: rr(0.12, 0.12) },
  ],
  // Solar roof: a grid of panels.
  [
    ...[-0.13, 0, 0.13].flatMap((x) => [0.09, -0.09].map((y) => ({ x, y, look: rr(0.1, 0.14, 0.015) }))),
  ],
  // Stadium: a pill-shaped pitch with stands on two sides.
  [
    { x: 0, y: 0, look: rr(0.3, 0.2, 0.1) },
    { x: 0, y: 0.18, look: rr(0.3, 0.05, 0.02) },
    { x: 0, y: -0.18, look: rr(0.3, 0.05, 0.02) },
  ],
  // Cross-shaped roof with a dish.
  [
    { x: -0.04, y: 0.02, look: rr(0.32, 0.1, 0.02) },
    { x: -0.04, y: 0.02, look: rr(0.1, 0.36, 0.02) },
    { x: 0.16, y: -0.16, look: circ(0.1) },
  ],
];

/** Layouts above are drawn for a ±0.25 cell; this stretches them to fill the block's cell. */
const DETAIL_SCALE = 1.4;
const scaled = (l: ShapeLook): ShapeLook => ({
  ...l,
  size: [l.size[0] * DETAIL_SCALE, l.size[1] * DETAIL_SCALE],
  radius: l.radius * DETAIL_SCALE,
  thickness: l.thickness === undefined ? undefined : l.thickness * DETAIL_SCALE,
});

/** Detail shapes of a w×h block whose top-left cell is `cell`, as offsets from the block's centre. */
export function blockDetails(w: number, h: number, cell: number): { x: number; y: number; look: ShapeLook }[] {
  const out: { x: number; y: number; look: ShapeLook }[] = [];
  if (!SHOW_BLOCK_DETAILS) return out;
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      // A fixed pattern per cell, picked from the cell index so a block keeps its look.
      const pick = ((cell + i + j * 7) * 2654435761) >>> 0;
      // High bits: the low bits of a multiplicative hash just follow the cell's parity.
      const layout = CELL_DETAILS[(pick >>> 16) % CELL_DETAILS.length];
      const flip = (pick >>> 8) & 1 ? -1 : 1;
      const cx = i - (w - 1) / 2;
      const cy = (h - 1) / 2 - j;
      for (const d of layout) out.push({ x: cx + d.x * flip * DETAIL_SCALE, y: cy + d.y * DETAIL_SCALE, look: scaled(d.look) });
    }
  }
  return out;
}

/**
 * Pre-placed (locked) items read as bolted steel: a steel rim and corner rivets on blocks, a steel
 * mounting ring under weapons. The player's own items keep the blue neon.
 */
export const LOCKED = { rim: '#c3cdf0', fill: '#10142a', rivet: 0.12 } as const;
export function lockedBlockBody(w: number, h: number): ShapeLook {
  return { kind: 'Rect', size: [w - 0.1, h - 0.1], radius: 0.18, color: LOCKED.fill, strokeColor: LOCKED.rim, strokeWidth: 0.07 };
}
export const LOCKED_RIVET: ShapeLook = { kind: 'Rect', size: [LOCKED.rivet, LOCKED.rivet], radius: 0.02, color: LOCKED.rim };
/** Rivet offsets from a w×h block's centre, one per corner. */
export function rivetOffsets(w: number, h: number): [number, number][] {
  const x = w / 2 - 0.22;
  const y = h / 2 - 0.22;
  return [[-x, y], [x, y], [-x, -y], [x, -y]];
}
export const LOCKED_RING: ShapeLook = { kind: 'Ring', size: [0.86, 0.86], radius: 0.43, thickness: 0.05, color: LOCKED.rim };

/**
 * Projectiles: a white-hot streak (tower), a glowing shell (cannon), an ice shard (frost), a green shell (mortar); a mine's blast is never seen.
 * 1.5× their first size since the 2026-11-26 playtest (they read too small).
 */
export const SHOT_LOOKS = {
  tower: { kind: 'Rect', size: [0.51, 0.135], radius: 0.0675, color: '#f2ffff', strokeColor: '#29f2ff', strokeWidth: 0.05 },
  cannon: { kind: 'Circle', size: [0.45, 0.45], radius: 0.225, color: '#ffe0b0', strokeColor: '#ff7a1a', strokeWidth: 0.1 },
  frost: { kind: 'Polygon', size: [0.33, 0.33], radius: 0.03, sides: 4, color: '#e6f8ff', strokeColor: '#7fd8ff', strokeWidth: 0.06 },
  mine: { kind: 'Circle', size: [0.1, 0.1], radius: 0.05, color: '#ff2e4d' },
  mortar: { kind: 'Circle', size: [0.36, 0.36], radius: 0.18, color: '#d8ffe0', strokeColor: '#3dff6e', strokeWidth: 0.09 },
} as const satisfies Record<string, ShapeLook>;

/** Base flash and enemy flash colours. */
export const FLASH = { hit: '#ffffff', base: '#ff2e4d' } as const;

export function shapeValue(l: ShapeLook, order: number, visible = true) {
  return {
    kind: l.kind,
    size: l.size,
    radius: l.radius,
    sides: l.sides ?? 6,
    thickness: l.thickness ?? 0.1,
    color: l.color,
    strokeColor: l.strokeColor ?? '#00000000',
    strokeWidth: l.strokeWidth ?? 0,
    order,
    sortingLayer: 'Default',
    visible,
  };
}
