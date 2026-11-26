/** Capacity sweep: how many ants on screen the device holds (cheat `benchmark.capacity`). */
import { query, read, write } from '@gameengine/runtime';
import { defineCapacityCheat, defineCapacitySweep } from '@gameengine/runtime/capacity';
import { defineCheat, runCheat } from '@gameengine/runtime/cheats';
import { Board, Enemy, Run } from './schema.gen.ts';
import { spawnEnemy } from './sim/battle.ts';
import { cellX, cellY } from './grid.ts';

/** Replaces every enemy with `count` ants spread over the first 40% of the path (from the nest). */
export const SetSwarm = defineCheat({
  id: 'swarm.set',
  group: 'Stress',
  title: 'Set the swarm to exactly N ants',
  params: { count: { type: 'int', default: 100, min: 0, max: 1000000 } },
  resources: [write(Run), read(Board)],
  query: query(read(Enemy)),
  run(ctx, { count }, q) {
    for (const c of q.chunks()) for (let i = 0; i < c.length; i++) ctx.commands.despawn(c.entity(i));
    const run = ctx.resource(Run);
    const b = ctx.resource(Board);
    const span = Math.max(1, Math.floor(b.pathLen[0]! * 0.4));
    for (let i = 0; i < count; i++) {
      const cell = b.path[ctx.rng.range(0, span)]!;
      spawnEnemy(ctx, 'ant', 1, run.time[0]!, cellX(cell) + ctx.rng.between(-0.4, 0.4), cellY(cell) + ctx.rng.between(-0.4, 0.4), b.nestCell[0]!);
    }
    run.alive[0] = count;
    run.lives[0] = 100000;
    run.nextWaveAt[0] = 1e9;
  },
});

// One sweep per load: a sweep stops after its first step over 35 ms, and this test must go on to
// 1000000 ants (or a crash) whatever the frame time.
const LOADS = [15000, 20000, 30000, 50000, 75000, 100000, 200000, 500000, 1000000];
const sweeps = LOADS.map((load) =>
  defineCapacitySweep({
    name: `ants-${load}`,
    unit: 'ants',
    steps: [load],
    resources: [read(Run)],
    start: (n) => runCheat(SetSwarm, { count: n }),
    ready: (n, ctx) => ctx.resource(Run).alive[0] === n,
    report: (_n, ctx) => ({ alive: ctx.resource(Run).alive[0]! }),
    finish: () => runCheat(SetSwarm, { count: 0 }),
  }),
);

export const Capacity = defineCapacityCheat({ sweeps });
