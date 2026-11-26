/**
 * The meta layer between runs (design: Ant Battle Meta UI, 25/11): coins earned by every run,
 * stars won on each level, and upgrades bought with the Roll (coins) or the Luxury roll (charged
 * by stars). One persisted document, changed only by the pure actions below. Every number comes
 * from the balancing sheet (tabs Meta, Rarities, Upgrades).
 */
import { defineMeta, refuse } from '@gameengine/meta';
import { metaInWorld } from '@gameengine/meta/world';
import { SHEET } from './balance.sheet.ts';
import type { RarityName, UpgradeKindName } from './kinds.ts';

export const META = SHEET.meta;
export const RARITIES = SHEET.rarities;
export const RARITY_ORDER: readonly RarityName[] = ['common', 'rare', 'epic', 'legendary'];

export interface UpgradeDef {
  kind: UpgradeKindName;
  name: string;
  rarity: RarityName;
  /** Effect of one level, in `unit`. */
  perLevel: number;
  unit: string;
  /** What the effect changes, shown on the Upgrades screen. */
  stat: string;
}

/** Every upgrade, in the sheet's order (the Upgrades screen shows them so). */
export const UPGRADES: readonly UpgradeDef[] = SHEET.upgrades;
const BY_KIND = Object.fromEntries(UPGRADES.map((u) => [u.kind, u])) as Record<UpgradeKindName, UpgradeDef>;
export const upgradeDef = (kind: UpgradeKindName): UpgradeDef => BY_KIND[kind];
export const maxLevel = (kind: UpgradeKindName): number => RARITIES[BY_KIND[kind].rarity].maxLevel;

export interface MetaState {
  coins: number;
  /** Best stars won per level id (LevelDef.id), 1 to 3; absent: never won. */
  stars: Record<string, number>;
  /** Sum of `stars`: first-time stars charge the Luxury roll and are never spent. */
  starTotal: number;
  /** Luxury rolls used so far. */
  luxuryUsed: number;
  /** Coin Rolls bought so far (each one costs more). */
  rolls: number;
  /** Level of each owned upgrade. */
  upgrades: Partial<Record<UpgradeKindName, number>>;
}

const INITIAL: MetaState = { coins: 0, stars: {}, starTotal: 0, luxuryUsed: 0, rolls: 0, upgrades: {} };

export const levelOf = (s: MetaState, kind: UpgradeKindName): number => s.upgrades[kind] ?? 0;
/** Total effect of an upgrade at its current level, in its unit (0 when not owned). */
export const effectOf = (s: MetaState, kind: UpgradeKindName): number => levelOf(s, kind) * BY_KIND[kind].perLevel;
export const rollCost = (s: MetaState): number => META.rollBase + META.rollStep * s.rolls;
export const luxuryCharges = (s: MetaState): number => Math.floor(s.starTotal / META.starsPerLuxury) - s.luxuryUsed;
/** Stars toward the next Luxury roll charge. */
export const luxuryProgress = (s: MetaState): number => s.starTotal % META.starsPerLuxury;
/** POWER: Σ level × rarity weight. */
export const power = (s: MetaState): number => UPGRADES.reduce((p, u) => p + levelOf(s, u.kind) * RARITIES[u.rarity].power, 0);

/** Upgrades a roll can give: not maxed, and Rare or better for the Luxury roll. */
export function rollPool(s: MetaState, luxury: boolean): UpgradeDef[] {
  return UPGRADES.filter((u) => levelOf(s, u.kind) < maxLevel(u.kind) && (luxury ? RARITIES[u.rarity].luxuryOdds > 0 : RARITIES[u.rarity].odds > 0));
}

/**
 * Picks an upgrade from the pool: a rarity by its odds (among rarities left in the pool), then an
 * upgrade of that rarity, evenly. `r1` and `r2` are uniform in [0, 1) (the sim's ctx.rng).
 */
export function pickUpgrade(s: MetaState, luxury: boolean, r1: number, r2: number): UpgradeDef | null {
  const pool = rollPool(s, luxury);
  if (pool.length === 0) return null;
  const odds = (r: RarityName) => (luxury ? RARITIES[r].luxuryOdds : RARITIES[r].odds);
  const rarities = RARITY_ORDER.filter((r) => odds(r) > 0 && pool.some((u) => u.rarity === r));
  const total = rarities.reduce((t, r) => t + odds(r), 0);
  let x = r1 * total;
  let rarity = rarities[rarities.length - 1]!;
  for (const r of rarities) {
    if (x < odds(r)) {
      rarity = r;
      break;
    }
    x -= odds(r);
  }
  const of = pool.filter((u) => u.rarity === rarity);
  return of[Math.min(of.length - 1, Math.floor(r2 * of.length))]!;
}

