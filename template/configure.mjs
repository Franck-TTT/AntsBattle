#!/usr/bin/env node
// Fills a game's placeholders. Run through template/setup.mjs, which also installs and generates.
// Re-runnable: each run takes only the values that change.
//
//   node template/configure.mjs [--values <file.json>] [--set NAME=value ...]
//   node template/configure.mjs --check
//
// Values are placeholder names (template/placeholders.json, without the __TACTILE_ __ wrapper).
// Identity, signing and Build Server values are mandatory: a run that would leave one unknown is
// refused before anything changes. A value already set is not changed here: the run is refused, and
// it is changed by hand. --check prints the checklist and exits 1 while a mandatory value is missing.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(readFileSync(join(root, 'template', 'placeholders.json'), 'utf8'));
const statePath = join(root, 'template', 'state.json');
const SKIP_DIRS = new Set(['.git', 'node_modules', 'game-engine', '.gameengine', 'build']);
const TEXT = /\.(ts|tsx|mjs|js|json|ya?ml|md|css|py|txt|sh|gitignore)$|^[^.]+$/;
const placeholder = (name) => `__TACTILE_${name}__`;
const ANY_PLACEHOLDER = /__TACTILE_[A-Z0-9_]+__/g;
// The template's own tool, docs and tests name placeholders as text: filling them would break the tool's tests.
const NOT_SCANNED = new Set(['template/placeholders.json', 'template/state.json', 'template/configure.mjs', 'template/README.md']);
const isNotScanned = (path) => {
  const rel = relative(root, path).split('\\').join('/');
  return NOT_SCANNED.has(rel) || rel.startsWith('template/e2e/');
};

function textFiles(dir = root, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const s = statSync(path, { throwIfNoEntry: false });
    if (!s) continue;
    if (s.isDirectory()) {
      if (!SKIP_DIRS.has(name)) textFiles(path, out);
    } else if (TEXT.test(name) && !isNotScanned(path)) out.push(path);
  }
  return out;
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);

function args(argv) {
  const out = { values: {}, check: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--check') out.check = true;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--values') Object.assign(out.values, readJson(argv[++i]));
    else if (a === '--set') {
      const [name, ...rest] = argv[++i].split('=');
      out.values[name] = rest.join('=');
    } else if (a === '--enable' || a === '--disable') throw new Error(`unknown feature ${argv[i + 1]}: this template has no optional features`);
    else throw new Error(`unknown argument ${a}`);
  }
  return out;
}

/** Placeholder name -> files and lines where it is still unfilled. */
function unfilled() {
  const found = new Map();
  for (const file of textFiles()) {
    readFileSync(file, 'utf8')
      .split('\n')
      .forEach((line, i) => {
        for (const m of line.matchAll(ANY_PLACEHOLDER)) {
          const name = m[0].slice('__TACTILE_'.length, -2);
          if (!found.has(name)) found.set(name, []);
          found.get(name).push(`${relative(root, file)}:${i + 1}`);
        }
      });
  }
  return found;
}

function validate(values) {
  const known = new Map(registry.placeholders.map((p) => [p.name, p]));
  const errors = [];
  for (const [name, value] of Object.entries(values)) {
    const p = known.get(name);
    if (!p) errors.push(`${name}: not a template placeholder`);
    else if (p.fromValue) errors.push(`${name}: set ${p.fromValue} instead, it fills this`);
    else if (typeof value !== 'string' || value === '') errors.push(`${name}: empty`);
    else if (p.pattern && !new RegExp(p.pattern).test(value)) errors.push(`${name}: '${value}' does not match ${p.pattern} (e.g. ${p.example})`);
  }
  if (errors.length) throw new Error(`invalid values:\n  ${errors.join('\n  ')}`);
}

/** The values with each choice value (STORE_ACCOUNT) expanded into the values it fills. */
function expand(values) {
  const out = { ...values };
  for (const p of registry.placeholders) if (p.choices && values[p.name] !== undefined) {
    const { label: _label, ...fills } = p.choices[values[p.name]];
    Object.assign(out, fills);
  }
  return out;
}

