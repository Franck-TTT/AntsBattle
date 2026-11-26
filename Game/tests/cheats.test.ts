import { worldTest, expect } from '@gameengine/test';
import { Enemy, Level, LevelPicked, Run } from '../src/schema.gen.ts';
import { menuLevels } from '../src/levels.ts';
import { META, progress } from '../src/meta.ts';
import { GoToLevel, GoToWave, KillAll, Lose, SetGold, SetLives, Win } from '../src/run.cheats.ts';
import { GrantStars, MaxUpgrades, ResetMeta, UnlockLevels } from '../src/meta.cheats.ts';
import { Swarm } from '../src/stress.cheats.ts';

worldTest('run cheats: gold, lives, wave jump, kill all, win and lose', async ({ world, step, input, cheat }) => {
  await step(2);
  input.emit(LevelPicked, { index: 0 });
  await step(3);
  await cheat(SetGold, { gold: 1234 });
  await cheat(SetLives, { lives: 77 });
  await step(1);
  expect(world.resource(Run).gold).toBe(1234);
  expect(world.resource(Run).lives).toBe(77);

  await cheat(GoToWave, { wave: 4 });
  await step(2);
  expect(world.resource(Run).wave).toBe(4);

  await cheat(Swarm, { count: 20 });
  await step(1);
  await cheat(KillAll, {});
  await step(2);
  expect(world.entities(Enemy).length).toBe(0);
  expect(world.resource(Run).alive).toBe(0);

  await cheat(Win, { stars: 2 });
  await step(3);
  expect(world.resource(Run).phase).toBe('won');
  expect(world.resource(Run).stars).toBe(2);
});

worldTest('lose cheats end the run lost', async ({ world, step, input, cheat }) => {
  await step(2);
  input.emit(LevelPicked, { index: 0 });
  await step(3);
  await cheat(Lose, {});
  await step(2);
  expect(world.resource(Run).phase).toBe('lost');
});

worldTest('meta cheats: stars, unlock, go to level, max upgrades, reset', async ({ world, step, cheat }) => {
  await step(2);
  const levels = menuLevels();
  await cheat(GrantStars, { stars: META.starsPerLuxury });
  await step(1);
  expect(progress.get().starTotal).toBe(META.starsPerLuxury);

  const last = levels.length;
  await cheat(GoToLevel, { level: last });
  await step(3);
  expect(world.resource(Level).data).toBe(levels[last - 1]!.guid);
  for (const l of levels.slice(0, last - 1)) expect(progress.get().stars[l.id]).toBe(1);

  await cheat(UnlockLevels, { stars: 3 });
  await cheat(MaxUpgrades, {});
  await step(1);
  for (const l of levels) expect(progress.get().stars[l.id]).toBe(3);
  expect(Object.keys(progress.get().upgrades).length).toBeGreaterThan(0);

  await cheat(ResetMeta, {});
  await step(1);
  expect(progress.get().starTotal).toBe(0);
  expect(progress.get().coins).toBe(0);
});
