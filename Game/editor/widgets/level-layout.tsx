/**
 * Level Layout: paint a level — its board size, its nests, its base, and its pre-placed blocks
 * and weapons. Click places the picked block (its top-left cell under the cursor) or weapon, adds or
 * removes a nest, or moves the base; right-click or the eraser removes. Drops that would break a
 * layout rule (src/layout.ts) are refused; the ants' paths show live. Writes go through the command
 * bus (asset.setText), so undo, the check and hot reload see them. Fields this tool does not edit
 * (name, order, …) are kept as they are.
 */
import { defineEditorWidget, type EditorModeApi } from '@gameengine/editor-api';
import { COLS, DEFAULT_COLS, DEFAULT_ROWS, MAX_NESTS, MIN_COLS, MIN_ROWS, ROWS } from '../../src/grid.ts';
import { blockCells, checkLayout, layoutMarkers, layoutPaths, type LayoutBlock, type LayoutCell, type LayoutNest, type LayoutWeapon } from '../../src/layout.ts';
import { FLOW_COLORS } from '../../src/looks.ts';

const DIR = 'assets/levels';
const SUFFIX = '.level.json';
const ERASER = 'erase';
const NEST = 'nest';
const BASE = 'base';

/** The open level: the file's other fields as read, and the parts this tool edits. */
interface Level {
  raw: Record<string, unknown>;
  cols: number;
  rows: number;
  blocks: LayoutBlock[];
  weapons: LayoutWeapon[];
  nests: LayoutNest[];
  base: LayoutCell;
}

// Survive a re-dock (remount): the open file and the picked tool.
const memo = { path: '', tool: 'b1x1', played: '' };

const COLORS = {
  board: '#0b1020',
  grid: '#1d2640',
  path: '#3f8cff',
  block: '#3a4a6b',
  blockRim: '#8fa6d6',
  nest: '#3a1030',
  base: '#1e7a4a',
  ok: '#3fd17a',
  bad: '#ff4d5e',
  weapon: { tower: '#ffc51f', cannon: '#ff7a3f', frost: '#3fc8ff', mine: '#ff3b5c', boostPad: '#ffb020', mortar: '#4caf3f', flamethrower: '#ff5a1f', radar: '#5ee8ff', bank: '#ffc51f' } as Record<string, string>,
};

