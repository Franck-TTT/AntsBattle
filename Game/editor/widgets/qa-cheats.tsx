/**
 * QA Cheats: one-click buttons for the game's cheats (src/*.cheats.ts) — win, lose, jump to a level
 * or a wave, gold, lives, meta coins and stars. Starts Play when it is not running. Every button
 * goes through api.game.cheats.run, so sim cheats are recorded input like in the console.
 */
import { defineEditorWidget, type EditorModeApi } from '@gameengine/editor-api';

// Field values survive a re-dock (remount).
const memo = { level: 1, wave: 5, gold: 999, lives: 100_000, coins: 1000, stars: 10 };

export default defineEditorWidget(({ React, ui }) => {
  function QaCheats({ api }: { api: EditorModeApi }) {
    const play = api.play.useState();
    const [busy, setBusy] = React.useState(false);
    const [status, setStatus] = React.useState('');
    const [, redraw] = React.useState(0);
    const set = (k: keyof typeof memo, v: number) => {
      memo[k] = v;
      redraw((n) => n + 1);
    };

    async function run(label: string, id: string, args: Record<string, unknown> = {}) {
      setBusy(true);
      try {
        if (!api.play.state().playing) {
          setStatus('Starting Play…');
          await api.play.start();
        }
        await api.game.cheats.run(id, args);
        setStatus(`✓ ${label}`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setStatus(`✗ ${label}: ${msg}`);
        api.notify(`${label}: ${msg}`, 'error');
      } finally {
        setBusy(false);
      }
    }

    const btn = (label: string, id: string, args?: Record<string, unknown>, title?: string) => (
      <ui.Button key={label} disabled={busy} title={title ?? label} aria-label={label} onClick={() => void run(label, id, args)}>
        {label}
      </ui.Button>
    );
    const field = (k: keyof typeof memo, label: string) => (
      <div style={{ flex: '1 1 110px', minWidth: 0 }}>
        <ui.NumberField label={label} showLabel integer value={memo[k]} onCommit={(v) => set(k, Math.round(v))} />
      </div>
    );
    const section = (title: string, ...rows: unknown[]) => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontWeight: 700, opacity: 0.7, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
            {r as never}
          </div>
        ))}
      </div>
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 8, overflow: 'auto', minHeight: 0, height: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, opacity: 0.8 }}>{play.playing ? `● Play ${play.paused ? '(paused)' : 'running'}` : '○ Not playing (buttons start Play)'}</span>
          {!play.playing ? (
            <ui.Button disabled={busy} aria-label="Start Play" onClick={() => void api.play.start()}>
              ▶ Play
            </ui.Button>
          ) : null}
        </div>

        {section(
          'Result',
          <>
            {btn('Win ★', 'run.win', { stars: 1 })}
            {btn('Win ★★', 'run.win', { stars: 2 })}
            {btn('Win ★★★', 'run.win', { stars: 3 })}
            {btn('Lose', 'run.lose')}
          </>,
        )}

        {section(
          'Level',
          <>
            {field('level', 'Level (menu #)')}
            {btn('Go to level', 'level.goto', { level: memo.level }, 'Play this menu level; unlocks the ones before it')}
          </>,
          <>
            {btn('Unlock all ★', 'meta.unlockLevels', { stars: 1 })}
            {btn('Unlock all ★★★', 'meta.unlockLevels', { stars: 3 })}
          </>,
        )}

        {section(
          'Waves',
          <>
            {field('wave', 'Wave')}
            {btn('Go to wave', 'wave.goto', { wave: memo.wave }, 'Clears the board and starts this wave now')}
            {btn('Next wave', 'wave.next', {}, 'Starts the next wave now (and never lose)')}
          </>,
          <>
            {btn('Kill all ants', 'run.killAll')}
            {btn('Spawn 500 ants', 'swarm.spawn', { count: 500 })}
          </>,
        )}

        {section(
          'In-run',
          <>
            {field('gold', 'Gold')}
            {btn('Set gold', 'run.gold', { gold: memo.gold })}
          </>,
          <>
            {field('lives', 'Lives')}
            {btn('Set lives', 'run.lives', { lives: memo.lives })}
            {btn('God mode', 'run.lives', { lives: 100_000 }, '100000 lives')}
          </>,
        )}

        {section(
          'Meta',
          <>
            {field('coins', 'Coins')}
            {btn('Add coins', 'meta.coins', { coins: memo.coins })}
          </>,
          <>
            {field('stars', 'Stars')}
            {btn('Add stars', 'meta.stars', { stars: memo.stars }, 'Charges the Luxury roll')}
          </>,
          <>
            {btn('Max upgrades', 'meta.maxUpgrades')}
            {btn('Reset meta', 'meta.reset', {}, 'Coins, stars and upgrades back to zero')}
          </>,
        )}

        {status ? <div style={{ fontSize: 11, opacity: 0.8, wordBreak: 'break-word' }}>{status}</div> : null}
      </div>
    );
  }
  return { id: 'antsbattle.qaCheats', title: 'QA Cheats', icon: 'sliders', render: QaCheats };
});
