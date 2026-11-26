/**
 * The game's UI controller: fills the HUD from the Run resource, shows the wave and boss
 * banners, flies coins from kills to the gold counter and opens the settings popup, the level menu and the end screen.
 * Presentation.
 */
import { createEffect, createSignal, defineUI, emit, onCleanup, onUiFrame, untrack, useDoc, useResource, views } from '@gameengine/ui';
import { onSignal, worldToUi } from '@gameengine/runtime';
import { AudioSettingsChanged, BankPaid, Board, Boost, EnemyKilled, LevelPicked, MenuRequested, Panel, RestartRequested, RollRequested, Run, SettingsMenu, SettingsToggled, UpgradeRolled, WaveStarted, WeaponInfo, WeaponInfoClosed } from '../schema.gen.ts';
import { ITEMS, SPIN_FIRST_GAP, SPIN_GROWTH, SPIN_HOLD, SPIN_LAST_GAP, WAVES, WAVE_COUNT, type EnemyKindName } from '../balance.ts';
import { levelWaves } from '../sim/level.ts';
import { HudView, type Flight, type HudModel } from '../views/hud.view.tsx';
import { BannerView, type BannerModel } from '../views/banner.view.tsx';
import { EndView, type EndModel } from '../views/end.view.tsx';
import { LevelMenuView, LevelPopupView, MAP_PATH, type LevelMenuModel, type LevelPopupModel, type MapNode } from '../views/level-menu.view.tsx';
import { WeaponInfoView, type WeaponInfoModel } from '../views/weapon-info.view.tsx';
import { SettingsView, type SettingsModel } from '../views/settings.view.tsx';
import { settings } from '../settings.ts';
import { UpgradeRevealView, UpgradesView, type Ink, type Lean, type UpgradeTile, type UpgradesModel } from '../views/upgrades.view.tsx';
import { menuLevels } from '../levels.ts';
import { loadData } from '@gameengine/runtime';
import { LevelDef } from '../schema.gen.ts';
import { checkLayout } from '../layout.ts';
import { COLS, DEFAULT_COLS, DEFAULT_ROWS, boardRect } from '../grid.ts';
import { META, UPGRADES, levelOf, levelOpen, luxuryCharges, luxuryProgress, maxLevel, power, progress, rollCost, rollPool, upgradeDef, type MetaState, type UpgradeDef } from '../meta.ts';
import { ITEM_NAMES } from '../kinds.ts';
import type { ItemKindName, UpgradeKindName } from '../kinds.ts';

const BANNER_SECONDS = 1.5;

/** How each upgrade looks on its tile (mockup 3B): short name, icon, icon colour. */
const TILE_LOOKS: Record<UpgradeKindName, { short: string; icon: string; ink: Ink }> = {
  towerDmg: { short: 'Tower DMG', icon: 'ui/meta/ic_dmg', ink: 'cyan' },
  cannonDmg: { short: 'Cannon DMG', icon: 'ui/meta/ic_dmg', ink: 'orange' },
  startGold: { short: 'Start gold', icon: 'ui/meta/ic_gold', ink: 'gold' },
  killGold: { short: 'Kill gold', icon: 'ui/meta/ic_gold', ink: 'gold' },
  fireRate: { short: 'Fire rate', icon: 'ui/meta/ic_rate', ink: 'white' },
  towerRange: { short: 'Tower range', icon: 'ui/meta/ic_range', ink: 'cyan' },
  cannonAoe: { short: 'Cannon AoE', icon: 'ui/meta/ic_aoe', ink: 'orange' },
  freeCell: { short: 'Free cell', icon: 'ui/meta/ic_cell', ink: 'blue' },
  globalDmg: { short: 'Global DMG', icon: 'ui/meta/ic_dmg', ink: 'white' },
  life: { short: '+1 Life', icon: 'ui/meta/ic_life', ink: 'cyan' },
  reroll: { short: 'Free reroll', icon: 'ui/meta/ic_reroll', ink: 'white' },
  freeTower: { short: 'Free tower', icon: 'ui/meta/ic_tower', ink: 'cyan' },
  slowmo: { short: 'Deep slow-mo', icon: 'ui/meta/ic_slow', ink: 'white' },
};

/**
 * Upgrades of weapons that are not in the game yet, shown locked on the Upgrades screen (design:
 * Flamethrower L8, Poison L15, Slow field L22). They join the sheet once the weapons exist.
 */
