import { worldTest, expect } from '@gameengine/test';
import { simulateMeta } from '@gameengine/meta';
import { Board, Boost, ItemKind, LevelDef, LevelPicked, RestartRequested, RollRequested, Run } from '../src/schema.gen.ts';
import { loadData } from '@gameengine/runtime';
import { levelWaves } from '../src/sim/level.ts';
import { menuLevels } from '../src/levels.ts';
import { START_GOLD, START_LIVES, SWARM, WAVE_COUNT } from '../src/balance.ts';
import { META, RARITIES, UPGRADES, coinsFor, levelOpen, luxuryCharges, meta, pickUpgrade, progress, rollCost, rollPool, starsFor, type MetaState } from '../src/meta.ts';
import { EndRun, GrantCoins, SetUpgrade } from '../src/meta.cheats.ts';

const EMPTY: MetaState = { coins: 0, stars: {}, starTotal: 0, luxuryUsed: 0, rolls: 0, upgrades: {} };

worldTest('stars come from the lives left; coins from the result', async () => {
  expect(starsFor(false, 10, 50)).toBe(0);
  expect(starsFor(true, 50, 50)).toBe(3);
  expect(starsFor(true, Math.ceil(50 * META.star3), 50)).toBe(3);
  expect(starsFor(true, 30, 50)).toBe(2);
  expect(starsFor(true, 1, 50)).toBe(1);
  expect(coinsFor(true, 3, 9)).toBe(META.winCoins + 3 * META.starCoins);
  expect(coinsFor(false, 0, 5)).toBe(5 * META.waveCoins);
  expect(coinsFor(false, 0, -1)).toBe(0);
});

worldTest('a won run pays coins and stars once; replays pay coins, only better stars count again', async ({ world, step, input, cheat }) => {
  await step(2);
  const level = menuLevels()[0]!.id;
  input.emit(LevelPicked, { index: 0 });
  await step(3);
  await cheat(EndRun, { result: 'won', lives: START_LIVES, wave: 10 });
  await step(2);
  const paid = META.winCoins + 3 * META.starCoins;
  expect(progress.get().coins).toBe(paid);
  expect(progress.get().stars[level]).toBe(3);
  expect(progress.get().starTotal).toBe(3);
  expect(world.resource(Run).paid).toBe(true);
  expect(world.resource(Run).newStars).toBe(3);
  await step(30);
  expect(progress.get().coins).toBe(paid);
  // A replay with fewer stars pays its coins but keeps the best stars.
  input.emit(RestartRequested, {});
  await step(3);
  await cheat(EndRun, { result: 'won', lives: 1, wave: 10 });
  await step(2);
  expect(progress.get().coins).toBe(paid + META.winCoins + META.starCoins);
  expect(progress.get().stars[level]).toBe(3);
  expect(progress.get().starTotal).toBe(3);
  expect(world.resource(Run).newStars).toBe(0);
  // A defeat pays per wave survived.
  input.emit(RestartRequested, {});
  await step(3);
  await cheat(EndRun, { result: 'lost', lives: 0, wave: 6 });
  await step(2);
  expect(world.resource(Run).coinsWon).toBe(5 * META.waveCoins);
});

worldTest('a level opens once the one before it is won', async () => {
  const ids = ['a', 'b', 'c'];
  expect(levelOpen(EMPTY, ids, 0)).toBe(true);
  expect(levelOpen(EMPTY, ids, 1)).toBe(false);
  expect(levelOpen({ ...EMPTY, stars: { a: 1 } }, ids, 1)).toBe(true);
  expect(levelOpen({ ...EMPTY, stars: { a: 1 } }, ids, 2)).toBe(false);
});

worldTest('a Roll pays its rising cost and raises one upgrade', async ({ world, step, input, cheat }) => {
  await step(2);
  await cheat(GrantCoins, { coins: 1000 });
  input.emit(RollRequested, { luxury: false });
  await step(1);
  let s = progress.get();
  expect(s.coins).toBe(1000 - META.rollBase);
  expect(s.rolls).toBe(1);
  expect(Object.values(s.upgrades).reduce((a, b) => a + (b ?? 0), 0)).toBe(1);
  expect(rollCost(s)).toBe(META.rollBase + META.rollStep);
  // Broke: the roll is refused and nothing changes.
  await cheat(GrantCoins, { coins: -s.coins });
  input.emit(RollRequested, { luxury: false });
  await step(1);
  s = progress.get();
  expect(s.rolls).toBe(1);
  expect(world.resource(Run).phase).toBe('menu');
});

