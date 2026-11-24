import { defineView, For, View, Widget, ui } from '@gameengine/ui';

export interface Flight {
  id: number;
  /** Start, in UI reference px. */
  x: number;
  y: number;
}

export interface HudModel {
  wave: number;
  gold: number;
  lives: number;
  walls: number;
  flights: readonly Flight[];
}

export const HudView = defineView<HudModel>({
  name: 'Hud',
  description: 'Wave, gold, lives and free walls; coins fly from kills to the gold counter. Intents: coinLanded (payload: flight id).',
  samples: {
    start: { wave: 1, gold: 60, lives: 10, walls: 8, flights: [] },
    late: { wave: 9, gold: 1250, lives: 3, walls: 0, flights: [] },
  },
  render: (model, { intent }) => (
    <View class="hud-root">
      <Widget
        doc="hud"
        props={{ wave: () => model().wave, gold: () => model().gold, lives: () => model().lives, walls: () => model().walls }}
      />
      <View class="hud-flights">
        <For each={() => model().flights}>
          {(f) => (
            <View
              class="hud-coin"
              style={{ left: `${f.x}px`, top: `${f.y}px` }}
              ref={(n) => void ui.animateTo([n], { to: 'gold.target', duration: 480, arc: 0.3, land: 0.6, easing: 'in-sine', onLand: () => intent('coinLanded', f.id) })}
            />
          )}
        </For>
      </View>
    </View>
  ),
});
