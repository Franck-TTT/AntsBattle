// The balancing Google Sheet ("Ants battle balancing") as typed game data: parses its tabs, checks
// them against the schema's enums and renders src/balance.sheet.ts. Shared by the sheet-sync tool
// and the balance-sheet check.
//
// Sheet conventions (see the sheet itself):
// - Rows whose label starts with "@" or ends with ">" are titles for people and are skipped.
// - Text in parentheses in a label is a unit or a hint, ignored when matching ("Cooldown (s)").
// - Weapons and Units: one column per entry, its id (a dropdown from _Enums) in row 1.
// - Waves and Offers: one row per entry, columns named in row 1.
import { createHash } from 'node:crypto';

export const SHEET_ID = '1MwWoXQ96KbL_xSVf_P2YX7napk90BDMLbGvXpz9_k0s';
export const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`;
export const OUT = 'src/balance.sheet.ts';

/** Tabs read, with their gid (the number after #gid= in the sheet's URL). */
export const TABS = {
  general: { name: 'General parameters', gid: 0 },
  weapons: { name: 'Weapons', gid: 545939661 },
  units: { name: 'Units', gid: 358514479 },
  waves: { name: 'Waves', gid: 1100000001 },
  offers: { name: 'Offers', gid: 1100000002 },
  meta: { name: 'Meta', gid: 1100000003 },
  rarities: { name: 'Rarities', gid: 1100000004 },
  upgrades: { name: 'Upgrades', gid: 1100000005 },
} as const;
export type TabKey = keyof typeof TABS;
export type Grid = string[][];

type Kind = 'num' | 'int' | 'bool' | 'text';
interface Field { key: string; kind: Kind }

/** General parameters: sheet label (lower case, no parentheses) → field. */
const GENERAL: Record<string, Field> = {
  'start lives': { key: 'startLives', kind: 'int' },
  'wave gap': { key: 'waveGap', kind: 'num' },
  'first wave at': { key: 'firstWaveAt', kind: 'num' },
  'hp growth per wave': { key: 'hpPerWave', kind: 'num' },
  'enemy speed multiplier': { key: 'enemySpeed', kind: 'num' },
  'swarm scale': { key: 'swarm', kind: 'int' },
  'start gold': { key: 'startGold', kind: 'int' },
  'free walls': { key: 'freeWalls', kind: 'int' },
  'wall cost step': { key: 'wallStep', kind: 'int' },
  'reroll base price': { key: 'rerollBase', kind: 'int' },
  'reroll price step': { key: 'rerollStep', kind: 'int' },
  'offer size': { key: 'offerSize', kind: 'int' },
  'single pick offers': { key: 'singlePick', kind: 'int' },
  'drag game speed': { key: 'dragSpeed', kind: 'num' },
  'speed recovery': { key: 'speedRecovery', kind: 'num' },
  'move grace window': { key: 'moveGrace', kind: 'num' },
  'roll spin first gap': { key: 'spinFirstGap', kind: 'num' },
  'roll spin last gap': { key: 'spinLastGap', kind: 'num' },
  'roll spin growth': { key: 'spinGrowth', kind: 'num' },
  'roll spin hold': { key: 'spinHold', kind: 'num' },
  'chromatic aberration strength': { key: 'caStrength', kind: 'num' },
  'chromatic aberration inner': { key: 'caInner', kind: 'num' },
  'chromatic aberration outer': { key: 'caOuter', kind: 'num' },
  'chromatic aberration inset top': { key: 'caInsetTop', kind: 'num' },
  'chromatic aberration inset bottom': { key: 'caInsetBottom', kind: 'num' },
  'chromatic aberration inset left': { key: 'caInsetLeft', kind: 'num' },
  'chromatic aberration inset right': { key: 'caInsetRight', kind: 'num' },
  'crt sweep period': { key: 'crtPeriod', kind: 'num' },
  'crt sweep duration': { key: 'crtSweep', kind: 'num' },
  'crt sweep height': { key: 'crtWidth', kind: 'num' },
  'crt sweep jitter': { key: 'crtShift', kind: 'num' },
  'crt sweep colour split': { key: 'crtSplit', kind: 'num' },
  'crt sweep glow': { key: 'crtGlow', kind: 'num' },
};

/** Meta (the progression between runs): sheet label → field. */
const META: Record<string, Field> = {
  'coins per win': { key: 'winCoins', kind: 'int' },
  'coins per star': { key: 'starCoins', kind: 'int' },
  'coins per wave survived': { key: 'waveCoins', kind: 'int' },
  '3 stars lives left': { key: 'star3', kind: 'num' },
  '2 stars lives left': { key: 'star2', kind: 'num' },
  'roll base cost': { key: 'rollBase', kind: 'int' },
  'roll cost step': { key: 'rollStep', kind: 'int' },
  'stars per luxury roll': { key: 'starsPerLuxury', kind: 'int' },
};

const RARITY: Record<string, Field> = {
  'roll odds': { key: 'odds', kind: 'num' },
  'luxury odds': { key: 'luxuryOdds', kind: 'num' },
  'max level': { key: 'maxLevel', kind: 'int' },
  'power weight': { key: 'power', kind: 'int' },
};

const WEAPON: Record<string, Field> = {
  name: { key: 'name', kind: 'text' },
  description: { key: 'description', kind: 'text' },
  price: { key: 'price', kind: 'int' },
  lootable: { key: 'lootable', kind: 'bool' },
  'min wave': { key: 'minWave', kind: 'int' },
  'max wave': { key: 'maxWave', kind: 'int' },
  'attack range': { key: 'range', kind: 'num' },
  cooldown: { key: 'period', kind: 'num' },
  'attack damage': { key: 'damage', kind: 'num' },
  'aoe size': { key: 'splash', kind: 'num' },
  'aoe falloff': { key: 'falloff', kind: 'num' },
  'projectile speed': { key: 'shotSpeed', kind: 'num' },
  'knockback force': { key: 'knockback', kind: 'num' },
  'shockwave radius': { key: 'shockRadius', kind: 'num' },
  slow: { key: 'slow', kind: 'num' },
  'slow duration': { key: 'slowTime', kind: 'num' },
  haste: { key: 'haste', kind: 'num' },
  'haste duration': { key: 'hasteTime', kind: 'num' },
  'puddle damage': { key: 'puddle', kind: 'num' },
  'puddle size': { key: 'puddleSize', kind: 'num' },
  'puddle duration': { key: 'puddleTime', kind: 'num' },
  'burn damage': { key: 'burn', kind: 'num' },
  'burn duration': { key: 'burnTime', kind: 'num' },
  'cone angle': { key: 'cone', kind: 'num' },
  'aura range bonus': { key: 'auraRange', kind: 'num' },
  'aura fire rate bonus': { key: 'auraRate', kind: 'num' },
  'gold per wave': { key: 'waveGold', kind: 'int' },
};

const UNIT: Record<string, Field> = {
  'max health': { key: 'hp', kind: 'num' },
  movespeed: { key: 'speed', kind: 'num' },
  'gold reward': { key: 'reward', kind: 'int' },
  'base damage': { key: 'damage', kind: 'int' },
  swarms: { key: 'swarms', kind: 'bool' },
  'knockback taken': { key: 'knockback', kind: 'num' },
};

/** Rows for people only, unless the tab maps them (Weapons reads its Name and Description for the weapon info popup). */
const INFO_ROWS = new Set(['name', 'description']);

export interface Enums { ItemKind: string[]; EnemyKind: string[]; BlockShape: string[]; UpgradeKind: string[]; Rarity: string[] }

/** The schema's enums, from schema.gen.json (written by `gameengine gen`). */
export function readEnums(schemaGenJson: string): Enums {
  const all = (JSON.parse(schemaGenJson) as { enums: { name: string; values: string[] }[] }).enums;
  const get = (name: string) => {
    const e = all.find((x) => x.name === name);
    if (!e) throw new Error(`schema.gen.json has no enum ${name}: run gameengine gen`);
    return e.values;
  };
  return { ItemKind: get('ItemKind'), EnemyKind: get('EnemyKind'), BlockShape: get('BlockShape'), UpgradeKind: get('UpgradeKind'), Rarity: get('Rarity') };
}

const norm = (label: string) => label.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const isTitle = (label: string) => {
  const t = label.trim();
  return t === '' || t.startsWith('@') || t.endsWith('>');
};

class Errors {
  list: string[] = [];
  add(text: string) { this.list.push(text); }
  throwIfAny() {
    if (this.list.length) throw new Error(`The balancing sheet has ${this.list.length} problem(s):\n- ${this.list.join('\n- ')}`);
  }
}

function value(raw: string | undefined, kind: Kind, where: string, errs: Errors): number | boolean | string {
  const text = (raw ?? '').trim();
  if (kind === 'text') {
    if (!text) errs.add(`${where}: empty text`);
    return text;
  }
  if (kind === 'bool') {
    if (/^(true|vrai)$/i.test(text)) return true;
    if (/^(false|faux)$/i.test(text)) return false;
    errs.add(`${where}: "${text}" is not a checkbox value (TRUE or FALSE)`);
    return false;
  }
  // The sheet's locale is French: "0,32" and "1 000" are numbers.
  const t = text.replace(/\s/g, '').replace(/^(-?\d+),(\d+)$/, '$1.$2');
  const n = Number(t);
  if (t === '' || !Number.isFinite(n)) {
    errs.add(`${where}: "${text}" is not a number`);
    return 0;
  }
  if (kind === 'int' && !Number.isInteger(n)) errs.add(`${where}: ${text} must be a whole number`);
  if (n < 0) errs.add(`${where}: ${text} must not be negative`);
  return n;
}

function oneOf(raw: string | undefined, allowed: readonly string[], enumName: string, where: string, errs: Errors): string {
  const text = (raw ?? '').trim();
  if (!allowed.includes(text)) {
    errs.add(`${where}: "${text}" is not one of ${enumName} (${allowed.join(', ')}). A new one goes in schema/game.schema.ts first, then gameengine gen`);
  }
  return text;
}

function parseGeneral(grid: Grid, errs: Errors, tab: string = TABS.general.name, fields: Record<string, Field> = GENERAL) {
  const out: Record<string, number> = {};
  grid.forEach((row, i) => {
    const label = row[0] ?? '';
    if (isTitle(label)) return;
    const f = fields[norm(label)];
    if (!f) return errs.add(`${tab} row ${i + 1}: unknown parameter "${label}" (the game does not read it yet)`);
    if (f.key in out) return errs.add(`${tab} row ${i + 1}: "${label}" is there twice`);
    out[f.key] = value(row[1], f.kind, `${tab} "${label}"`, errs) as number;
  });
  const general: Record<string, number> = {};
  for (const [label, f] of Object.entries(fields)) {
    if (!(f.key in out)) errs.add(`${tab}: missing parameter "${label}"`);
    general[f.key] = out[f.key] ?? 0;
  }
  return general;
}

/** One column per entry (Weapons, Units): ids in row 1, a field per labelled row. */
function parseColumns(grid: Grid, tab: string, fields: Record<string, Field>, ids: readonly string[], enumName: string, errs: Errors) {
  const header = grid[0] ?? [];
  const cols = new Map<string, number>();
  for (let j = 1; j < header.length; j++) {
    const id = (header[j] ?? '').trim();
    if (!id) continue;
    oneOf(id, ids, enumName, `${tab} column ${j + 1}`, errs);
    if (cols.has(id)) errs.add(`${tab}: "${id}" has two columns`);
    cols.set(id, j);
  }
  const rows = new Map<string, number>();
  grid.forEach((row, i) => {
    if (i === 0) return;
    const label = row[0] ?? '';
    if (isTitle(label)) return;
    const f = fields[norm(label)];
    if (!f && INFO_ROWS.has(norm(label))) return;
    if (!f) return errs.add(`${tab} row ${i + 1}: unknown stat "${label}" (the game does not read it yet)`);
    rows.set(f.key, i);
  });
  for (const [label, f] of Object.entries(fields)) if (!rows.has(f.key)) errs.add(`${tab}: missing row "${label}"`);

  const out: Record<string, Record<string, number | boolean | string>> = {};
  for (const id of ids) {
    const j = cols.get(id);
    if (j === undefined) {
      errs.add(`${tab}: no column for "${id}" (every ${enumName} needs one)`);
      continue;
    }
    const entry: Record<string, number | boolean | string> = {};
    for (const [label, f] of Object.entries(fields)) {
      const i = rows.get(f.key);
      if (i !== undefined) entry[f.key] = value(grid[i]![j], f.kind, `${tab} ${id} "${label}"`, errs);
    }
    out[id] = entry;
  }
  return out;
}

/** One row per entry (Waves, Offers): column names in row 1. */
function parseRows(grid: Grid, tab: string, columns: string[], errs: Errors): { row: number; cells: Record<string, string> }[] {
  const header = (grid[0] ?? []).map(norm);
  const at: Record<string, number> = {};
  for (const c of columns) {
    const j = header.indexOf(c);
    if (j < 0) errs.add(`${tab}: missing column "${c}"`);
    at[c] = j;
  }
  const out: { row: number; cells: Record<string, string> }[] = [];
  grid.forEach((row, i) => {
    if (i === 0 || row.every((c) => (c ?? '').trim() === '')) return;
    const cells: Record<string, string> = {};
    for (const c of columns) cells[c] = at[c]! >= 0 ? (row[at[c]!] ?? '') : '';
    out.push({ row: i + 1, cells });
  });
  return out;
}

export interface SheetData {
  general: Record<string, number>;
  weapons: Record<string, Record<string, number | boolean | string>>;
  units: Record<string, Record<string, number | boolean | string>>;
  waves: { kind: string; count: number; every: number }[][];
  offers: { kind: string; shape: string; weight: number }[];
  meta: Record<string, number>;
  rarities: Record<string, Record<string, number | boolean | string>>;
  upgrades: { kind: string; name: string; rarity: string; perLevel: number; unit: string; stat: string }[];
}

export function parseSheet(tabs: Record<TabKey, Grid>, enums: Enums): SheetData {
  const errs = new Errors();
  const weaponIds = enums.ItemKind.filter((k) => k !== 'none' && k !== 'wall');
  const offerIds = enums.ItemKind.filter((k) => k !== 'none');

  const general = parseGeneral(tabs.general, errs);
  const weapons = parseColumns(tabs.weapons, TABS.weapons.name, WEAPON, weaponIds, 'WeaponsType', errs);
  const units = parseColumns(tabs.units, TABS.units.name, UNIT, enums.EnemyKind, 'UnitsType', errs);

  const waveTab = TABS.waves.name;
  const byWave = new Map<number, { kind: string; count: number; every: number }[]>();
  for (const { row, cells } of parseRows(tabs.waves, waveTab, ['wave', 'unit', 'count', 'every'], errs)) {
    const where = `${waveTab} row ${row}`;
    const wave = value(cells.wave, 'int', `${where} Wave`, errs) as number;
    if (wave < 1) errs.add(`${where}: waves start at 1`);
    const group = {
      kind: oneOf(cells.unit, enums.EnemyKind, 'UnitsType', `${where} Unit`, errs),
      count: value(cells.count, 'int', `${where} Count`, errs) as number,
      every: value(cells.every, 'num', `${where} Every`, errs) as number,
    };
    if (group.count < 1) errs.add(`${where}: Count must be at least 1`);
    byWave.set(wave, [...(byWave.get(wave) ?? []), group]);
  }
  const waveCount = Math.max(0, ...byWave.keys());
  if (waveCount === 0) errs.add(`${waveTab}: no waves`);
  const waves: SheetData['waves'] = [];
  for (let w = 1; w <= waveCount; w++) {
    const groups = byWave.get(w);
    if (!groups) errs.add(`${waveTab}: wave ${w} has no rows (waves go 1, 2, 3… without gaps)`);
    waves.push(groups ?? []);
  }

  const offerTab = TABS.offers.name;
  const offers: SheetData['offers'] = [];
  for (const { row, cells } of parseRows(tabs.offers, offerTab, ['item', 'shape', 'weight'], errs)) {
    const where = `${offerTab} row ${row}`;
    const offer = {
      kind: oneOf(cells.item, offerIds, 'ItemType', `${where} Item`, errs),
      shape: oneOf(cells.shape, enums.BlockShape, 'BlockShape', `${where} Shape`, errs),
      weight: value(cells.weight, 'num', `${where} Weight`, errs) as number,
    };
    if (offer.weight <= 0) errs.add(`${where}: Weight must be above 0`);
    offers.push(offer);
  }
  if (!offers.some((o) => o.kind === 'wall')) errs.add(`${offerTab}: needs at least one wall (every offer holds a block)`);
  if (!offers.some((o) => o.kind !== 'wall' && weapons[o.kind]?.lootable === true)) errs.add(`${offerTab}: needs at least one Lootable weapon (Weapons tab)`);
  // Min Wave / Max Wave: a sane window per weapon, and something to offer on every wave.
  for (const [id, w] of Object.entries(weapons)) {
    const min = w.minWave as number;
    const max = w.maxWave as number;
    if (max > 0 && max < Math.max(1, min)) errs.add(`${TABS.weapons.name} ${id}: Max Wave ${max} is before Min Wave ${min} (0 = no limit)`);
  }
  const offeredAt = (kind: string, wave: number) => {
    const w = weapons[kind];
    return !!w && w.lootable === true && Math.max(1, w.minWave as number) <= wave && ((w.maxWave as number) === 0 || wave <= (w.maxWave as number));
  };
  for (let wave = 1; wave <= waves.length; wave++) {
    if (!offers.some((o) => o.kind !== 'wall' && offeredAt(o.kind, wave))) errs.add(`${offerTab}: no weapon can be offered on wave ${wave} (check Min Wave / Max Wave and Lootable in ${TABS.weapons.name})`);
  }

  const meta = parseGeneral(tabs.meta, errs, TABS.meta.name, META);
  const rarities = parseColumns(tabs.rarities, TABS.rarities.name, RARITY, enums.Rarity, 'Rarity', errs);
  const upTab = TABS.upgrades.name;
  const upgrades: SheetData['upgrades'] = [];
  for (const { row, cells } of parseRows(tabs.upgrades, upTab, ['upgrade', 'name', 'rarity', 'per level', 'unit', 'stat'], errs)) {
    const where = `${upTab} row ${row}`;
    const kind = oneOf(cells.upgrade, enums.UpgradeKind, 'UpgradeType', `${where} Upgrade`, errs);
    if (upgrades.some((u) => u.kind === kind)) errs.add(`${where}: "${kind}" is there twice`);
    upgrades.push({
      kind,
      name: (cells.name ?? '').trim() || kind,
      rarity: oneOf(cells.rarity, enums.Rarity, 'Rarity', `${where} Rarity`, errs),
      perLevel: value(cells['per level'], 'num', `${where} Per level`, errs) as number,
      unit: (cells.unit ?? '').trim(),
      stat: (cells.stat ?? '').trim(),
    });
  }
  for (const k of enums.UpgradeKind) if (!upgrades.some((u) => u.kind === k)) errs.add(`${upTab}: no row for "${k}" (every UpgradeType needs one)`);

  errs.throwIfAny();
  return { general, weapons, units, waves, offers, meta, rarities, upgrades };
}

// ---- The generated file ----

export const hashOf = (json: string) => createHash('sha256').update(json).digest('hex').slice(0, 16);
const canonical = (data: unknown) => JSON.stringify(data, null, 2);

export function render(data: SheetData): string {
  const json = canonical(data);
  const general = Object.values(GENERAL).map((f) => `    ${f.key}: number;`).join('\n');
  const meta = Object.values(META).map((f) => `    ${f.key}: number;`).join('\n');
  return `// GENERATED by \`gameengine tool sheet-sync\` from the balancing Google Sheet:
