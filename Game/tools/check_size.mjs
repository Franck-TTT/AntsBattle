// Checks the cooked size budget (tests/budgets/size.json) for Android and iOS, the check a release
// build runs. `gameengine check` cooks for desktop only, so it can't catch a cook over budget, and
// builds 89 and 90 failed on one. A release dry-run per target: cook, then the budget. The Android
// artifact budget needs a real build and isn't checked here.
// Run from the project root after an asset change: `npm run size`.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cli = join(root, '..', 'game-engine', 'tools', 'cli', 'bin', 'gameengine.mjs');
const mb = (n) => `${(n / 1024 ** 2).toFixed(2)} MB`;

// A release refuses `env:` settings with no value. The size doesn't depend on a secret, so the dry
// run gets a stand-in for every one the environment lacks. The real build sets them.
const config = JSON.parse(readFileSync(join(root, 'project.gameengine.json'), 'utf8'));
const env = { ...process.env };
for (const name of JSON.stringify(config.services ?? {}).match(/"env:[A-Za-z0-9_]+"/g) ?? []) env[name.slice(5, -1)] ??= 'size-check';

let failed = false;
for (const target of ['android', 'ios']) {
  const run = spawnSync(process.execPath, [cli, 'build', target, '--config', 'release', '--dry-run', '--allow-pipeline-issues', '--json'], {
    cwd: root,
    env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  // The report is the last JSON line on stdout.
  const line = run.stdout.split('\n').reverse().find((l) => l.startsWith('{"ok"'));
  const report = line ? JSON.parse(line) : null;
  if (!report) {
    console.log(`${target}: no build report (exit ${run.status})\n${run.stderr.trim()}`);
    failed = true;
    continue;
  }
  for (const b of report.budgets ?? []) console.log(`${target}: ${b.over ? 'OVER' : 'ok  '} ${b.what} ${mb(b.bytes)} of ${mb(b.budget)}`);
  if (!report.ok) {
    console.log(`${target}: ${report.error}`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
