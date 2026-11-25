import { worldTest, expect } from '@gameengine/test';
import { loadData } from '@gameengine/runtime';
import { Block, Level, LevelDef, LevelPicked, MenuRequested, Run } from '../src/schema.gen.ts';
import { menuLevels } from '../src/levels.ts';

worldTest('the game opens on the level menu and no wave comes while it is up', async ({ world, step }) => {
  await step(1);
  expect(world.resource(Run).phase).toBe('menu');
  await step(600);
  expect(world.resource(Run).phase).toBe('menu');
  expect(world.resource(Run).wave).toBe(0);
});

worldTest('the menu lists the levels in order, without test layouts', async () => {
  const levels = menuLevels();
  expect(levels.length).toBeGreaterThan(1);
  const orders = levels.map((l) => loadData(LevelDef, l.guid).order);
  expect(orders.every((o, i) => o > 0 && (i === 0 || o >= orders[i - 1]!))).toBe(true);
  expect(levels.some((l) => l.id === 'test-layout-fixture')).toBe(false);
});

worldTest('picking a level plays it on its own layout', async ({ world, step, input }) => {
  await step(1);
  const levels = menuLevels();
  for (const [index, level] of levels.entries()) {
    input.emit(LevelPicked, { index });
    await step(3);
    expect(world.resource(Run).phase).toBe('playing');
    expect(world.resource(Level).data).toBe(level.guid);
    expect(world.entities(Block).length).toBe(loadData(LevelDef, level.guid).blocks.length);
  }
});

worldTest('Levels on the end screen goes back to the menu, and a pick starts a new run', async ({ world, step, input }) => {
  await step(1);
  input.emit(LevelPicked, { index: 0 });
  await step(3);
  const runId = world.resource(Run).runId;
  input.emit(MenuRequested, {});
  await step(1);
  expect(world.resource(Run).phase).toBe('menu');
  input.emit(LevelPicked, { index: 0 });
  await step(3);
  expect(world.resource(Run).phase).toBe('playing');
  expect(world.resource(Run).runId).toBeGreaterThan(runId);
});
