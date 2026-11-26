// id game/balance-sheet: src/balance.sheet.ts holds what sheet-sync wrote, not hand edits.
import { defineCheck } from '@gameengine/tools';
import { OUT, readGenerated } from './balance-sheet.ts';
import { POST_PROFILE, withPostValues } from '../src/post-profile.ts';

export const balanceSheet = defineCheck({
  name: 'balance-sheet',
  description: 'The balance values in src/balance.sheet.ts come from the Google Sheet (no hand edits)',
  run(ctx) {
    const text = ctx.read(OUT);
    if (text === null) return ctx.fail(`${OUT} is missing: run \`gameengine tool sheet-sync\``);
    const got = readGenerated(text);
    if (!got) return ctx.fail(`${OUT} is not a file sheet-sync wrote: run \`gameengine tool sheet-sync\``, { file: OUT });
    if (got.hash !== got.actual) {
      ctx.fail(`${OUT} was edited by hand: make the change in the balancing Google Sheet, then run \`gameengine tool sheet-sync\``, { file: OUT });
    }
    // The post effect values in the post profile follow the sheet and the live tweaks (src/post-profile.ts).
    const profile = ctx.read(POST_PROFILE);
    if (profile === null) return ctx.fail(`${POST_PROFILE} is missing`);
    let tweaks = {};
    try {
      tweaks = JSON.parse(ctx.read('src/balance.tweaks.json') || '{}') as object;
    } catch {
      // game/balance-tweaks reports a broken tweaks file.
    }
    if (withPostValues(profile, { ...got.data.general, ...tweaks }) !== null) {
      ctx.fail(`${POST_PROFILE}: the post effect values differ from the sheet's General parameters (and live tweaks): run \`gameengine tool sheet-sync\``, { file: POST_PROFILE });
    }
  },
});
