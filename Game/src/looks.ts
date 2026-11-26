/**
 * Placeholder art: every look of the game is a few SDF shapes defined here, so an art direction
 * swap (ants and bugs, or a fantasy horde) touches this file and nothing else.
 * Sorting orders on the Default layer, back to front.
 */
import { SWARM, type ItemKindName, type EnemyKindName } from './balance.ts';

export const ORDER = { ground: 0, tile: 1, trail: 2, path: 3, highlight: 4, base: 5, block: 6, enemy: 7, item: 8, shot: 11, tray: 12, bar: 17, ghost: 18 } as const;

/** Infection trails (src/present/infection.ts): lots glow green where the horde walks, then fade. */
export const INFECTION = { color: '#5cff8a', alpha: 0.2, size: 0.9, fadeSec: 6, gainPerAnt: 0.5 } as const;

/** The base's lot is a safe zone: translucent cyan with a bright rim, as in a tactical map. */
export const SAFE_ZONE = { size: 0.94, fill: '#5ee8ff26', rim: '#5ee8ffb3', rimWidth: 0.035 } as const;

export const COLORS = {
  /** Tactical sim map: dark asphalt, beige extruded blocks, neon-green horde, saturated player pieces. */
  space: '#15171b',
  board: '#1b1d22',
  /** An empty lot on the board: where blocks go, between the streets. */
  lot: '#272a31',
  frame: '#5ee8ffb3',
  corner: '#ffc93c',
  gridMajor: '#2c3038',
  gridFar: '#1b1d22',
  preview: '#ffc93c',
  valid: '#3fd6ff',
  invalid: '#ff3b5c',
  nest: '#121417',
  nestRim: '#5cff8a',
  nestHole: '#5cff8a',
  base: '#14564f',
  baseRim: '#5ee8ff',
  traySlot: '#1a1d24',
  trayRim: '#4a505c',
  trayDisabled: '#121418',
  reroll: '#1a1d24',
  text: '#ffffff',
  hpBack: '#1a1d24',
  hpFill: '#5cff8a',
  ring: '#ffffff',
} as const;

/** The unlit city around the board: grey roofs and south faces, darker farther out. */
export const CITY = {
  near: { top: '#43464c', side: '#2c2e33' },
  far: { top: '#34363b', side: '#25272b' },
  /** Parks: flat lawn, darker tree crowns. */
  park: { lawn: '#263826', tree: '#31502f' },
  /** The river: bands from the banks (lighter, shallow) to the deep middle, as on a bathymetric map. */
  water: ['#2a5f8f', '#235380', '#1d4670'],
  bridge: '#3a3d43',
} as const;

/** Cast shadows, down-right (light from the top-left), longer for taller buildings. */
export const SHADOW = { color: '#0000008c', base: 0.04, perLift: 0.6 } as const;

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

