import { defineView, Widget } from '@gameengine/ui';

export interface EndModel {
  won: boolean;
  title: string;
  subtitle: string;
  /** Meta coins and stars the run paid. */
  reward: string;
}

export const EndView = defineView<EndModel>({
  name: 'EndScreen',
  description: 'Victory or defeat, with restart and level menu buttons. Intents: restart, menu.',
  samples: {
    won: { won: true, title: 'VICTORY!', subtitle: 'All 10 waves held - 3 lives left', reward: '+70 coins · 3 stars (1 new)' },
    lost: { won: false, title: 'OVERRUN', subtitle: 'They broke through on wave 6', reward: '+20 coins' },
  },
  render: (model, { intent }) => (
    <Widget
      doc="end-screen"
      props={{ result: () => (model().won ? 'won' : 'lost'), title: () => model().title, subtitle: () => model().subtitle, reward: () => model().reward }}
      onIntent={(_, e) => intent(e.path.at(-1)!)}
    />
  ),
});
