/** QA: the current run — gold, lives, jump to a level or a wave, clear the board, win or lose on the spot. */
import { query, read, write, type Query, type SystemContext } from '@gameengine/runtime';
import { defineCheat } from '@gameengine/runtime/cheats';
import { Enemy, Level, Run } from './schema.gen.ts';
import { WAVE_COUNT } from './balance.ts';
import { menuLevels } from './levels.ts';
import { META, progress } from './meta.ts';
import { runLives } from './sim/progress.ts';

const enemies = query(read(Enemy));

/** Removes every enemy on the board (no gold paid). */
function clearEnemies(ctx: SystemContext, q: Query): void {
  for (const c of q.chunks()) for (let i = 0; i < c.length; i++) ctx.commands.despawn(c.entity(i));
  ctx.resource(Run).alive[0] = 0;
}

export const SetGold = defineCheat({
  id: 'run.gold',
  group: 'Run',
  title: 'Set in-run gold',
  params: { gold: { type: 'int', default: 999, min: 0, max: 99_999, step: 50 } },
  current: (world) => ({ gold: world.resource(Run).gold }),
  resources: [write(Run)],
  run(ctx, { gold }) {
    ctx.set(Run, { gold });
  },
});

export const SetLives = defineCheat({
  id: 'run.lives',
  group: 'Run',
  title: 'Set lives (100000: never lose)',
  params: { lives: { type: 'int', default: 100_000, min: 1, max: 100_000 } },
  current: (world) => ({ lives: world.resource(Run).lives }),
  resources: [write(Run)],
  run(ctx, { lives }) {
    ctx.set(Run, { lives });
  },
});

export const KillAll = defineCheat({
  id: 'run.killAll',
  group: 'Run',
  title: 'Remove every ant on the board',
  resources: [write(Run)],
  query: enemies,
  run(ctx, _args, q) {
    clearEnemies(ctx, q);
  },
});

export const Win = defineCheat({
  id: 'run.win',
  group: 'Run',
  title: 'Win now with 1 to 3 stars',
  params: { stars: { type: 'int', default: 3, min: 1, max: 3 } },
  resources: [write(Run)],
  query: enemies,
  run(ctx, { stars }, q) {
    const max = runLives(progress.get());
    const lives = stars >= 3 ? max : stars === 2 ? Math.ceil(max * META.star2) : 1;
    clearEnemies(ctx, q);
    ctx.set(Run, { phase: 'won', lives, wave: WAVE_COUNT, spawning: false });
  },
});

export const Lose = defineCheat({
  id: 'run.lose',
  group: 'Run',
  title: 'Lose now',
  resources: [write(Run)],
  run(ctx) {
    ctx.set(Run, { phase: 'lost', lives: 0 });
  },
});

export const GoToWave = defineCheat({
  id: 'wave.goto',
  group: 'Waves',
  title: 'Jump to a wave (clears the board, starts it now)',
  params: { wave: { type: 'int', default: 5, min: 1, max: WAVE_COUNT } },
  current: (world) => ({ wave: Math.max(1, world.resource(Run).wave) }),
  resources: [write(Run)],
  query: enemies,
  run(ctx, { wave }, q) {
    if (ctx.get(Run).phase !== 'playing') return;
    clearEnemies(ctx, q);
    const run = ctx.resource(Run);
    ctx.set(Run, { wave: wave - 1, nextWaveAt: run.time[0]!, spawning: false, spawnAt: 1e9, group: 0, groupSpawned: 0 });
  },
});

export const GoToLevel = defineCheat({
  id: 'level.goto',
  group: 'Level',
  title: 'Play a menu level (unlocks the ones before it)',
  params: { level: { type: 'int', default: 1, min: 1, max: 99, doc: 'Position on the level menu, from 1' } },
  resources: [write(Level)],
  run(ctx, { level }) {
    const levels = menuLevels();
    const target = levels[Math.min(level, levels.length) - 1];
    if (!target) return;
    const before = levels.slice(0, levels.indexOf(target)).map((l) => l.id);
    if (before.length > 0) progress.dispatch('raiseStars', { levels: before, stars: 1 }, ctx.time);
    ctx.set(Level, { data: target.guid, loads: ctx.get(Level).loads + 1 });
  },
});
