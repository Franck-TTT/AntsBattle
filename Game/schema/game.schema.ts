import { array, asset, bool, component, dataAsset, entity, enumOf, event, f32, i16, i32, i8, p, resource, tag, u16, u32, u8 } from '@gameengine/schema';

// Item kinds: index 0 is "nothing". New weapons are added at the end of this list and in src/balance.ts.
export const ITEM_KINDS = ['none', 'wall', 'tower', 'cannon', 'frost', 'mine', 'boostPad', 'mortar', 'flamethrower', 'radar', 'bank'] as const;
export const ENEMY_KINDS = ['ant', 'fast', 'beetle', 'boss'] as const;
export const FX_KINDS = ['dust', 'pop', 'boom', 'hit', 'baseHit', 'casing'] as const;
// Block footprints, width × height in cells. New shapes go at the end (and in src/balance.ts SHAPES).
export const BLOCK_SHAPES = ['b1x1', 'b2x2', 'b2x1', 'b1x2', 'b3x1', 'b1x3'] as const;
/** Meta upgrades the Roll can give (their effect lives in src/meta.ts; rarity and value per level in the sheet's Upgrades tab). */
export const UPGRADE_KINDS = ['towerDmg', 'cannonDmg', 'startGold', 'killGold', 'fireRate', 'towerRange', 'cannonAoe', 'freeCell', 'globalDmg', 'life', 'reroll', 'freeTower', 'slowmo'] as const;
export const RARITIES = ['common', 'rare', 'epic', 'legendary'] as const;
/** Item kinds a weapon can be (every kind but 'none' and 'wall'). */
const WEAPON_KINDS = ITEM_KINDS.filter((k) => k !== 'none' && k !== 'wall');
/** Most nests a level can have (one path colour each, src/looks.ts FLOW_COLORS). */
export const MAX_NESTS = 5;
/** The largest board a level can have (src/grid.ts COLS, ROWS); cells are numbered row * MAX_COLS + col. */
export const MAX_COLS = 10;
export const MAX_ROWS = 14;
const MAX_CELLS = MAX_COLS * MAX_ROWS;

/** A level's starting layout: blocks and weapons already on the board, locked (never moved). */
export const LevelDef = dataAsset(
  'LevelDef',
  {
    id: p.str('Stable id saves and analytics use; never changes once shipped'),
    name: p.str('Shown on the level menu'),
    order: p.int('Position on the level menu, from 1; 0 keeps it off the menu (test layouts)'),
    blocks: p.arr(
      p.obj({
        shape: p.oneOf(BLOCK_SHAPES),
        col: p.int('Column of the top-left cell, 0 on the left'),
        row: p.int('Row of the top-left cell, 0 at the top'),
      }),
      'Pre-placed blocks',
    ),
    weapons: p.arr(
      p.obj({
        kind: p.oneOf(WEAPON_KINDS),
        col: p.int('Column, 0 on the left'),
        row: p.int('Row, 0 at the top; the cell must hold a pre-placed block'),
      }),
      'Pre-placed weapons, each standing on a pre-placed block cell',
    ),
    cols: p.optional(p.int('Board width in cells, 4 to 10; absent: 7')),
    rows: p.optional(p.int('Board height in cells, 4 to 14; absent: 11')),
    nests: p.optional(
      p.arr(
        p.obj({
          col: p.int('Column, 0 on the left'),
          row: p.int('Row, 0 at the top'),
          fromWave: p.int('Wave it opens on (1: open from the start)'),
        }),
        'Ant nests, 1 to 5, in path-colour order; absent: the default nests (src/grid.ts)',
      ),
    ),
    base: p.optional(p.obj({ col: p.int('Column, 0 on the left'), row: p.int('Row, 0 at the top') }, 'The base to defend; absent: the default base (src/grid.ts)')),
    noBuild: p.optional(
      p.arr(
        p.obj({ col: p.int('Column, 0 on the left'), row: p.int('Row, 0 at the top') }),
        'No-build cells: the player can place nothing there (the 8 cells around each nest always are); ants walk through',
      ),
    ),
    waves: p.optional(p.int('Waves to hold to win: the first N of the Waves tab of the sheet, 1 to all; absent: all')),
    power: p.optional(p.int('Advised POWER (meta upgrades) shown on the level map popup; absent: none shown')),
  },
  { doc: 'A level layout: its nests, its base, and what stands on the board when a run starts.' },
);

