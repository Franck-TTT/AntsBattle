import { createSignal, defineView, onCleanup, onUiFrame, View, Widget } from '@gameengine/ui';
import { worldToUi } from '@gameengine/runtime';

export interface BannerModel {
  title: string;
  subtitle: string;
  boss: boolean;
  /** World point the banner is centred on (the board's centre, so it never covers the side panel); absent: the screen's centre. */
  at?: [number, number];
}

/** The box the banner is centred in, around the board's centre, in UI reference px (wider than any banner). */
const BOX_W = 1400;
const BOX_H = 700;

export const BannerView = defineView<BannerModel>({
  name: 'WaveBanner',
  description: 'A short "Wave X" banner when a wave starts, centred on the board; the boss wave gets its own tone. No intents.',
  layer: 'overlay',
  samples: {
    normal: { title: 'WAVE 4', subtitle: 'Here they come', boss: false },
    boss: { title: 'BOSS!', subtitle: 'Wave 10 - hold the line', boss: true },
  },
  render: (model) => {
    // The board's centre on screen, read each frame (it moves when the screen turns); writes only
    // when it moved by more than half a pixel, so a still banner costs nothing.
    const [centre, setCentre] = createSignal<[number, number] | null>(null, { equals: (a, b) => (a && b ? Math.abs(a[0] - b[0]) < 0.5 && Math.abs(a[1] - b[1]) < 0.5 : a === b) });
    onCleanup(
      onUiFrame(() => {
        const at = model().at;
        const p = at ? worldToUi(at[0], at[1]) : null;
        setCentre(p ? [p.x, p.y] : null);
      }),
    );
    const box = (): Record<string, string> => {
      const c = centre();
      return c ? { position: 'absolute', left: `${c[0] - BOX_W / 2}px`, top: `${c[1] - BOX_H / 2}px`, width: `${BOX_W}px`, height: `${BOX_H}px` } : { width: '100%', height: '100%' };
    };
    return (
      <View class="banner-root">
        <View style={box}>
          <Widget doc="wave-banner" props={{ title: () => model().title, subtitle: () => model().subtitle, tone: () => (model().boss ? 'boss' : 'normal') }} />
        </View>
      </View>
    );
  },
});
