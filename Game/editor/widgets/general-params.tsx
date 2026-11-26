/**
 * General Params: every value of the balancing sheet's General parameters tab, editable live.
 * An edit writes src/balance.tweaks.json through the bus (asset.setText); the game hot reloads with
 * the tweak on top of the sheet's value (src/balance.ts). Values read at run start (lives, gold,
 * first wave…) show from the next run: Restart run replays the level. Tweaks are temporary: copy
 * the ones you keep into the Google Sheet, sync, then Reset all (game/balance-tweaks warns until then).
 */
import { defineEditorWidget, type EditorModeApi } from '@gameengine/editor-api';
import { SHEET, type BalanceSheet } from '../../src/balance.sheet.ts';
import { POST_PROFILE, withPostValues } from '../../src/post-profile.ts';

type Key = keyof BalanceSheet['general'];
type Tweaks = Partial<Record<Key, number>>;

/** JSON, not TypeScript: the bus's asset.setText only writes JSON and a few asset kinds. */
const FILE = 'src/balance.tweaks.json';

/** The sheet's sections and labels, in the sheet's order; `start`: read when a run starts. */
const SECTIONS: { title: string; rows: { key: Key; label: string; int?: boolean; start?: boolean }[] }[] = [
  {
    title: 'Global settings',
    rows: [
      { key: 'startLives', label: 'Start Lives (before swarm scale)', int: true, start: true },
      { key: 'waveGap', label: 'Wave gap (s)' },
      { key: 'firstWaveAt', label: 'First wave at (s)', start: true },
      { key: 'hpPerWave', label: 'HP growth per wave' },
      { key: 'enemySpeed', label: 'Enemy speed multiplier' },
      { key: 'swarm', label: 'Swarm scale', int: true, start: true },
    ],
  },
  {
    title: 'Economy',
    rows: [
      { key: 'startGold', label: 'Start Gold', int: true, start: true },
      { key: 'freeWalls', label: 'Free walls', int: true },
      { key: 'wallStep', label: 'Wall cost step', int: true },
      { key: 'rerollBase', label: 'Reroll base price', int: true },
      { key: 'rerollStep', label: 'Reroll price step', int: true },
    ],
  },
  {
    title: 'Offer',
    rows: [
      { key: 'offerSize', label: 'Offer size', int: true, start: true },
      { key: 'singlePick', label: 'Single pick offers (0 off, 1 on)', int: true },
    ],
  },
  {
    title: 'Game feel',
    rows: [
      { key: 'dragSpeed', label: 'Drag game speed' },
      { key: 'speedRecovery', label: 'Speed recovery (per s)' },
      { key: 'moveGrace', label: 'Move grace window (s, 0 no limit)' },
    ],
  },
  {
    title: 'Roll animation',
    rows: [
      { key: 'spinFirstGap', label: 'Roll spin first gap (frames at 60 fps)' },
      { key: 'spinLastGap', label: 'Roll spin last gap (frames at 60 fps)' },
      { key: 'spinGrowth', label: 'Roll spin growth (gap x per step)' },
      { key: 'spinHold', label: 'Roll spin hold (s)' },
    ],
  },
  {
    title: 'Post effects',
    rows: [
      { key: 'caStrength', label: 'Chromatic aberration strength (px at 1080p)' },
      { key: 'caInner', label: 'Chromatic aberration inner (0 centre, 1 corner)' },
      { key: 'caOuter', label: 'Chromatic aberration outer (0 centre, 1 corner)' },
      { key: 'caInsetTop', label: 'Chromatic aberration inset top (screen heights)' },
      { key: 'caInsetBottom', label: 'Chromatic aberration inset bottom (screen heights)' },
      { key: 'caInsetLeft', label: 'Chromatic aberration inset left (screen widths)' },
      { key: 'caInsetRight', label: 'Chromatic aberration inset right (screen widths)' },
      { key: 'crtPeriod', label: 'CRT sweep period (s between two sweeps)' },
      { key: 'crtSweep', label: 'CRT sweep duration (s to cross the screen)' },
      { key: 'crtWidth', label: 'CRT sweep height (screen heights)' },
      { key: 'crtShift', label: 'CRT sweep jitter (px at 1080p)' },
      { key: 'crtSplit', label: 'CRT sweep colour split (px at 1080p)' },
      { key: 'crtGlow', label: 'CRT sweep glow (0 to 1)' },
    ],
  },
];
const LABEL = new Map(SECTIONS.flatMap((s) => s.rows.map((r) => [r.key, r.label] as const)));

function parseTweaks(text: string): Tweaks {
  try {
    return (JSON.parse(text || '{}') ?? {}) as Tweaks;
  } catch {
    return {};
  }
}
const renderTweaks = (t: Tweaks): string => `${JSON.stringify(t, null, 2)}\n`;
/** A number as the sheet (French locale) writes it. */
const sheetNumber = (v: number): string => String(v).replace('.', ',');

