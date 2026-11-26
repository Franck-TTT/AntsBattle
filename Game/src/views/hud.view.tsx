import { createSignal, defineView, drawnRect, For, onCleanup, onUiFrame, View, Widget, ui } from '@gameengine/ui';
import { worldToUi } from '@gameengine/runtime';

export interface Flight {
  id: number;
  /** Start, in UI reference px. */
  x: number;
  y: number;
}

export interface HudModel {
  wave: number;
  /** Waves of the level being played, shown as the counter's "/N". */
  waveCount: number;
  gold: number;
  /** World point the bar is centred on: above the tray (Panel.hudY). */
  at: [number, number];
  flights: readonly Flight[];
}

export const HudView = defineView<HudModel>({
  name: 'Hud',
  description: 'Wave counter at the top centre, gold just above the tray in the bottom panel (lives are shown on the base); coins fly from kills to the gold counter. Intents: coinLanded (payload: flight id), settings (the gear, top right like on the level menu).',
  samples: {
    start: { wave: 1, waveCount: 8, gold: 60, at: [0, 0], flights: [] },
    late: { wave: 7, waveCount: 8, gold: 1250, at: [0, 0], flights: [] },
  },
  render: (model, { intent }) => {
    // Keeps the bar centred on the band whatever the safe area does to its container: each frame,
    // the gap between the band's centre on screen and where the bar is drawn moves the bar by
    // that much. Writes only when off by more than half a pixel, so a still screen costs nothing.
    const [nudge, setNudge] = createSignal<[number, number]>([0, 0], { equals: (a, b) => a[0] === b[0] && a[1] === b[1] });
    onCleanup(
      onUiFrame(() => {
        const [x, y] = model().at;
        const want = worldToUi(x, y);
        const got = drawnRect('hud');
        if (!want || !got) return;
        const dx = want.x - (got.x + got.width / 2);
        const dy = want.y - (got.y + got.height / 2);
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) setNudge(([nx, ny]) => [nx + dx, ny + dy]);
      }),
    );
    return (
    <View class="hud-root">
      <Widget
        doc="hud-bar"
        id="hud"
        props={{ gold: () => model().gold }}
        follow={() => ({ point: model().at, offset: nudge() })}
      />
      <View class="hud-wave">
        <Widget doc="stat-chip" id="wave" props={{ caption: 'WAVE', amount: () => model().wave, suffix: () => `/${model().waveCount}`, tone: 'wave' }} />
      </View>
      <View class="hud-gear">
        <Widget doc="gear-button" id="settings" onIntent={() => intent('settings')} />
      </View>
      <View class="hud-flights">
        <For each={() => model().flights}>
          {(f) => (
            <View
              class="hud-coin"
              style={{ left: `${f.x}px`, top: `${f.y}px` }}
              ref={(n) => void ui.animateTo([n], { to: 'hud.gold.target', duration: 480, arc: 0.3, land: 0.6, easing: 'in-sine', onLand: () => intent('coinLanded', f.id) })}
            />
          )}
        </For>
      </View>
    </View>
    );
  },
});
