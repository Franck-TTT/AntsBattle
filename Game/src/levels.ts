/**
 * The levels on the level menu, in play order, grouped in worlds. The world structure comes from the
 * WorldsDef (assets/levels/worlds.json, edited with the Worlds editor widget): its worlds in order,
 * each world's filled slots in order. Without one, or with every slot empty, every LevelDef with an
 * `order` above 0 is listed by `order`, MAP_SIZE levels a world. Data assets are content, identical
 * on every device, so sim systems and the UI read the same list.
 */
import { listData, loadData } from '@gameengine/runtime';
import { LevelDef, WorldsDef } from './schema.gen.ts';

/** Levels per world when no WorldsDef sets them (the level map's 10 nodes). */
const MAP_SIZE = 10;

export interface MenuLevel {
  /** The LevelDef's GUID, what `Level.data` takes. */
  guid: string;
  id: string;
  name: string;
  /** Index of its world, from 0. */
  world: number;
  /** The world's name, shown as the level map's title. */
  worldName: string;
  /** Position in its world, from 0. */
  slot: number;
  /** The last level of its world (the boss node). */
  last: boolean;
}

/** Menu levels in play order (LevelPicked's index is a position in this list). */
export function menuLevels(): MenuLevel[] {
  const defs = listData(LevelDef).map((guid) => ({ guid, def: loadData(LevelDef, guid) }));
  const byId = new Map(defs.map((l) => [l.def.id, l] as const));
  const out: MenuLevel[] = [];
  const worldsRef = listData(WorldsDef)[0];
  const worlds = worldsRef ? loadData(WorldsDef, worldsRef).worlds : [];
  const seen = new Set<string>();
  let w = 0;
  for (const world of worlds) {
    // Empty slots, unknown ids and a level already placed earlier are skipped.
    const ids = world.levels.filter((id) => id && byId.has(id) && !seen.has(id) && (seen.add(id), true));
    if (!ids.length) continue;
    ids.forEach((id, slot) => {
      const l = byId.get(id)!;
      out.push({ guid: l.guid, id, name: l.def.name, world: w, worldName: world.name, slot, last: slot === ids.length - 1 });
    });
    w++;
  }
  if (out.length) return out;
  const ordered = defs.filter((l) => l.def.order > 0).sort((a, b) => a.def.order - b.def.order || (a.def.id < b.def.id ? -1 : 1));
  return ordered.map((l, i) => {
    const world = Math.floor(i / MAP_SIZE);
    const slot = i % MAP_SIZE;
    return { guid: l.guid, id: l.def.id, name: l.def.name, world, worldName: `World ${world + 1}`, slot, last: slot === MAP_SIZE - 1 };
  });
}