/** The world structure: which levels make up each world, in order (assets/levels/worlds.json). */
export const WorldsDef = dataAsset(
  'WorldsDef',
  {
    worlds: p.arr(
      p.obj({
        name: p.str('Shown to the player'),
        levels: p.arr(p.str('A LevelDef id; empty: no level in this slot yet'), 'The world\'s level slots, in play order'),
      }),
      'Worlds in play order',
    ),
  },
  { doc: 'The world structure: each world and the levels it holds, in order.' },
);

/** The level this scene plays. */
export const Level = resource(
  'Level',
  {
    data: asset('data', { doc: 'The LevelDef this run starts from (none: an empty board)' }),
    loads: u32({ doc: 'Bumped on every level load (menu pick, level.load cheat) so loading the same level again restarts the run' }),
  },
  { sim: true },
);

/** One run: economy, waves, lives and the counters presentation follows. */
export const Run = resource(
  'Run',
  {
    phase: enumOf('RunPhase', ['playing', 'won', 'lost', 'menu']),
    runId: u32({ doc: 'Bumped on every restart' }),
    time: f32({ doc: 'Game seconds, scaled by speed (slow motion while dragging)' }),
    speed: f32({ default: 1, doc: 'Game speed: 1 normal, 0.05 while a finger drags an item' }),
    wave: u32({ doc: 'Waves started so far (0 before the first)' }),
    lives: u32(),
    gold: u32(),
    goldFrac: f32({ doc: 'Fractional gold from swarm kills, paid out as whole coins' }),
    wallsBuilt: u32({ doc: 'Walls bought this run (the first FREE_WALLS are free)' }),
    nextWaveAt: f32(),
    group: u32({ doc: 'Spawn group of the current wave' }),
    groupSpawned: u32(),
    spawnAt: f32(),
    spawning: bool(),
    alive: u32(),
    kills: u32(),
    bossSteps: u32({ doc: 'Steps left of the boss intro beat' }),
    // Counters presentation watches to play sounds, shakes and flashes.
    placements: u32(),
    refusals: u32(),
    shots: u32(),
    booms: u32(),
    hurts: u32({ doc: 'Damage events on enemies (the camera tremor follows it)' }),
    baseHits: u32(),
    bosses: u32(),
    nestTurn: u32({ doc: 'Round-robin counter: which open nest the next ant leaves from' }),
    nestsOpen: u32({ doc: 'Nests open so far (presentation plays the opening)' }),
    // End-of-run rewards (PayRun), shown on the end screen.
    paid: bool({ doc: 'The end-of-run reward was paid into the meta' }),
    stars: u8({ doc: 'Stars this run earned (0 on a defeat)' }),
    newStars: u8({ doc: 'Stars above the best already won on this level (they charge the Luxury roll)' }),
    coinsWon: u32({ doc: 'Meta coins this run paid' }),
    graced: u16({ doc: 'Placed blocks and weapons still inside their move grace window (MoveGrace runs, and the overlay draws their rings, only while it is above 0)' }),
  },
  { sim: true },
);

