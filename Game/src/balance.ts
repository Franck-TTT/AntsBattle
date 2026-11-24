/**
 * Every tunable number of a run. The balancing values come from the Google Sheet through
 * src/balance.sheet.ts: change them in the sheet, then run `gameengine tool sheet-sync`.
 * Adding a weapon: add its name to ITEM_KINDS in schema/game.schema.ts (then `gameengine gen`),
 * a column in the sheet's Weapons tab (and its name in _Enums), its look in src/looks.ts and an
 * Offers row. Adding a block shape: add it to BLOCK_SHAPES in the schema, its size in SHAPES and
 * the sheet's BlockShape enum.
 */
import type { BlockShapeName, EnemyKindName, ItemKindName } from './kinds.ts';
import { SHEET, type WeaponKindName } from './balance.sheet.ts';

export type { BlockShapeName, EnemyKindName, ItemKindName };

const G = SHEET.general;

/**
 * Swarm scale: swarming kinds come N times as many, each with HP and gold ÷N; lives and the
 * boss's damage are ×N, so a run plays the same at any N. 1 is the v0.2 tuning.
 */
export const SWARM = G.swarm;
/** Most enemies alive at once that the systems size their scratch buffers for. */
export const MAX_ENEMIES = 4096;

export const START_GOLD = G.startGold;
export const START_LIVES = G.startLives * SWARM;
/**
 * Block cells that cost nothing; then each extra cell costs WALL_STEP more than the previous one
 * (a block's price is the sum over its cells).
 */
export const FREE_WALLS = G.freeWalls;
export const WALL_STEP = G.wallStep;
/** Game seconds a moved item waits before it can be moved again. */
export const MOVE_COOLDOWN = 5;
/** Game speed while a finger holds an item. */
export const DRAG_SPEED = G.dragSpeed;
/** Speed regained per real second after the finger lifts (back to 1 in ~0.2 s). */
export const SPEED_RECOVERY = G.speedRecovery;
/** Ghost height above the finger, in cells, so the thumb never hides it. */
export const GHOST_LIFT = 1.1;

export interface ItemDef {
  kind: ItemKindName;
  /** Gold price; walls use the wall curve instead. */
  price: number;
  /** Cells. */
  range: number;
  /** Game seconds between shots. */
  period: number;
  damage: number;
  /** Area radius in cells around the impact; every weapon hits an area. */
  splash: number;
  /** Projectile speed, cells per second. */
  shotSpeed: number;
}

export const ITEMS: Record<Exclude<ItemKindName, 'none'>, ItemDef> = {
  wall: { kind: 'wall', price: 0, range: 0, period: 0, damage: 0, splash: 0, shotSpeed: 0 },
  ...(Object.fromEntries(
    Object.entries(SHEET.weapons).map(([kind, stats]) => [kind, { kind: kind as WeaponKindName, ...stats }]),
  ) as Record<WeaponKindName, ItemDef>),
};

/** Block footprints: width and height in cells. */
export const SHAPES: Record<BlockShapeName, readonly [number, number]> = {
  b1x1: [1, 1],
  b2x2: [2, 2],
  b2x1: [2, 1],
  b1x2: [1, 2],
  b3x1: [3, 1],
  b1x3: [1, 3],
};

export interface OfferDef {
  kind: Exclude<ItemKindName, 'none'>;
  shape: BlockShapeName;
  /** Relative chance to be drawn into an offer. */
  weight: number;
}

/** Everything the offer can draw: each set holds exactly one block (weights pick which) and weapons. */
export const OFFER_POOL: readonly OfferDef[] = SHEET.offers;
/** Items on offer at once. */
export const OFFER_SIZE = G.offerSize;
/** Reroll price: base, then this much more for each reroll already bought in the run. */
export const REROLL_BASE = G.rerollBase;
export const REROLL_STEP = G.rerollStep;
export const rerollPrice = (rerolls: number): number => REROLL_BASE + REROLL_STEP * rerolls;

export interface EnemyDef {
  hp: number;
  /** Cells per game second. */
  speed: number;
  reward: number;
  /** Lives lost when it reaches the base (before swarm scaling). */
  damage: number;
  /** Comes in swarms: N times as many at swarm scale N, each N times weaker. */
  swarms: boolean;
}

export const ENEMIES: Record<EnemyKindName, EnemyDef> = SHEET.units;

/** Enemy hit points grow by this share per wave after the first. */
export const HP_PER_WAVE = G.hpPerWave;
/** Every enemy's speed is multiplied by this (0.7: 30% slower than the v0.4 tuning). */
export const ENEMY_SPEED = G.enemySpeed;

export const FIRST_WAVE_AT = G.firstWaveAt;
/** Game seconds from one wave's start to the next one's: 10 waves in about 5 minutes. */
export const WAVE_GAP = G.waveGap;

export interface SpawnGroup {
  kind: EnemyKindName;
  count: number;
  /** Game seconds between two spawns of the group. */
  every: number;
}

/** Spawn groups of each wave, in the order they come (the sheet's Waves tab). */
export const WAVES: readonly (readonly SpawnGroup[])[] = SHEET.waves;

export const WAVE_COUNT = WAVES.length;

/** Swarm factor of a kind: how many come per listed one, and how much weaker each is. */
export const swarmOf = (kind: EnemyKindName): number => (ENEMIES[kind].swarms ? SWARM : 1);

/** Price of the next block cell after `wallsBuilt` cells. */
export function wallPrice(wallsBuilt: number): number {
  return wallsBuilt < FREE_WALLS ? 0 : (wallsBuilt - FREE_WALLS + 1) * WALL_STEP;
}

export function shapeCells(shape: BlockShapeName): number {
  const [w, h] = SHAPES[shape];
  return w * h;
}

export function itemPrice(kind: ItemKindName, wallsBuilt: number, shape: BlockShapeName = 'b1x1'): number {
  if (kind === 'none') return 0;
  if (kind !== 'wall') return ITEMS[kind].price;
  let price = 0;
  for (let k = 0; k < shapeCells(shape); k++) price += wallPrice(wallsBuilt + k);
  return price;
}
