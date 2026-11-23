#!/usr/bin/env node
// Makes a new game from this template, or updates one made earlier. One call does it all.
//
//   node template/setup.mjs <game-folder> [--values <file.json>] [--set NAME=value ...]
//        [--engine <game-engine checkout>] [--verify]
//
// A new (empty or missing) folder gets the template's committed files, its own Git repository with
// nothing committed, and the engine linked. A folder made earlier gets only what changed: new values
// (template/configure.mjs). Either way it then installs when the game declares packages and they
// changed, generates, and prints the changes, one per line, and the checklist. --verify also runs
// check --tests and the size budget, one line each.
//
// Exit codes: 0 done, 1 a check failed or a mandatory value is still missing, 2 refused (nothing changed).
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const template = join(dirname(fileURLToPath(import.meta.url)), '..');

function args(argv) {
  const out = { dest: null, pass: [], engine: join(template, 'game-engine'), verify: false, configureOnly: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--values') out.pass.push(a, resolve(argv[++i]));
    else if (a === '--set' || a === '--enable' || a === '--disable') out.pass.push(a, argv[++i]);
    else if (a === '--engine') out.engine = resolve(argv[++i]);
    else if (a === '--verify') out.verify = true;
    else if (a === '--configure-only') out.configureOnly = true;
    else if (!a.startsWith('--') && out.dest === null) out.dest = resolve(a);
    else throw Object.assign(new Error(`unknown argument ${a}`), { code: 2 });
  }
  if (!out.dest) throw Object.assign(new Error('usage: node template/setup.mjs <game-folder> [--values <file.json>] [--set NAME=value] [--verify]'), { code: 2 });
  return out;
}

/** Runs quietly. On failure, stops with the tail of the output. */
function run(label, cmd, argv, cwd) {
  const r = spawnSync(cmd, argv, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...(cmd === 'npm' && process.platform === 'win32' ? { shell: true } : {}) });
  if (r.status !== 0) {
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-15).join('\n');
    throw Object.assign(new Error(`${label} failed (exit ${r.status}):\n${out}`), { code: 1 });
  }
  return r.stdout ?? '';
}

function copyTemplate(dest, engine, displayName) {
  mkdirSync(dest, { recursive: true });
  if (existsSync(join(template, '.git'))) {
    const archive = execFileSync('git', ['archive', '--format=tar', 'HEAD'], { cwd: template, maxBuffer: 1 << 30 });
    execFileSync('tar', ['-x', '-C', dest], { input: archive });
  } else {
    cpSync(template, dest, { recursive: true, filter: (source) => !relative(template, source).split(/[\\/]/).some((part) => ['.git', 'node_modules', '.gameengine', 'game-engine'].includes(part)) });
  }
  symlinkSync(resolve(engine), join(dest, 'game-engine'), process.platform === 'win32' ? 'junction' : 'dir');
  for (const dir of ['.claude', '.agents']) rmSync(join(dest, dir, 'skills', 'create-game-from-template'), { recursive: true, force: true });
  // The tool's tests copy and configure the unconfigured template: in a game they can only fail. new-game
  // starts a game, so a game has no use for it.
  for (const f of ['new-game.mjs', 'new-game.sh']) rmSync(join(dest, 'template', f), { force: true });
  rmSync(join(dest, 'template', 'e2e'), { recursive: true, force: true });
  // The template's agent file starts a game. A game has no use for it.
  rmSync(join(dest, '_agents.md'), { force: true });
  writeFileSync(
    join(dest, 'README.md'),
    `# ${displayName}\n\nA Tactile Game Engine game, made from the Tactile Game Engine game template. The game project is\n\`Game/\`, the Build Server pipelines are in \`Build/\`. \`node template/setup.mjs . --set NAME=value\` adds a\nvalue not set yet, and \`node template/configure.mjs --check\` lists what is still missing (\`template/README.md\`).\n`,
  );
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dest });
}

function main() {
  const opts = args(process.argv.slice(2));
  const fresh = !existsSync(join(opts.dest, 'template', 'state.json'));
  if (fresh && existsSync(opts.dest) && readdirSync(opts.dest).length) throw Object.assign(new Error(`${opts.dest} is neither empty nor a game made from the template`), { code: 2 });
  if (fresh) {
    if (!existsSync(join(opts.engine, 'tools', 'cli', 'bin', 'gameengine.mjs'))) throw Object.assign(new Error(`no game-engine checkout at ${opts.engine} (pass --engine)`), { code: 2 });
    // Refused values leave no folder behind: they are checked against the template before the copy.
    const dry = spawnSync(process.execPath, [join(template, 'template', 'configure.mjs'), '--dry-run', ...opts.pass], { encoding: 'utf8' });
    if (dry.status !== 0) throw Object.assign(new Error(dry.stderr.trim()), { code: 2 });
    copyTemplate(opts.dest, opts.engine, JSON.parse(dry.stdout).values.DISPLAY_NAME);
    console.log(`made ${opts.dest}`);
  }
  const game = join(opts.dest, 'Game');
  const installed = existsSync(join(game, 'node_modules'));
  const pkgBefore = readFileSync(join(game, 'package.json'), 'utf8');
  const conf = spawnSync(process.execPath, ['template/configure.mjs', ...opts.pass], { cwd: opts.dest, encoding: 'utf8' });
  if (conf.status !== 0) throw Object.assign(new Error(conf.stderr.trim()), { code: 2 });
  process.stdout.write(conf.stdout);
  if (opts.configureOnly) return;
  const cli = ['../game-engine/tools/cli/bin/gameengine.mjs'];
  const pkgAfter = readFileSync(join(game, 'package.json'), 'utf8');
  if (Object.keys(JSON.parse(pkgAfter).dependencies ?? {}).length && (!installed || pkgBefore !== pkgAfter)) {
    run('npm install', 'npm', ['install', '--no-audit', '--no-fund', '--no-package-lock'], game);
    console.log('installed');
  }
  run('gameengine gen', process.execPath, [...cli, 'gen'], game);
  console.log('generated');
  run('gameengine skills update', process.execPath, [...cli, 'skills', 'update'], game);
  console.log('skills updated');
  if (opts.verify) {
    run('check --tests', process.execPath, [...cli, 'check', '--tests'], game);
    console.log('check --tests: passed');
    const size = run('npm run size', 'npm', ['run', '--silent', 'size'], game).trim().split('\n');
    console.log(`size: ${size.map((l) => l.replace(/\s+/g, ' ')).join(' | ')}`);
  }
  console.log('');
  const check = spawnSync(process.execPath, ['template/configure.mjs', '--check'], { cwd: opts.dest, stdio: 'inherit' });
  process.exit(check.status ?? 1);
}

try {
  main();
} catch (e) {
  console.error(e.message);
  process.exit(e.code ?? 1);
}
