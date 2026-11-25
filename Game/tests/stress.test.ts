import { expect } from '@gameengine/test';
import { renderTest, worldTest } from './play.ts';
import { Swarm, Defenses } from '../src/stress.cheats.ts';
import { Enemy } from '../src/schema.gen.ts';

// Sim cost at swarm sizes: spawn N ants along the path (with towers and cannons on both sides) and
// step while the whole swarm is still on the board. Per-system means: gameengine test --json.
for (const count of [500, 1000, 2000]) {
  worldTest(`stress: ${count} ants`, async ({ step, cheat, world }) => {
    await step(2);
    await cheat(Defenses, {});
    await cheat(Swarm, { count });
    await step(2);
    expect(world.entities(Enemy).length).toBeGreaterThan(count * 0.9);
    await step(60);
    console.log(`alive after 60 steps: ${world.entities(Enemy).length}`);
  });
}

renderTest('stress: 500 ants on the board', async ({ step, cheat, world, render, input }) => {
  input.view(393, 852, 3, [0, 59, 0, 34]);
  await step(250);
  await cheat(Defenses, {});
  await cheat(Swarm, { count: 500 });
  await step(10);
  expect(world.entities(Enemy).length).toBeGreaterThan(450);
  let peak = 0;
  for (let i = 0; i < 4; i++) {
    await step(15);
    peak = Math.max(peak, render.stats({ width: 393, height: 852 }).drawCalls);
  }
  console.log(`peak draw calls ${peak}`);
  render.expectScreenshot('swarm', { width: 393, height: 852 });
});
