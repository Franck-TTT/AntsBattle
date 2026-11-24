// id game/balance-sheet: src/balance.sheet.ts holds what sheet-sync wrote, not hand edits.
import { defineCheck } from '@gameengine/tools';
import { OUT, readGenerated } from './balance-sheet.ts';

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
  },
});
