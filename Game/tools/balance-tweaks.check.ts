// id game/balance-tweaks: live tweaks from the Tune + Play mode are temporary; the sheet holds the values.
import { defineCheck } from '@gameengine/tools';

const FILE = 'src/balance.tweaks.json';

export const balanceTweaks = defineCheck({
  name: 'balance-tweaks',
  description: "No live tweak left over the balancing sheet's General parameters (src/balance.tweaks.json)",
  run(ctx) {
    const text = ctx.read(FILE);
    if (text === null) return ctx.fail(`${FILE} is missing: it holds the live tweaks ({} when nothing is tweaked)`);
    let keys: string[] = [];
    try {
      keys = Object.keys(JSON.parse(text) as object);
    } catch {
      return ctx.fail(`${FILE} is not valid JSON (edit it from the Tune + Play mode)`, { file: FILE });
    }
    if (keys.length) {
      ctx.warn(`${keys.length} live tweak(s) over the sheet (${keys.join(', ')}): copy them into the Google Sheet and sync, then Reset all in the Tune + Play mode`, { file: FILE });
    }
  },
});