worldTest('the Luxury roll needs a star charge and never gives a Common', async () => {
  expect(meta.apply(EMPTY, 'luxury', { kind: 'globalDmg' }, { now: 0 }).ok).toBe(false);
  const charged: MetaState = { ...EMPTY, starTotal: META.starsPerLuxury };
  expect(luxuryCharges(charged)).toBe(1);
  for (let i = 0; i < 50; i++) {
    const u = pickUpgrade(charged, true, i / 50, (i * 7) % 50 / 50)!;
    expect(u.rarity).not.toBe('common');
    expect(RARITIES[u.rarity].luxuryOdds).toBeGreaterThan(0);
  }
  const r = meta.apply(charged, 'luxury', { kind: 'globalDmg' }, { now: 0 });
  expect(r.ok).toBe(true);
  expect(luxuryCharges(r.state)).toBe(0);
});

worldTest('maxed upgrades leave the pool', async () => {
  const full: MetaState = { ...EMPTY, upgrades: Object.fromEntries(UPGRADES.map((u) => [u.kind, RARITIES[u.rarity].maxLevel])) };
  expect(rollPool(full, false).length).toBe(0);
  expect(pickUpgrade(full, false, 0.5, 0.5)).toBe(null);
  expect(meta.apply({ ...full, coins: 9999 }, 'roll', { kind: 'towerDmg' }, { now: 0 }).ok).toBe(false);
});

worldTest('owned upgrades change the next run', async ({ world, step, input, cheat }) => {
  await step(2);
  await cheat(SetUpgrade, { kind: 'life', level: 1 });
  await cheat(SetUpgrade, { kind: 'startGold', level: 2 });
  await cheat(SetUpgrade, { kind: 'towerDmg', level: 2 });
  await cheat(SetUpgrade, { kind: 'freeCell', level: 1 });
  await cheat(SetUpgrade, { kind: 'freeTower', level: 1 });
  input.emit(LevelPicked, { index: 0 });
  await step(3);
  const run = world.resource(Run);
  expect(run.lives).toBe(START_LIVES + SWARM);
  expect(run.gold).toBe(START_GOLD + 20);
  const boost = world.resource(Boost);
  expect(boost.damage[ItemKind.tower]).toBeCloseTo(1.1, 5);
  expect(boost.damage[ItemKind.cannon]).toBeCloseTo(1, 5);
  expect(boost.freeWalls).toBe(1);
  expect(boost.freeTower).toBe(true);
});

worldTest('no soft lock: losing every run still buys rolls', async () => {
  // A player who never wins (5 waves survived per run) still affords a roll every few runs.
  const r = simulateMeta(meta, {
    players: 50,
    steps: 120,
    seed: 1,
    policy: (s) => (s.coins >= rollCost(s) && rollPool(s, false).length ? { action: 'roll', payload: { kind: rollPool(s, false)[0]!.kind } } : { action: 'finishRun', payload: { level: '', stars: 0, coins: coinsFor(false, 0, 5) } }),
    track: { rolls: (s) => s.rolls },
    stuckAfter: 60,
  });
  expect(r.final.rolls!.min).toBeGreaterThan(2);
  expect(r.stuckPlayers).toBe(0);
});

worldTest('a level plays its own number of waves, all of them when it sets none', async ({ world, step, input }) => {
  expect(levelWaves({})).toBe(WAVE_COUNT);
  expect(levelWaves({ waves: 3 })).toBe(3);
  expect(levelWaves({ waves: 99 })).toBe(WAVE_COUNT);
  expect(levelWaves({ waves: 0 })).toBe(1);
  await step(2);
  input.emit(LevelPicked, { index: 0 });
  await step(3);
  expect(world.resource(Board).waveCount).toBe(levelWaves(loadData(LevelDef, menuLevels()[0]!.guid)));
});
