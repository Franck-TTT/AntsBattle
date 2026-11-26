/**
 * The game's UI controller: fills the HUD from the Run resource, shows the wave and boss
 * banners, flies coins from kills to the gold counter and opens the level menu and the end screen.
 * Presentation.
 */
import { createEffect, createSignal, defineUI, emit, onCleanup, onUiFrame, untrack, useDoc, useResource, views } from '@gameengine/ui';
import { onSignal, worldToUi } from '@gameengine/runtime';
import { BankPaid, Board, EnemyKilled, LevelPicked, MenuRequested, Panel, RestartRequested, RollRequested, Run, UpgradeRolled, WaveStarted } from '../schema.gen.ts';
import { WAVES, WAVE_COUNT, type EnemyKindName } from '../balance.ts';
import { levelWaves } from '../sim/level.ts';
import { HudView, type Flight, type HudModel } from '../views/hud.view.tsx';
import { BannerView, type BannerModel } from '../views/banner.view.tsx';
import { EndView, type EndModel } from '../views/end.view.tsx';
import { LevelMenuView, LevelPopupView, MAP_PATH, type LevelMenuModel, type LevelPopupModel, type MapNode } from '../views/level-menu.view.tsx';
import { UpgradeRevealView, UpgradesView, type Ink, type UpgradeTile, type UpgradesModel } from '../views/upgrades.view.tsx';
import { menuLevels } from '../levels.ts';
import { loadData } from '@gameengine/runtime';
import { LevelDef } from '../schema.gen.ts';
import { checkLayout } from '../layout.ts';
import { COLS } from '../grid.ts';
import { META, UPGRADES, levelOf, levelOpen, luxuryCharges, luxuryProgress, maxLevel, power, progress, rollCost, rollPool, upgradeDef, type MetaState, type UpgradeDef } from '../meta.ts';
import type { UpgradeKindName } from '../kinds.ts';

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

/** Enemy names on the map popup. */
const ENEMY_LABELS: Record<EnemyKindName, string> = { ant: 'Ant', fast: 'Fast ant', beetle: 'Beetle', boss: 'Boss' };


const canRoll = (s: MetaState) => s.coins >= rollCost(s) && rollPool(s, false).length > 0;
const canLuxury = (s: MetaState) => luxuryCharges(s) > 0 && rollPool(s, true).length > 0;
/** Most coins in the air at once. */
const MAX_FLIGHTS = 24;

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
        gold: r?.gold ?? 0,
        at: hudPoint(),
        flights: flights(),
      };
    };
    const hud = views.push(HudView, untrack(model), {
      onIntent: (name, payload) => {
        if (name === 'coinLanded') setFlights((fs) => fs.filter((f) => f.id !== payload));
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

    // Banners: "Wave X" at each wave start, "BOSS!" when the boss walks out.
    const banner = (m: BannerModel) => {
      const b = views.push(BannerView, m);
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
    const menuModel = (): LevelMenuModel => {
      const s = meta();
      const cur = currentIndex(s);
      // The chapter holding the current level: MAP_PATH.length levels a chapter, the last one a boss.
      const per = MAP_PATH.length;
      const first = Math.floor(cur / per) * per;
      const nodes: MapNode[] = levels.slice(first, first + per).map((l, k) => {
        const i = first + k;
        const state = i === cur ? 'current' : k === per - 1 ? 'boss' : levelOpen(s, ids, i) ? 'done' : 'locked';
        return { key: l.id, num: i + 1, state, stars: s.stars[l.id] ?? 0 };
      });
      const charges = luxuryCharges(s);
      const ready = canRoll(s) || canLuxury(s);
      return {
        coins: fmt(s.coins),
        stars: fmt(s.starTotal),
        chapter: `CHAPTER ${first / per + 1}`,
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
      const boss = index % MAP_PATH.length === MAP_PATH.length - 1;
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
      return fresh.length ? ENEMY_LABELS[fresh[fresh.length - 1]!] : '—';
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
    const upgradesModel = (): UpgradesModel => {
      const s = meta();
      const tiles = UPGRADES.map((u): UpgradeTile => {
        const level = levelOf(s, u.kind);
        const look = TILE_LOOKS[u.kind];
        return { key: u.kind, name: look.short, icon: look.icon, ink: look.ink, level, max: maxLevel(u.kind), rarity: u.rarity, owned: level > 0, locked: false, unlock: '' };
      });
      const charges = luxuryCharges(s);
      return {
        coins: fmt(s.coins),
        stars: fmt(s.starTotal),
        power: power(s),
        tiles: [...tiles, ...COMING],
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
      upgrades?.close();
      upgrades = null;
    };
    const openUpgrades = () => {
      upgrades ??= views.push(UpgradesView, untrack(upgradesModel), {
        onIntent: (name, key) => {
          if (name === 'tile') return showTile(key as string);
          if (name === 'roll' && canRoll(untrack(meta))) emit(RollRequested, { luxury: false });
          if (name === 'luxury' && canLuxury(untrack(meta))) emit(RollRequested, { luxury: true });
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

    // The reveal popup of each roll.
    onCleanup(
      onSignal(UpgradeRolled, (sig) => {
        const kind = sig.fields.upgrade as UpgradeKindName;
        const u = upgradeDef(kind);
        const level = sig.fields.level;
        const r = views.push(
          UpgradeRevealView,
          {
            kicker: `${sig.fields.luxury ? 'LUXURY' : level === 1 ? 'NEW' : 'UPGRADE'} · ${u.rarity}`,
            name: u.name,
            levels: `Level ${level} / ${maxLevel(kind)}`,
            stat: u.stat,
            effect: `${effectText(u, level - 1)} → ${effectText(u, level)}`,
            rarity: u.rarity,
            cta: 'COLLECT',
          },
          { onIntent: (name) => name === 'collect' && r.close() },
        );
      }),
    );

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
          onIntent: (name, id) => {
            if (name === 'upgrades') return openUpgrades();
            if (name === 'play') return emit(LevelPicked, { index: currentIndex(untrack(meta)) });
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