/** The board, up to MAX_COLS × MAX_ROWS: the level's size, nests and base, what stands on each cell, and the flow field the ants follow. Row 0 is the top. */
export const Board = resource(
  'Board',
  {
    cells: array(u8(), MAX_CELLS, { doc: '1 where a block stands (blocks the ants), 0 free' }),
    noBuild: array(u8(), MAX_CELLS, { doc: '1 where the player can place nothing: the no-build cells of the level and the 8 cells around each nest' }),
    weapons: array(u8(), MAX_CELLS, { doc: 'Weapon kind index on each cell (0 none): on its block, or on the ground for a mine or a boost pad' }),
    dist: array(i16(), MAX_CELLS, { doc: 'Steps to the base per cell, -1 unreachable or blocked' }),
    path: array(u8(), MAX_CELLS, { doc: 'Cells of the path from the nest to the base' }),
    pathLen: u8(),
    version: u32(),
    cols: u8({ doc: 'Board width of this level (cells past it are off the board)' }),
    rows: u8({ doc: 'Board height of this level' }),
    nestCount: u8({ doc: 'Nests of this level (1 to MAX_NESTS)' }),
    nestCell: array(u8(), MAX_NESTS, { doc: 'Cell of each nest' }),
    nestWave: array(u8(), MAX_NESTS, { doc: 'Wave each nest opens on' }),
    baseCell: u8({ doc: 'Cell of the base' }),
    waveCount: u8({ doc: 'Waves to hold to win this level (LevelDef.waves, else every wave of the sheet)' }),
  },
  { sim: true },
);

/**
 * What the player's meta upgrades change in a run, written by StartRun from the meta (src/meta.ts)
 * so the hot systems read plain numbers. Arrays are by ItemKind index.
 */
export const Boost = resource(
  'Boost',
  {
    damage: array(f32(), ITEM_KINDS.length, { doc: 'Damage multiplier per weapon kind (StartRun writes 1 and up)' }),
    range: array(f32(), ITEM_KINDS.length, { doc: 'Range added per weapon kind, cells' }),
    splash: array(f32(), ITEM_KINDS.length, { doc: 'Splash radius added per weapon kind, cells' }),
    period: f32({ default: 1, doc: 'Cooldown multiplier of every weapon' }),
    killGold: f32({ default: 1, doc: 'Gold per kill multiplier' }),
    drag: f32({ default: 1, doc: 'Multiplier of the game speed while dragging' }),
    freeWalls: u8({ doc: "Blocks that cost nothing, on top of the sheet's Free walls" }),
    freeRerolls: u8({ doc: 'Rerolls that cost nothing each wave' }),
    freeTower: bool({ doc: 'The first offer holds a tower' }),
  },
  { sim: true },
);

/**
 * The bottom panel (tray, then the HUD above it), pinned to the bottom of the screen at the same
 * size on every level: world placement written by FitView from the screen (grid.ts panelLayout).
 */
export const Panel = resource(
  'Panel',
  {
    x: f32({ doc: 'World x of the panel centre' }),
    trayY: f32({ doc: 'World y of the tray centre line' }),
    hudY: f32({ doc: 'World y of the HUD bar centre line' }),
    scale: f32({ default: 1, doc: 'World units per tray unit (grid.ts TRAY_* sizes)' }),
  },
  { sim: true },
);

/** The item under the finger: picked from the tray or from the board. */
export const Placement = resource(
  'Placement',
  {
    active: bool(),
    kind: enumOf('ItemKind', ITEM_KINDS),
    shape: enumOf('BlockShape', BLOCK_SHAPES),
    fromItem: entity({ doc: 'The placed item being moved, or none for a tray pick' }),
    fromCell: i16({ default: -1 }),
    slot: i8({ default: -1, doc: 'Tray slot it came from' }),
    x: f32(),
    y: f32(),
    cell: i16({ default: -1, doc: 'Hovered cell (a block: its top-left cell), -1 off the board' }),
    valid: bool(),
    reason: enumOf('PlaceReason', ['ok', 'offBoard', 'occupied', 'blocks', 'gold', 'enemy', 'noBlock', 'fixed', 'noBuild', 'moveLocked']),
    previewDist: array(i16(), MAX_CELLS, { doc: 'Flow field if the hovered drop happened (each nest preview path is traced from it)' }),
    previewLen: u8({ doc: '1 when previewDist holds a valid preview' }),
    // Snap back after a refused drop.
    returnSteps: u8(),
    retFromX: f32(),
    retFromY: f32(),
    retToX: f32(),
    retToY: f32(),
    retKind: enumOf('ItemKind', ITEM_KINDS),
    retShape: enumOf('BlockShape', BLOCK_SHAPES),
    moveGrace: f32({ default: -1, doc: "Move grace window override, game seconds (cheat placement.moveGrace; kept across restarts): -1 the sheet's MOVE_GRACE, 0 no limit" }),
  },
  { sim: true },
);

