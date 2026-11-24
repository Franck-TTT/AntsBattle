/** Stress test: fill the board with ants spread along the current path, plus some defenses. */
import { read, write } from '@gameengine/runtime';
import { defineCheat } from '@gameengine/runtime/cheats';
import { Board, Run } from './schema.gen.ts';
import { spawnEnemy } from './sim/battle.ts';
import { spawnBlock, spawnItem } from './sim/placement.ts';
import { recomputeBoard } from './sim/board.ts';
import { cellX, cellY } from './grid.ts';

export const Swarm = defineCheat({
  id: 'swarm.spawn',
  group: 'Stress',
  title: 'Spawn a swarm of ants',
  params: { count: { type: 'int', default: 500, min: 1, max: 2000 } },
  resources: [write(Run), read(Board)],
  run(ctx, { count }) {
    const run = ctx.resource(Run);
    const b = ctx.resource(Board);
    const len = b.pathLen[0]!;
    for (let i = 0; i < count; i++) {
      const c = b.path[ctx.rng.range(0, Math.max(1, len - 1))]!;
      spawnEnemy(ctx, 'ant', 1, run.time[0]!, cellX(c) + ctx.rng.between(-0.4, 0.4), cellY(c) + ctx.rng.between(-0.4, 0.4));
    }
    run.alive[0] = run.alive[0]! + count;
    run.lives[0] = 100000;
  },
});

export const Defenses = defineCheat({
  id: 'swarm.defenses',
  group: 'Stress',
  title: 'Place towers and cannons on both sides of the column',
  resources: [write(Board), read(Run)],
  run(ctx) {
    const b = ctx.resource(Board);
    const t = ctx.resource(Run).time[0]!;
    for (let row = 1; row < 10; row++) {
      for (const col of [2, 4]) {
        const cell = row * 7 + col;
        const kind = row % 3 === 0 ? 'cannon' : 'tower';
        spawnBlock(ctx, 'b1x1', cell, t);
        spawnItem(ctx, kind, cell, t);
        b.cells[cell] = 1;
        b.weapons[cell] = kind === 'cannon' ? 3 : 2;
      }
    }
    recomputeBoard(ctx);
  },
});

export const NextWave = defineCheat({
  id: 'wave.next',
  group: 'Waves',
  title: 'Start the next wave now (and never lose)',
  resources: [write(Run)],
  run(ctx) {
    const run = ctx.resource(Run);
    run.nextWaveAt[0] = run.time[0]!;
    run.lives[0] = 100000;
  },
});
