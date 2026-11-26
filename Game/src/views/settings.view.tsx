/** The settings popup (ui/docs/settings.ui.json): the gear (top right in a run, on the level menu's top bar) opens it; in a run it pauses the game. */
import { defineView, Widget } from '@gameengine/ui';

export interface SettingsModel {
  sound: boolean;
  music: boolean;
  /** In a run: shows Back to menu (hidden on the level menu). */
  inRun: boolean;
}

export const SettingsView = defineView<SettingsModel>({
  name: 'Settings',
  description: 'Sound and music switches and a Back to menu button. Intents: sound (payload: on), music (payload: on), menu, close (close button or tap outside).',
  samples: {
    allOn: { sound: true, music: true, inRun: true },
    muted: { sound: false, music: false, inRun: true },
    menu: { sound: true, music: true, inRun: false },
  },
  render: (model, { intent }) => (
    <Widget
      doc="settings"
      props={{ sound: () => model().sound, music: () => model().music, inRun: () => model().inRun }}
      onIntent={(_, e) => {
        const key = e.path[0];
        if (key === 'sound' || key === 'music') intent(key, e.on === true);
        else if (key === 'menu') intent('menu');
        else intent('close');
      }}
    />
  ),
});