/** The weapon info popup: a tap on a weapon (offer or board) opens it and pauses the run until it closes. */
export const WeaponInfo = resource(
  'WeaponInfo',
  {
    open: bool({ doc: 'The popup is open: the run is paused' }),
    kind: enumOf('ItemKind', ITEM_KINDS),
    slot: i8({ default: -1, doc: 'Offer slot tapped, -1 for a weapon on the board' }),
    cell: i16({ default: -1, doc: 'Board cell tapped, -1 for an offer' }),
    opens: u32({ doc: 'Bumped on every open, so the UI opens a new popup' }),
  },
  { sim: true },
);

/** The settings popup: the gear in the HUD opens it and pauses the run until it closes. */
export const SettingsMenu = resource('SettingsMenu', { open: bool({ doc: 'The popup is open: the run is paused' }) }, { sim: true });

/** A block on the board: movable during its grace window, then fixed; blocks the ants, carries weapons. */
export const Block = component(
  'Block',
  {
    shape: enumOf('BlockShape', BLOCK_SHAPES),
    cell: u8({ doc: 'Top-left cell' }),
    placedAt: f32(),
    denySteps: u8({ doc: 'Shake left after a refused pick-up' }),
    locked: bool({ doc: 'Pre-placed by the level: never moved, never destroyed' }),
    grace: f32({ doc: 'Game seconds left of its move grace window (counted from its first drop; a move does not restart it); 0: locked in place, unless MOVE_GRACE is 0 (no limit)' }),
    held: bool({ doc: 'Picked up by the finger right now (being moved)' }),
  },
  { sim: true },
);

/** A weapon standing on a block cell (a mine or a boost pad: on a free ground cell). */
export const Item = component(
  'Item',
  {
    kind: enumOf('ItemKind', ITEM_KINDS),
    cell: u8(),
    grace: f32({ doc: 'Game seconds left of its move grace window (counted from its first drop; a move does not restart it); 0: locked in place, unless MOVE_GRACE is 0 (no limit)' }),
    reload: f32({ doc: 'Game seconds before it fires again' }),
    aim: f32({ doc: 'Barrel angle, radians' }),
    placedAt: f32({ doc: 'Run.time of its last drop (squash and stretch)' }),
    denySteps: u8({ doc: 'Shake left after a refused pick-up' }),
    held: bool({ doc: 'Picked up by the finger right now' }),
    locked: bool({ doc: 'Pre-placed by the level: never moved, never destroyed' }),
  },
  { sim: true },
);

export const Enemy = component(
  'Enemy',
  {
    kind: enumOf('EnemyKind', ENEMY_KINDS),
    hp: f32(),
    maxHp: f32(),
    speed: f32({ doc: 'Cells per game second' }),
    reward: f32({ doc: 'Gold per kill (fractional at swarm scale)' }),
    damage: u32({ doc: 'Lives lost when it reaches the base' }),
    hx: f32({ default: 0, doc: 'Facing, unit vector x (smoothed; no trig per step)' }),
    hy: f32({ default: -1, doc: 'Facing, unit vector y' }),
    remaining: f32({ doc: 'Path length left to the base, for targeting' }),
    flashSteps: u8(),
    lane: f32({ doc: 'Sideways offset in its column, cells (spreads the swarm)' }),
    bornAt: f32(),
    nest: u8({ doc: 'Cell of the nest it came out of (a block dropped on it moves it onto the new path from there)' }),
    kx: f32({ doc: 'Knockback velocity x, cells per game second (decays; the walk brings it back on its path)' }),
    ky: f32({ doc: 'Knockback velocity y' }),
    slow: f32({ doc: 'Share of its speed lost while slowed (frost)' }),
    slowLeft: f32({ doc: 'Game seconds of slow left' }),
    haste: f32({ doc: 'Share of speed gained while hasted (boost pad)' }),
    hasteLeft: f32({ doc: 'Game seconds of haste left' }),
    burn: f32({ doc: 'Damage per game second while burning (flamethrower)' }),
    burnLeft: f32({ doc: 'Game seconds of burning left' }),
  },
  { sim: true },
);