/** Body and detail of each item; the detail turns with the barrel. Flat saturated fill, thin darker rim. */
export const ITEM_LOOKS: Record<Exclude<ItemKindName, 'none'>, { body: ShapeLook; detail: ShapeLook | null }> = {
  wall: {
    body: { kind: 'Rect', size: [0.9, 0.9], radius: 0.02, color: '#6f6655' },
    detail: { kind: 'Rect', size: [0.9, 0.76], radius: 0.02, color: '#b5a88c' },
  },
  tower: {
    body: { kind: 'Polygon', size: [0.6, 0.6], radius: 0.02, sides: 6, color: '#e0338f', strokeColor: '#7a1650', strokeWidth: 0.05 },
    detail: { kind: 'Rect', size: [0.46, 0.08], radius: 0, color: '#ffe3f2' },
  },
  cannon: {
    body: { kind: 'Polygon', size: [0.7, 0.7], radius: 0.02, sides: 8, color: '#8b3fd9', strokeColor: '#3f1a6b', strokeWidth: 0.05 },
    detail: { kind: 'Rect', size: [0.54, 0.2], radius: 0, color: '#3f1a6b' },
  },
  frost: {
    body: { kind: 'Polygon', size: [0.62, 0.62], radius: 0.02, sides: 4, color: '#3fc8ff', strokeColor: '#0f4f7a', strokeWidth: 0.05 },
    detail: { kind: 'Rect', size: [0.44, 0.12], radius: 0.06, color: '#e6f8ff' },
  },
  /** Flat on the ground, under the ants: a dark disc with an amber rim and a red light. */
  mine: {
    body: { kind: 'Circle', size: [0.46, 0.46], radius: 0.23, color: '#2b2f38', strokeColor: '#ff8a1f', strokeWidth: 0.06 },
    detail: { kind: 'Circle', size: [0.12, 0.12], radius: 0.06, color: '#ff3b5c' },
  },
  /** Flat on the ground, under the ants: an amber plate with a chevron pointing up. */
  boostPad: {
    body: { kind: 'Rect', size: [0.7, 0.7], radius: 0.12, color: '#3a2a10', strokeColor: '#ffb020', strokeWidth: 0.06 },
    detail: { kind: 'Polygon', size: [0.34, 0.34], radius: 0.02, sides: 3, color: '#ffb020' },
  },
  mortar: {
    body: { kind: 'Polygon', size: [0.66, 0.66], radius: 0.02, sides: 5, color: '#4caf3f', strokeColor: '#1d4a17', strokeWidth: 0.05 },
    detail: { kind: 'Rect', size: [0.4, 0.24], radius: 0.08, color: '#1d4a17' },
  },
  flamethrower: {
    body: { kind: 'Polygon', size: [0.62, 0.62], radius: 0.02, sides: 6, color: '#ff5a1f', strokeColor: '#7a2008', strokeWidth: 0.05 },
    detail: { kind: 'Rect', size: [0.44, 0.16], radius: 0.04, color: '#3a1206' },
  },
  /** Support: no barrel; a dish on a mast. */
  radar: {
    body: { kind: 'Circle', size: [0.6, 0.6], radius: 0.3, color: '#2a3550', strokeColor: '#5ee8ff', strokeWidth: 0.05 },
    detail: { kind: 'Ring', size: [0.34, 0.34], radius: 0.17, thickness: 0.06, color: '#5ee8ff' },
  },
  /** Support: a vault with a coin. */
  bank: {
    body: { kind: 'Rect', size: [0.6, 0.6], radius: 0.08, color: '#6b5310', strokeColor: '#ffc51f', strokeWidth: 0.05 },
    detail: { kind: 'Circle', size: [0.26, 0.26], radius: 0.13, color: '#ffc51f', strokeColor: '#b8860b', strokeWidth: 0.04 },
  },
};

/** Enemies are glowing dots, so the horde reads as a flow; big kinds keep an inner shape. */
export const ENEMY_LOOKS: Record<EnemyKindName, { body: ShapeLook; head: ShapeLook; headX: number }> = {
  ant: {
    body: { kind: 'Circle', size: [0.2, 0.2], radius: 0.1, color: '#5cff8a' },
    head: { kind: 'Circle', size: [0.08, 0.08], radius: 0.04, color: '#e8fff0' },
    headX: 0,
  },
  fast: {
    body: { kind: 'Circle', size: [0.17, 0.17], radius: 0.085, color: '#c6ff4a' },
    head: { kind: 'Circle', size: [0.07, 0.07], radius: 0.035, color: '#ffffff' },
    headX: 0,
  },
  beetle: {
    body: { kind: 'Circle', size: [0.44, 0.44], radius: 0.22, color: '#1fbf5a', strokeColor: '#5cff8a', strokeWidth: 0.06 },
    head: { kind: 'Circle', size: [0.16, 0.16], radius: 0.08, color: '#e8fff0' },
    headX: 0,
  },
  boss: {
    body: { kind: 'Circle', size: [0.95, 0.95], radius: 0.475, color: '#0e5c2c', strokeColor: '#5cff8a', strokeWidth: 0.1 },
    head: { kind: 'Circle', size: [0.4, 0.4], radius: 0.2, color: '#5cff8a' },
    headX: 0,
  },
};