/** The file's text: its keys in their order, one list entry per line, so diffs stay readable. */
function formatLevel(l: Level): string {
  const doc: Record<string, unknown> = { ...l.raw, cols: l.cols, rows: l.rows, blocks: l.blocks, weapons: l.weapons, nests: l.nests, base: l.base };
  const inline = (v: unknown) => JSON.stringify(v).replace(/,"/g, ', "').replace(/":/g, '": ').replace(/^\{/, '{ ').replace(/\}$/, ' }');
  const value = (v: unknown) => (Array.isArray(v) ? (v.length ? `[\n${v.map((i) => `    ${inline(i)}`).join(',\n')}\n  ]` : '[]') : v && typeof v === 'object' ? inline(v) : JSON.stringify(v));
  return `{\n${Object.entries(doc).map(([k, v]) => `  ${JSON.stringify(k)}: ${value(v)}`).join(',\n')}\n}\n`;
}

function readLevel(raw: Record<string, unknown>): Level {
  const blocks = ((raw.blocks as LayoutBlock[] | undefined) ?? []).map((b) => ({ ...b }));
  const weapons = ((raw.weapons as LayoutWeapon[] | undefined) ?? []).map((w) => ({ ...w }));
  const cols = (raw.cols as number | undefined) ?? DEFAULT_COLS;
  const rows = (raw.rows as number | undefined) ?? DEFAULT_ROWS;
  const { nests, base } = layoutMarkers({ cols, rows, blocks, weapons, nests: raw.nests as LayoutNest[] | undefined, base: raw.base as LayoutCell | undefined });
  return { raw, cols, rows, blocks, weapons, nests, base };
}

const pathOf = (r: unknown): string[] => {
  const list = Array.isArray(r) ? r : ((r as { files?: unknown[] })?.files ?? []);
  return list.map((f) => (typeof f === 'string' ? f : String((f as { path?: string }).path ?? ''))).filter((p) => p.endsWith(SUFFIX)).sort();
};

export default defineEditorWidget(({ React, ui }) => {
  function LevelLayout({ api }: { api: EditorModeApi }) {
    const rev = api.assets.useRevision({ dir: DIR, suffixes: [SUFFIX] });
    const [files, setFiles] = React.useState<string[]>([]);
    const [path, setPathState] = React.useState(memo.path);
    const [tool, setToolState] = React.useState(memo.tool);
    const [level, setLevel] = React.useState<Level | null>(null);
    const [hash, setHash] = React.useState<string | undefined>(undefined);
    const [hover, setHover] = React.useState(-1);
    const [newId, setNewId] = React.useState('');
    const [sizeKey, setSizeKey] = React.useState(0);
    const setPath = (p: string) => ((memo.path = p), setPathState(p));
    const setTool = (t: string) => ((memo.tool = t), setToolState(t));

    const shapes = api.schema.enumValues('BlockShape');
    const weapons = api.schema.enumValues('ItemKind').filter((k) => k !== 'none' && k !== 'wall');

    // The level files, re-listed whenever one changes on disk.
    React.useEffect(() => {
      void api.query('project.listFiles', { dir: DIR, suffix: SUFFIX }).then((r) => {
        const list = pathOf(r);
        setFiles(list);
        if (!list.includes(memo.path) && list.length) setPath(list[0]!);
      });
    }, [rev]);

    // The open level, re-read whenever it changes on disk (an undo, an agent, another editor).
    React.useEffect(() => {
      if (!path) return;
      void api.query('asset.read', { path }).then((r) => {
        const res = r as { text?: string; json?: unknown; hash?: string };
        const raw = (res.json ?? (res.text ? JSON.parse(res.text) : null)) as Record<string, unknown> | null;
        if (!raw) return;
        setLevel(readLevel(raw));
        setHash(res.hash);
      }).catch((e: unknown) => api.notify(`Level Layout: cannot read ${path}: ${String(e)}`, 'error'));
    }, [path, rev]);

    const result = React.useMemo(() => (level ? checkLayout(level) : null), [level]);
    const paths = React.useMemo(() => (result ? layoutPaths(result) : null), [result]);
    const cellOf = (p: { col: number; row: number }) => p.row * COLS + p.col;
    const nestAt = (cell: number) => (level ? level.nests.findIndex((n) => cellOf(n) === cell) : -1);

    /** The level after clicking `cell` with the current tool (null: nothing to do). */
    const apply = (cell: number, erase: boolean): Level | null => {
      if (!level || !result) return null;
      const col = cell % COLS;
      const row = (cell / COLS) | 0;
      if (erase || tool === ERASER) {
        const w = result.weaponAt[cell]!;
        if (w >= 0) return { ...level, weapons: level.weapons.filter((_, i) => i !== w) };
        const n = nestAt(cell);
        if (n >= 0) return level.nests.length > 1 ? { ...level, nests: level.nests.filter((_, i) => i !== n) } : null;
        const b = result.blockAt[cell]!;
        if (b < 0) return null;
        const blk = level.blocks[b]!;
        const covered = new Set(blockCells(blk.shape, blk.col, blk.row, level.cols, level.rows) ?? []);
        return { ...level, blocks: level.blocks.filter((_, i) => i !== b), weapons: level.weapons.filter((wp) => !covered.has(cellOf(wp))) };
      }
      if (tool === BASE) return cellOf(level.base) === cell ? null : { ...level, base: { col, row } };
      if (tool === NEST) {
        const n = nestAt(cell);
        if (n >= 0) return level.nests.length > 1 ? { ...level, nests: level.nests.filter((_, i) => i !== n) } : null;
        const fromWave = level.nests.some((o) => o.fromWave === 1) ? Math.max(...level.nests.map((o) => o.fromWave)) + 3 : 1;
        return { ...level, nests: [...level.nests, { col, row, fromWave }] };
      }
      if (weapons.includes(tool)) {
        const w = result.weaponAt[cell]!;
        if (w >= 0) return level.weapons[w]!.kind === tool ? null : { ...level, weapons: level.weapons.map((wp, i) => (i === w ? { ...wp, kind: tool } : wp)) };
        return { ...level, weapons: [...level.weapons, { kind: tool, col, row }] };
      }
      return { ...level, blocks: [...level.blocks, { shape: tool, col, row }] };
    };

    /** Why an edit is refused (a rule it would newly break), or null when it keeps the level valid. */
    const refusal = (next: Level | null): string | null => {
      if (!next || !result) return null;
      const before = new Set(result.issues.map((i) => i.message));
      const added = checkLayout(next).issues.find((i) => !before.has(i.message));
      return added ? added.message : null;
    };

    const save = async (next: Level) => {
      setLevel(next); // show it at once; the re-read after the write confirms it
      try {
        const r = (await api.execute('asset.setText', { path, text: formatLevel(next), ...(hash ? { expectedHash: hash } : {}) })) as { hash?: string };
        if (r?.hash) setHash(r.hash);
        // Playing this level: restart the run on it once the game has the new file.
        if (memo.played === path && api.play.state().playing) setTimeout(() => void api.game.cheats.run('level.load', { level: path }).catch(() => {}), 400);
      } catch (e) {
        api.notify(`Level Layout: ${String(e)} (re-reading ${path})`, 'error');
        setHash(undefined);
      }
    };

    /** Saves `next` unless it breaks a rule the level kept until now. */
    const commit = (next: Level | null, check = true): boolean => {
      if (!next) return false;
      const why = check ? refusal(next) : null;
      if (why) {
        api.notify(`Refused: ${why}`, 'error');
        return false;
      }
      void save(next);
      return true;
    };

    const click = (cell: number, erase: boolean) => {
      if ((erase || tool === ERASER) && nestAt(cell) >= 0 && level?.nests.length === 1) return api.notify('Refused: a level keeps at least one nest', 'error');
      void commit(apply(cell, erase), !(erase || tool === ERASER));
    };

    /** Resizes the board (from its top-left corner); refused when something would fall off it. */
    const setSize = (cols: number, rows: number) => {
      if (!level || (cols === level.cols && rows === level.rows)) return;
      // A refused size puts the fields back on the level's (remount them with a new key).
      if (!commit({ ...level, cols: Math.round(cols), rows: Math.round(rows) })) setSizeKey((k: number) => k + 1);
    };

    const setNestWave = (n: number, wave: number) => {
      if (!level || level.nests[n]!.fromWave === wave) return;
      void commit({ ...level, nests: level.nests.map((o, i) => (i === n ? { ...o, fromWave: Math.round(wave) } : o)) });
    };

    const play = async () => {
      try {
        await api.play.start();
        await api.game.cheats.run('level.load', { level: path });
        memo.played = path;
      } catch (e) {
        api.notify(`Level Layout: cannot play ${path}: ${String(e)}`, 'error');
      }
    };

    const create = async () => {
      const id = newId.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
      if (!id) return;
      const p = `${DIR}/${id}${SUFFIX}`;
      const fresh = readLevel({ $type: 'LevelDef', id, name: id, order: files.length + 1 });
      try {
        await api.execute('asset.setText', { path: p, text: formatLevel(fresh), create: true });
        setNewId('');
        setPath(p);
      } catch (e) {
        api.notify(`Level Layout: cannot create ${p}: ${String(e)}`, 'error');
      }
    };

    // Hover ghost: the cells the click would fill, and whether it would be accepted.
    const ghost = React.useMemo(() => {
      if (hover < 0 || !level || tool === ERASER) return null;
      const isBlock = !weapons.includes(tool) && tool !== NEST && tool !== BASE;
      const cells = isBlock ? (blockCells(tool, hover % COLS, (hover / COLS) | 0, level.cols, level.rows) ?? [hover]) : [hover];
      const next = apply(hover, false);
      return { cells: new Set(cells), ok: !!next && !refusal(next) };
    }, [hover, tool, level, result]);

    const issueCells = new Set(result?.issues.flatMap((i) => i.cells) ?? []);
    const markerCells = new Set(level ? [cellOf(level.base), ...level.nests.map(cellOf)] : []);
    const at = (col: number, row: number, w = 1, h = 1) => ({ gridColumn: `${col + 1} / span ${w}`, gridRow: `${row + 1} / span ${h}` });
    const flow = (n: number) => FLOW_COLORS[n % FLOW_COLORS.length]!;

    const cells = [];
    for (let c = 0; c < COLS * ROWS && level; c++) {
      const col = c % COLS;
      const row = (c / COLS) | 0;
      if (col >= level.cols || row >= level.rows) continue;
      const g = ghost?.cells.has(c);
      cells.push(
        <button
          type="button"
          key={`c${c}`}
          title={`(${col}, ${row})`}
          aria-label={`Cell ${col},${row}`}
          onMouseEnter={() => setHover(c)}
          onMouseLeave={() => setHover((h: number) => (h === c ? -1 : h))}
          onClick={() => click(c, false)}
          onContextMenu={(e: { preventDefault(): void }) => (e.preventDefault(), click(c, true))}
          style={{
            ...at(col, row),
            border: `1px solid ${COLORS.grid}`,
            background: g ? (ghost!.ok ? `${COLORS.ok}55` : `${COLORS.bad}55`) : 'transparent',
            outline: issueCells.has(c) ? `2px solid ${COLORS.bad}` : 'none',
            outlineOffset: -2,
            cursor: 'pointer',
            padding: 0,
            margin: 0,
            minWidth: 0,
            minHeight: 0,
            borderRadius: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {paths?.[c] && !result?.cells[c] && !markerCells.has(c) ? <div style={{ width: '22%', height: '22%', borderRadius: '50%', background: COLORS.path, opacity: 0.7 }} /> : null}
        </button>,
      );
    }
    const marks = level
      ? [
          ...level.nests.map((n, i) => (
            <div key={`n${i}`} style={{ ...at(n.col, n.row), pointerEvents: 'none', margin: '10%', borderRadius: '30%', background: COLORS.nest, border: `2px solid ${flow(i)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff' }}>
              W{n.fromWave}
            </div>
          )),
          <div key="base" style={{ ...at(level.base.col, level.base.row), pointerEvents: 'none', margin: '8%', borderRadius: '30%', background: COLORS.base, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#fff' }}>
            Base
          </div>,
        ]
      : [];
    const blocks = (level?.blocks ?? []).map((b, i) => {
      const fp = level ? blockCells(b.shape, b.col, b.row, level.cols, level.rows) : null;
      if (!fp || result?.blockAt[fp[0]!] !== i) return null;
      const w = fp.filter((c) => c < fp[0]! + COLS).length;
      const h = fp.length / w;
      return <div key={`b${i}`} style={{ ...at(b.col, b.row, w, h), pointerEvents: 'none', margin: 3, borderRadius: 4, background: COLORS.block, border: `2px solid ${COLORS.blockRim}` }} />;
    });
    const guns = (level?.weapons ?? []).map((w, i) => {
      const c = cellOf(w);
      if (result?.weaponAt[c] !== i) return null;
      return (
        <div key={`w${i}`} style={{ ...at(w.col, w.row), pointerEvents: 'none', margin: '22%', borderRadius: '50%', background: COLORS.weapon[w.kind] ?? '#ccc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#000' }}>
          {w.kind[0]!.toUpperCase()}
        </div>
      );
    });

    const toolButton = (id: string, label: string) => (
      <ui.Button key={id} active={tool === id} title={label} aria-label={label} onClick={() => setTool(id)}>
        {label}
      </ui.Button>
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8, overflow: 'auto', minHeight: 0, height: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <div style={{ flex: '1 1 160px', minWidth: 0 }}>
            <ui.Select label="Level" value={path} options={files.map((f) => ({ value: f, label: f.slice(DIR.length + 1, -SUFFIX.length) }))} onChange={setPath} />
          </div>
          <div style={{ flex: '1 1 120px', minWidth: 0 }}>
            <ui.TextField label="New level id" placeholder="new level id" value={newId} onCommit={setNewId} />
          </div>
          <ui.Button title="Create the level" aria-label="Create level" disabled={!newId.trim()} onClick={() => void create()}>
            Create
          </ui.Button>
          <ui.Button title="Start Play on this level (edits restart the run)" aria-label="Play level" disabled={!level} onClick={() => void play()}>
            ▶ Play level
          </ui.Button>
        </div>
        {level ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ flex: '1 1 120px', minWidth: 0 }}>
              <ui.NumberField key={`cols${sizeKey}`} label={`Columns (${MIN_COLS}-${COLS})`} showLabel integer value={level.cols} onCommit={(v) => setSize(v, level.rows)} />
            </div>
            <div style={{ flex: '1 1 120px', minWidth: 0 }}>
              <ui.NumberField key={`rows${sizeKey}`} label={`Rows (${MIN_ROWS}-${ROWS})`} showLabel integer value={level.rows} onCommit={(v) => setSize(level.cols, v)} />
            </div>
          </div>
        ) : null}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {toolButton(NEST, 'nest')}
          {toolButton(BASE, 'base')}
          {shapes.map((s) => toolButton(s, s.slice(1)))}
          {weapons.map((w) => toolButton(w, w))}
          {toolButton(ERASER, 'eraser')}
        </div>
        {level ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${level.cols}, 1fr)`,
              gridTemplateRows: `repeat(${level.rows}, 1fr)`,
              aspectRatio: `${level.cols} / ${level.rows}`,
              width: `min(100%, calc(58vh * ${level.cols} / ${level.rows}))`,
              alignSelf: 'center',
              background: COLORS.board,
              borderRadius: 6,
              userSelect: 'none',
            }}
          >
            {cells}
            {marks}
            {blocks}
            {guns}
          </div>
        ) : (
          <div style={{ opacity: 0.7 }}>{files.length ? 'Loading…' : `No level yet: create one (files go to ${DIR}/).`}</div>
        )}
        {level ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {level.nests.map((n, i) => (
              <div key={`nw${i}`} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: flow(i), flex: 'none' }} />
                <ui.NumberField label={`Nest ${i + 1} wave`} showLabel integer value={n.fromWave} onCommit={(v) => setNestWave(i, v)} />
              </div>
            ))}
          </div>
        ) : null}
        {level ? (
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            {level.cols}×{level.rows} · {level.nests.length}/{MAX_NESTS} nests · {level.blocks.length} blocks · {level.weapons.length} weapons · click: place · right-click: remove (blocks and weapons are locked in game)
          </div>
        ) : null}
        {result?.issues.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12, color: COLORS.bad }}>
            {result.issues.map((i, k) => (
              <div key={`i${k}`}>⚠ {i.message}</div>
            ))}
          </div>
        ) : level ? (
          <div style={{ fontSize: 12, color: COLORS.ok }}>✓ Layout valid: every nest reaches the base</div>
        ) : null}
      </div>
    );
  }
  return { id: 'antsbattle.levelLayout', title: 'Level Layout', icon: 'grid', render: LevelLayout };
});