export const Projectile = component(
  'Projectile',
  {
    kind: enumOf('ItemKind', ITEM_KINDS),
    target: entity(),
    tx: f32(),
    ty: f32(),
    damage: f32(),
    splash: f32(),
    speed: f32(),
    knockback: f32({ doc: 'Push given on impact, cells per second' }),
    shock: f32({ doc: 'Shockwave radius on impact, cells' }),
    ux: f32({ doc: 'Flight direction, unit vector x (kept for the push at impact)' }),
    uy: f32({ doc: 'Flight direction, unit vector y' }),
    slow: f32({ doc: 'Share of speed the enemies hit lose (frost)' }),
    slowTime: f32({ doc: 'Game seconds the slow lasts' }),
    puddle: f32({ doc: 'Damage per game second of the puddle left on impact (mortar), 0 none' }),
    puddleSize: f32({ doc: 'Puddle radius, cells' }),
    puddleTime: f32({ doc: 'Game seconds the puddle lasts' }),
  },
  { sim: true },
);

/** A puddle left by a mortar shell: hurts every enemy inside it each step until it dries. */
export const Puddle = component(
  'Puddle',
  {
    radius: f32({ doc: 'Cells' }),
    dps: f32({ doc: 'Damage per game second to each enemy inside' }),
    left: f32({ doc: 'Game seconds before it dries' }),
    life: f32({ doc: 'Game seconds it lasts in all (for the fade)' }),
  },
  { sim: true },
);

/** The three items on offer. Once all three are bought a new set is drawn; Reroll draws one early, for gold. */
export const Offer = resource(
  'Offer',
  {
    kinds: array(u8(), 3, { doc: 'ItemKind index per offer slot' }),
    shapes: array(u8(), 3, { doc: 'BlockShape index per offer slot (blocks)' }),
    sold: array(u8(), 3, { doc: '1 once bought; the slot stays empty until the next set' }),
    sets: u32({ doc: 'Sets drawn this run' }),
    rerolls: u32({ doc: 'Rerolls bought this run (the price rises with each)' }),
    version: u32({ doc: 'Bumped on every new set or purchase, so the tray redraws' }),
    freeRerolls: u8({ doc: 'Free rerolls left this wave (Boost.freeRerolls, refilled at each wave)' }),
    singlePick: u8({ doc: 'Single-pick variant: 0 as the sheet says (SINGLE_PICK), 1 forced on, 2 forced off (cheat; kept across restarts)' }),
  },
  { sim: true },
);

