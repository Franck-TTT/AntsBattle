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
import { TWEAKS } from './balance.tweaks.ts';

export type { BlockShapeName, EnemyKindName, ItemKindName };

/** The sheet's General parameters, with the editor's live tweaks on top (src/balance.tweaks.ts). */
const G = { ...SHEET.general, ...TWEAKS };

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
 * Blocks that cost nothing; then each extra block costs WALL_STEP more than the previous one,
 * whatever its size (a 2×2 costs the same as a 1×1).
 */
export const FREE_WALLS = G.freeWalls;
export const WALL_STEP = G.wallStep;
/** Game seconds a moved item waits before it can be moved again. */
export const MOVE_COOLDOWN = 5;
/** Game speed while a finger holds an item. */
export const DRAG_SPEED = G.dragSpeed;
/** Speed regained per real second after the finger lifts (back to 1 in ~0.2 s). */
export const SPEED_RECOVERY = G.speedRecovery;
/**
 * Upgrades roll animation (presentation): a random tile lights up, then the next, the gap between two
 * growing from SPIN_FIRST_GAP to SPIN_LAST_GAP frames (60 fps frames, timed in seconds), ×SPIN_GROWTH
 * each time; it lands on the upgrade won and holds SPIN_HOLD seconds before the reveal.
 */
export const SPIN_FIRST_GAP = G.spinFirstGap;
export const SPIN_LAST_GAP = G.spinLastGap;
export const SPIN_GROWTH = G.spinGrowth;
export const SPIN_HOLD = G.spinHold;
/**
 * Chromatic aberration on the screen edges (post effect `chromaticEdges`, presentation only):
 * red/blue split in pixels at 1080p, from CA_INNER to full at CA_OUTER (0 centre, 1 corner).
 */
export const CA_STRENGTH = G.caStrength;
export const CA_INNER = G.caInner;
export const CA_OUTER = G.caOuter;
/** Ghost height above the finger, in cells, so the thumb never hides it. */
export const GHOST_LIFT = 1.1;

export interface ItemDef {
  kind: ItemKindName;
  /** Display name (the sheet's Name row). */
  name: string;
  /** One line on what it does (the sheet's Description row), shown in the weapon info popup. */
  description: string;
  /** Gold price; walls use the wall curve instead. */
  price: number;
  /** Drawn into offers; false: only levels pre-place it (the boost pad). */
  lootable: boolean;
  /** First wave it can be offered on (before wave 1 counts as wave 1). */
  minWave: number;
  /** Last wave it can be offered on; 0: no limit. */
  maxWave: number;
  /** Cells. */
  range: number;
  /** Game seconds between shots. */
  period: number;
  damage: number;
  /** Area radius in cells around the impact; 0: the target alone. */
  splash: number;
  /** Share of the damage lost at the edge of the area (linear with distance): 0 none, 1 all. */
  falloff: number;
  /** Projectile speed, cells per second. */
  shotSpeed: number;
  /** Push given to the ants hit, cells per second (decays fast; they walk back to their path). */
  knockback: number;
  /** Radius of the impact's shockwave, cells: ants inside are pushed away, weaker at the edge. */
  shockRadius: number;
  /** Share of their speed the enemies hit lose (frost): 0 none, 1 frozen. */
  slow: number;
  /** Game seconds the slow lasts. */
  slowTime: number;
  /** Share of their speed the enemies on it gain (boost pad): 1 twice as fast. */
  haste: number;
  /** Game seconds the haste lasts after they leave the pad. */
  hasteTime: number;
  /** Damage per second of the puddle the shell leaves (mortar), to each enemy inside; 0 none. */
  puddle: number;
  /** Puddle radius, cells. */
  puddleSize: number;
  /** Game seconds the puddle lasts. */
  puddleTime: number;
  /** Damage per second an ant takes while it burns, after the flame touched it (flamethrower). */
  burn: number;
  /** Game seconds it burns. */
  burnTime: number;
  /** Width of the flame cone, degrees; 0: not a cone weapon. */
  cone: number;
  /** Range added to the weapons within its Attack Range (radar), cells. */
  auraRange: number;
  /** Share of the cooldown removed from the weapons within its Attack Range (radar). */
  auraRate: number;
  /** Gold paid at the start of every wave (bank). */
  waveGold: number;
}

