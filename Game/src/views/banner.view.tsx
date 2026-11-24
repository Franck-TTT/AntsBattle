import { defineView, Widget } from '@gameengine/ui';

export interface BannerModel {
  title: string;
  subtitle: string;
  boss: boolean;
}

export const BannerView = defineView<BannerModel>({
  name: 'WaveBanner',
  description: 'A short "Wave X" banner when a wave starts; the boss wave gets its own tone. No intents.',
  layer: 'overlay',
  samples: {
    normal: { title: 'WAVE 4', subtitle: 'Here they come', boss: false },
    boss: { title: 'BOSS!', subtitle: 'Wave 10 - hold the line', boss: true },
  },
  render: (model) => (
    <Widget doc="wave-banner" props={{ title: () => model().title, subtitle: () => model().subtitle, tone: () => (model().boss ? 'boss' : 'normal') }} />
  ),
});