const COMING: readonly UpgradeTile[] = [
  { key: 'flameDmg', name: 'Flame DMG', icon: 'ui/meta/ic_dmg', ink: 'white', level: 0, max: 5, rarity: 'rare', owned: false, locked: true, unlock: 'Unlock Lvl 8' },
  { key: 'poisonDmg', name: 'Poison DMG', icon: 'ui/meta/ic_dmg', ink: 'white', level: 0, max: 5, rarity: 'rare', owned: false, locked: true, unlock: 'Unlock Lvl 15' },
  { key: 'slowField', name: 'Slow field', icon: 'ui/meta/ic_slow', ink: 'white', level: 0, max: 3, rarity: 'epic', owned: false, locked: true, unlock: 'Unlock Lvl 22' },
];

/** An upgrade's total effect at `level`, as the Upgrades screen shows it ("+15%", "+0.2 cells"). */
function effectText(u: UpgradeDef, level: number): string {
  const v = Math.round(u.perLevel * level * 100) / 100;
  return `+${v}${u.unit === '%' ? '%' : u.unit ? ` ${u.unit}` : ''}`;
}

/** Enemy kinds a level's waves bring (its first `waves` rows of the sheet's Waves tab). */
function enemiesOf(waves: number): Set<EnemyKindName> {
  const out = new Set<EnemyKindName>();
  for (const wave of WAVES.slice(0, waves)) for (const g of wave) out.add(g.kind);
  return out;
}

/** A number as the weapon popup shows it: at most two decimals, no trailing zeros. */
const num = (n: number): string => `${Math.round(n * 100) / 100}`;
const pct = (share: number): string => `${Math.round(share * 100)}%`;
const CHIP_COLORS = ['pink', 'blue', 'green', 'gold'] as const;

/** The weapon popup: name, description and the stats this weapon has, with the run's upgrades (Boost) applied. */
function weaponInfoModel(kindIndex: number, kind: Exclude<ItemKindName, 'none' | 'wall'>, onBoard: boolean, boost: { damage: ArrayLike<number>; range: ArrayLike<number>; splash: ArrayLike<number>; period: number } | undefined): WeaponInfoModel {
  const w = ITEMS[kind];
  const dmg = boost?.damage[kindIndex] || 1;
  const period = w.period * (boost?.period ?? 1);
  const range = w.range + (boost?.range[kindIndex] ?? 0);
  const splash = w.splash > 0 ? w.splash + (boost?.splash[kindIndex] ?? 0) : 0;
  const rows: [string, string, string][] = [];
  if (w.damage > 0) rows.push(['damage', 'Damage', num(w.damage * dmg)]);
  if (w.damage > 0 && period > 0) rows.push(['rate', 'Fire rate', `${num(1 / period)} / s`]);
  if (range > 0) rows.push(['range', 'Range', `${num(range)} cells`]);
  if (splash > 0) rows.push(['area', 'Area', `${num(splash)} cells`]);
  if (w.slow > 0) rows.push(['slow', 'Slow', `${pct(w.slow)} · ${num(w.slowTime)} s`]);
  if (w.burn > 0) rows.push(['burn', 'Burn', `${num(w.burn * dmg)} / s · ${num(w.burnTime)} s`]);
  if (w.puddle > 0) rows.push(['puddle', 'Puddle', `${num(w.puddle * dmg)} / s · ${num(w.puddleTime)} s`]);
  if (w.haste > 0) rows.push(['haste', 'Ants faster', `+${pct(w.haste)} · ${num(w.hasteTime)} s`]);
  if (w.auraRange > 0) rows.push(['auraRange', 'Range bonus', `+${num(w.auraRange)} cells`]);
  if (w.auraRate > 0) rows.push(['auraRate', 'Fire rate bonus', `+${pct(w.auraRate)}`]);
  if (w.waveGold > 0) rows.push(['waveGold', 'Gold per wave', `${w.waveGold}`]);
  return {
    kicker: onBoard ? 'ON THE BOARD' : `IN THE OFFER · ${w.price} GOLD`,
    name: w.name,
    desc: w.description,
    info: rows.map(([key, k, v], i) => ({ key, k, v, color: CHIP_COLORS[i % CHIP_COLORS.length]! })),
  };
}

/** Enemy names on the map popup. */
const ENEMY_LABELS: Record<EnemyKindName, string> = { ant: 'Ant', fast: 'Fast ant', beetle: 'Beetle', boss: 'Boss' };