export const ITEMS: Record<Exclude<ItemKindName, 'none'>, ItemDef> = {
  wall: { kind: 'wall', name: 'Block', description: 'Blocks the ants: they walk around it', price: 0, lootable: true, minWave: 0, maxWave: 0, range: 0, period: 0, damage: 0, splash: 0, falloff: 0, shotSpeed: 0, knockback: 0, shockRadius: 0, slow: 0, slowTime: 0, haste: 0, hasteTime: 0, puddle: 0, puddleSize: 0, puddleTime: 0, burn: 0, burnTime: 0, cone: 0, auraRange: 0, auraRate: 0, waveGold: 0 },
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

/**
 * Everything the offer can draw: each set holds exactly one block (weights pick which) and weapons.
 * Weapons the sheet marks not Lootable never come up, whatever their Offers row says.
 */
export const OFFER_POOL: readonly OfferDef[] = SHEET.offers.filter((o) => ITEMS[o.kind].lootable);

/** Whether an offer row can come up on `wave` (blocks always can; a weapon within its Min Wave / Max Wave). */
export function offeredAt(kind: Exclude<ItemKindName, 'none'>, wave: number): boolean {
  return inWaveWindow(ITEMS[kind].minWave, ITEMS[kind].maxWave, wave);
}

/** Min Wave / Max Wave rule: before wave 1 counts as wave 1; a Max Wave of 0 means no limit. */
export function inWaveWindow(minWave: number, maxWave: number, wave: number): boolean {
  const w = Math.max(1, wave);
  return minWave <= w && (maxWave === 0 || w <= maxWave);
}

/** Weapons laid on a free ground cell, where the ants walk, instead of on a block. */
export const ON_GROUND: ReadonlySet<ItemKindName> = new Set<ItemKindName>(['mine', 'boostPad']);
/** Items on offer at once. */
export const OFFER_SIZE = G.offerSize;
/**
 * Test variant: buying one item of the offer draws a new set for free (the two others go). The
 * paid Reroll stays. The offer.singlePick cheat overrides it (Offer.singlePick).
 */
export const SINGLE_PICK = G.singlePick > 0;
/** Reroll price: base, then this much more for each reroll already bought in the run. */
export const REROLL_BASE = G.rerollBase;
export const REROLL_STEP = G.rerollStep;
/** Price of the next reroll; free while `freeLeft` (the Free reroll upgrade) is above 0. */
export const rerollPrice = (rerolls: number, freeLeft: number = 0): number => (freeLeft > 0 ? 0 : REROLL_BASE + REROLL_STEP * rerolls);

export interface EnemyDef {
  hp: number;
  /** Cells per game second. */
  speed: number;
  reward: number;
  /** Lives lost when it reaches the base (before swarm scaling). */
  damage: number;
  /** Comes in swarms: N times as many at swarm scale N, each N times weaker. */
  swarms: boolean;
  /** Share of every push it takes: 1 full knockback, 0 immune (heavy units keep walking). */
  knockback: number;
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

/** Price of the next block after `wallsBuilt` blocks; `extraFree` more blocks are free (the Free block upgrade). */
export function wallPrice(wallsBuilt: number, extraFree: number = 0): number {
  const free = FREE_WALLS + extraFree;
  return wallsBuilt < free ? 0 : (wallsBuilt - free + 1) * WALL_STEP;
}

export function shapeCells(shape: BlockShapeName): number {
  const [w, h] = SHAPES[shape];
  return w * h;
}

export function itemPrice(kind: ItemKindName, wallsBuilt: number, shape: BlockShapeName = 'b1x1', extraFree: number = 0): number {
  if (kind === 'none') return 0;
  if (kind !== 'wall') return ITEMS[kind].price;
  void shape;
  return wallPrice(wallsBuilt, extraFree);
}