// ${SHEET_URL}
// Do not edit: change the sheet, then run the tool. The game/balance-sheet check fails on hand edits.
// sheet-hash: ${hashOf(json)}
import type { BlockShapeName, EnemyKindName, ItemKindName, RarityName, UpgradeKindName } from './kinds.ts';

export type WeaponKindName = Exclude<ItemKindName, 'none' | 'wall'>;

export interface BalanceSheet {
  general: {
${general}
  };
  weapons: Record<WeaponKindName, { name: string; description: string; price: number; lootable: boolean; minWave: number; maxWave: number; range: number; period: number; damage: number; splash: number; falloff: number; shotSpeed: number; knockback: number; shockRadius: number; slow: number; slowTime: number; haste: number; hasteTime: number; puddle: number; puddleSize: number; puddleTime: number; burn: number; burnTime: number; cone: number; auraRange: number; auraRate: number; waveGold: number }>;
  units: Record<EnemyKindName, { hp: number; speed: number; reward: number; damage: number; swarms: boolean; knockback: number }>;
  waves: { kind: EnemyKindName; count: number; every: number }[][];
  offers: { kind: Exclude<ItemKindName, 'none'>; shape: BlockShapeName; weight: number }[];
  meta: {
${meta}
  };
  rarities: Record<RarityName, { odds: number; luxuryOdds: number; maxLevel: number; power: number }>;
  upgrades: { kind: UpgradeKindName; name: string; rarity: RarityName; perLevel: number; unit: string; stat: string }[];
}