/** A tray slot: slots 0–2 show the offer, slot 3 is the Reroll button. */
export const TraySlot = component('TraySlot', { slot: u8(), shownVersion: i32({ default: -1 }), shownPrice: i16({ default: -2 }), affordable: bool() }, { sim: true });
export const TrayLabel = component('TrayLabel', { slot: u8() }, { sim: true });
/** The coin shown left of a slot's price; hidden when the slot is sold or free. */
export const TrayCoin = component('TrayCoin', { slot: u8() }, { sim: true });
/** The icon shapes of an offer slot, replaced when the offer changes. */
export const TrayIcon = component('TrayIcon', { slot: u8() }, { sim: true });
export const BankPaid = event('BankPaid', { x: f32(), y: f32(), gold: u32() }, { sim: true, doc: 'Signal: a bank paid its gold at the start of a wave.' });
export const OfferRerolled = event('OfferRerolled', { price: u32() }, { sim: true, doc: 'Signal: the player paid for a new offer.' });
export const FxHost = component('FxHost', { kind: enumOf('FxKind', FX_KINDS) }, { sim: true });
export const BoardTile = tag('BoardTile', { sim: true });
/** Beetles and bosses: HP bars and the grow-in, which plain ants skip to stay cheap at swarm scale. */
export const Big = tag('Big', { sim: true });
/** One per board cell: the flow field in a form hot systems read without array views. */
export const FlowCell = component('FlowCell', { cell: u8(), dist: i16({ default: -1 }), next: i16({ default: -1 }) }, { sim: true });
export const Base = tag('Base', { sim: true });
/** The lives count drawn on the base (BaseLives keeps it current). */
export const BaseLabel = component('BaseLabel', { shown: i16({ default: -1 }) }, { sim: true });
/** The hole of a nest slot: shown once its nest is open (Board.nestWave). */
export const NestSpot = component('NestSpot', { index: u8(), open: bool() }, { sim: true });
/** The mound of a nest slot: parent of its hole and label, moved onto the level's nest (or hidden). */
export const NestMound = component('NestMound', { index: u8() }, { sim: true });
export const NestLabel = component('NestLabel', { index: u8() }, { sim: true });
export const NestOpened = event('NestOpened', { nest: u8(), wave: u32() }, { sim: true, doc: 'Signal: a new nest opened.' });

export const RestartRequested = event('RestartRequested', {}, { sim: true, doc: 'The player pressed Restart on the end screen.' });
export const LevelPicked = event('LevelPicked', { index: u8({ doc: 'Position in menuLevels() (src/levels.ts), from 0' }) }, { sim: true, doc: 'The player picked a level on the level menu.' });
export const RollRequested = event('RollRequested', { luxury: bool({ doc: 'The Luxury roll (paid with star charge, Rare or better) instead of the coin Roll' }) }, { sim: true, doc: 'The player pressed Roll or Luxury on the Upgrades screen.' });
export const UpgradeRolled = event('UpgradeRolled', { upgrade: enumOf('UpgradeKind', UPGRADE_KINDS), rarity: enumOf('Rarity', RARITIES), level: u8(), luxury: bool() }, { sim: true, doc: 'Signal: a roll gave an upgrade (the reveal popup shows it).' });
export const WeaponInfoClosed = event('WeaponInfoClosed', {}, { sim: true, doc: 'The player closed the weapon info popup: the run resumes.' });
export const SettingsToggled = event('SettingsToggled', { open: bool() }, { sim: true, doc: 'The player opened (gear in the HUD) or closed the settings popup: the run pauses while it is open.' });
export const AudioSettingsChanged = event('AudioSettingsChanged', { sound: bool(), music: bool() }, { sim: true, doc: 'The player switched sound or music on or off in the settings popup.' });
export const MenuRequested = event('MenuRequested', {}, { sim: true, doc: 'The player asked for the level menu.' });
export const EnemyKilled = event('EnemyKilled', { x: f32(), y: f32(), gold: u32(), kind: enumOf('EnemyKind', ENEMY_KINDS) }, { sim: true, doc: 'Signal: an enemy died; gold flies to the counter.' });
export const WaveStarted = event('WaveStarted', { wave: u32(), boss: bool(), newNest: bool() }, { sim: true, doc: 'Signal: a wave started.' });
export const ItemPlaced = event('ItemPlaced', { kind: enumOf('ItemKind', ITEM_KINDS), shape: enumOf('BlockShape', BLOCK_SHAPES), cell: u8(), moved: bool(), cost: u32() }, { sim: true, doc: 'Signal: an item was dropped on the board.' });
export const PlacementRefused = event('PlacementRefused', { reason: enumOf('PlaceReason', ['ok', 'offBoard', 'occupied', 'blocks', 'gold', 'enemy', 'noBlock', 'fixed', 'noBuild', 'moveLocked']) }, { sim: true, doc: 'Signal: a drop was refused.' });