/**
 * Path colours by nest, in priority order: a segment several flows share takes the first one's.
 * Ice blue, blue, yellow, amber, lavender: one per nest, so MAX_NESTS (src/grid.ts) is their count.
 */
export const FLOW_COLORS = ['#ffffff', '#5ee8ff', '#ffc93c', '#ff9e3d', '#c58cff'] as const;

/** Enemy body colours by EnemyKind index (restored after a hit flash). Keep in step with ENEMY_LOOKS. */
export const ENEMY_BODY_COLORS = ['#5cff8a', '#c6ff4a', '#1fbf5a', '#0e5c2c'] as const;
/** Body colour of a slowed (frosted) enemy. */
export const FROST_COLOR = '#8fe3ff';
/** Body colour of a hasted enemy (boost pad). */
export const HASTE_COLOR = '#ffb020';
/** A mortar's puddle, drawn on the ground under the ants, of radius `r` cells. */
export const PUDDLE = { color: '#9dff3c66', alpha: 0.4 } as const;
export const puddleLook = (r: number): ShapeLook => ({ kind: 'Circle', size: [r * 2, r * 2], radius: r, color: PUDDLE.color });

/** Enemies shrink at swarm scale so a column of hundreds still reads as a column. */
export function enemyScale(kind: EnemyKindName): number {
  if (SWARM <= 1 || kind === 'boss') return 1;
  return kind === 'beetle' ? 0.8 : 0.62;
}

/** A fixed hash of two integers to [0, 1): building layouts are the same every run. */
export function hash01(a: number, b: number, salt: number): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(salt, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** One building: its footprint centre and size, and how far its roof is lifted above its south face. */
export interface Building { x: number; y: number; w: number; h: number; lift: number }

/**
 * The buildings on one 1×1 lot centred on (0, 0): one, two or four, picked by the seed (sx, sy).
 * `street`: the gap kept along the lot's left, right, top and bottom edges; `alley`: the gap between buildings of the lot;
 * `empty`: the chance a building is left out; roof lifts run from lift[0] to lift[1].
 */
export function lotBuildings(sx: number, sy: number, street: readonly [number, number, number, number], alley: number, empty: number, lift: readonly [number, number]): Building[] {
  const split = hash01(sx, sy, 1);
  const parts: [number, number, number, number][] = split < 0.3 ? [[0, 0, 1, 1]]
    : split < 0.55 ? [[0, 0, 0.5, 1], [0.5, 0, 0.5, 1]]
    : split < 0.8 ? [[0, 0, 1, 0.5], [0, 0.5, 1, 0.5]]
    : [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]];
  const out: Building[] = [];
  for (const [px, py, pw, ph] of parts) {
    const hx = sx * 2 + px * 2;
    const hy = sy * 2 + py * 2;
    if (empty > 0 && hash01(hx, hy, 2) < empty) continue;
    const left = px === 0 ? street[0] : alley / 2;
    const right = px + pw === 1 ? street[1] : alley / 2;
    const top = py === 0 ? street[2] : alley / 2;
    const bottom = py + ph === 1 ? street[3] : alley / 2;
    const w = pw - left - right;
    const h = ph - top - bottom;
    out.push({ x: px + left + w / 2 - 0.5, y: 0.5 - (py + top + h / 2), w, h, lift: Math.min(h / 3, lift[0] + hash01(hx, hy, 3) * (lift[1] - lift[0])) });
  }
  return out;
}

/**
 * Building tones: the lit beige of the player's blocks, the grey of locked ones (old ruins, like the
 * dead city). `edge`: the sunlit north rim of a roof.
 */
export const BLOCK_TONES = {
  player: { top: '#b5a88c', side: '#6f6655', edge: '#efe4c8', pad: '#3b3e46' },
  locked: { top: '#5a5d63', side: '#383a3f', edge: '#767a81', pad: '#31343a' },
} as const;
export type BuildingTone = { top: string; side: string; edge?: string };

/** One shape of a building: 0 cast shadow, 1 south face, 2 roof, 3 roof rim; offsets from the building's lot. */
export interface BuildingLayer { look: ShapeLook; x: number; y: number; layer: 0 | 1 | 2 | 3 }