export const SHEET: BalanceSheet = ${json};
`;
}

/** The data and recorded hash of a generated file, or null when it is not one. */
export function readGenerated(text: string): { data: SheetData; hash: string; actual: string } | null {
  const body = text.replace(/\r\n/g, '\n').match(/export const SHEET: BalanceSheet = ([\s\S]*);\s*$/);
  const hash = text.match(/sheet-hash: ([0-9a-f]+)/);
  if (!body || !hash) return null;
  try {
    const data = JSON.parse(body[1]!) as SheetData;
    return { data, hash: hash[1]!, actual: hashOf(canonical(data)) };
  } catch {
    return null;
  }
}

/** Changed values between two versions, as "units.ant.hp: 10 → 12". */
export function diff(before: SheetData | null, after: SheetData): string[] {
  const flat = (v: unknown, path: string, out: Map<string, string>) => {
    if (v !== null && typeof v === 'object') for (const [k, x] of Object.entries(v)) flat(x, path ? `${path}.${k}` : k, out);
    else out.set(path, JSON.stringify(v));
    return out;
  };
  const a = before ? flat(before, '', new Map()) : new Map<string, string>();
  const b = flat(after, '', new Map());
  const lines: string[] = [];
  for (const [k, v] of b) if (a.get(k) !== v) lines.push(a.has(k) ? `${k}: ${a.get(k)} → ${v}` : `${k}: ${v} (new)`);
  for (const [k, v] of a) if (!b.has(k)) lines.push(`${k}: ${v} (removed)`);
  return lines;
}

// ---- Reading tabs ----

/** RFC 4180 CSV, as Google Sheets exports it. */
export function parseCsv(text: string): Grid {
  const rows: Grid = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export async function downloadTab(key: TabKey): Promise<Grid> {
  const { name, gid } = TABS[key];
  const res = await fetch(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`);
  const type = res.headers.get('content-type') ?? '';
  if (!res.ok || !type.includes('text/csv')) {
    throw new Error(
      `Could not download the "${name}" tab (HTTP ${res.status}, ${type || 'no type'}). The sheet must be readable without signing in: ` +
        `Share > General access > "Anyone with the link" (Viewer). Or export the tabs and pass --dir.`,
    );
  }
  return parseCsv(await res.text());
}
