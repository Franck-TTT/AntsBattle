/**
 * The settings popup's sim side: opening it pauses the run (GameSpeed reads SettingsMenu), and the
 * sound and music switches are kept in the persisted settings (src/settings.ts) and applied to the
 * mixer buses. Sim code.
 */
import { defineSystem, MetaLoaded, SetBusVolume, write, type SystemContext } from '@gameengine/runtime';
import { AudioSettingsChanged, SettingsMenu, SettingsToggled } from '../schema.gen.ts';
import { settings } from '../settings.ts';

export const ToggleSettings = defineSystem({
  name: 'ToggleSettings',
  before: ['GameSpeed', 'DragItems'],
  resources: [write(SettingsMenu)],
  events: [SettingsToggled],
  runIf: { event: SettingsToggled },
  run(ctx) {
    const all = ctx.events.read(SettingsToggled);
    ctx.set(SettingsMenu, { open: all[all.length - 1]!.open });
  },
});

function applyBuses(ctx: SystemContext): void {
  const s = settings.get();
  const sfx = s.sound ? 1 : 0;
  ctx.events.emit(SetBusVolume, { bus: 'SFX', volume: sfx, lowpass: 0, highpass: 0 });
  ctx.events.emit(SetBusVolume, { bus: 'UI', volume: sfx, lowpass: 0, highpass: 0 });
  ctx.events.emit(SetBusVolume, { bus: 'Music', volume: s.music ? 1 : 0, lowpass: 0, highpass: 0 });
}

/** Keeps the switches and sets the bus volumes: when the player changes them, and once the save has loaded. */
export const AudioSettings = defineSystem({
  name: 'AudioSettings',
  events: [AudioSettingsChanged, MetaLoaded],
  runIf: { any: [{ event: AudioSettingsChanged }, { event: MetaLoaded }] },
  run(ctx) {
    if (!settings.loaded()) return;
    for (const e of ctx.events.read(AudioSettingsChanged)) settings.dispatch('setAudio', { sound: e.sound, music: e.music }, ctx.time);
    applyBuses(ctx);
  },
});