export default defineEditorWidget(({ React, ui }) => {
  function GeneralParams({ api }: { api: EditorModeApi }) {
    const rev = api.assets.useRevision({ dir: 'src', suffixes: ['balance.tweaks.json'] });
    const [tweaks, setTweaks] = React.useState<Tweaks>({});
    const [hash, setHash] = React.useState<string | undefined>(undefined);
    const [status, setStatus] = React.useState('');
    const play = api.play.useState();

    React.useEffect(() => {
      void api.query('asset.read', { path: FILE }).then((r) => {
        const res = r as { text?: string; hash?: string };
        setTweaks(parseTweaks(res.text ?? ''));
        setHash(res.hash);
      }).catch((e: unknown) => api.notify(`General Params: cannot read ${FILE}: ${String(e)}`, 'error'));
    }, [rev]);

    async function save(next: Tweaks, label: string) {
      try {
        const r = (await api.execute('asset.setText', { path: FILE, text: renderTweaks(next), ...(hash ? { expectedHash: hash } : {}) })) as { hash?: string };
        setTweaks(next);
        setHash(r?.hash);
        // Post effect values live in the post profile, not in the game code (src/post-profile.ts).
        const cur = (await api.query('asset.read', { path: POST_PROFILE })) as { text?: string; hash?: string };
        const profile = withPostValues(cur.text ?? '', { ...SHEET.general, ...next });
        if (profile) await api.execute('asset.setText', { path: POST_PROFILE, text: profile, ...(cur.hash ? { expectedHash: cur.hash } : {}) });
        setStatus(`✓ ${label}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setStatus(`✗ ${label}: ${msg}`);
        api.notify(`General Params: ${msg}`, 'error');
      }
    }

    const setValue = (key: Key, v: number) => {
      const next: Tweaks = { ...tweaks };
      if (v === SHEET.general[key]) delete next[key];
      else next[key] = v;
      void save(next, `${LABEL.get(key)} = ${v}`);
    };

    async function restart() {
      try {
        if (!api.play.state().playing) await api.play.start();
        await api.game.cheats.run('run.restart', {});
        setStatus('✓ Run restarted');
      } catch (e) {
        setStatus(`✗ Restart: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const changed = (Object.keys(tweaks) as Key[]).filter((k) => tweaks[k] !== undefined);
    const forSheet = changed.map((k) => `${LABEL.get(k)}\t${sheetNumber(tweaks[k]!)}`).join('\n');

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 8, overflow: 'auto', minHeight: 0, height: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <ui.Button disabled={!changed.length} aria-label="Reset all tweaks" title="Back to the sheet's values" onClick={() => void save({}, 'Reset all')}>
            Reset all
          </ui.Button>
          <ui.Button aria-label="Restart run" title="Replays the level so the start values (↻) apply" onClick={() => void restart()}>
            ↻ Restart run
          </ui.Button>
          <ui.Button
            disabled={!changed.length}
            aria-label="Copy tweaks for the sheet"
            title="Label and value per line, sheet format"
            onClick={() => void navigator.clipboard?.writeText(forSheet).then(() => setStatus('✓ Copied for the sheet'))}
          >
            Copy for sheet
          </ui.Button>
          <span style={{ fontSize: 11, opacity: 0.8 }}>{play.playing ? '● Play running' : '○ Not playing'}</span>
        </div>
        <div style={{ fontSize: 11, opacity: 0.75 }}>
          Live tweaks over the Google Sheet (not saved there). ↻: read when a run starts. {changed.length ? `${changed.length} tweaked.` : 'No tweak: the game plays the sheet.'}
        </div>
        {SECTIONS.map((s) => (
          <div key={s.title} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ fontWeight: 700, opacity: 0.7, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.title}</div>
            {s.rows.map((r) => {
              const sheet = SHEET.general[r.key];
              const tweaked = tweaks[r.key] !== undefined;
              const value = tweaked ? tweaks[r.key]! : sheet;
              return (
                <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <div style={{ flex: '1 1 0', minWidth: 0, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: tweaked ? 700 : 400 }} title={r.label}>
                    {r.start ? '↻ ' : ''}
                    {r.label}
                  </div>
                  <div style={{ width: 90, flex: 'none' }}>
                    <ui.NumberField label={r.label} value={value} integer={r.int} onCommit={(v) => setValue(r.key, r.int ? Math.round(v) : v)} />
                  </div>
                  <div style={{ width: 70, flex: 'none', fontSize: 11, opacity: tweaked ? 0.9 : 0.4 }} title="Value in the sheet">
                    {tweaked ? `sheet ${sheetNumber(sheet)}` : 'sheet'}
                  </div>
                  <ui.Button disabled={!tweaked} aria-label={`Reset ${r.label}`} title="Back to the sheet's value" onClick={() => setValue(r.key, sheet)}>
                    ⟲
                  </ui.Button>
                </div>
              );
            })}
          </div>
        ))}
        {status ? <div style={{ fontSize: 11, opacity: 0.8 }}>{status}</div> : null}
      </div>
    );
  }
  return { id: 'antsbattle.generalParams', title: 'General Params', icon: 'sliders', render: GeneralParams };
});
