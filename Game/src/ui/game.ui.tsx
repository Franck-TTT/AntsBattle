/**
 * The game's UI controller: fills the HUD from the Run resource, shows the wave and boss
 * banners, flies coins from kills to the gold counter and opens the level menu and the end screen.
 * Presentation.
 */
import { createEffect, createSignal, defineUI, emit, onCleanup, onUiFrame, untrack, useResource, views } from '@gameengine/ui';
import { onSignal, worldToUi } from '@gameengine/runtime';
import { Board, EnemyKilled, LevelPicked, MenuRequested, RestartRequested, Run, WaveStarted } from '../schema.gen.ts';
import { WAVE_COUNT } from '../balance.ts';
import { DEFAULT_COLS, DEFAULT_ROWS, boardRect, hudY } from '../grid.ts';
import { HudView, type Flight, type HudModel } from '../views/hud.view.tsx';
import { BannerView, type BannerModel } from '../views/banner.view.tsx';
import { EndView } from '../views/end.view.tsx';
import { LevelMenuView } from '../views/level-menu.view.tsx';
import { menuLevels } from '../levels.ts';

const BANNER_SECONDS = 1.5;
/** Most coins in the air at once. */
const MAX_FLIGHTS = 24;

export const GameUI = defineUI({
  name: 'GameUI',
  root: () => {
    const run = useResource(Run);
    const board = useResource(Board);
    const [flights, setFlights] = createSignal<readonly Flight[]>([]);
    let nextFlight = 1;

    // The HUD sits in the band between the board and the tray (grid.ts HUD_BAND), at the level's size.
    const hudPoint = (): [number, number] => {
      const b = board();
      const cols = b?.cols || DEFAULT_COLS;
      const rows = b?.rows || DEFAULT_ROWS;
      return [boardRect(cols, rows).x, hudY(rows)];
    };
    const model = (): HudModel => {
      const r = run();
      return {
        wave: Math.max(1, r?.wave ?? 1),
        gold: r?.gold ?? 0,
        at: hudPoint(),
        flights: flights(),
      };
    };
    const hud = views.push(HudView, untrack(model), {
      onIntent: (name, payload) => {
        if (name === 'coinLanded') setFlights((fs) => fs.filter((f) => f.id !== payload));
      },
    });
    createEffect(() => hud.update(model()));

    onCleanup(
      onSignal(EnemyKilled, (s) => {
        if (untrack(flights).length >= MAX_FLIGHTS) return;
        const p = worldToUi(s.fields.x, s.fields.y);
        if (!p) return;
        setFlights((fs) => [...fs, { id: nextFlight++, x: p.x, y: p.y }]);
      }),
    );

    // Banners: "Wave X" at each wave start, "BOSS!" when the boss walks out.
    const banner = (m: BannerModel) => {
      const b = views.push(BannerView, m);
      let start = -1;
      const stop = onUiFrame((now) => {
        if (start < 0) start = now;
        if (now - start < BANNER_SECONDS) return;
        b.close();
        stop();
      });
    };
    onCleanup(
      onSignal(WaveStarted, (s) => {
        const n = s.fields.wave;
        const newNest = s.fields.newNest;
        banner({ title: `WAVE ${n}`, subtitle: newNest ? 'A new nest opened!' : n === WAVE_COUNT ? 'Final wave' : n === 1 ? 'Build the maze!' : 'Here they come', boss: false });
      }),
    );
    let bosses = untrack(() => run()?.bosses ?? 0);
    createEffect(() => {
      const b = run()?.bosses ?? 0;
      if (b > bosses) banner({ title: 'BOSS!', subtitle: 'Hold the line', boss: true });
      bosses = b;
    });

    // Level menu (the game opens on it) and end screen.
    const levels = menuLevels();
    let menu: { close(): void } | null = null;
    let end: { close(): void } | null = null;
    createEffect(() => {
      const phase = run()?.phase;
      if (phase === 'menu') {
        end?.close();
        end = null;
        menu ??= views.push(
          LevelMenuView,
          { levels: levels.map((l, i) => ({ key: l.id, number: i + 1, name: l.name })) },
          {
            onIntent: (name, id) => {
              const index = levels.findIndex((l) => l.id === id);
              if (name === 'pick' && index >= 0) emit(LevelPicked, { index });
            },
          },
        );
        return;
      }
      menu?.close();
      menu = null;
      if (phase === 'playing') {
        end?.close();
        end = null;
        bosses = untrack(() => run()?.bosses ?? 0);
        setFlights([]);
        return;
      }
      if (!phase || end) return;
      const r = untrack(run)!;
      const won = phase === 'won';
      end = views.push(
        EndView,
        {
          won,
          title: won ? 'VICTORY!' : 'OVERRUN',
          subtitle: won ? `All ${WAVE_COUNT} waves held - ${r.lives} ${r.lives === 1 ? 'life' : 'lives'} left` : `They broke through on wave ${r.wave}`,
        },
        {
          onIntent: (name) => {
            if (name === 'restart') emit(RestartRequested);
            if (name === 'menu') emit(MenuRequested);
          },
        },
      );
    });
    return [];
  },
});
