/**
 * The levels on the level menu: every LevelDef with an `order` above 0, sorted by it. Data assets
 * are content, identical on every device, so sim systems and the UI read the same list.
 */
import { listData, loadData } from '@gameengine/runtime';
import { LevelDef } from './schema.gen.ts';

export interface MenuLevel {
  /** The LevelDef's GUID, what `Level.data` takes. */
  guid: string;
  id: string;
  name: string;
}

/** Menu levels in play order (LevelPicked's index is a position in this list). */
export function menuLevels(): MenuLevel[] {
  return listData(LevelDef)
    .map((guid) => ({ guid, def: loadData(LevelDef, guid) }))
    .filter((l) => l.def.order > 0)
    .sort((a, b) => a.def.order - b.def.order || (a.def.id < b.def.id ? -1 : 1))
    .map((l) => ({ guid: l.guid, id: l.def.id, name: l.def.name }));
}
