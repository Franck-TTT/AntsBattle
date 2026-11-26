import { expect, renderTest as menuRenderTest } from '@gameengine/test';
import { renderTest, worldTest } from './play.ts';
import { AudioSettingsChanged, MenuRequested, Run, SettingsMenu, SettingsToggled } from '../src/schema.gen.ts';
import { settings } from '../src/settings.ts';

const PHONE: [number, number, number, [number, number, number, number]] = [393, 852, 3, [0, 59, 0, 34]];

worldTest('the settings popup pauses the run; closing it resumes', async ({ world, step, input }) => {
  await step(30);
  input.emit(SettingsToggled, { open: true });
  await step(2);
  expect(world.resource(SettingsMenu).open).toBe(true);
  const time = world.resource(Run).time;
  await step(30);
  expect(world.resource(Run).speed).toBe(0);
  expect(world.resource(Run).time).toBe(time);

  input.emit(SettingsToggled, { open: false });
  await step(30);
  expect(world.resource(SettingsMenu).open).toBe(false);
  expect(world.resource(Run).speed).toBe(1);
  expect(world.resource(Run).time).toBeGreaterThan(time);
});

worldTest('sound and music switches are kept in the settings', async ({ step, input }) => {
  await step(5);
  expect(settings.loaded()).toBe(true);
  expect(settings.get()).toEqual({ sound: true, music: true });
  input.emit(AudioSettingsChanged, { sound: false, music: true });
  await step(2);
  expect(settings.get()).toEqual({ sound: false, music: true });
  input.emit(AudioSettingsChanged, { sound: false, music: false });
  await step(2);
  expect(settings.get()).toEqual({ sound: false, music: false });
});

worldTest('Back to menu from the settings leaves the run and closes the popup', async ({ world, step, input }) => {
  await step(5);
  input.emit(SettingsToggled, { open: true });
  await step(2);
  input.emit(MenuRequested, {});
  await step(2);
  expect(world.resource(Run).phase).toBe('menu');
  expect(world.resource(SettingsMenu).open).toBe(false);
});

renderTest('the HUD gear opens the settings popup; its switches and close button work', async ({ world, step, input, ui }) => {
  input.view(...PHONE);
  await step(10);
  await ui.press('settings');
  await step(3);
  expect(world.resource(SettingsMenu).open).toBe(true);
  await ui.press('sound');
  await step(3);
  expect(settings.get().sound).toBe(false);
  await ui.press('close');
  await step(3);
  expect(world.resource(SettingsMenu).open).toBe(false);
});

menuRenderTest('the level menu gear opens the settings popup, with no Back to menu', async ({ world, step, input, ui }) => {
  input.view(...PHONE);
  await step(10);
  expect(world.resource(Run).phase).toBe('menu');
  await ui.press('topbar.settings');
  await step(3);
  expect(world.resource(SettingsMenu).open).toBe(true);
  expect(ui.interactables().some((n) => n.id === 'menu')).toBe(false);
  await ui.press('close');
  await step(3);
  expect(world.resource(SettingsMenu).open).toBe(false);
});
