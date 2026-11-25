/** Probe (reports only): the size-test levels load clean and play out with no player input. */
import { worldTest } from './play.ts';
import { Board, Enemy, Run } from '../src/schema.gen.ts';
import { LoadLevel } from '../src/level.cheats.ts';
import { checkLayout } from '../src/layout.ts';
import l1 from '../assets/levels/size-small-5x7.level.json';
import l2 from '../assets/levels/size-compact-6x9.level.json';
import l3 from '../assets/levels/level-01.level.json';
import l4 from '../assets/levels/size-big-8x12.level.json';
import l5 from '../assets/levels/size-max-10x14.level.json';
const JSONS: Record<string, any> = { 'size-small-5x7': l1, 'size-compact-6x9': l2, 'level-01': l3, 'size-big-8x12': l4, 'size-max-10x14': l5 };

const LEVELS = ['size-small-5x7', 'size-compact-6x9', 'level-01', 'size-big-8x12', 'size-max-10x14'];

for (const id of LEVELS) {
  worldTest(`probe size: ${id}`, async (t) => {
    t.input.view(390, 844, 3, [0, 47, 0, 34]);
    await t.step(2);
    const path = `assets/levels/${id}.level.json`;
    await t.cheat(LoadLevel, { level: path });
    await t.step(3);
    const b = t.world.resource(Board);
    const issues = checkLayout(JSONS[id]).issues.map((i) => i.message);
    const log: string[] = [`[${id}] ${b.cols}x${b.rows} pathLen=${b.pathLen} issues=${JSON.stringify(issues)}`];
    for (let s = 15; s <= 120; s += 15) {
      await t.step(15 * 60);
      const r = t.world.resource(Run);
      log.push(`  t=${s}s phase=${r.phase} wave=${r.wave} lives=${r.lives} gold=${r.gold} ants=${t.world.entities(Enemy).length}`);
      if (r.phase !== 'playing') break;
    }
    console.log(log.join('\n'));
  });
}