const canRoll = (s: MetaState) => s.coins >= rollCost(s) && rollPool(s, false).length > 0;
const canLuxury = (s: MetaState) => luxuryCharges(s) > 0 && rollPool(s, true).length > 0;
/** Most coins in the air at once. */
const MAX_FLIGHTS = 24;

/** Columns of the Upgrades grid (upgrades.view.tsx): tile i is UPGRADES[i], at row i / 4, column i % 4. */
const GRID_COLS = 4;

/** Upgrade tiles next to tile `i` in the grid (left, right, up, down). */
function gridNeighbours(i: number): number[] {
  const n = UPGRADES.length;
  const out: number[] = [];
  if (i % GRID_COLS > 0) out.push(i - 1);
  if (i % GRID_COLS < GRID_COLS - 1 && i + 1 < n) out.push(i + 1);
  if (i >= GRID_COLS) out.push(i - GRID_COLS);
  if (i + GRID_COLS < n) out.push(i + GRID_COLS);
  return out;
}

/** Which way tile `to` lies from its neighbour `from`. */
const leanToward = (from: number, to: number): Lean => (to === from - 1 ? 'left' : to === from + 1 ? 'right' : to < from ? 'up' : 'down');

/**
 * The tiles the roll animation lights, in order: a walk from tile to adjacent tile, never straight
 * back, ending on `target` (back only out of a dead end). One tile per gap of the SPIN_* schedule, plus the landing. Built backwards
 * from the target so it always lands there. Presentation only (Math.random is fine here).
 */
function spinPath(target: number): number[] {
  let steps = 1;
  for (let gap = SPIN_FIRST_GAP * SPIN_GROWTH; gap <= SPIN_LAST_GAP; gap *= SPIN_GROWTH) steps++;
  const path = [target];
  let prev = -1;
  while (path.length <= steps) {
    const at = path[path.length - 1]!;
    const around = gridNeighbours(at);
    const forward = around.filter((j) => j !== prev);
    const options = forward.length ? forward : around; // a dead end (a tile alone on its row) turns back
    const pick = options[Math.floor(Math.random() * options.length)]!;
    prev = at;
    path.push(pick);
  }
  return path.reverse();
}

