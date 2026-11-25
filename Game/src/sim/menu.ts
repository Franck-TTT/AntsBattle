/** The level menu's sim side: picking a level loads it (StartRun restarts on it), Menu pauses the run. */
import { defineSystem, write } from '@gameengine/runtime';
import { Level, LevelPicked, MenuRequested, Placement, Run } from '../schema.gen.ts';
import { menuLevels } from '../levels.ts';

export const PickLevel = defineSystem({
  name: 'PickLevel',
  before: ['StartRun'],
  resources: [write(Level)],
  events: [LevelPicked],
  runIf: { event: LevelPicked },
  run(ctx) {
    const levels = menuLevels();
    for (const e of ctx.events.read(LevelPicked)) {
      const level = levels[e.index];
      if (level) ctx.set(Level, { data: level.guid, loads: ctx.get(Level).loads + 1 });
    }
  },
});

export const OpenMenu = defineSystem({
  name: 'OpenMenu',
  resources: [write(Run), write(Placement)],
  events: [MenuRequested],
  runIf: { event: MenuRequested },
  run(ctx) {
    ctx.set(Run, { phase: 'menu', speed: 1 });
    ctx.set(Placement, { active: false, cell: -1, valid: false, previewLen: 0, returnSteps: 0 });
  },
});