/** Fills a placeholder: JSON-escaped inside double quotes (JSON, TypeScript, YAML), as written elsewhere. */
const fill = (text, name, value) => text.split(`"${placeholder(name)}"`).join(JSON.stringify(value)).split(placeholder(name)).join(value);

/** Fills a placeholder in every text file. Returns the files changed. */
function fillEverywhere(name, value) {
  const changed = [];
  for (const file of textFiles()) {
    const text = readFileSync(file, 'utf8');
    const next = fill(text, name, value);
    if (next !== text) {
      writeFileSync(file, next);
      changed.push(relative(root, file));
    }
  }
  return changed;
}

function configure(opts) {
  validate(opts.values);
  const values = expand(opts.values);
  const saved = existsSync(statePath) ? readJson(statePath) : { values: {} };
  const known = new Set([...Object.keys(saved.values ?? {}), ...Object.keys(values)]);
  const missing = registry.placeholders.filter((p) => registry.features[p.feature]?.required && !known.has(p.name));
  if (missing.length) throw new Error(`mandatory values missing, nothing changed:\n  ${missing.map((p) => `${p.name}: ${p.howToGet}`).join('\n  ')}`);
  // A value already set can't be changed here: the same string can stand for several placeholders
  // (GAME_NAME, APPSIGNING_NAME, BUILD_SERVER_PROJECT) and for the game's own code, so no replace
  // can tell which occurrence is this value's.
  const changed = Object.entries(values).filter(([n, v]) => saved.values?.[n] !== undefined && saved.values[n] !== v);
  if (changed.length)
    throw new Error(`already set, nothing changed. Change these by hand in the files that hold them, and in template/state.json:\n  ${changed.map(([n]) => `${n}: '${saved.values[n]}'`).join('\n  ')}`);
  if (opts.dryRun) return console.log(JSON.stringify({ values }));
  const log = [];
  const all = { ...(saved.values ?? {}) };
  for (const [name, value] of Object.entries(values)) {
    if (all[name] === value) continue;
    const files = fillEverywhere(name, value);
    all[name] = value;
    log.push(`set  ${name} (${files.length} file${files.length === 1 ? '' : 's'})`);
  }
  writeJson(statePath, { values: all });
  console.log(log.length ? log.join('\n') : 'nothing changed');
}

function check() {
  const saved = existsSync(statePath) ? readJson(statePath) : null;
  const left = unfilled();
  const known = new Set(Object.keys(saved?.values ?? {}));
  const rows = [];
  let blocking = false;
  for (const [name, f] of Object.entries(registry.features)) {
    const missing = registry.placeholders.filter((p) => p.feature === name && (left.has(p.name) || !known.has(p.name)));
    if (missing.length) {
      if (f.required) blocking = true;
      rows.push([f.title, 'missing', missing.map((p) => `${p.name}: ${p.howToGet}`).join('\n')]);
    } else rows.push([f.title, 'configured', '']);
  }
  const strays = [...left.keys()].filter((n) => !registry.placeholders.some((p) => p.name === n));
  for (const n of strays) rows.push([`Unregistered ${n}`, 'missing', `${left.get(n).join(', ')}: add it to template/placeholders.json`]);
  const width = [0, 1].map((i) => Math.max(...rows.map((r) => r[i].length), i ? 'Status'.length : 'Feature'.length));
  const line = (a, b, c) => `${a.padEnd(width[0])}  ${b.padEnd(width[1])}  ${c}`;
  console.log(line('Feature', 'Status', 'What to do'));
  for (const [a, b, c] of rows) {
    const [first, ...rest] = c.split('\n');
    console.log(line(a, b, first));
    for (const r of rest) console.log(line('', '', r));
  }
  return blocking ? 1 : 0;
}

try {
  const opts = args(process.argv.slice(2));
  if (opts.check) process.exit(check());
  configure(opts);
} catch (e) {
  console.error(e.message);
  process.exit(2);
}
