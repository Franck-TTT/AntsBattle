/**
 * Worlds: the world structure (assets/levels/worlds.json, a WorldsDef). Arrows step through the
 * worlds (the right arrow past the last one adds a new world); each world has LEVELS_PER_WORLD
 * slots, each a dropdown of the project's levels (by LevelDef id). Writes go through the command
 * bus (asset.setText), so undo and hot reload see them.
 */
import { defineEditorWidget, type EditorModeApi } from '@gameengine/editor-api';

const FILE = 'assets/levels/worlds.json';
const LEVEL_DIR = 'assets/levels';
const LEVEL_SUFFIX = '.level.json';
const NONE = '';
const LEVELS_PER_WORLD = 10;

interface World {
  name: string;
  levels: string[];
}

// Survive a re-dock (remount): the world shown.
const memo = { index: 0 };

const slots = (levels: string[] | undefined) => Array.from({ length: LEVELS_PER_WORLD }, (_, i) => levels?.[i] ?? NONE);

function format(worlds: World[]): string {
  const rows = worlds.map((w) => `    { "name": ${JSON.stringify(w.name)}, "levels": [${w.levels.map((l) => JSON.stringify(l)).join(', ')}] }`);
  return `{\n  "$type": "WorldsDef",\n  "worlds": [\n${rows.join(',\n')}\n  ]\n}\n`;
}

const readJson = (r: unknown): Record<string, unknown> | null => {
  const res = r as { text?: string; json?: unknown };
  return (res.json ?? (res.text ? JSON.parse(res.text) : null)) as Record<string, unknown> | null;
};

export default defineEditorWidget(({ React, ui }) => {
  function Worlds({ api }: { api: EditorModeApi }) {
    const rev = api.assets.useRevision({ dir: LEVEL_DIR, suffixes: ['.json'] });
    const [worlds, setWorlds] = React.useState<World[]>([]);
    const [hash, setHash] = React.useState<string | undefined>(undefined);
    const [levels, setLevels] = React.useState<{ id: string; name: string }[]>([]);
    const [index, setIndexState] = React.useState(memo.index);
    const setIndex = (i: number) => ((memo.index = i), setIndexState(i));

    // The world file, re-read whenever it changes on disk.
    React.useEffect(() => {
      void api.query('asset.read', { path: FILE }).then((r) => {
        const raw = readJson(r);
        const list = ((raw?.worlds as World[] | undefined) ?? []).map((w) => ({ name: String(w.name ?? ''), levels: slots(w.levels) }));
        setWorlds(list.length ? list : [{ name: 'World 1', levels: slots([]) }]);
        setHash((r as { hash?: string }).hash);
      }).catch((e: unknown) => api.notify(`Worlds: cannot read ${FILE}: ${String(e)}`, 'error'));
    }, [rev]);

    // The levels to pick from: every LevelDef id under assets/levels.
    React.useEffect(() => {
      void api.query('project.listFiles', { dir: LEVEL_DIR, suffix: LEVEL_SUFFIX }).then(async (r) => {
        const list = Array.isArray(r) ? r : ((r as { files?: unknown[] })?.files ?? []);
        const paths = list.map((f) => (typeof f === 'string' ? f : String((f as { path?: string }).path ?? ''))).filter((p) => p.endsWith(LEVEL_SUFFIX)).sort();
        const defs = await Promise.all(paths.map((p) => api.query('asset.read', { path: p }).then(readJson).catch(() => null)));
        setLevels(defs.flatMap((d, i) => (d ? [{ id: String(d.id ?? paths[i]!.slice(LEVEL_DIR.length + 1, -LEVEL_SUFFIX.length)), name: String(d.name ?? '') }] : [])));
      });
    }, [rev]);

    const save = async (next: World[]) => {
      setWorlds(next); // show it at once; the re-read after the write confirms it
      try {
        const r = (await api.execute('asset.setText', { path: FILE, text: format(next), ...(hash ? { expectedHash: hash } : { create: true }) })) as { hash?: string };
        if (r?.hash) setHash(r.hash);
      } catch (e) {
        api.notify(`Worlds: ${String(e)} (re-reading ${FILE})`, 'error');
        setHash(undefined);
      }
    };

    const i = Math.min(index, Math.max(0, worlds.length - 1));
    const world = worlds[i];
    const update = (w: World) => void save(worlds.map((o, k) => (k === i ? w : o)));
    const next = () => {
      if (i < worlds.length - 1) return setIndex(i + 1);
      void save([...worlds, { name: `World ${worlds.length + 1}`, levels: slots([]) }]);
      setIndex(worlds.length);
    };
    const remove = () => {
      if (worlds.length <= 1) return;
      void save(worlds.filter((_, k) => k !== i));
      setIndex(Math.max(0, i - 1));
    };

    const used = new Map<string, string>();
    worlds.forEach((w, k) => w.levels.forEach((l, s) => l && !used.has(l) && used.set(l, `W${k + 1}-${s + 1}`)));
    const options = [{ value: NONE, label: '— none —' }, ...levels.map((l) => ({ value: l.id, label: l.name && l.name !== l.id ? `${l.id} (${l.name})` : l.id }))];

    if (!world) return <div style={{ padding: 8, opacity: 0.7 }}>Loading…</div>;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 8, overflow: 'auto', minHeight: 0, height: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <ui.Button title="Previous world" aria-label="Previous world" disabled={i === 0} onClick={() => setIndex(i - 1)}>
            ◀
          </ui.Button>
          <div style={{ flex: '1 1 auto', minWidth: 0 }}>
            <ui.TextField key={`name${i}`} label="World name" value={world.name} onCommit={(v) => v.trim() && v !== world.name && update({ ...world, name: v.trim() })} />
          </div>
          <ui.Button title={i < worlds.length - 1 ? 'Next world' : 'Add a world'} aria-label="Next world" onClick={next}>
            {i < worlds.length - 1 ? '▶' : '＋'}
          </ui.Button>
        </div>
        <div style={{ fontSize: 12, opacity: 0.8, display: 'flex', justifyContent: 'space-between', gap: 6 }}>
          <span>
            World {i + 1} / {worlds.length}
          </span>
          <ui.Button title="Delete this world" aria-label="Delete world" disabled={worlds.length <= 1} onClick={remove}>
            Delete world
          </ui.Button>
        </div>
        {world.levels.map((l, s) => {
          const dup = l && used.get(l) !== `W${i + 1}-${s + 1}` ? used.get(l) : null;
          const missing = l && !levels.some((o) => o.id === l);
          return (
            <div key={`s${i}-${s}`} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                <ui.Select
                  label={`Level ${s + 1}`}
                  showLabel
                  value={l}
                  options={missing ? [...options, { value: l, label: `${l} (missing)` }] : options}
                  onChange={(v: string) => v !== l && update({ ...world, levels: world.levels.map((o, k) => (k === s ? v : o)) })}
                />
              </div>
              {dup ? <span style={{ fontSize: 11, color: '#ffb020', flex: 'none' }} title="This level is already used in another slot">⚠ {dup}</span> : null}
              {missing ? <span style={{ fontSize: 11, color: '#ff4d5e', flex: 'none' }}>⚠ missing</span> : null}
            </div>
          );
        })}
      </div>
    );
  }
  return { id: 'antsbattle.worlds', title: 'Worlds', icon: 'list', render: Worlds };
});
