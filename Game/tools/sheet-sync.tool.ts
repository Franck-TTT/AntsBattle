// Pulls the balancing Google Sheet into src/balance.sheet.ts (read by src/balance.ts).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineTool } from '@gameengine/tools';
import { OUT, SHEET_URL, TABS, diff, downloadTab, parseCsv, parseSheet, readEnums, readGenerated, render, type Grid, type TabKey } from './balance-sheet.ts';

function readTabFromDir(dir: string, key: TabKey): Grid {
  const name = TABS[key].name;
  const json = join(dir, `${name}.json`);
  if (existsSync(json)) {
    const parsed = JSON.parse(readFileSync(json, 'utf8')) as { values?: unknown[][] } | unknown[][];
    const values = Array.isArray(parsed) ? parsed : (parsed.values ?? []);
    return values.map((row) => row.map((c) => (c === null || c === undefined ? '' : String(c))));
  }
  const csv = join(dir, `${name}.csv`);
  if (existsSync(csv)) return parseCsv(readFileSync(csv, 'utf8'));
  throw new Error(`No "${name}.json" or "${name}.csv" in ${dir}`);
}

export const sheetSync = defineTool({
  name: 'sheet-sync',
  description:
    'Pulls the balancing Google Sheet (weapons, units, waves, offers, general parameters) into src/balance.sheet.ts, which src/balance.ts reads, and returns the values that changed. Writes that file unless preview is set. Use after the sheet was edited. The sheet must be viewable by link, or pass dir with the tabs exported as "<tab name>.csv" or ".json" ({"values": [[...]]}).',
  params: {
    dir: { type: 'string', description: 'Read the tabs from this folder instead of downloading them' },
    preview: { type: 'boolean', default: false, description: 'Only list the changes, write nothing' },
  },
  async run(args, ctx) {
    const tabs = {} as Record<TabKey, Grid>;
    for (const key of Object.keys(TABS) as TabKey[]) {
      tabs[key] = args.dir ? readTabFromDir(join(ctx.project, args.dir), key) : await downloadTab(key);
    }
    const enums = readEnums(readFileSync(join(ctx.project, 'schema.gen.json'), 'utf8'));
    const data = parseSheet(tabs, enums);

    const path = join(ctx.project, OUT);
    const before = existsSync(path) ? readGenerated(readFileSync(path, 'utf8')) : null;
    const changes = before ? diff(before.data, data) : [`${OUT} created`];
    const write = !args.preview && (changes.length > 0 || !before || before.hash !== before.actual);
    if (write) writeFileSync(path, render(data));
    ctx.log(changes.length ? `${changes.length} value(s) changed` : 'No value changed');
    return { sheet: SHEET_URL, file: OUT, written: write, waves: data.waves.length, changes };
  },
});
