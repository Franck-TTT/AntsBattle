import { defineView, Widget } from '@gameengine/ui';

export interface LevelMenuItem {
  /** The level's id (LevelDef.id). */
  key: string;
  number: number;
  name: string;
}

export interface LevelMenuModel {
  levels: readonly LevelMenuItem[];
}

export const LevelMenuView = defineView<LevelMenuModel>({
  name: 'LevelMenu',
  description: 'The level menu: one button per level. Intents: pick (payload: the level id).',
  samples: {
    two: { levels: [{ key: 'level-01', number: 1, name: 'Open Field' }, { key: 'demo', number: 2, name: 'Fortified' }] },
    many: {
      levels: Array.from({ length: 12 }, (_, i) => ({ key: `l${i + 1}`, number: i + 1, name: i % 3 === 2 ? 'A Much Longer Level Name' : `Level ${i + 1}` })),
    },
  },
  render: (model, { intent }) => (
    <Widget doc="level-menu" props={{ levels: () => model().levels }} onIntent={(_, e) => e.item && intent('pick', e.item)} />
  ),
});
