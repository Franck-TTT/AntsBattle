// id game/level-layout: every level layout (assets/**/*.level.json) follows the layout rules of src/layout.ts.
import { defineCheck } from '@gameengine/tools';
import { checkLayout, type Layout } from '../src/layout.ts';

export const levelLayout = defineCheck({
  name: 'level-layout',
  description: 'Level layouts have a valid size, nests and base, fit on their board, never overlap, keep weapons on blocks and leave every nest a path to the base',
  run(ctx) {
    for (const file of ctx.glob('assets/**/*.level.json')) {
      const text = ctx.read(file);
      if (text === null) continue;
      let layout: Layout;
      try {
        layout = JSON.parse(text) as Layout;
      } catch {
        ctx.fail(`${file} is not valid JSON`, { file });
        continue;
      }
      // The whole layout: its size, nests and base as well as its blocks and weapons.
      for (const issue of checkLayout({ ...layout, blocks: layout.blocks ?? [], weapons: layout.weapons ?? [] }).issues) {
        ctx.fail(`${file}: ${issue.message} (fix it in the Level Layout widget)`, { file });
      }
    }
  },
});