export const GameUI = defineUI({
  name: 'GameUI',
  root: () => {
    const run = useResource(Run);
    const board = useResource(Board);
    /** Waves of the level being played (LevelDef.waves). */
    const waveCount = () => board()?.waveCount || WAVE_COUNT;
    const panel = useResource(Panel);
    const [flights, setFlights] = createSignal<readonly Flight[]>([]);
    let nextFlight = 1;

    // The HUD sits above the tray, in the bottom panel FitView pins to the screen (grid.ts panelLayout).
    const hudPoint = (): [number, number] => {
      const p = panel();
      return [p?.x ?? 0, p?.hudY ?? 0];
    };
    const model = (): HudModel => {
      const r = run();
      return {
        wave: Math.max(1, r?.wave ?? 1),
        waveCount: waveCount(),
        gold: r?.gold ?? 0,
        at: hudPoint(),
        flights: flights(),
      };
    };
    const hud = views.push(HudView, untrack(model), {
      order: 0,
      onIntent: (name, payload) => {
        if (name === 'coinLanded') setFlights((fs) => fs.filter((f) => f.id !== payload));
        if (name === 'settings') emit(SettingsToggled, { open: true });
      },
    });
    createEffect(() => hud.update(model()));

    onCleanup(
      onSignal(EnemyKilled, (s) => {
        if (untrack(flights).length >= MAX_FLIGHTS) return;
        const p = worldToUi(s.fields.x, s.fields.y);
        if (!p) return;
        setFlights((fs) => [...fs, { id: nextFlight++, x: p.x, y: p.y }]);
      }),
    );
    onCleanup(
      // A bank's pay: a few coins fly from it to the counter.
      onSignal(BankPaid, (s) => {
        const p = worldToUi(s.fields.x, s.fields.y);
        if (!p) return;
        const n = Math.min(3, MAX_FLIGHTS - untrack(flights).length);
        if (n <= 0) return;
        setFlights((fs) => [...fs, ...Array.from({ length: n }, (_, k) => ({ id: nextFlight++, x: p.x + (k - 1) * 12, y: p.y }))]);
      }),
    );

    // Weapon info: a tap on a weapon opens it (DragItems) and the run waits until it closes.
    const weaponInfo = useResource(WeaponInfo);
    const boost = useResource(Boost);
    let info: { close(): void } | null = null;
    let infoOpens = untrack(() => weaponInfo()?.opens ?? 0);
    createEffect(() => {
      const wi = weaponInfo();
      if (!wi) return;
      if (wi.opens !== infoOpens && wi.open) {
        infoOpens = wi.opens;
        const index = ITEM_NAMES.indexOf(wi.kind as ItemKindName);
        if (index <= 1) return; // none or wall: no popup
        info?.close();
        const v = views.push(WeaponInfoView, weaponInfoModel(index, wi.kind as Exclude<ItemKindName, 'none' | 'wall'>, wi.cell >= 0, untrack(boost)), {
          onIntent: () => {
            v.close();
            if (info === v) info = null;
            emit(WeaponInfoClosed);
          },
        });
        info = v;
      } else if (!wi.open && info) {
        info.close();
        info = null;
      }
    });

    // Settings: the gear (top right in a run, on the level menu and Upgrades top bar) opens the popup (ToggleSettings) and the run waits until it closes.
    const settingsMenu = useResource(SettingsMenu);
    const audio = useDoc(settings);
    const settingsModel = (): SettingsModel => ({ sound: audio().sound, music: audio().music, inRun: run()?.phase === 'playing' });
    let settingsView: { close(): void; update(m: SettingsModel): void } | null = null;
    createEffect(() => {
      const open = settingsMenu()?.open ?? false;
      if (open && !settingsView) {
        const v = views.push(SettingsView, untrack(settingsModel), {
          onIntent: (name, on) => {
            const s = untrack(settingsModel);
            if (name === 'sound') emit(AudioSettingsChanged, { sound: on === true, music: s.music });
            else if (name === 'music') emit(AudioSettingsChanged, { sound: s.sound, music: on === true });
            else if (name === 'menu') emit(MenuRequested);
            else emit(SettingsToggled, { open: false });
          },
        });
        settingsView = v;
      } else if (!open && settingsView) {
        settingsView.close();
        settingsView = null;
      }
    });
    createEffect(() => {
      const m = settingsModel();
      untrack(() => settingsView?.update(m));
    });

    // Banners: "Wave X" at each wave start, "BOSS!" when the boss walks out.
    const banner = (m: BannerModel) => {
      const bd = untrack(board);
      const r = boardRect(bd?.cols || DEFAULT_COLS, bd?.rows || DEFAULT_ROWS);
      const b = views.push(BannerView, { ...m, at: [r.x, r.y] });
      let start = -1;
      const stop = onUiFrame((now) => {
        if (start < 0) start = now;
        if (now - start < BANNER_SECONDS) return;
        b.close();
        stop();
      });
    };
    onCleanup(
      onSignal(WaveStarted, (s) => {
        const n = s.fields.wave;
        const newNest = s.fields.newNest;
        banner({ title: `WAVE ${n}`, subtitle: newNest ? 'A new nest opened!' : n === untrack(waveCount) ? 'Final wave' : n === 1 ? 'Build the maze!' : 'Here they come', boss: false });
      }),
    );
    let bosses = untrack(() => run()?.bosses ?? 0);
    createEffect(() => {
      const b = run()?.bosses ?? 0;
      if (b > bosses) banner({ title: 'BOSS!', subtitle: 'Hold the line', boss: true });
      bosses = b;
    });

    // Meta progress (src/meta.ts): coins, stars per level, upgrades. Read only; the sim changes it.
    const meta = useDoc(progress);
    const levels = menuLevels();
    const ids = levels.map((l) => l.id);

    // Level menu (the game opens on it), with the Upgrades screen on top of it.
    /** The level PLAY starts: the first open level not won yet, else the last open one. */
    const currentIndex = (s: MetaState): number => {
      let last = 0;
      for (let i = 0; i < levels.length; i++) {
        if (!levelOpen(s, ids, i)) break;
        last = i;
        if (!(s.stars[levels[i]!.id] ?? 0)) return i;
      }
      return last;
    };
    const fmt = (n: number) => n.toLocaleString('en-US');
    const worldCount = levels.reduce((n, l) => Math.max(n, l.world + 1), 0);
    /** The world the map shows when the player browsed with the arrows; null: the current level's. */
    const [shownWorld, setShownWorld] = createSignal<number | null>(null);
    const menuModel = (): LevelMenuModel => {
      const s = meta();
      const cur = currentIndex(s);
      // The world picked with the arrows, else the one holding the current level (src/levels.ts), its last level a boss.
      const world = shownWorld() ?? levels[cur]?.world ?? 0;
      const first = Math.max(0, levels.findIndex((l) => l.world === world));
      const nodes: MapNode[] = levels.slice(first, first + MAP_PATH.length).filter((l) => l.world === world).map((l, k) => {
        const i = first + k;
        const state = i === cur ? 'current' : l.last ? 'boss' : levelOpen(s, ids, i) ? 'done' : 'locked';
        return { key: l.id, num: i + 1, state, stars: s.stars[l.id] ?? 0 };
      });
      const charges = luxuryCharges(s);
      const ready = canRoll(s) || canLuxury(s);
      return {
        coins: fmt(s.coins),
        stars: fmt(s.starTotal),
        chapter: (levels[first]?.worldName ?? `World ${world + 1}`).toUpperCase(),
        hasPrev: world > 0,
        hasNext: world + 1 < worldCount,
        nodes,
        luxText: `${luxuryProgress(s)} / ${META.starsPerLuxury}`,
        luxStars: luxuryProgress(s),
        luxGoal: META.starsPerLuxury,
        luxReady: charges > 0,
        luxCount: `${charges}`,
        playDetail: `Level ${cur + 1} · ${levels[cur]?.name ?? ''}`,
        upReady: ready,
        upBadge: ready ? `${(canRoll(s) ? 1 : 0) + charges}` : '',
      };
    };
    /** The level popup: its layout from the LevelDef (the rules the game uses, src/layout.ts). */
    const popupModel = (index: number): LevelPopupModel => {
      const s = meta();
      const l = levels[index]!;
      const def = loadData(LevelDef, l.guid);
      const lay = checkLayout(def);
      const waves = levelWaves(def);
      const cells: number[] = [];
      for (let r = 0; r < lay.rows; r++) {
        for (let c = 0; c < lay.cols; c++) {
          const cell = r * COLS + c;
          cells.push(cell === lay.base ? 3 : lay.nests.some((n) => n.cell === cell) ? 2 : lay.weaponAt[cell]! >= 0 ? 4 : lay.cells[cell] ? 1 : 0);
        }
      }
      const boss = l.last;
      return {
        key: l.id,
        kicker: `LEVEL ${index + 1}${boss ? ' · BOSS' : ''}`,
        name: l.name,
        stars: s.stars[l.id] ?? 0,
        locked: !levelOpen(s, ids, index),
        boss,
        lockText: `Win level ${index} to unlock`,
        info: [
          { key: 'nests', k: 'Nests', v: `${lay.nests.length}`, color: 'pink' },
          { key: 'waves', k: 'Waves', v: `${waves}`, color: 'blue' },
          { key: 'new', k: 'New', v: newEnemy(index), color: 'green' },
          { key: 'power', k: 'Power', v: def.power !== undefined ? `${def.power}` : '—', color: 'gold' },
        ],
        cols: lay.cols,
        rows: lay.rows,
        cells,
      };
    };
    /** The enemy a level meets first on the map (none before it brought it), or '—'. */
    const newEnemy = (index: number): string => {
      const seen = new Set<EnemyKindName>();
      for (let i = 0; i < index; i++) for (const k of enemiesOf(levelWaves(loadData(LevelDef, levels[i]!.guid)))) seen.add(k);
      const fresh = [...enemiesOf(levelWaves(loadData(LevelDef, levels[index]!.guid)))].filter((k) => !seen.has(k));
      return fresh.length ? ENEMY_LABELS[fresh[0]!] : '—';
    };
    let popup: { close(): void } | null = null;
    const openPopup = (index: number) => {
      popup?.close();
      const p = views.push(LevelPopupView, popupModel(index), {
        onIntent: (name) => {
          if (name === 'play' && levelOpen(untrack(meta), ids, index)) emit(LevelPicked, { index });
          if (name === 'close' || name === 'play') {
            p.close();
            if (popup === p) popup = null;
          }
        },
      });
      popup = p;
    };
    /** The tiles of a meta state, cached so the grid is rebuilt only when the meta changes. */
    let tilesFor: MetaState | null = null;
    let tilesCache: readonly UpgradeTile[] = [];
    const tilesOf = (s: MetaState): readonly UpgradeTile[] => {
      if (s === tilesFor) return tilesCache;
      tilesFor = s;
      const tiles = UPGRADES.map((u): UpgradeTile => {
        const level = levelOf(s, u.kind);
        const look = TILE_LOOKS[u.kind];
        return { key: u.kind, name: look.short, icon: look.icon, ink: look.ink, level, max: maxLevel(u.kind), rarity: u.rarity, owned: level > 0, locked: false, unlock: '' };
      });
      tilesCache = [...tiles, ...COMING];
      return tilesCache;
    };
    // The roll animation: the tile lit now, and the tiles as they were before the roll (shown until the
    // reveal closes, so the new level does not show early).
    /** The lit tile and where it leans, one signal so the view updates once per move. */
    const [spot, setSpot] = createSignal<{ key: string; lean: Lean }>({ key: '', lean: 'none' });
    const [frozen, setFrozen] = createSignal<readonly UpgradeTile[] | null>(null);
    let stopSpin: (() => void) | null = null;
    const spinning = () => frozen() !== null;
    const endSpin = () => {
      stopSpin?.();
      stopSpin = null;
      setSpot({ key: '', lean: 'none' });
      setFrozen(null);
    };
    const upgradesModel = (): UpgradesModel => {
      const s = meta();
      const charges = luxuryCharges(s);
      return {
        coins: fmt(s.coins),
        stars: fmt(s.starTotal),
        power: power(s),
        tiles: frozen() ?? tilesOf(s),
        lit: spot().key,
        lean: spot().lean,
        rollSub: rollPool(s, false).length ? `${rollCost(s)}` : 'MAX',
        rollAccent: canRoll(s) ? 'gold' : 'gold-off',
        luxurySub: `${luxuryProgress(s)}/${META.starsPerLuxury}`,
        luxStars: luxuryProgress(s),
        luxGoal: META.starsPerLuxury,
        luxCount: `${charges}`,
        luxReady: charges > 0,
        luxAccent: canLuxury(s) ? 'purple' : 'purple-off',
      };
    };
    /** A tile's details: its effect now → at the next level. */
    const showTile = (key: string) => {
      const u = UPGRADES.find((x) => x.kind === key);
      if (!u) return;
      const level = levelOf(untrack(meta), u.kind);
      const max = maxLevel(u.kind);
      const r = views.push(
        UpgradeRevealView,
        {
          kicker: u.rarity,
          name: u.name,
          levels: `Level ${level} / ${max}`,
          stat: u.stat,
          effect: level >= max ? `${effectText(u, level)} (max)` : `${effectText(u, level)} → ${effectText(u, level + 1)}`,
          rarity: u.rarity,
          cta: 'OK',
        },
        { onIntent: (name) => name === 'collect' && r.close() },
      );
    };
    let menu: { close(): void; update(m: LevelMenuModel): void } | null = null;
    let upgrades: { close(): void; update(m: UpgradesModel): void } | null = null;
    let end: { close(): void; update(m: EndModel): void } | null = null;
    const closeUpgrades = () => {
      endSpin();
      upgrades?.close();
      upgrades = null;
    };
    const openUpgrades = () => {
      upgrades ??= views.push(UpgradesView, untrack(upgradesModel), {
        onIntent: (name, key) => {
          if (name === 'settings') return emit(SettingsToggled, { open: true });
          if (untrack(spinning)) return;
          if (name === 'tile') return showTile(key as string);
          const luxury = name === 'luxury';
          if ((name === 'roll' && canRoll(untrack(meta))) || (luxury && canLuxury(untrack(meta)))) {
            const s = untrack(meta);
            setFrozen(tilesOf(s));
            emit(RollRequested, { luxury });
          }
          if (name === 'back') closeUpgrades();
        },
      });
    };
    // Read the model first: `menu?.update(menuModel())` would skip it while no view is open, and the
    // effect would never subscribe to the meta.
    createEffect(() => {
      const m = menuModel();
      menu?.update(m);
    });
    createEffect(() => {
      const m = upgradesModel();
      upgrades?.update(m);
    });

    // Each roll: the tiles light up one after another, slowing down until they stop on the upgrade won,
    // then its reveal popup.
    const spin = (target: UpgradeKindName, done: () => void) => {
      const path = spinPath(UPGRADES.findIndex((u) => u.kind === target));
      let step = 0;
      let gap = SPIN_FIRST_GAP;
      let next = 0;
      let landed = -1;
      let start = -1;
      const light = (now: number) => {
        const at = path[step]!;
        const to = path[step + 1];
        step++;
        setSpot({ key: UPGRADES[at]!.kind, lean: to === undefined ? 'none' : leanToward(at, to) });
        next = now + gap / 60;
        gap *= SPIN_GROWTH;
      };
      stopSpin = onUiFrame((now) => {
        if (start < 0) {
          start = now;
          light(now);
          return;
        }
        if (landed >= 0) {
          if (now - landed < SPIN_HOLD) return;
          stopSpin?.();
          stopSpin = null;
          done();
          return;
        }
        if (now < next) return;
        light(now);
        if (step === path.length) landed = now;
      });
    };
    onCleanup(() => stopSpin?.());
    onCleanup(
      onSignal(UpgradeRolled, (sig) => {
        const kind = sig.fields.upgrade as UpgradeKindName;
        const show = () => reveal(kind, sig.fields.level, sig.fields.luxury);
        if (upgrades && untrack(spinning)) spin(kind, show);
        else show();
      }),
    );
    const reveal = (kind: UpgradeKindName, level: number, luxury: boolean) => {
      const u = upgradeDef(kind);
      const r = views.push(
        UpgradeRevealView,
        {
          kicker: `${luxury ? 'LUXURY' : level === 1 ? 'NEW' : 'UPGRADE'} · ${u.rarity}`,
          name: u.name,
          levels: `Level ${level} / ${maxLevel(kind)}`,
          stat: u.stat,
          effect: `${effectText(u, level - 1)} → ${effectText(u, level)}`,
          rarity: u.rarity,
          cta: 'COLLECT',
        },
        {
          onIntent: (name) => {
            if (name !== 'collect') return;
            r.close();
            endSpin();
          },
        },
      );
    };

    // End screen: the run's result and what it paid into the meta.
    const endModel = (): EndModel => {
      const r = run()!;
      const won = r.phase === 'won';
      const stars = won ? ` · ${r.stars} ${r.stars === 1 ? 'star' : 'stars'}${r.newStars > 0 ? ` (${r.newStars} new)` : ''}` : '';
      return {
        won,
        title: won ? 'VICTORY!' : 'OVERRUN',
        subtitle: won ? `All ${waveCount()} waves held - ${r.lives} ${r.lives === 1 ? 'life' : 'lives'} left` : `They broke through on wave ${r.wave}`,
        reward: r.paid ? `+${r.coinsWon} coins${stars}` : '',
      };
    };
    createEffect(() => {
      const phase = run()?.phase;
      if (end && (phase === 'won' || phase === 'lost')) end.update(endModel());
    });
    createEffect(() => {
      const phase = run()?.phase;
      if (phase === 'menu') {
        end?.close();
        end = null;
        menu ??= views.push(LevelMenuView, untrack(menuModel), {
          order: 0,
          onIntent: (name, id) => {
            if (name === 'settings') return emit(SettingsToggled, { open: true });
            if (name === 'upgrades') return openUpgrades();
            if (name === 'play') return emit(LevelPicked, { index: currentIndex(untrack(meta)) });
            if (name === 'prev-world' || name === 'next-world') {
              const from = untrack(shownWorld) ?? levels[currentIndex(untrack(meta))]?.world ?? 0;
              return setShownWorld(Math.max(0, Math.min(worldCount - 1, from + (name === 'next-world' ? 1 : -1))));
            }
            const index = levels.findIndex((l) => l.id === id);
            if (name === 'pick' && index >= 0) openPopup(index);
          },
        });
        return;
      }
      closeUpgrades();
      popup?.close();
      popup = null;
      menu?.close();
      menu = null;
      // Back on the menu after a run, the map opens on the current level's world again.
      setShownWorld(null);
      if (phase === 'playing') {
        end?.close();
        end = null;
        bosses = untrack(() => run()?.bosses ?? 0);
        setFlights([]);
        return;
      }
      if (!phase || end) return;
      end = views.push(EndView, untrack(endModel), {
        onIntent: (name) => {
          if (name === 'restart') emit(RestartRequested);
          if (name === 'menu') emit(MenuRequested);
        },
      });
    });
    return [];
  },
});
