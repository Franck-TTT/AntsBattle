import { worldTest, expect } from '@gameengine/test';
import { listData, loadData } from '@gameengine/runtime';
import { Block, Level, LevelDef, LevelPicked, MenuRequested, Run, WorldsDef } from '../src/schema.gen.ts';
import { menuLevels } from '../src/levels.ts';

worldTest('the game opens on the level menu and no wave comes while it is up', async ({ world, step }) => {
  await step(1);
  expect(world.resource(Run).phase).toBe('menu');
  await step(600);
  expect(world.resource(Run).phase).toBe('menu');
  expect(world.resource(Run).wave).toBe(0);
});

worldTest('the menu follows the world structure (assets/levels/worlds.json), without test layouts', async () => {
  const levels = menuLevels();
  expect(levels.length).toBeGreaterThan(1);
  const worlds = loadData(WorldsDef, listData(WorldsDef)[0]!).worlds;
  const placed = worlds.flatMap((w) => w.levels.filter((id) => id));
  expect(levels.map((l) => l.id)).toEqual(placed);
  // Worlds in order, slots numbered from 0, the last level of each world its boss.
  for (const [i, l] of levels.entries()) {
    const next = levels[i + 1];
    expect(l.last).toBe(!next || next.world !== l.world);
    if (i > 0) expect(l.slot).toBe(levels[i - 1]!.world === l.world ? levels[i - 1]!.slot + 1 : 0);
  }
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
