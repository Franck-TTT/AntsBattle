import { array, bool, component, entity, enumOf, event, f32, i16, i32, i8, resource, tag, u32, u8 } from '@gameengine/schema';

// Item kinds: index 0 is "nothing". New weapons are added at the end of this list and in src/balance.ts.
export const ITEM_KINDS = ['none', 'wall', 'tower', 'cannon'] as const;
export const ENEMY_KINDS = ['ant', 'fast', 'beetle', 'boss'] as const;
export const FX_KINDS = ['dust', 'pop', 'boom', 'hit', 'baseHit'] as const;
// Block footprints, width × height in cells. New shapes go at the end (and in src/balance.ts SHAPES).
export const BLOCK_SHAPES = ['b1x1', 'b2x2', 'b2x1', 'b1x2', 'b3x1', 'b1x3'] as const;

/** One run: economy, waves, lives and the counters presentation follows. */
export const Run = resource(
  'Run',
  {
    phase: enumOf('RunPhase', ['playing', 'won', 'lost']),
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
    baseHits: u32(),
    bosses: u32(),
    nestTurn: u32({ doc: 'Round-robin counter: which open nest the next ant leaves from' }),
    nestsOpen: u32({ doc: 'Nests open so far (presentation plays the opening)' }),
  },
  { sim: true },
);

/** The 7×11 grid: what stands on each cell, and the flow field the ants follow. Row 0 is the top. */
export const Board = resource(
  'Board',
  {
    cells: array(u8(), 77, { doc: '1 where a block stands (blocks the ants), 0 free' }),
    weapons: array(u8(), 77, { doc: 'Weapon kind index standing on the block of each cell (0 none)' }),
    dist: array(i16(), 77, { doc: 'Steps to the base per cell, -1 unreachable or blocked' }),
    path: array(u8(), 77, { doc: 'Cells of the path from the nest to the base' }),
    pathLen: u8(),
    version: u32(),
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
    fromCell: i8({ default: -1 }),
    slot: i8({ default: -1, doc: 'Tray slot it came from' }),
    x: f32(),
    y: f32(),
    cell: i8({ default: -1, doc: 'Hovered cell (a block: its top-left cell), -1 off the board' }),
    valid: bool(),
    reason: enumOf('PlaceReason', ['ok', 'offBoard', 'occupied', 'blocks', 'gold', 'enemy', 'noBlock', 'fixed']),
    previewDist: array(i16(), 77, { doc: 'Flow field if the hovered drop happened (each nest preview path is traced from it)' }),
    previewLen: u8({ doc: '1 when previewDist holds a valid preview' }),
    // Snap back after a refused drop.
    returnSteps: u8(),
    retFromX: f32(),
    retFromY: f32(),
    retToX: f32(),
    retToY: f32(),
    retKind: enumOf('ItemKind', ITEM_KINDS),
    retShape: enumOf('BlockShape', BLOCK_SHAPES),
  },
  { sim: true },
);

/** A block on the board: fixed once placed, blocks the ants, carries weapons. */
export const Block = component(
  'Block',
  {
    shape: enumOf('BlockShape', BLOCK_SHAPES),
    cell: u8({ doc: 'Top-left cell' }),
    placedAt: f32(),
    denySteps: u8({ doc: 'Shake left after a refused pick-up (blocks never move)' }),
  },
  { sim: true },
);

/** A weapon standing on a block cell. */
export const Item = component(
  'Item',
  {
    kind: enumOf('ItemKind', ITEM_KINDS),
    cell: u8(),
    cooldown: f32({ doc: 'Game seconds before it can be moved again' }),
    reload: f32({ doc: 'Game seconds before it fires again' }),
    aim: f32({ doc: 'Barrel angle, radians' }),
    placedAt: f32({ doc: 'Run.time of its last drop (squash and stretch)' }),
    denySteps: u8({ doc: 'Shake left after a refused pick-up' }),
    held: bool({ doc: 'Picked up by the finger right now' }),
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
  },
  { sim: true },
);

/** A tray slot: slots 0–2 show the offer, slot 3 is the Reroll button. */
export const TraySlot = component('TraySlot', { slot: u8(), shownVersion: i32({ default: -1 }), shownPrice: i16({ default: -2 }), affordable: bool() }, { sim: true });
export const TrayLabel = component('TrayLabel', { slot: u8() }, { sim: true });
/** The icon shapes of an offer slot, replaced when the offer changes. */
export const TrayIcon = component('TrayIcon', { slot: u8() }, { sim: true });
export const OfferRerolled = event('OfferRerolled', { price: u32() }, { sim: true, doc: 'Signal: the player paid for a new offer.' });
export const FxHost = component('FxHost', { kind: enumOf('FxKind', FX_KINDS) }, { sim: true });
export const BoardTile = tag('BoardTile', { sim: true });
/** Beetles and bosses: HP bars and the grow-in, which plain ants skip to stay cheap at swarm scale. */
export const Big = tag('Big', { sim: true });
/** One per board cell: the flow field in a form hot systems read without array views. */
export const FlowCell = component('FlowCell', { cell: u8(), dist: i16({ default: -1 }), next: i16({ default: -1 }) }, { sim: true });
export const Base = tag('Base', { sim: true });
/** An ant nest on the board; it opens at its wave (src/grid.ts NESTS). */
export const NestSpot = component('NestSpot', { index: u8(), open: bool() }, { sim: true });
export const NestLabel = component('NestLabel', { index: u8() }, { sim: true });
export const NestOpened = event('NestOpened', { nest: u8(), wave: u32() }, { sim: true, doc: 'Signal: a new nest opened.' });

export const RestartRequested = event('RestartRequested', {}, { sim: true, doc: 'The player pressed Restart on the end screen.' });
export const EnemyKilled = event('EnemyKilled', { x: f32(), y: f32(), gold: u32(), kind: enumOf('EnemyKind', ENEMY_KINDS) }, { sim: true, doc: 'Signal: an enemy died; gold flies to the counter.' });
export const WaveStarted = event('WaveStarted', { wave: u32(), boss: bool() }, { sim: true, doc: 'Signal: a wave started.' });
export const ItemPlaced = event('ItemPlaced', { kind: enumOf('ItemKind', ITEM_KINDS), shape: enumOf('BlockShape', BLOCK_SHAPES), cell: u8(), moved: bool(), cost: u32() }, { sim: true, doc: 'Signal: an item was dropped on the board.' });
export const PlacementRefused = event('PlacementRefused', { reason: enumOf('PlaceReason', ['ok', 'offBoard', 'occupied', 'blocks', 'gold', 'enemy', 'noBlock', 'fixed']) }, { sim: true, doc: 'Signal: a drop was refused.' });
