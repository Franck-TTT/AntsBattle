import { renderTest } from './play.ts';
renderTest('settings shot', async ({ step, input, ui, screenshot }) => {
  input.view(393, 852, 3, [0, 59, 0, 34]);
  await step(20);
  await screenshot('.gameengine/tmp/hud-game.png');
  await ui.press('hud.settings');
  await step(20);
  await screenshot('.gameengine/tmp/settings-game.png');
});
