// @generated — do not edit. Regenerate with `pnpm gen` (tools/bindgen).
// This project's UI documents (ui/**/*.ui.json, ADR 0122) as types: `<Widget doc="…">` checks its
// props, codeAreas and refs against them. Types only: nothing imports this file at run time.
// Events are the names `onIntent` hears: `<id>` is the placing `<Widget>`'s `id` or `eventKey` (else a slug of
// its first text property's value, else the document's name), or in a document the use's key; `<item>` is a
// Repeat item's key.
import type { TextSourceRef } from '@gameengine/ui';

declare module '@gameengine/ui' {
  interface UiDocumentTypes {
    /**
     * Element: a widget (ui/docs/bottom-nav.ui.json)
     *
     * Properties:
     *   - `upBadge`: text, default "1"
     *   - `upReady`: yesno, default false
     *   - `upActive`: yesno, default false
     *   - `mapActive`: yesno, default true
     * Events: `<id>: upgrades`, `<id>: maptab`
     * Code areas: none
     * Refs: `upgrades`, `maptab`
     */
    'bottom-nav': {
      props: { upBadge: string | TextSourceRef; upReady: boolean; upActive: boolean; mapActive: boolean };
      areas: never;
      refs: 'upgrades' | 'maptab';
    };
    /**
     * End screen: a view, dialog (ui/docs/end-screen.ui.json)
     *
     * Properties:
     *   - `result`: enum won | lost, default "won"
     *   - `title`: text, default "VICTORY!"
     *   - `subtitle`: text, default "All 10 waves held"
     *   - `reward`: text, default "+60 coins · 2 stars"
     * Events: `restart`, `menu`
     * Code areas: none
     * Refs: `restart`, `menu`
     * Samples (`view render doc:end-screen --sample …`): `won`, `lost`
     */
    'end-screen': {
      props: { result: 'won' | 'lost'; title: string | TextSourceRef; subtitle: string | TextSourceRef; reward: string | TextSourceRef };
      areas: never;
      refs: 'restart' | 'menu';
    };
    /**
     * Gear button: a widget, button (ui/docs/gear-button.ui.json)
     *
     * Properties: none
     * Events: `<id>`
     * Code areas: none
     * Refs: none
     */
    'gear-button': {
      props: {};
      areas: never;
      refs: never;
    };
    /**
     * Home / Level map: a view, screen (ui/docs/home.ui.json)
     *
     * Properties:
     *   - `coins`: text, default "1,240"
     *   - `stars`: text, default "12"
     *   - `luxText`: text, default "2 / 10"
     *   - `chapter`: text, default "CHAPTER 1"
     *   - `playDetail`: text, default "Level 6 · Crossfire"
     *   - `upBadge`: text, default "1"
     *   - `luxReady`: yesno, default false
     *   - `luxCount`: text, default "1"
     *   - `upReady`: yesno, default false
     *   - `luxStars`: number, default 2
     *   - `luxGoal`: number, default 10
     * Events: `topbar: settings`, `play`, `bottomnav: upgrades`, `bottomnav: maptab`
     * Code areas: `map`
     * Refs: `topbar`, `topbar.coins`, `topbar.starchip`, `topbar.settings`, `luxsteps`, `play`, `bottomnav`, `bottomnav.upgrades`, `bottomnav.maptab`
     * Samples (`view render doc:home --sample …`): `half`
     */
    'home': {
      props: { coins: string | TextSourceRef; stars: string | TextSourceRef; luxText: string | TextSourceRef; chapter: string | TextSourceRef; playDetail: string | TextSourceRef; upBadge: string | TextSourceRef; luxReady: boolean; luxCount: string | TextSourceRef; upReady: boolean; luxStars: number; luxGoal: number };
      areas: 'map';
      refs: 'topbar' | 'topbar.coins' | 'topbar.starchip' | 'topbar.settings' | 'luxsteps' | 'play' | 'bottomnav' | 'bottomnav.upgrades' | 'bottomnav.maptab';
    };
    /**
     * HUD bar: a widget (ui/docs/hud-bar.ui.json)
     *
     * Properties:
     *   - `gold`: number, default 60
     * Events: none
     * Code areas: none
     * Refs: `gold`, `gold.target`
     * Samples (`view render doc:hud-bar --sample …`): `start`, `late`
     */
    'hud-bar': {
      props: { gold: number };
      areas: never;
      refs: 'gold' | 'gold.target';
    };
    /**
     * Icon button: a widget, button (ui/docs/icon-button.ui.json)
     *
     * Properties:
     *   - `icon`: image, default {"guid":"31b3b5d4-174f-49ff-8ddc-783ac4958896"}
     * Events: `<id>`
     * Code areas: none
     * Refs: none
     */
    'icon-button': {
      props: { icon: string };
      areas: never;
      refs: never;
    };
    /**
     * Info chip: a widget (ui/docs/info-chip.ui.json)
     *
     * Properties:
     *   - `k`: text, default "Nests"
     *   - `v`: text, default "2"
     *   - `color`: enum pink | blue | green | gold, default "pink"
     * Events: none
     * Code areas: none
     * Refs: none
     */
    'info-chip': {
      props: { k: string | TextSourceRef; v: string | TextSourceRef; color: 'pink' | 'blue' | 'green' | 'gold' };
      areas: never;
      refs: never;
    };
    /**
     * Level button: a widget, button (ui/docs/level-button.ui.json)
     *
     * Properties:
     *   - `name`: text, default "Button"
     *   - `number`: number, default 1
     * Events: `<id>`
     * Code areas: none
     * Refs: none
     */
    'level-button': {
      props: { name: string | TextSourceRef; number: number };
      areas: never;
      refs: never;
    };
    /**
     * Level menu: a view, dialog (ui/docs/level-menu.ui.json)
     *
     * Properties:
     *   - `levels`: list of level-button
     * Events: `press (<item>)`
     * Code areas: none
     * Refs: none
     */
    'level-menu': {
      props: { levels: readonly { key: string; name?: string | TextSourceRef; number?: number }[] };
      areas: never;
      refs: never;
    };
    /**
     * Level popup: a view, dialog (ui/docs/level-popup.ui.json)
     *
     * Properties:
     *   - `kicker`: text, default "LEVEL 6"
     *   - `name`: text, default "Crossfire"
     *   - `lockText`: text, default "Win level 5 to unlock"
     *   - `stars`: number, default 0
     *   - `locked`: yesno, default false
     *   - `boss`: yesno, default false
     *   - `info`: list of info-chip
     * Events: `dismiss`, `close`, `play`
     * Code areas: `preview`
     * Refs: `close`, `stars`, `play`
     */
    'level-popup': {
      props: { kicker: string | TextSourceRef; name: string | TextSourceRef; lockText: string | TextSourceRef; stars: number; locked: boolean; boss: boolean; info: readonly { key: string; k?: string | TextSourceRef; v?: string | TextSourceRef; color?: 'pink' | 'blue' | 'green' | 'gold' }[] };
      areas: 'preview';
      refs: 'close' | 'stars' | 'play';
    };
    /**
     * Level stars: a widget (ui/docs/level-stars.ui.json)
     *
     * Properties:
     *   - `steps`: number, default 5
     *   - `progress`: number, default 3
     * Events: none
     * Code areas: none
     * Refs: none
     */
    'level-stars': {
      props: { steps: number; progress: number };
      areas: never;
      refs: never;
    };
    /**
     * Level stars segment: a widget, toggle (ui/docs/level-stars-segment.ui.json)
     *
     * Properties:
     *   - `on`: yesno, default false
     * Events: `<id>: changed`
     * Code areas: none
     * Refs: none
     */
    'level-stars-segment': {
      props: { on: boolean };
      areas: never;
      refs: never;
    };
    /**
     * Lux steps: a widget (ui/docs/lux-steps.ui.json)
     *
     * Properties:
     *   - `steps`: number, default 5
     *   - `progress`: number, default 3
     * Events: none
     * Code areas: none
     * Refs: none
     */
    'lux-steps': {
      props: { steps: number; progress: number };
      areas: never;
      refs: never;
    };
    /**
     * Lux steps segment: a widget, toggle (ui/docs/lux-steps-segment.ui.json)
     *
     * Properties:
     *   - `on`: yesno, default false
     * Events: `<id>: changed`
     * Code areas: none
     * Refs: none
     */
    'lux-steps-segment': {
      props: { on: boolean };
      areas: never;
      refs: never;
    };
    /**
     * Map node: a widget, button (ui/docs/map-node.ui.json)
     *
     * Properties:
     *   - `num`: number, default 1
     *   - `stars`: number, default 0
     *   - `state`: enum done | current | locked | boss, default "done"
     * Events: `<id>`
     * Code areas: none
     * Refs: `stars`
     */
    'map-node': {
      props: { num: number; stars: number; state: 'done' | 'current' | 'locked' | 'boss' };
      areas: never;
      refs: 'stars';
    };
    /**
     * Meta chip: a widget (ui/docs/meta-chip.ui.json)
     *
     * Properties:
     *   - `value`: text, default "1,240"
     *   - `icon`: image, default {"guid":"d95efa6e-2703-4582-b964-5305acf63ea5"}
     *   - `kind`: enum coins | stars, default "coins"
     * Events: none
     * Code areas: none
     * Refs: none
     */
    'meta-chip': {
      props: { value: string | TextSourceRef; icon: string; kind: 'coins' | 'stars' };
      areas: never;
      refs: never;
    };
    /**
     * Nav button: a widget, button (ui/docs/nav-button.ui.json)
     *
     * Properties:
     *   - `label`: text, default "Button"
     *   - `icon`: image, default {"guid":"08280257-c237-4b96-83f3-e5146ed66ba4"}
     *   - `active`: yesno, default false
     *   - `badge`: text, default ""
     *   - `hasBadge`: yesno, default false
     * Events: `<id>`
     * Code areas: none
     * Refs: none
     */
    'nav-button': {
      props: { label: string | TextSourceRef; icon: string; active: boolean; badge: string | TextSourceRef; hasBadge: boolean };
      areas: never;
      refs: never;
    };
    /**
     * Play button: a widget, button (ui/docs/play-button.ui.json)
     *
     * Properties:
     *   - `label`: text, default "Button"
     *   - `detail`: text, default "Level 6 · Crossfire"
     * Events: `<id>`
     * Code areas: none
     * Refs: none
     */
    'play-button': {
      props: { label: string | TextSourceRef; detail: string | TextSourceRef };
      areas: never;
      refs: never;
    };
    /**
     * Restart button: a widget, button (ui/docs/restart-button.ui.json)
     *
     * Properties:
     *   - `label`: text, default "Button"
     * Events: `<id>`
     * Code areas: none
     * Refs: none
     */
    'restart-button': {
      props: { label: string | TextSourceRef };
      areas: never;
      refs: never;
    };
    /**
     * Roll button: a widget, button (ui/docs/roll-button.ui.json)
     *
     * Properties:
     *   - `label`: text, default "Button"
     *   - `sub`: text, default "150 coins"
     *   - `kicker`: text, default "ANY RARITY"
     *   - `accent`: enum gold | purple | gold-off | purple-off, default "gold"
     *   - `steps`: number, default 10
     *   - `progress`: number, default 2
     *   - `badge`: text, default "1"
     *   - `hasBadge`: yesno, default false
     * Events: `<id>`
     * Code areas: none
     * Refs: `steps`
     * Samples (`view render doc:roll-button --sample …`): `roll`, `luxury`
     */
    'roll-button': {
      props: { label: string | TextSourceRef; sub: string | TextSourceRef; kicker: string | TextSourceRef; accent: 'gold' | 'purple' | 'gold-off' | 'purple-off'; steps: number; progress: number; badge: string | TextSourceRef; hasBadge: boolean };
      areas: never;
      refs: 'steps';
    };
    /**
     * Settings: a view, dialog (ui/docs/settings.ui.json)
     *
     * Properties:
     *   - `sound`: yesno, default true
     *   - `music`: yesno, default true
     *   - `inRun`: yesno, default true
     * Events: `dismiss`, `close`, `sound: changed`, `music: changed`, `menu`
     * Code areas: none
     * Refs: `close`, `sound`, `music`, `menu`
     * Samples (`view render doc:settings --sample …`): `allOn`, `muted`, `menu`
     */
    'settings': {
      props: { sound: boolean; music: boolean; inRun: boolean };
      areas: never;
      refs: 'close' | 'sound' | 'music' | 'menu';
    };
    /**
     * Settings toggle: a widget, toggle (ui/docs/settings-toggle.ui.json)
     *
     * Properties:
     *   - `label`: text, default "Sound"
     *   - `on`: yesno
     * Events: `<id>: changed`
     * Code areas: none
     * Refs: none
     * Samples (`view render doc:settings-toggle --sample …`): `on`, `off`
     */
    'settings-toggle': {
      props: { label: string | TextSourceRef; on: boolean };
      areas: never;
      refs: never;
    };
    /**
     * Stat chip: a widget (ui/docs/stat-chip.ui.json)
     *
     * Properties:
     *   - `caption`: text, default "GOLD"
     *   - `amount`: number, default 60
     *   - `suffix`: text, default ""
     *   - `tone`: enum wave | gold | lives | walls, default "wave"
     * Events: none
     * Code areas: none
     * Refs: `target`
     * Samples (`view render doc:stat-chip --sample …`): `gold`, `wave`, `lives`, `walls`
     */
    'stat-chip': {
      props: { caption: string | TextSourceRef; amount: number; suffix: string | TextSourceRef; tone: 'wave' | 'gold' | 'lives' | 'walls' };
      areas: never;
      refs: 'target';
    };
    /**
     * Tile pips: a widget (ui/docs/tile-pips.ui.json)
     *
     * Properties:
     *   - `steps`: number, default 5
     *   - `progress`: number, default 3
     * Events: none
     * Code areas: none
     * Refs: none
     */
    'tile-pips': {
      props: { steps: number; progress: number };
      areas: never;
      refs: never;
    };
    /**
     * Tile pips epic: a widget (ui/docs/tile-pips-epic.ui.json)
     *
     * Properties:
     *   - `steps`: number, default 5
     *   - `progress`: number, default 3
     * Events: none
     * Code areas: none
     * Refs: none
     */
    'tile-pips-epic': {
      props: { steps: number; progress: number };
      areas: never;
      refs: never;
    };
    /**
     * Tile pips epic segment: a widget, toggle (ui/docs/tile-pips-epic-segment.ui.json)
     *
     * Properties:
     *   - `on`: yesno, default false
     * Events: `<id>: changed`
     * Code areas: none
     * Refs: none
     */
    'tile-pips-epic-segment': {
      props: { on: boolean };
      areas: never;
      refs: never;
    };
    /**
     * Tile pips legendary: a widget (ui/docs/tile-pips-legendary.ui.json)
     *
     * Properties:
     *   - `steps`: number, default 5
     *   - `progress`: number, default 3
     * Events: none
     * Code areas: none
     * Refs: none
     */
    'tile-pips-legendary': {
      props: { steps: number; progress: number };
      areas: never;
      refs: never;
    };
    /**
     * Tile pips legendary segment: a widget, toggle (ui/docs/tile-pips-legendary-segment.ui.json)
     *
     * Properties:
     *   - `on`: yesno, default false
     * Events: `<id>: changed`
     * Code areas: none
     * Refs: none
     */
    'tile-pips-legendary-segment': {
      props: { on: boolean };
      areas: never;
      refs: never;
    };
    /**
     * Tile pips rare: a widget (ui/docs/tile-pips-rare.ui.json)
     *
     * Properties:
     *   - `steps`: number, default 5
     *   - `progress`: number, default 3
     * Events: none
     * Code areas: none
     * Refs: none
     */
    'tile-pips-rare': {
      props: { steps: number; progress: number };
      areas: never;
      refs: never;
    };
    /**
     * Tile pips rare segment: a widget, toggle (ui/docs/tile-pips-rare-segment.ui.json)
     *
     * Properties:
     *   - `on`: yesno, default false
     * Events: `<id>: changed`
     * Code areas: none
     * Refs: none
     */
    'tile-pips-rare-segment': {
      props: { on: boolean };
      areas: never;
      refs: never;
    };
    /**
     * Tile pips segment: a widget, toggle (ui/docs/tile-pips-segment.ui.json)
     *
     * Properties:
     *   - `on`: yesno, default false
     * Events: `<id>: changed`
     * Code areas: none
     * Refs: none
     */
    'tile-pips-segment': {
      props: { on: boolean };
      areas: never;
      refs: never;
    };
    /**
     * Element: a widget (ui/docs/top-bar.ui.json)
     *
     * Properties:
     *   - `coins`: text, default "1,240"
     *   - `stars`: text, default "12"
     * Events: `<id>: settings`
     * Code areas: none
     * Refs: `coins`, `starchip`, `settings`
     */
    'top-bar': {
      props: { coins: string | TextSourceRef; stars: string | TextSourceRef };
      areas: never;
      refs: 'coins' | 'starchip' | 'settings';
    };
    /**
     * Upgrade reveal: a view, dialog (ui/docs/upgrade-reveal.ui.json)
     *
     * Properties:
     *   - `kicker`: text, default "NEW · RARE"
     *   - `name`: text, default "Tower range"
     *   - `levels`: text, default "Level 2 / 5"
     *   - `stat`: text, default "Tower range"
     *   - `effect`: text, default "+0.1 → +0.2 cells"
     *   - `rarity`: enum common | rare | epic | legendary, default "common"
     *   - `cta`: text, default "COLLECT"
     * Events: `dismiss`, `collect`
     * Code areas: none
     * Refs: `collect`
     * Samples (`view render doc:upgrade-reveal --sample …`): `epic`
     */
    'upgrade-reveal': {
      props: { kicker: string | TextSourceRef; name: string | TextSourceRef; levels: string | TextSourceRef; stat: string | TextSourceRef; effect: string | TextSourceRef; rarity: 'common' | 'rare' | 'epic' | 'legendary'; cta: string | TextSourceRef };
      areas: never;
      refs: 'collect';
    };
    /**
     * Upgrade tile: a widget, button (ui/docs/upgrade-tile.ui.json)
     *
     * Properties:
     *   - `label`: text, default "Button"
     *   - `icon`: image, default {"guid":"96fc4902-3f31-4123-ba3d-3f27ae669fe2"}
     *   - `level`: number, default 1
     *   - `max`: number, default 5
     *   - `rarity`: enum common | rare | epic | legendary, default "common"
     *   - `ink`: enum white | cyan | orange | gold | blue, default "white"
     *   - `owned`: yesno, default true
     *   - `locked`: yesno, default false
     *   - `unlock`: text, default "Unlock Lvl 8"
     *   - `lit`: yesno, default false
     *   - `lean`: enum none | left | right | up | down, default "none"
     * Events: `<id>`
     * Code areas: none
     * Refs: `pips`, `pipsrare`, `pipsepic`, `pipslegendary`
     */
    'upgrade-tile': {
      props: { label: string | TextSourceRef; icon: string; level: number; max: number; rarity: 'common' | 'rare' | 'epic' | 'legendary'; ink: 'white' | 'cyan' | 'orange' | 'gold' | 'blue'; owned: boolean; locked: boolean; unlock: string | TextSourceRef; lit: boolean; lean: 'none' | 'left' | 'right' | 'up' | 'down' };
      areas: never;
      refs: 'pips' | 'pipsrare' | 'pipsepic' | 'pipslegendary';
    };
    /**
     * Upgrades: a view, screen (ui/docs/upgrades.ui.json)
     *
     * Properties:
     *   - `power`: number, default 0
     *   - `rollSub`: text, default "150 coins"
     *   - `luxurySub`: text, default "0/10 stars"
     *   - `coins`: text, default "1,240"
     *   - `stars`: text, default "12"
     *   - `luxStars`: number, default 2
     *   - `luxGoal`: number, default 10
     *   - `luxCount`: text, default "1"
     *   - `luxReady`: yesno, default false
     *   - `rollAccent`: enum gold | purple | gold-off | purple-off, default "gold"
     *   - `luxAccent`: enum gold | purple | gold-off | purple-off, default "gold"
     * Events: `topbar: settings`, `roll`, `luxury`, `bottomnav: upgrades`, `bottomnav: maptab`
     * Code areas: `grid`
     * Refs: `topbar`, `topbar.coins`, `topbar.starchip`, `topbar.settings`, `roll`, `roll.steps`, `luxury`, `luxury.steps`, `bottomnav`, `bottomnav.upgrades`, `bottomnav.maptab`
     * Samples (`view render doc:upgrades --sample …`): `mid`
     */
    'upgrades': {
      props: { power: number; rollSub: string | TextSourceRef; luxurySub: string | TextSourceRef; coins: string | TextSourceRef; stars: string | TextSourceRef; luxStars: number; luxGoal: number; luxCount: string | TextSourceRef; luxReady: boolean; rollAccent: 'gold' | 'purple' | 'gold-off' | 'purple-off'; luxAccent: 'gold' | 'purple' | 'gold-off' | 'purple-off' };
      areas: 'grid';
      refs: 'topbar' | 'topbar.coins' | 'topbar.starchip' | 'topbar.settings' | 'roll' | 'roll.steps' | 'luxury' | 'luxury.steps' | 'bottomnav' | 'bottomnav.upgrades' | 'bottomnav.maptab';
    };
    /**
     * Wave banner: a view (ui/docs/wave-banner.ui.json)
     *
     * Properties:
     *   - `title`: text, default "WAVE 1"
     *   - `subtitle`: text, default "Here they come"
     *   - `tone`: enum normal | boss, default "normal"
     * Events: none
     * Code areas: none
     * Refs: none
     * Samples (`view render doc:wave-banner --sample …`): `normal`, `boss`
     */
    'wave-banner': {
      props: { title: string | TextSourceRef; subtitle: string | TextSourceRef; tone: 'normal' | 'boss' };
      areas: never;
      refs: never;
    };
    /**
     * Weapon info: a view, dialog (ui/docs/weapon-info.ui.json)
     *
     * Properties:
     *   - `kicker`: text, default "WEAPON · 40 GOLD"
     *   - `name`: text, default "Tower"
     *   - `desc`: text, default "Fast single-target shots"
     *   - `info`: list of info-chip
     * Events: `dismiss`, `close`
     * Code areas: none
     * Refs: `close`
     */
    'weapon-info': {
      props: { kicker: string | TextSourceRef; name: string | TextSourceRef; desc: string | TextSourceRef; info: readonly { key: string; k?: string | TextSourceRef; v?: string | TextSourceRef; color?: 'pink' | 'blue' | 'green' | 'gold' }[] };
      areas: never;
      refs: 'close';
    };
  }
}
