/**
 * The game opens on the level menu. Gameplay tests start in a run on the scene's level instead:
 * these wrap `worldTest` / `renderTest` and press "play" (a RestartRequested before the first step,
 * which StartRun folds into the boot run). The level menu itself is tested with the plain ones.
 */
import { renderTest as baseRender, worldTest as baseWorld } from '@gameengine/test';
import { RestartRequested } from '../src/schema.gen.ts';

type Emits = { input: { emit(event: typeof RestartRequested, fields: object): void } };

function playing<F extends object>(base: F): F {
  const run = base as unknown as (name: string, fn: (t: Emits) => unknown, ...rest: unknown[]) => unknown;
  const wrapped = (name: string, fn: (t: Emits) => unknown, ...rest: unknown[]) =>
    run(name, (t) => {
      t.input.emit(RestartRequested, {});
      return fn(t);
    }, ...rest);
  return Object.assign(wrapped, base) as F;
}

export const worldTest = playing(baseWorld);
export const renderTest = playing(baseRender);
