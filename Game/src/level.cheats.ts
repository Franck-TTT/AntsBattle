/** QA and tests: play another level layout (the run restarts on it). */
import { write } from '@gameengine/runtime';
import { defineCheat } from '@gameengine/runtime/cheats';
import { Level } from './schema.gen.ts';

export const LoadLevel = defineCheat({
  id: 'level.load',
  group: 'Level',
  title: 'Restart the run on a level layout',
  params: { level: { type: 'string', default: 'assets/levels/demo.level.json', doc: 'Path or GUID of a LevelDef' } },
  resources: [write(Level)],
  run(ctx, { level }) {
    ctx.set(Level, { data: level, loads: ctx.get(Level).loads + 1 });
  },
});

export const RestartRun = defineCheat({
  id: 'run.restart',
  group: 'Level',
  title: 'Restart the run on the current level',
  resources: [write(Level)],
  run(ctx) {
    ctx.set(Level, { loads: ctx.get(Level).loads + 1 });
  },
});
