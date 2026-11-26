/** QA and tests: meta coins, upgrade levels, and ending the run on the spot. */
import { write } from '@gameengine/runtime';
import { defineCheat } from '@gameengine/runtime/cheats';
import { Run } from './schema.gen.ts';
import { UPGRADE_NAMES } from './kinds.ts';
import { META, progress } from './meta.ts';
import { menuLevels } from './levels.ts';

const UPGRADE_KIND_VALUES = UPGRADE_NAMES as readonly (typeof UPGRADE_NAMES)[number][];

export const GrantCoins = defineCheat({
  id: 'meta.coins',
  group: 'Meta',
  title: 'Add meta coins',
  params: { coins: { type: 'number', default: 1000 } },
  run(ctx, { coins }) {
    progress.dispatch('grantCoins', { coins }, ctx.time);
  },
});

export const SetUpgrade = defineCheat({
  id: 'meta.upgrade',
  group: 'Meta',
  title: 'Set an upgrade level (applies from the next run)',
  params: {
    kind: { type: 'enum', values: UPGRADE_KIND_VALUES, default: 'towerDmg' },
    level: { type: 'number', default: 1 },
  },
  run(ctx, { kind, level }) {
    progress.dispatch('grantUpgrade', { kind, level }, ctx.time);
  },
});

export const GrantStars = defineCheat({
  id: 'meta.stars',
  group: 'Meta',
  title: 'Add stars (charge the Luxury roll)',
  params: { stars: { type: 'int', default: META.starsPerLuxury, min: 1, max: 999 } },
  run(ctx, { stars }) {
    progress.dispatch('grantStars', { stars }, ctx.time);
  },
});

export const UnlockLevels = defineCheat({
  id: 'meta.unlockLevels',
  group: 'Meta',
  title: 'Give stars on every menu level (unlocks them all)',
  params: { stars: { type: 'int', default: 3, min: 1, max: 3 } },
  run(ctx, { stars }) {
    progress.dispatch('raiseStars', { levels: menuLevels().map((l) => l.id), stars }, ctx.time);
  },
});

export const MaxUpgrades = defineCheat({
  id: 'meta.maxUpgrades',
  group: 'Meta',
  title: 'Max every upgrade (applies from the next run)',
  run(ctx) {
    progress.dispatch('maxUpgrades', {}, ctx.time);
  },
});

export const ResetMeta = defineCheat({
  id: 'meta.reset',
  group: 'Meta',
  title: 'Reset the meta (coins, stars, upgrades)',
  run(ctx) {
    progress.dispatch('reset', {}, ctx.time);
  },
});

export const EndRun = defineCheat({
  id: 'run.end',
  group: 'Meta',
  title: 'End the run now (won with these lives left, or lost)',
  params: {
    result: { type: 'enum', values: ['won', 'lost'] as const, default: 'won' },
    lives: { type: 'number', default: 50 },
    wave: { type: 'number', default: 10 },
  },
  resources: [write(Run)],
  run(ctx, { result, lives, wave }) {
    ctx.set(Run, { phase: result, lives: result === 'won' ? lives : 0, wave });
  },
});