/** Stars for a run: 0 on a defeat, else 1 to 3 by the share of lives left (sheet Meta tab). */
export function starsFor(won: boolean, lives: number, maxLives: number): number {
  if (!won) return 0;
  const share = maxLives > 0 ? lives / maxLives : 0;
  return share >= META.star3 - 1e-6 ? 3 : share >= META.star2 - 1e-6 ? 2 : 1;
}

/** Meta coins a run pays: a win pays a base plus per star, a defeat per wave survived. Replays pay the same. */
export function coinsFor(won: boolean, stars: number, wavesSurvived: number): number {
  return won ? META.winCoins + META.starCoins * stars : META.waveCoins * Math.max(0, wavesSurvived);
}

/**
 * Level `index` of the menu is open when it is the first one or the previous one was won.
 * `ids` are the menu's level ids in order.
 */
export const levelOpen = (s: MetaState, ids: readonly string[], index: number): boolean => index === 0 || (s.stars[ids[index - 1]!] ?? 0) > 0;

function gain(s: MetaState, kind: UpgradeKindName): MetaState {
  const now = levelOf(s, kind);
  if (now >= maxLevel(kind)) refuse('maxed');
  return { ...s, upgrades: { ...s.upgrades, [kind]: now + 1 } };
}

export const meta = defineMeta({
  name: 'progress',
  version: 1,
  initial: INITIAL,
  actions: {
    /** End of a run: pays its coins and keeps the level's best stars (only the stars above it count again). */
    finishRun: (s: MetaState, p: { level: string; stars: number; coins: number }) => {
      const best = p.level ? (s.stars[p.level] ?? 0) : 0;
      const stars = p.level && p.stars > best ? { ...s.stars, [p.level]: p.stars } : s.stars;
      return { ...s, coins: s.coins + p.coins, stars, starTotal: s.starTotal + Math.max(0, p.level ? p.stars - best : 0) };
    },
    /** A coin Roll: pays the rising cost and raises the upgrade the system drew. */
    roll: (s: MetaState, p: { kind: UpgradeKindName }) => {
      const cost = rollCost(s);
      if (s.coins < cost) refuse('not enough coins');
      return { ...gain(s, p.kind), coins: s.coins - cost, rolls: s.rolls + 1 };
    },
    /** A Luxury roll: spends one star charge, Rare or better. */
    luxury: (s: MetaState, p: { kind: UpgradeKindName }) => {
      if (luxuryCharges(s) <= 0) refuse('no luxury charge');
      if (RARITIES[BY_KIND[p.kind].rarity].luxuryOdds <= 0) refuse('not a luxury upgrade');
      return { ...gain(s, p.kind), luxuryUsed: s.luxuryUsed + 1 };
    },
    // QA only, called by src/meta.cheats.ts (left out of release builds).
    grantCoins: (s: MetaState, p: { coins: number }) => ({ ...s, coins: Math.max(0, s.coins + p.coins) }),
    grantUpgrade: (s: MetaState, p: { kind: UpgradeKindName; level: number }) => ({ ...s, upgrades: { ...s.upgrades, [p.kind]: Math.max(0, Math.min(maxLevel(p.kind), p.level)) } }),
    /** Stars that only charge the Luxury roll (no level gets them). */
    grantStars: (s: MetaState, p: { stars: number }) => ({ ...s, starTotal: s.starTotal + Math.max(0, p.stars) }),
    /** Raises each listed level to at least `stars` (unlocks the levels after them); the gain counts toward Luxury. */
    raiseStars: (s: MetaState, p: { levels: string[]; stars: number }) => {
      const stars = { ...s.stars };
      let gained = 0;
      for (const id of p.levels) {
        const best = stars[id] ?? 0;
        if (p.stars > best) {
          stars[id] = p.stars;
          gained += p.stars - best;
        }
      }
      return { ...s, stars, starTotal: s.starTotal + gained };
    },
    maxUpgrades: (s: MetaState) => ({ ...s, upgrades: Object.fromEntries(UPGRADES.map((u) => [u.kind, maxLevel(u.kind)])) }),
    reset: () => INITIAL,
  },
  invariants: {
    coinsNonNegative: (s) => s.coins >= 0,
    luxuryNotOverspent: (s) => luxuryCharges(s) >= 0,
  },
});

export const progress = metaInWorld(meta, { persist: true });