/** The shapes that draw building `b` in `tone`, back to front. */
export function buildingLayers(b: Building, tone: BuildingTone, shadow = true): BuildingLayer[] {
  const out: BuildingLayer[] = [];
  if (shadow) {
    const d = SHADOW.base + b.lift * SHADOW.perLift;
    out.push({ look: { kind: 'Rect', size: [b.w, b.h], radius: 0.02, color: SHADOW.color }, x: b.x + d, y: b.y - d, layer: 0 });
  }
  out.push({ look: buildingSide(b, tone.side), x: b.x, y: b.y, layer: 1 });
  out.push({ look: buildingRoof(b, tone.top), x: b.x, y: b.y + b.lift, layer: 2 });
  if (tone.edge) {
    const rim = 0.03;
    out.push({ look: { kind: 'Rect', size: [b.w, rim], radius: 0.01, color: tone.edge }, x: b.x, y: b.y + b.h / 2 - rim / 2, layer: 3 });
  }
  return out;
}

/**
 * A w×h block is a city block: a pavement pad and, on each of its cells, one to four buildings of
 * varied heights, seeded by `seed` (the block's cell, so a block keeps its look). Offsets are from
 * the block's centre.
 */
export function blockBuildings(seed: number, w: number, h: number): Building[] {
  const out: Building[] = [];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const ox = i - (w - 1) / 2;
      const oy = (h - 1) / 2 - j;
      // Streets only along the block's outside; inside it, cells meet at an alley.
      const edge = (outer: boolean) => (outer ? 0.08 : 0.035);
      const streets = [edge(i === 0), edge(i === w - 1), edge(j === 0), edge(j === h - 1)] as const;
      for (const b of lotBuildings(1000 + seed + i, 3000 + seed + j * 17, streets, 0.07, 0, [0.06, 0.16])) {
        out.push({ ...b, x: b.x + ox, y: b.y + oy });
      }
    }
  }
  return out;
}
export function blockPad(w: number, h: number, locked = false): ShapeLook {
  return { kind: 'Rect', size: [w - 0.04, h - 0.04], radius: 0.03, color: locked ? BLOCK_TONES.locked.pad : BLOCK_TONES.player.pad };
}
/** A building's south face (drawn at its centre) and roof (drawn `lift` higher). */
export function buildingSide(b: Building, color: string): ShapeLook {
  return { kind: 'Rect', size: [b.w, b.h], radius: 0.015, color };
}
export function buildingRoof(b: Building, color: string): ShapeLook {
  return { kind: 'Rect', size: [b.w, b.h - b.lift * 2], radius: 0.015, color };
}

/** Pre-placed (locked) weapons stand on a steel mounting ring. */
export const LOCKED = { rim: '#8e939c' } as const;
export const LOCKED_RING: ShapeLook = { kind: 'Ring', size: [0.86, 0.86], radius: 0.43, thickness: 0.05, color: LOCKED.rim };

/** Projectiles: a thin white tracer (tower), an orange shell (cannon), an ice shard (frost); a mine's blast is never seen. */
export const SHOT_LOOKS = {
  tower: { kind: 'Rect', size: [0.4, 0.05], radius: 0.025, color: '#ffffff' },
  cannon: { kind: 'Circle', size: [0.24, 0.24], radius: 0.12, color: '#ffc93c', strokeColor: '#ff8a1f', strokeWidth: 0.05 },
  frost: { kind: 'Polygon', size: [0.2, 0.2], radius: 0.02, sides: 4, color: '#bff0ff', strokeColor: '#3fc8ff', strokeWidth: 0.04 },
  mine: { kind: 'Circle', size: [0.1, 0.1], radius: 0.05, color: '#ff8a1f' },
  mortar: { kind: 'Circle', size: [0.22, 0.22], radius: 0.11, color: '#b6ff3c', strokeColor: '#4caf3f', strokeWidth: 0.05 },
} as const satisfies Record<string, ShapeLook>;

/** Base flash and enemy flash colours. */
export const FLASH = { hit: '#ffffff', base: '#ff3b5c' } as const;

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
