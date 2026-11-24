import { defineView, Widget } from '@gameengine/ui';

export interface EndModel {
  won: boolean;
  title: string;
  subtitle: string;
}

export const EndView = defineView<EndModel>({
  name: 'EndScreen',
  description: 'Victory or defeat, with a restart button. Intents: restart.',
  samples: {
    won: { won: true, title: 'VICTORY!', subtitle: 'All 10 waves held - 3 lives left' },
    lost: { won: false, title: 'OVERRUN', subtitle: 'They broke through on wave 6' },
  },
  render: (model, { intent }) => (
    <Widget
      doc="end-screen"
      props={{ result: () => (model().won ? 'won' : 'lost'), title: () => model().title, subtitle: () => model().subtitle }}
      onIntent={(_, e) => intent(e.path.at(-1)!)}
    />
  ),
});
