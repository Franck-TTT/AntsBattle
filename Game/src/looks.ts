/**
 * Placeholder art: every look of the game is a few SDF shapes defined here, so an art direction
 * swap (ants and bugs, or a fantasy horde) touches this file and nothing else.
 * Sorting orders on the Default layer, back to front.
 */
import { SWARM, type ItemKindName, type EnemyKindName } from './balance.ts';

export const ORDER = { ground: 0, tile: 1, path: 2, highlight: 3, base: 4, block: 5, enemy: 6, item: 7, shot: 10, tray: 11, bar: 15, ghost: 16 } as const;

export const COLORS = {
  grass: '#4d7a36',
  dirt: '#8d6a43',
  dirtDark: '#80603b',
  frame: '#5c4127',
  path: '#f6e7b8',
  preview: '#ffd84a',
  valid: '#7dffa1',
  invalid: '#ff4d4d',
  nest: '#4a2e17',
  nestHole: '#1c120a',
  base: '#3aa0ff',
  baseRim: '#e8f4ff',
  traySlot: '#2b2033',
  trayRim: '#ffc51f',
  trayDisabled: '#4a4450',
  reroll: '#3b2a55',
  text: '#ffffff',
  hpBack: '#2a1a14',
  hpFill: '#7dff6a',
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

/** Body and detail of each item; the detail turns with the barrel. */
export const ITEM_LOOKS: Record<Exclude<ItemKindName, 'none'>, { body: ShapeLook; detail: ShapeLook | null }> = {
  wall: {
    body: { kind: 'Rect', size: [0.9, 0.9], radius: 0.16, color: '#a7afb8', strokeColor: '#5f6772', strokeWidth: 0.07 },
    detail: { kind: 'Rect', size: [0.5, 0.12], radius: 0.06, color: '#c9d0d8' },
  },
  tower: {
    body: { kind: 'Circle', size: [0.66, 0.66], radius: 0.33, color: '#2f7cf6', strokeColor: '#d8e8ff', strokeWidth: 0.07 },
    detail: { kind: 'Rect', size: [0.56, 0.16], radius: 0.08, color: '#d8e8ff' },
  },
  cannon: {
    body: { kind: 'Polygon', size: [0.72, 0.72], radius: 0.05, sides: 8, color: '#30343f', strokeColor: '#ff9a2e', strokeWidth: 0.07 },
    detail: { kind: 'Rect', size: [0.6, 0.28], radius: 0.14, color: '#ff9a2e' },
  },
};

export const ENEMY_LOOKS: Record<EnemyKindName, { body: ShapeLook; head: ShapeLook; headX: number }> = {
  ant: {
    body: { kind: 'Rect', size: [0.4, 0.22], radius: 0.11, color: '#231510' },
    head: { kind: 'Circle', size: [0.16, 0.16], radius: 0.08, color: '#5a2b1c' },
    headX: 0.22,
  },
  fast: {
    body: { kind: 'Rect', size: [0.34, 0.16], radius: 0.08, color: '#e2482a' },
    head: { kind: 'Circle', size: [0.13, 0.13], radius: 0.065, color: '#ffb199' },
    headX: 0.18,
  },
  beetle: {
    body: { kind: 'Circle', size: [0.56, 0.5], radius: 0.25, color: '#2f9b5a', strokeColor: '#123d24', strokeWidth: 0.06 },
    head: { kind: 'Circle', size: [0.2, 0.2], radius: 0.1, color: '#123d24' },
    headX: 0.28,
  },
  boss: {
    body: { kind: 'Circle', size: [1.05, 0.95], radius: 0.5, color: '#b0122a', strokeColor: '#ffc51f', strokeWidth: 0.09 },
    head: { kind: 'Circle', size: [0.38, 0.38], radius: 0.19, color: '#ffc51f' },
    headX: 0.5,
  },
};

/**
 * Path colours by nest, in priority order: a segment several flows share takes the first one's.
 * Nest 1 (centre) white/grey, nest 2 blue, nest 3 yellow; a 4th nest would need a 4th colour.
 */
export const FLOW_COLORS = ['#f6e7b8', '#5ab4ff', '#ffd84a'] as const;

/** Enemy body colours by EnemyKind index (restored after a hit flash). Keep in step with ENEMY_LOOKS. */
export const ENEMY_BODY_COLORS = ['#231510', '#e2482a', '#2f9b5a', '#b0122a'] as const;

/** Enemies shrink at swarm scale so a column of hundreds still reads as a column. */
export function enemyScale(kind: EnemyKindName): number {
  if (SWARM <= 1 || kind === 'boss') return 1;
  return kind === 'beetle' ? 0.8 : 0.62;
}

/** A w×h block: a stone slab and a lighter top, one per footprint. */
export function blockBody(w: number, h: number): ShapeLook {
  return { kind: 'Rect', size: [w - 0.1, h - 0.1], radius: 0.16, color: '#a7afb8', strokeColor: '#5f6772', strokeWidth: 0.07 };
}
export function blockTop(w: number, h: number): ShapeLook {
  return { kind: 'Rect', size: [w - 0.4, h - 0.4], radius: 0.1, color: '#b8bfc7' };
}

/** Base flash and enemy flash colours. */
export const FLASH = { hit: '#ffffff', base: '#ff3b3b' } as const;

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
