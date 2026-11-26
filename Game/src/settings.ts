/**
 * The player's settings, kept between sessions: sound effects and music on or off. One persisted
 * document, changed only by the settings popup (AudioSettingsChanged, src/sim/settings.ts).
 */
import { defineMeta } from '@gameengine/meta';
import { metaInWorld } from '@gameengine/meta/world';

export interface SettingsState {
  /** Sound effects (SFX and UI buses). */
  sound: boolean;
  /** Music (Music bus). */
  music: boolean;
}

const INITIAL: SettingsState = { sound: true, music: true };

export const settingsMeta = defineMeta({
  name: 'settings',
  version: 1,
  initial: INITIAL,
  actions: {
    setAudio: (s: SettingsState, p: { sound: boolean; music: boolean }) => ({ ...s, sound: p.sound, music: p.music }),
  },
});

export const settings = metaInWorld(settingsMeta, { persist: true });
