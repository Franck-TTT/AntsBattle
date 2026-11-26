// @generated — do not edit. Regenerate with `pnpm gen` (tools/bindgen).
import { typeToken, rowRead as $r, registerSchema, dataToken, type DataRecord, type EntityId } from '@gameengine/runtime';
import './content.gen.ts';

export type { EntityId };

/** Project schema IR, registered with the engine when the bundle boots. */
export const schemaIr = {
  "version": 1,
  "package": "AntsBattle",
  "enums": [
    {
      "name": "BlockShape",
      "values": [
        "b1x1",
        "b2x2",
        "b2x1",
        "b1x2",
        "b3x1",
        "b1x3"
      ],
      "package": "AntsBattle"
    },
    {
      "name": "EnemyKind",
      "values": [
        "ant",
        "fast",
        "beetle",
        "boss"
      ],
      "package": "AntsBattle"
    },
    {
      "name": "FxKind",
      "values": [
        "dust",
        "pop",
        "boom",
        "hit",
        "baseHit",
        "casing"
      ],
      "package": "AntsBattle"
    },
    {
      "name": "ItemKind",
      "values": [
        "none",
        "wall",
        "tower",
        "cannon",
        "frost",
        "mine",
        "boostPad",
        "mortar",
        "flamethrower",
        "radar",
        "bank"
      ],
      "package": "AntsBattle"
    },
    {
      "name": "PlaceReason",
      "values": [
        "ok",
        "offBoard",
        "occupied",
        "blocks",
        "gold",
        "enemy",
        "noBlock",
        "fixed"
      ],
      "package": "AntsBattle"
    },
    {
      "name": "RunPhase",
      "values": [
        "playing",
        "won",
        "lost",
        "menu"
      ],
      "package": "AntsBattle"
    },
    {
      "name": "UpgradeKind",
      "values": [
        "towerDmg",
        "cannonDmg",
        "startGold",
        "killGold",
        "fireRate",
        "towerRange",
        "cannonAoe",
        "freeCell",
        "globalDmg",
        "life",
        "reroll",
        "freeTower",
        "slowmo"
      ],
      "package": "AntsBattle"
    },
    {
      "name": "Rarity",
      "values": [
        "common",
        "rare",
        "epic",
        "legendary"
      ],
      "package": "AntsBattle"
    }
  ],
  "types": [
    {
      "name": "BankPaid",
      "kind": "event",
      "sim": true,
      "fields": [
        {
          "name": "x",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "y",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "gold",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        }
      ],
      "package": "AntsBattle",
      "doc": "Signal: a bank paid its gold at the start of a wave."
    },
    {
      "name": "Base",
      "kind": "tag",
      "sim": true,
      "fields": [],
      "package": "AntsBattle"
    },
    {
      "name": "BaseLabel",
      "kind": "component",
      "sim": true,
      "fields": [
        {
          "name": "shown",
          "kind": "i16",
          "scalar": "i16",
          "lanes": 1,
          "default": -1
        }
      ],
      "package": "AntsBattle"
    },
    {
      "name": "Big",
      "kind": "tag",
      "sim": true,
      "fields": [],
      "package": "AntsBattle"
    },
    {
      "name": "Block",
      "kind": "component",
      "sim": true,
      "fields": [
        {
          "name": "shape",
          "kind": "enum",
          "scalar": "u8",
          "lanes": 1,
          "enumName": "BlockShape"
        },
        {
          "name": "cell",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1,
          "doc": "Top-left cell"
        },
        {
          "name": "placedAt",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "denySteps",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1,
          "doc": "Shake left after a refused pick-up (blocks never move)"
        },
        {
          "name": "locked",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1,
          "doc": "Pre-placed by the level: never moved, never destroyed"
        }
      ],
      "package": "AntsBattle"
    },
    {
      "name": "Board",
      "kind": "resource",
      "sim": true,
      "fields": [
        {
          "name": "cells",
          "kind": "array",
          "scalar": "u8",
          "lanes": 140,
          "doc": "1 where a block stands (blocks the ants), 0 free"
        },
        {
          "name": "weapons",
          "kind": "array",
          "scalar": "u8",
          "lanes": 140,
          "doc": "Weapon kind index on each cell (0 none): on its block, or on the ground for a mine or a boost pad"
        },
        {
          "name": "dist",
          "kind": "array",
          "scalar": "i16",
          "lanes": 140,
          "doc": "Steps to the base per cell, -1 unreachable or blocked"
        },
        {
          "name": "path",
          "kind": "array",
          "scalar": "u8",
          "lanes": 140,
          "doc": "Cells of the path from the nest to the base"
        },
        {
          "name": "pathLen",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "version",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "cols",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1,
          "doc": "Board width of this level (cells past it are off the board)"
        },
        {
          "name": "rows",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1,
          "doc": "Board height of this level"
        },
        {
          "name": "nestCount",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1,
          "doc": "Nests of this level (1 to MAX_NESTS)"
        },
        {
          "name": "nestCell",
          "kind": "array",
          "scalar": "u8",
          "lanes": 5,
          "doc": "Cell of each nest"
        },
        {
          "name": "nestWave",
          "kind": "array",
          "scalar": "u8",
          "lanes": 5,
          "doc": "Wave each nest opens on"
        },
        {
          "name": "baseCell",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1,
          "doc": "Cell of the base"
        },
        {
          "name": "waveCount",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1,
          "doc": "Waves to hold to win this level (LevelDef.waves, else every wave of the sheet)"
        }
      ],
      "package": "AntsBattle"
    },
    {
      "name": "BoardTile",
      "kind": "tag",
      "sim": true,
      "fields": [],
      "package": "AntsBattle"
    },
    {
      "name": "Boost",
      "kind": "resource",
      "sim": true,
      "fields": [
        {
          "name": "damage",
          "kind": "array",
          "scalar": "f32",
          "lanes": 11,
          "doc": "Damage multiplier per weapon kind (StartRun writes 1 and up)"
        },
        {
          "name": "range",
          "kind": "array",
          "scalar": "f32",
          "lanes": 11,
          "doc": "Range added per weapon kind, cells"
        },
        {
          "name": "splash",
          "kind": "array",
          "scalar": "f32",
          "lanes": 11,
          "doc": "Splash radius added per weapon kind, cells"
        },
        {
          "name": "period",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": 1,
          "doc": "Cooldown multiplier of every weapon"
        },
        {
          "name": "killGold",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": 1,
          "doc": "Gold per kill multiplier"
        },
        {
          "name": "drag",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": 1,
          "doc": "Multiplier of the game speed while dragging"
        },
        {
          "name": "freeWalls",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1,
          "doc": "Blocks that cost nothing, on top of the sheet's Free walls"
        },
        {
          "name": "freeRerolls",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1,
          "doc": "Rerolls that cost nothing each wave"
        },
        {
          "name": "freeTower",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1,
          "doc": "The first offer holds a tower"
        }
      ],
      "package": "AntsBattle"
    },
    {
      "name": "Enemy",
      "kind": "component",
      "sim": true,
      "fields": [
        {
          "name": "kind",
          "kind": "enum",
          "scalar": "u8",
          "lanes": 1,
          "enumName": "EnemyKind"
        },
        {
          "name": "hp",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "maxHp",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "speed",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Cells per game second"
        },
        {
          "name": "reward",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Gold per kill (fractional at swarm scale)"
        },
        {
          "name": "damage",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "doc": "Lives lost when it reaches the base"
        },
        {
          "name": "hx",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": 0,
          "doc": "Facing, unit vector x (smoothed; no trig per step)"
        },
        {
          "name": "hy",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": -1,
          "doc": "Facing, unit vector y"
        },
        {
          "name": "remaining",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Path length left to the base, for targeting"
        },
        {
          "name": "flashSteps",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "lane",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Sideways offset in its column, cells (spreads the swarm)"
        },
        {
          "name": "bornAt",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "kx",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Knockback velocity x, cells per game second (decays; the walk brings it back on its path)"
        },
        {
          "name": "ky",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Knockback velocity y"
        },
        {
          "name": "slow",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Share of its speed lost while slowed (frost)"
        },
        {
          "name": "slowLeft",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Game seconds of slow left"
        },
        {
          "name": "haste",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Share of speed gained while hasted (boost pad)"
        },
        {
          "name": "hasteLeft",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Game seconds of haste left"
        },
        {
          "name": "burn",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Damage per game second while burning (flamethrower)"
        },
        {
          "name": "burnLeft",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Game seconds of burning left"
        }
      ],
      "package": "AntsBattle"
    },
    {
      "name": "EnemyKilled",
      "kind": "event",
      "sim": true,
      "fields": [
        {
          "name": "x",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "y",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "gold",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "kind",
          "kind": "enum",
          "scalar": "u8",
          "lanes": 1,
          "enumName": "EnemyKind"
        }
      ],
      "package": "AntsBattle",
      "doc": "Signal: an enemy died; gold flies to the counter."
    },
    {
      "name": "FlowCell",
      "kind": "component",
      "sim": true,
      "fields": [
        {
          "name": "cell",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "dist",
          "kind": "i16",
          "scalar": "i16",
          "lanes": 1,
          "default": -1
        },
        {
          "name": "next",
          "kind": "i16",
          "scalar": "i16",
          "lanes": 1,
          "default": -1
        }
      ],
      "package": "AntsBattle"
    },
    {
      "name": "FxHost",
      "kind": "component",
      "sim": true,
      "fields": [
        {
          "name": "kind",
          "kind": "enum",
          "scalar": "u8",
          "lanes": 1,
          "enumName": "FxKind"
        }
      ],
      "package": "AntsBattle"
    },
    {
      "name": "Item",
      "kind": "component",
      "sim": true,
      "fields": [
        {
          "name": "kind",
          "kind": "enum",
          "scalar": "u8",
          "lanes": 1,
          "enumName": "ItemKind"
        },
        {
          "name": "cell",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "cooldown",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Game seconds before it can be moved again"
        },
        {
          "name": "reload",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Game seconds before it fires again"
        },
        {
          "name": "aim",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Barrel angle, radians"
        },
        {
          "name": "placedAt",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Run.time of its last drop (squash and stretch)"
        },
        {
          "name": "denySteps",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1,
          "doc": "Shake left after a refused pick-up"
        },
        {
          "name": "held",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1,
          "doc": "Picked up by the finger right now"
        },
        {
          "name": "locked",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1,
          "doc": "Pre-placed by the level: never moved, never destroyed"
        }
      ],
      "package": "AntsBattle"
    },
    {
      "name": "ItemPlaced",
      "kind": "event",
      "sim": true,
      "fields": [
        {
          "name": "kind",
          "kind": "enum",
          "scalar": "u8",
          "lanes": 1,
          "enumName": "ItemKind"
        },
        {
          "name": "shape",
          "kind": "enum",
          "scalar": "u8",
          "lanes": 1,
          "enumName": "BlockShape"
        },
        {
          "name": "cell",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "moved",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "cost",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        }
      ],
      "package": "AntsBattle",
      "doc": "Signal: an item was dropped on the board."
    },
    {
      "name": "Level",
      "kind": "resource",
      "sim": true,
      "fields": [
        {
          "name": "data",
          "kind": "asset",
          "scalar": "u32",
          "lanes": 1,
          "assetType": "data",
          "doc": "The LevelDef this run starts from (none: an empty board)"
        },
        {
          "name": "loads",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "doc": "Bumped on every level load (menu pick, level.load cheat) so loading the same level again restarts the run"
        }
      ],
      "package": "AntsBattle"
    },
    {
      "name": "LevelPicked",
      "kind": "event",
      "sim": true,
      "fields": [
        {
          "name": "index",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1,
          "doc": "Position in menuLevels() (src/levels.ts), from 0"
        }
      ],
      "package": "AntsBattle",
      "doc": "The player picked a level on the level menu."
    },
    {
      "name": "MenuRequested",
      "kind": "event",
      "sim": true,
      "fields": [],
      "package": "AntsBattle",
      "doc": "The player asked for the level menu."
    },
    {
      "name": "NestLabel",
      "kind": "component",
      "sim": true,
      "fields": [
        {
          "name": "index",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1
        }
      ],
      "package": "AntsBattle"
    },
    {
      "name": "NestMound",
      "kind": "component",
      "sim": true,
      "fields": [
        {
          "name": "index",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1
        }
      ],
      "package": "AntsBattle"
    },
    {
      "name": "NestOpened",
      "kind": "event",
      "sim": true,
      "fields": [
        {
          "name": "nest",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "wave",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        }
      ],
      "package": "AntsBattle",
      "doc": "Signal: a new nest opened."
    },
    {
      "name": "NestSpot",
      "kind": "component",
      "sim": true,
      "fields": [
        {
          "name": "index",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "open",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        }
      ],
      "package": "AntsBattle"
    },
    {
      "name": "Offer",
      "kind": "resource",
      "sim": true,
      "fields": [
        {
          "name": "kinds",
          "kind": "array",
          "scalar": "u8",
          "lanes": 3,
          "doc": "ItemKind index per offer slot"
        },
        {
          "name": "shapes",
          "kind": "array",
          "scalar": "u8",
          "lanes": 3,
          "doc": "BlockShape index per offer slot (blocks)"
        },
        {
          "name": "sold",
          "kind": "array",
          "scalar": "u8",
          "lanes": 3,
          "doc": "1 once bought; the slot stays empty until the next set"
        },
        {
          "name": "sets",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "doc": "Sets drawn this run"
        },
        {
          "name": "rerolls",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "doc": "Rerolls bought this run (the price rises with each)"
        },
        {
          "name": "version",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "doc": "Bumped on every new set or purchase, so the tray redraws"
        },
        {
          "name": "freeRerolls",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1,
          "doc": "Free rerolls left this wave (Boost.freeRerolls, refilled at each wave)"
        }
      ],
      "package": "AntsBattle"
    },
    {
      "name": "OfferRerolled",
      "kind": "event",
      "sim": true,
      "fields": [
        {
          "name": "price",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        }
      ],
      "package": "AntsBattle",
      "doc": "Signal: the player paid for a new offer."
    },
    {
      "name": "Panel",
      "kind": "resource",
      "sim": true,
      "fields": [
        {
          "name": "x",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "World x of the panel centre"
        },
        {
          "name": "trayY",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "World y of the tray centre line"
        },
        {
          "name": "hudY",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "World y of the HUD bar centre line"
        },
        {
          "name": "scale",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": 1,
          "doc": "World units per tray unit (grid.ts TRAY_* sizes)"
        }
      ],
      "package": "AntsBattle"
    },
    {
      "name": "Placement",
      "kind": "resource",
      "sim": true,
      "fields": [
        {
          "name": "active",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "kind",
          "kind": "enum",
          "scalar": "u8",
          "lanes": 1,
          "enumName": "ItemKind"
        },
        {
          "name": "shape",
          "kind": "enum",
          "scalar": "u8",
          "lanes": 1,
          "enumName": "BlockShape"
        },
        {
          "name": "fromItem",
          "kind": "entity",
          "scalar": "u32",
          "lanes": 2,
          "doc": "The placed item being moved, or none for a tray pick"
        },
        {
          "name": "fromCell",
          "kind": "i16",
          "scalar": "i16",
          "lanes": 1,
          "default": -1
        },
        {
          "name": "slot",
          "kind": "i8",
          "scalar": "i8",
          "lanes": 1,
          "default": -1,
          "doc": "Tray slot it came from"
        },
        {
          "name": "x",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "y",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "cell",
          "kind": "i16",
          "scalar": "i16",
          "lanes": 1,
          "default": -1,
          "doc": "Hovered cell (a block: its top-left cell), -1 off the board"
        },
        {
          "name": "valid",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "reason",
          "kind": "enum",
          "scalar": "u8",
          "lanes": 1,
          "enumName": "PlaceReason"
        },
        {
          "name": "previewDist",
          "kind": "array",
          "scalar": "i16",
          "lanes": 140,
          "doc": "Flow field if the hovered drop happened (each nest preview path is traced from it)"
        },
        {
          "name": "previewLen",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1,
          "doc": "1 when previewDist holds a valid preview"
        },
        {
          "name": "returnSteps",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "retFromX",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "retFromY",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "retToX",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "retToY",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "retKind",
          "kind": "enum",
          "scalar": "u8",
          "lanes": 1,
          "enumName": "ItemKind"
        },
        {
          "name": "retShape",
          "kind": "enum",
          "scalar": "u8",
          "lanes": 1,
          "enumName": "BlockShape"
        }
      ],
      "package": "AntsBattle"
    },
    {
      "name": "PlacementRefused",
      "kind": "event",
      "sim": true,
      "fields": [
        {
          "name": "reason",
          "kind": "enum",
          "scalar": "u8",
          "lanes": 1,
          "enumName": "PlaceReason"
        }
      ],
      "package": "AntsBattle",
      "doc": "Signal: a drop was refused."
    },
    {
      "name": "Projectile",
      "kind": "component",
      "sim": true,
      "fields": [
        {
          "name": "kind",
          "kind": "enum",
          "scalar": "u8",
          "lanes": 1,
          "enumName": "ItemKind"
        },
        {
          "name": "target",
          "kind": "entity",
          "scalar": "u32",
          "lanes": 2
        },
        {
          "name": "tx",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "ty",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "damage",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "splash",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "speed",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "knockback",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Push given on impact, cells per second"
        },
        {
          "name": "shock",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Shockwave radius on impact, cells"
        },
        {
          "name": "ux",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Flight direction, unit vector x (kept for the push at impact)"
        },
        {
          "name": "uy",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Flight direction, unit vector y"
        },
        {
          "name": "slow",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Share of speed the enemies hit lose (frost)"
        },
        {
          "name": "slowTime",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Game seconds the slow lasts"
        },
        {
          "name": "puddle",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Damage per game second of the puddle left on impact (mortar), 0 none"
        },
        {
          "name": "puddleSize",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Puddle radius, cells"
        },
        {
          "name": "puddleTime",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Game seconds the puddle lasts"
        }
      ],
      "package": "AntsBattle"
    },
    {
      "name": "Puddle",
      "kind": "component",
      "sim": true,
      "fields": [
        {
          "name": "radius",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Cells"
        },
        {
          "name": "dps",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Damage per game second to each enemy inside"
        },
        {
          "name": "left",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Game seconds before it dries"
        },
        {
          "name": "life",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Game seconds it lasts in all (for the fade)"
        }
      ],
      "package": "AntsBattle"
    },
    {
      "name": "RestartRequested",
      "kind": "event",
      "sim": true,
      "fields": [],
      "package": "AntsBattle",
      "doc": "The player pressed Restart on the end screen."
    },
    {
      "name": "RollRequested",
      "kind": "event",
      "sim": true,
      "fields": [
        {
          "name": "luxury",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1,
          "doc": "The Luxury roll (paid with star charge, Rare or better) instead of the coin Roll"
        }
      ],
      "package": "AntsBattle",
      "doc": "The player pressed Roll or Luxury on the Upgrades screen."
    },
    {
      "name": "Run",
      "kind": "resource",
      "sim": true,
      "fields": [
        {
          "name": "phase",
          "kind": "enum",
          "scalar": "u8",
          "lanes": 1,
          "enumName": "RunPhase"
        },
        {
          "name": "runId",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "doc": "Bumped on every restart"
        },
        {
          "name": "time",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Game seconds, scaled by speed (slow motion while dragging)"
        },
        {
          "name": "speed",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "default": 1,
          "doc": "Game speed: 1 normal, 0.05 while a finger drags an item"
        },
        {
          "name": "wave",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "doc": "Waves started so far (0 before the first)"
        },
        {
          "name": "lives",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "gold",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "goldFrac",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1,
          "doc": "Fractional gold from swarm kills, paid out as whole coins"
        },
        {
          "name": "wallsBuilt",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "doc": "Walls bought this run (the first FREE_WALLS are free)"
        },
        {
          "name": "nextWaveAt",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "group",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "doc": "Spawn group of the current wave"
        },
        {
          "name": "groupSpawned",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "spawnAt",
          "kind": "f32",
          "scalar": "f32",
          "lanes": 1
        },
        {
          "name": "spawning",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "alive",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "kills",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "bossSteps",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "doc": "Steps left of the boss intro beat"
        },
        {
          "name": "placements",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "refusals",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "shots",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "booms",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "hurts",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "doc": "Damage events on enemies (the camera tremor follows it)"
        },
        {
          "name": "baseHits",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "bosses",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "nestTurn",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "doc": "Round-robin counter: which open nest the next ant leaves from"
        },
        {
          "name": "nestsOpen",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "doc": "Nests open so far (presentation plays the opening)"
        },
        {
          "name": "paid",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1,
          "doc": "The end-of-run reward was paid into the meta"
        },
        {
          "name": "stars",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1,
          "doc": "Stars this run earned (0 on a defeat)"
        },
        {
          "name": "newStars",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1,
          "doc": "Stars above the best already won on this level (they charge the Luxury roll)"
        },
        {
          "name": "coinsWon",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1,
          "doc": "Meta coins this run paid"
        }
      ],
      "package": "AntsBattle"
    },
    {
      "name": "TrayCoin",
      "kind": "component",
      "sim": true,
      "fields": [
        {
          "name": "slot",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1
        }
      ],
      "package": "AntsBattle"
    },
    {
      "name": "TrayIcon",
      "kind": "component",
      "sim": true,
      "fields": [
        {
          "name": "slot",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1
        }
      ],
      "package": "AntsBattle"
    },
    {
      "name": "TrayLabel",
      "kind": "component",
      "sim": true,
      "fields": [
        {
          "name": "slot",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1
        }
      ],
      "package": "AntsBattle"
    },
    {
      "name": "TraySlot",
      "kind": "component",
      "sim": true,
      "fields": [
        {
          "name": "slot",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "shownVersion",
          "kind": "i32",
          "scalar": "i32",
          "lanes": 1,
          "default": -1
        },
        {
          "name": "shownPrice",
          "kind": "i16",
          "scalar": "i16",
          "lanes": 1,
          "default": -2
        },
        {
          "name": "affordable",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        }
      ],
      "package": "AntsBattle"
    },
    {
      "name": "UpgradeRolled",
      "kind": "event",
      "sim": true,
      "fields": [
        {
          "name": "upgrade",
          "kind": "enum",
          "scalar": "u8",
          "lanes": 1,
          "enumName": "UpgradeKind"
        },
        {
          "name": "rarity",
          "kind": "enum",
          "scalar": "u8",
          "lanes": 1,
          "enumName": "Rarity"
        },
        {
          "name": "level",
          "kind": "u8",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "luxury",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        }
      ],
      "package": "AntsBattle",
      "doc": "Signal: a roll gave an upgrade (the reveal popup shows it)."
    },
    {
      "name": "WaveStarted",
      "kind": "event",
      "sim": true,
      "fields": [
        {
          "name": "wave",
          "kind": "u32",
          "scalar": "u32",
          "lanes": 1
        },
        {
          "name": "boss",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        },
        {
          "name": "newNest",
          "kind": "bool",
          "scalar": "u8",
          "lanes": 1
        }
      ],
      "package": "AntsBattle",
      "doc": "Signal: a wave started."
    }
  ],
  "commands": [],
  "protocol": [],
  "services": [],
  "data": [
    {
      "name": "LevelDef",
      "schema": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "description": "Stable id saves and analytics use; never changes once shipped"
          },
          "name": {
            "type": "string",
            "description": "Shown on the level menu"
          },
          "order": {
            "type": "integer",
            "description": "Position on the level menu, from 1; 0 keeps it off the menu (test layouts)"
          },
          "blocks": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "shape": {
                  "enum": [
                    "b1x1",
                    "b2x2",
                    "b2x1",
                    "b1x2",
                    "b3x1",
                    "b1x3"
                  ]
                },
                "col": {
                  "type": "integer",
                  "description": "Column of the top-left cell, 0 on the left"
                },
                "row": {
                  "type": "integer",
                  "description": "Row of the top-left cell, 0 at the top"
                }
              },
              "required": [
                "shape",
                "col",
                "row"
              ],
              "additionalProperties": false
            },
            "description": "Pre-placed blocks"
          },
          "weapons": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "kind": {
                  "enum": [
                    "tower",
                    "cannon",
                    "frost",
                    "mine",
                    "boostPad",
                    "mortar",
                    "flamethrower",
                    "radar",
                    "bank"
                  ]
                },
                "col": {
                  "type": "integer",
                  "description": "Column, 0 on the left"
                },
                "row": {
                  "type": "integer",
                  "description": "Row, 0 at the top; the cell must hold a pre-placed block"
                }
              },
              "required": [
                "kind",
                "col",
                "row"
              ],
              "additionalProperties": false
            },
            "description": "Pre-placed weapons, each standing on a pre-placed block cell"
          },
          "cols": {
            "type": "integer",
            "description": "Board width in cells, 4 to 10; absent: 7"
          },
          "rows": {
            "type": "integer",
            "description": "Board height in cells, 4 to 14; absent: 11"
          },
          "nests": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "col": {
                  "type": "integer",
                  "description": "Column, 0 on the left"
                },
                "row": {
                  "type": "integer",
                  "description": "Row, 0 at the top"
                },
                "fromWave": {
                  "type": "integer",
                  "description": "Wave it opens on (1: open from the start)"
                }
              },
              "required": [
                "col",
                "row",
                "fromWave"
              ],
              "additionalProperties": false
            },
            "description": "Ant nests, 1 to 5, in path-colour order; absent: the default nests (src/grid.ts)"
          },
          "base": {
            "type": "object",
            "properties": {
              "col": {
                "type": "integer",
                "description": "Column, 0 on the left"
              },
              "row": {
                "type": "integer",
                "description": "Row, 0 at the top"
              }
            },
            "required": [
              "col",
              "row"
            ],
            "additionalProperties": false,
            "description": "The base to defend; absent: the default base (src/grid.ts)"
          },
          "waves": {
            "type": "integer",
            "description": "Waves to hold to win: the first N of the Waves tab of the sheet, 1 to all; absent: all"
          },
          "power": {
            "type": "integer",
            "description": "Advised POWER (meta upgrades) shown on the level map popup; absent: none shown"
          }
        },
        "required": [
          "id",
          "name",
          "order",
          "blocks",
          "weapons"
        ],
        "additionalProperties": false
      },
      "package": "AntsBattle",
      "doc": "A level layout: its nests, its base, and what stands on the board when a run starts."
    }
  ]
} as const;
registerSchema(schemaIr);

export const BlockShape = {
  b1x1: 0,
  b2x2: 1,
  b2x1: 2,
  b1x2: 3,
  b3x1: 4,
  b1x3: 5,
} as const;
export type BlockShapeName = 'b1x1' | 'b2x2' | 'b2x1' | 'b1x2' | 'b3x1' | 'b1x3';

export const EnemyKind = {
  ant: 0,
  fast: 1,
  beetle: 2,
  boss: 3,
} as const;
export type EnemyKindName = 'ant' | 'fast' | 'beetle' | 'boss';

export const FxKind = {
  dust: 0,
  pop: 1,
  boom: 2,
  hit: 3,
  baseHit: 4,
  casing: 5,
} as const;
export type FxKindName = 'dust' | 'pop' | 'boom' | 'hit' | 'baseHit' | 'casing';

export const ItemKind = {
  none: 0,
  wall: 1,
  tower: 2,
  cannon: 3,
  frost: 4,
  mine: 5,
  boostPad: 6,
  mortar: 7,
  flamethrower: 8,
  radar: 9,
  bank: 10,
} as const;
export type ItemKindName = 'none' | 'wall' | 'tower' | 'cannon' | 'frost' | 'mine' | 'boostPad' | 'mortar' | 'flamethrower' | 'radar' | 'bank';

export const PlaceReason = {
  ok: 0,
  offBoard: 1,
  occupied: 2,
  blocks: 3,
  gold: 4,
  enemy: 5,
  noBlock: 6,
  fixed: 7,
} as const;
export type PlaceReasonName = 'ok' | 'offBoard' | 'occupied' | 'blocks' | 'gold' | 'enemy' | 'noBlock' | 'fixed';

export const RunPhase = {
  playing: 0,
  won: 1,
  lost: 2,
  menu: 3,
} as const;
export type RunPhaseName = 'playing' | 'won' | 'lost' | 'menu';

export const UpgradeKind = {
  towerDmg: 0,
  cannonDmg: 1,
  startGold: 2,
  killGold: 3,
  fireRate: 4,
  towerRange: 5,
  cannonAoe: 6,
  freeCell: 7,
  globalDmg: 8,
  life: 9,
  reroll: 10,
  freeTower: 11,
  slowmo: 12,
} as const;
export type UpgradeKindName = 'towerDmg' | 'cannonDmg' | 'startGold' | 'killGold' | 'fireRate' | 'towerRange' | 'cannonAoe' | 'freeCell' | 'globalDmg' | 'life' | 'reroll' | 'freeTower' | 'slowmo';

export const Rarity = {
  common: 0,
  rare: 1,
  epic: 2,
  legendary: 3,
} as const;
export type RarityName = 'common' | 'rare' | 'epic' | 'legendary';

export interface BankPaidViews {
  x: Float32Array;
  y: Float32Array;
  gold: Uint32Array;
}
export interface BankPaidValue {
  x: number;
  y: number;
  gold: number;
}
/** Signal: a bank paid its gold at the start of a wave. (event, sim) */
export const BankPaid = typeToken<BankPaidViews, BankPaidValue>('BankPaid', 'event', { sig: 'x:f32:1,y:f32:1,gold:u32:1', read: (v: BankPaidViews, i: number, o: Record<string, unknown>) => { o.x = v.x[i]; o.y = v.y[i]; o.gold = v.gold[i]; return o; } });

export type BaseViews = Record<string, never>;
export type BaseValue = Record<string, never>;
/** Base (tag, sim) */
export const Base = typeToken<BaseViews, BaseValue>('Base', 'tag');

export interface BaseLabelViews {
  shown: Int16Array;
}
export interface BaseLabelValue {
  shown: number;
}
/** BaseLabel (component, sim) */
export const BaseLabel = typeToken<BaseLabelViews, BaseLabelValue>('BaseLabel', 'component', { sig: 'shown:i16:1', read: (v: BaseLabelViews, i: number, o: Record<string, unknown>) => { o.shown = v.shown[i]; return o; } });

export type BigViews = Record<string, never>;
export type BigValue = Record<string, never>;
/** Big (tag, sim) */
export const Big = typeToken<BigViews, BigValue>('Big', 'tag');

export interface BlockViews {
  shape: Uint8Array;
  /** Top-left cell */
  cell: Uint8Array;
  placedAt: Float32Array;
  /** Shake left after a refused pick-up (blocks never move) */
  denySteps: Uint8Array;
  /** Pre-placed by the level: never moved, never destroyed */
  locked: Uint8Array;
}
export interface BlockValue {
  shape: BlockShapeName | number;
  /** Top-left cell */
  cell: number;
  placedAt: number;
  /** Shake left after a refused pick-up (blocks never move) */
  denySteps: number;
  /** Pre-placed by the level: never moved, never destroyed */
  locked: boolean;
}
/** Block (component, sim) */
export const Block = typeToken<BlockViews, BlockValue>('Block', 'component', { sig: 'shape:enum:1,cell:u8:1,placedAt:f32:1,denySteps:u8:1,locked:bool:1', read: (v: BlockViews, i: number, o: Record<string, unknown>) => { o.shape = $r.enm('BlockShape', v.shape[i]!); o.cell = v.cell[i]; o.placedAt = v.placedAt[i]; o.denySteps = v.denySteps[i]; o.locked = v.locked[i] !== 0; return o; } });

export interface BoardViews {
  /** 1 where a block stands (blocks the ants), 0 free */
  cells: Uint8Array;
  /** Weapon kind index on each cell (0 none): on its block, or on the ground for a mine or a boost pad */
  weapons: Uint8Array;
  /** Steps to the base per cell, -1 unreachable or blocked */
  dist: Int16Array;
  /** Cells of the path from the nest to the base */
  path: Uint8Array;
  pathLen: Uint8Array;
  version: Uint32Array;
  /** Board width of this level (cells past it are off the board) */
  cols: Uint8Array;
  /** Board height of this level */
  rows: Uint8Array;
  /** Nests of this level (1 to MAX_NESTS) */
  nestCount: Uint8Array;
  /** Cell of each nest */
  nestCell: Uint8Array;
  /** Wave each nest opens on */
  nestWave: Uint8Array;
  /** Cell of the base */
  baseCell: Uint8Array;
  /** Waves to hold to win this level (LevelDef.waves, else every wave of the sheet) */
  waveCount: Uint8Array;
}
export interface BoardValue {
  /** 1 where a block stands (blocks the ants), 0 free */
  cells: number[];
  /** Weapon kind index on each cell (0 none): on its block, or on the ground for a mine or a boost pad */
  weapons: number[];
  /** Steps to the base per cell, -1 unreachable or blocked */
  dist: number[];
  /** Cells of the path from the nest to the base */
  path: number[];
  pathLen: number;
  version: number;
  /** Board width of this level (cells past it are off the board) */
  cols: number;
  /** Board height of this level */
  rows: number;
  /** Nests of this level (1 to MAX_NESTS) */
  nestCount: number;
  /** Cell of each nest */
  nestCell: number[];
  /** Wave each nest opens on */
  nestWave: number[];
  /** Cell of the base */
  baseCell: number;
  /** Waves to hold to win this level (LevelDef.waves, else every wave of the sheet) */
  waveCount: number;
}
/** Board (resource, sim) */
export const Board = typeToken<BoardViews, BoardValue>('Board', 'resource', { sig: 'cells:array:140,weapons:array:140,dist:array:140,path:array:140,pathLen:u8:1,version:u32:1,cols:u8:1,rows:u8:1,nestCount:u8:1,nestCell:array:5,nestWave:array:5,baseCell:u8:1,waveCount:u8:1', read: (v: BoardViews, i: number, o: Record<string, unknown>) => { o.cells = $r.lanes(v.cells, i, 140, o.cells); o.weapons = $r.lanes(v.weapons, i, 140, o.weapons); o.dist = $r.lanes(v.dist, i, 140, o.dist); o.path = $r.lanes(v.path, i, 140, o.path); o.pathLen = v.pathLen[i]; o.version = v.version[i]; o.cols = v.cols[i]; o.rows = v.rows[i]; o.nestCount = v.nestCount[i]; o.nestCell = $r.lanes(v.nestCell, i, 5, o.nestCell); o.nestWave = $r.lanes(v.nestWave, i, 5, o.nestWave); o.baseCell = v.baseCell[i]; o.waveCount = v.waveCount[i]; return o; } });

export type BoardTileViews = Record<string, never>;
export type BoardTileValue = Record<string, never>;
/** BoardTile (tag, sim) */
export const BoardTile = typeToken<BoardTileViews, BoardTileValue>('BoardTile', 'tag');

export interface BoostViews {
  /** Damage multiplier per weapon kind (StartRun writes 1 and up) */
  damage: Float32Array;
  /** Range added per weapon kind, cells */
  range: Float32Array;
  /** Splash radius added per weapon kind, cells */
  splash: Float32Array;
  /** Cooldown multiplier of every weapon */
  period: Float32Array;
  /** Gold per kill multiplier */
  killGold: Float32Array;
  /** Multiplier of the game speed while dragging */
  drag: Float32Array;
  /** Blocks that cost nothing, on top of the sheet's Free walls */
  freeWalls: Uint8Array;
  /** Rerolls that cost nothing each wave */
  freeRerolls: Uint8Array;
  /** The first offer holds a tower */
  freeTower: Uint8Array;
}
export interface BoostValue {
  /** Damage multiplier per weapon kind (StartRun writes 1 and up) */
  damage: number[];
  /** Range added per weapon kind, cells */
  range: number[];
  /** Splash radius added per weapon kind, cells */
  splash: number[];
  /** Cooldown multiplier of every weapon */
  period: number;
  /** Gold per kill multiplier */
  killGold: number;
  /** Multiplier of the game speed while dragging */
  drag: number;
  /** Blocks that cost nothing, on top of the sheet's Free walls */
  freeWalls: number;
  /** Rerolls that cost nothing each wave */
  freeRerolls: number;
  /** The first offer holds a tower */
  freeTower: boolean;
}
/** Boost (resource, sim) */
export const Boost = typeToken<BoostViews, BoostValue>('Boost', 'resource', { sig: 'damage:array:11,range:array:11,splash:array:11,period:f32:1,killGold:f32:1,drag:f32:1,freeWalls:u8:1,freeRerolls:u8:1,freeTower:bool:1', read: (v: BoostViews, i: number, o: Record<string, unknown>) => { o.damage = $r.lanes(v.damage, i, 11, o.damage); o.range = $r.lanes(v.range, i, 11, o.range); o.splash = $r.lanes(v.splash, i, 11, o.splash); o.period = v.period[i]; o.killGold = v.killGold[i]; o.drag = v.drag[i]; o.freeWalls = v.freeWalls[i]; o.freeRerolls = v.freeRerolls[i]; o.freeTower = v.freeTower[i] !== 0; return o; } });

export interface EnemyViews {
  kind: Uint8Array;
  hp: Float32Array;
  maxHp: Float32Array;
  /** Cells per game second */
  speed: Float32Array;
  /** Gold per kill (fractional at swarm scale) */
  reward: Float32Array;
  /** Lives lost when it reaches the base */
  damage: Uint32Array;
  /** Facing, unit vector x (smoothed; no trig per step) */
  hx: Float32Array;
  /** Facing, unit vector y */
  hy: Float32Array;
  /** Path length left to the base, for targeting */
  remaining: Float32Array;
  flashSteps: Uint8Array;
  /** Sideways offset in its column, cells (spreads the swarm) */
  lane: Float32Array;
  bornAt: Float32Array;
  /** Knockback velocity x, cells per game second (decays; the walk brings it back on its path) */
  kx: Float32Array;
  /** Knockback velocity y */
  ky: Float32Array;
  /** Share of its speed lost while slowed (frost) */
  slow: Float32Array;
  /** Game seconds of slow left */
  slowLeft: Float32Array;
  /** Share of speed gained while hasted (boost pad) */
  haste: Float32Array;
  /** Game seconds of haste left */
  hasteLeft: Float32Array;
  /** Damage per game second while burning (flamethrower) */
  burn: Float32Array;
  /** Game seconds of burning left */
  burnLeft: Float32Array;
}
export interface EnemyValue {
  kind: EnemyKindName | number;
  hp: number;
  maxHp: number;
  /** Cells per game second */
  speed: number;
  /** Gold per kill (fractional at swarm scale) */
  reward: number;
  /** Lives lost when it reaches the base */
  damage: number;
  /** Facing, unit vector x (smoothed; no trig per step) */
  hx: number;
  /** Facing, unit vector y */
  hy: number;
  /** Path length left to the base, for targeting */
  remaining: number;
  flashSteps: number;
  /** Sideways offset in its column, cells (spreads the swarm) */
  lane: number;
  bornAt: number;
  /** Knockback velocity x, cells per game second (decays; the walk brings it back on its path) */
  kx: number;
  /** Knockback velocity y */
  ky: number;
  /** Share of its speed lost while slowed (frost) */
  slow: number;
  /** Game seconds of slow left */
  slowLeft: number;
  /** Share of speed gained while hasted (boost pad) */
  haste: number;
  /** Game seconds of haste left */
  hasteLeft: number;
  /** Damage per game second while burning (flamethrower) */
  burn: number;
  /** Game seconds of burning left */
  burnLeft: number;
}
/** Enemy (component, sim) */
export const Enemy = typeToken<EnemyViews, EnemyValue>('Enemy', 'component', { sig: 'kind:enum:1,hp:f32:1,maxHp:f32:1,speed:f32:1,reward:f32:1,damage:u32:1,hx:f32:1,hy:f32:1,remaining:f32:1,flashSteps:u8:1,lane:f32:1,bornAt:f32:1,kx:f32:1,ky:f32:1,slow:f32:1,slowLeft:f32:1,haste:f32:1,hasteLeft:f32:1,burn:f32:1,burnLeft:f32:1', read: (v: EnemyViews, i: number, o: Record<string, unknown>) => { o.kind = $r.enm('EnemyKind', v.kind[i]!); o.hp = v.hp[i]; o.maxHp = v.maxHp[i]; o.speed = v.speed[i]; o.reward = v.reward[i]; o.damage = v.damage[i]; o.hx = v.hx[i]; o.hy = v.hy[i]; o.remaining = v.remaining[i]; o.flashSteps = v.flashSteps[i]; o.lane = v.lane[i]; o.bornAt = v.bornAt[i]; o.kx = v.kx[i]; o.ky = v.ky[i]; o.slow = v.slow[i]; o.slowLeft = v.slowLeft[i]; o.haste = v.haste[i]; o.hasteLeft = v.hasteLeft[i]; o.burn = v.burn[i]; o.burnLeft = v.burnLeft[i]; return o; } });

export interface EnemyKilledViews {
  x: Float32Array;
  y: Float32Array;
  gold: Uint32Array;
  kind: Uint8Array;
}
export interface EnemyKilledValue {
  x: number;
  y: number;
  gold: number;
  kind: EnemyKindName | number;
}
/** Signal: an enemy died; gold flies to the counter. (event, sim) */
export const EnemyKilled = typeToken<EnemyKilledViews, EnemyKilledValue>('EnemyKilled', 'event', { sig: 'x:f32:1,y:f32:1,gold:u32:1,kind:enum:1', read: (v: EnemyKilledViews, i: number, o: Record<string, unknown>) => { o.x = v.x[i]; o.y = v.y[i]; o.gold = v.gold[i]; o.kind = $r.enm('EnemyKind', v.kind[i]!); return o; } });

export interface FlowCellViews {
  cell: Uint8Array;
  dist: Int16Array;
  next: Int16Array;
}
export interface FlowCellValue {
  cell: number;
  dist: number;
  next: number;
}
/** FlowCell (component, sim) */
export const FlowCell = typeToken<FlowCellViews, FlowCellValue>('FlowCell', 'component', { sig: 'cell:u8:1,dist:i16:1,next:i16:1', read: (v: FlowCellViews, i: number, o: Record<string, unknown>) => { o.cell = v.cell[i]; o.dist = v.dist[i]; o.next = v.next[i]; return o; } });

export interface FxHostViews {
  kind: Uint8Array;
}
export interface FxHostValue {
  kind: FxKindName | number;
}
/** FxHost (component, sim) */
export const FxHost = typeToken<FxHostViews, FxHostValue>('FxHost', 'component', { sig: 'kind:enum:1', read: (v: FxHostViews, i: number, o: Record<string, unknown>) => { o.kind = $r.enm('FxKind', v.kind[i]!); return o; } });

export interface ItemViews {
  kind: Uint8Array;
  cell: Uint8Array;
  /** Game seconds before it can be moved again */
  cooldown: Float32Array;
  /** Game seconds before it fires again */
  reload: Float32Array;
  /** Barrel angle, radians */
  aim: Float32Array;
  /** Run.time of its last drop (squash and stretch) */
  placedAt: Float32Array;
  /** Shake left after a refused pick-up */
  denySteps: Uint8Array;
  /** Picked up by the finger right now */
  held: Uint8Array;
  /** Pre-placed by the level: never moved, never destroyed */
  locked: Uint8Array;
}
export interface ItemValue {
  kind: ItemKindName | number;
  cell: number;
  /** Game seconds before it can be moved again */
  cooldown: number;
  /** Game seconds before it fires again */
  reload: number;
  /** Barrel angle, radians */
  aim: number;
  /** Run.time of its last drop (squash and stretch) */
  placedAt: number;
  /** Shake left after a refused pick-up */
  denySteps: number;
  /** Picked up by the finger right now */
  held: boolean;
  /** Pre-placed by the level: never moved, never destroyed */
  locked: boolean;
}
/** Item (component, sim) */
export const Item = typeToken<ItemViews, ItemValue>('Item', 'component', { sig: 'kind:enum:1,cell:u8:1,cooldown:f32:1,reload:f32:1,aim:f32:1,placedAt:f32:1,denySteps:u8:1,held:bool:1,locked:bool:1', read: (v: ItemViews, i: number, o: Record<string, unknown>) => { o.kind = $r.enm('ItemKind', v.kind[i]!); o.cell = v.cell[i]; o.cooldown = v.cooldown[i]; o.reload = v.reload[i]; o.aim = v.aim[i]; o.placedAt = v.placedAt[i]; o.denySteps = v.denySteps[i]; o.held = v.held[i] !== 0; o.locked = v.locked[i] !== 0; return o; } });

export interface ItemPlacedViews {
  kind: Uint8Array;
  shape: Uint8Array;
  cell: Uint8Array;
  moved: Uint8Array;
  cost: Uint32Array;
}
export interface ItemPlacedValue {
  kind: ItemKindName | number;
  shape: BlockShapeName | number;
  cell: number;
  moved: boolean;
  cost: number;
}
/** Signal: an item was dropped on the board. (event, sim) */
export const ItemPlaced = typeToken<ItemPlacedViews, ItemPlacedValue>('ItemPlaced', 'event', { sig: 'kind:enum:1,shape:enum:1,cell:u8:1,moved:bool:1,cost:u32:1', read: (v: ItemPlacedViews, i: number, o: Record<string, unknown>) => { o.kind = $r.enm('ItemKind', v.kind[i]!); o.shape = $r.enm('BlockShape', v.shape[i]!); o.cell = v.cell[i]; o.moved = v.moved[i] !== 0; o.cost = v.cost[i]; return o; } });

export interface LevelViews {
  /** The LevelDef this run starts from (none: an empty board) */
  data: Uint32Array;
  /** Bumped on every level load (menu pick, level.load cheat) so loading the same level again restarts the run */
  loads: Uint32Array;
}
export interface LevelValue {
  /** The LevelDef this run starts from (none: an empty board) */
  data: string | null;
  /** Bumped on every level load (menu pick, level.load cheat) so loading the same level again restarts the run */
  loads: number;
}
/** Level (resource, sim) */
export const Level = typeToken<LevelViews, LevelValue>('Level', 'resource', { sig: 'data:asset:1,loads:u32:1', read: (v: LevelViews, i: number, o: Record<string, unknown>) => { o.data = $r.asset(v.data[i]!); o.loads = v.loads[i]; return o; } });

export interface LevelPickedViews {
  /** Position in menuLevels() (src/levels.ts), from 0 */
  index: Uint8Array;
}
export interface LevelPickedValue {
  /** Position in menuLevels() (src/levels.ts), from 0 */
  index: number;
}
/** The player picked a level on the level menu. (event, sim) */
export const LevelPicked = typeToken<LevelPickedViews, LevelPickedValue>('LevelPicked', 'event', { sig: 'index:u8:1', read: (v: LevelPickedViews, i: number, o: Record<string, unknown>) => { o.index = v.index[i]; return o; } });

export type MenuRequestedViews = Record<string, never>;
export type MenuRequestedValue = Record<string, never>;
/** The player asked for the level menu. (event, sim) */
export const MenuRequested = typeToken<MenuRequestedViews, MenuRequestedValue>('MenuRequested', 'event');

export interface NestLabelViews {
  index: Uint8Array;
}
export interface NestLabelValue {
  index: number;
}
/** NestLabel (component, sim) */
export const NestLabel = typeToken<NestLabelViews, NestLabelValue>('NestLabel', 'component', { sig: 'index:u8:1', read: (v: NestLabelViews, i: number, o: Record<string, unknown>) => { o.index = v.index[i]; return o; } });

export interface NestMoundViews {
  index: Uint8Array;
}
export interface NestMoundValue {
  index: number;
}
/** NestMound (component, sim) */
export const NestMound = typeToken<NestMoundViews, NestMoundValue>('NestMound', 'component', { sig: 'index:u8:1', read: (v: NestMoundViews, i: number, o: Record<string, unknown>) => { o.index = v.index[i]; return o; } });

export interface NestOpenedViews {
  nest: Uint8Array;
  wave: Uint32Array;
}
export interface NestOpenedValue {
  nest: number;
  wave: number;
}
/** Signal: a new nest opened. (event, sim) */
export const NestOpened = typeToken<NestOpenedViews, NestOpenedValue>('NestOpened', 'event', { sig: 'nest:u8:1,wave:u32:1', read: (v: NestOpenedViews, i: number, o: Record<string, unknown>) => { o.nest = v.nest[i]; o.wave = v.wave[i]; return o; } });

export interface NestSpotViews {
  index: Uint8Array;
  open: Uint8Array;
}
export interface NestSpotValue {
  index: number;
  open: boolean;
}
/** NestSpot (component, sim) */
export const NestSpot = typeToken<NestSpotViews, NestSpotValue>('NestSpot', 'component', { sig: 'index:u8:1,open:bool:1', read: (v: NestSpotViews, i: number, o: Record<string, unknown>) => { o.index = v.index[i]; o.open = v.open[i] !== 0; return o; } });

export interface OfferViews {
  /** ItemKind index per offer slot */
  kinds: Uint8Array;
  /** BlockShape index per offer slot (blocks) */
  shapes: Uint8Array;
  /** 1 once bought; the slot stays empty until the next set */
  sold: Uint8Array;
  /** Sets drawn this run */
  sets: Uint32Array;
  /** Rerolls bought this run (the price rises with each) */
  rerolls: Uint32Array;
  /** Bumped on every new set or purchase, so the tray redraws */
  version: Uint32Array;
  /** Free rerolls left this wave (Boost.freeRerolls, refilled at each wave) */
  freeRerolls: Uint8Array;
}
export interface OfferValue {
  /** ItemKind index per offer slot */
  kinds: number[];
  /** BlockShape index per offer slot (blocks) */
  shapes: number[];
  /** 1 once bought; the slot stays empty until the next set */
  sold: number[];
  /** Sets drawn this run */
  sets: number;
  /** Rerolls bought this run (the price rises with each) */
  rerolls: number;
  /** Bumped on every new set or purchase, so the tray redraws */
  version: number;
  /** Free rerolls left this wave (Boost.freeRerolls, refilled at each wave) */
  freeRerolls: number;
}
/** Offer (resource, sim) */
export const Offer = typeToken<OfferViews, OfferValue>('Offer', 'resource', { sig: 'kinds:array:3,shapes:array:3,sold:array:3,sets:u32:1,rerolls:u32:1,version:u32:1,freeRerolls:u8:1', read: (v: OfferViews, i: number, o: Record<string, unknown>) => { o.kinds = $r.lanes(v.kinds, i, 3, o.kinds); o.shapes = $r.lanes(v.shapes, i, 3, o.shapes); o.sold = $r.lanes(v.sold, i, 3, o.sold); o.sets = v.sets[i]; o.rerolls = v.rerolls[i]; o.version = v.version[i]; o.freeRerolls = v.freeRerolls[i]; return o; } });

export interface OfferRerolledViews {
  price: Uint32Array;
}
export interface OfferRerolledValue {
  price: number;
}
/** Signal: the player paid for a new offer. (event, sim) */
export const OfferRerolled = typeToken<OfferRerolledViews, OfferRerolledValue>('OfferRerolled', 'event', { sig: 'price:u32:1', read: (v: OfferRerolledViews, i: number, o: Record<string, unknown>) => { o.price = v.price[i]; return o; } });

export interface PanelViews {
  /** World x of the panel centre */
  x: Float32Array;
  /** World y of the tray centre line */
  trayY: Float32Array;
  /** World y of the HUD bar centre line */
  hudY: Float32Array;
  /** World units per tray unit (grid.ts TRAY_* sizes) */
  scale: Float32Array;
}
export interface PanelValue {
  /** World x of the panel centre */
  x: number;
  /** World y of the tray centre line */
  trayY: number;
  /** World y of the HUD bar centre line */
  hudY: number;
  /** World units per tray unit (grid.ts TRAY_* sizes) */
  scale: number;
}
/** Panel (resource, sim) */
export const Panel = typeToken<PanelViews, PanelValue>('Panel', 'resource', { sig: 'x:f32:1,trayY:f32:1,hudY:f32:1,scale:f32:1', read: (v: PanelViews, i: number, o: Record<string, unknown>) => { o.x = v.x[i]; o.trayY = v.trayY[i]; o.hudY = v.hudY[i]; o.scale = v.scale[i]; return o; } });

export interface PlacementViews {
  active: Uint8Array;
  kind: Uint8Array;
  shape: Uint8Array;
  /** The placed item being moved, or none for a tray pick */
  fromItem: Uint32Array;
  fromCell: Int16Array;
  /** Tray slot it came from */
  slot: Int8Array;
  x: Float32Array;
  y: Float32Array;
  /** Hovered cell (a block: its top-left cell), -1 off the board */
  cell: Int16Array;
  valid: Uint8Array;
  reason: Uint8Array;
  /** Flow field if the hovered drop happened (each nest preview path is traced from it) */
  previewDist: Int16Array;
  /** 1 when previewDist holds a valid preview */
  previewLen: Uint8Array;
  returnSteps: Uint8Array;
  retFromX: Float32Array;
  retFromY: Float32Array;
  retToX: Float32Array;
  retToY: Float32Array;
  retKind: Uint8Array;
  retShape: Uint8Array;
}
export interface PlacementValue {
  active: boolean;
  kind: ItemKindName | number;
  shape: BlockShapeName | number;
  /** The placed item being moved, or none for a tray pick */
  fromItem: EntityId;
  fromCell: number;
  /** Tray slot it came from */
  slot: number;
  x: number;
  y: number;
  /** Hovered cell (a block: its top-left cell), -1 off the board */
  cell: number;
  valid: boolean;
  reason: PlaceReasonName | number;
  /** Flow field if the hovered drop happened (each nest preview path is traced from it) */
  previewDist: number[];
  /** 1 when previewDist holds a valid preview */
  previewLen: number;
  returnSteps: number;
  retFromX: number;
  retFromY: number;
  retToX: number;
  retToY: number;
  retKind: ItemKindName | number;
  retShape: BlockShapeName | number;
}
/** Placement (resource, sim) */
export const Placement = typeToken<PlacementViews, PlacementValue>('Placement', 'resource', { sig: 'active:bool:1,kind:enum:1,shape:enum:1,fromItem:entity:2,fromCell:i16:1,slot:i8:1,x:f32:1,y:f32:1,cell:i16:1,valid:bool:1,reason:enum:1,previewDist:array:140,previewLen:u8:1,returnSteps:u8:1,retFromX:f32:1,retFromY:f32:1,retToX:f32:1,retToY:f32:1,retKind:enum:1,retShape:enum:1', read: (v: PlacementViews, i: number, o: Record<string, unknown>) => { o.active = v.active[i] !== 0; o.kind = $r.enm('ItemKind', v.kind[i]!); o.shape = $r.enm('BlockShape', v.shape[i]!); o.fromItem = $r.ent(v.fromItem, i); o.fromCell = v.fromCell[i]; o.slot = v.slot[i]; o.x = v.x[i]; o.y = v.y[i]; o.cell = v.cell[i]; o.valid = v.valid[i] !== 0; o.reason = $r.enm('PlaceReason', v.reason[i]!); o.previewDist = $r.lanes(v.previewDist, i, 140, o.previewDist); o.previewLen = v.previewLen[i]; o.returnSteps = v.returnSteps[i]; o.retFromX = v.retFromX[i]; o.retFromY = v.retFromY[i]; o.retToX = v.retToX[i]; o.retToY = v.retToY[i]; o.retKind = $r.enm('ItemKind', v.retKind[i]!); o.retShape = $r.enm('BlockShape', v.retShape[i]!); return o; } });

export interface PlacementRefusedViews {
  reason: Uint8Array;
}
export interface PlacementRefusedValue {
  reason: PlaceReasonName | number;
}
/** Signal: a drop was refused. (event, sim) */
export const PlacementRefused = typeToken<PlacementRefusedViews, PlacementRefusedValue>('PlacementRefused', 'event', { sig: 'reason:enum:1', read: (v: PlacementRefusedViews, i: number, o: Record<string, unknown>) => { o.reason = $r.enm('PlaceReason', v.reason[i]!); return o; } });

export interface ProjectileViews {
  kind: Uint8Array;
  target: Uint32Array;
  tx: Float32Array;
  ty: Float32Array;
  damage: Float32Array;
  splash: Float32Array;
  speed: Float32Array;
  /** Push given on impact, cells per second */
  knockback: Float32Array;
  /** Shockwave radius on impact, cells */
  shock: Float32Array;
  /** Flight direction, unit vector x (kept for the push at impact) */
  ux: Float32Array;
  /** Flight direction, unit vector y */
  uy: Float32Array;
  /** Share of speed the enemies hit lose (frost) */
  slow: Float32Array;
  /** Game seconds the slow lasts */
  slowTime: Float32Array;
  /** Damage per game second of the puddle left on impact (mortar), 0 none */
  puddle: Float32Array;
  /** Puddle radius, cells */
  puddleSize: Float32Array;
  /** Game seconds the puddle lasts */
  puddleTime: Float32Array;
}
export interface ProjectileValue {
  kind: ItemKindName | number;
  target: EntityId;
  tx: number;
  ty: number;
  damage: number;
  splash: number;
  speed: number;
  /** Push given on impact, cells per second */
  knockback: number;
  /** Shockwave radius on impact, cells */
  shock: number;
  /** Flight direction, unit vector x (kept for the push at impact) */
  ux: number;
  /** Flight direction, unit vector y */
  uy: number;
  /** Share of speed the enemies hit lose (frost) */
  slow: number;
  /** Game seconds the slow lasts */
  slowTime: number;
  /** Damage per game second of the puddle left on impact (mortar), 0 none */
  puddle: number;
  /** Puddle radius, cells */
  puddleSize: number;
  /** Game seconds the puddle lasts */
  puddleTime: number;
}
/** Projectile (component, sim) */
export const Projectile = typeToken<ProjectileViews, ProjectileValue>('Projectile', 'component', { sig: 'kind:enum:1,target:entity:2,tx:f32:1,ty:f32:1,damage:f32:1,splash:f32:1,speed:f32:1,knockback:f32:1,shock:f32:1,ux:f32:1,uy:f32:1,slow:f32:1,slowTime:f32:1,puddle:f32:1,puddleSize:f32:1,puddleTime:f32:1', read: (v: ProjectileViews, i: number, o: Record<string, unknown>) => { o.kind = $r.enm('ItemKind', v.kind[i]!); o.target = $r.ent(v.target, i); o.tx = v.tx[i]; o.ty = v.ty[i]; o.damage = v.damage[i]; o.splash = v.splash[i]; o.speed = v.speed[i]; o.knockback = v.knockback[i]; o.shock = v.shock[i]; o.ux = v.ux[i]; o.uy = v.uy[i]; o.slow = v.slow[i]; o.slowTime = v.slowTime[i]; o.puddle = v.puddle[i]; o.puddleSize = v.puddleSize[i]; o.puddleTime = v.puddleTime[i]; return o; } });

export interface PuddleViews {
  /** Cells */
  radius: Float32Array;
  /** Damage per game second to each enemy inside */
  dps: Float32Array;
  /** Game seconds before it dries */
  left: Float32Array;
  /** Game seconds it lasts in all (for the fade) */
  life: Float32Array;
}
export interface PuddleValue {
  /** Cells */
  radius: number;
  /** Damage per game second to each enemy inside */
  dps: number;
  /** Game seconds before it dries */
  left: number;
  /** Game seconds it lasts in all (for the fade) */
  life: number;
}
/** Puddle (component, sim) */
export const Puddle = typeToken<PuddleViews, PuddleValue>('Puddle', 'component', { sig: 'radius:f32:1,dps:f32:1,left:f32:1,life:f32:1', read: (v: PuddleViews, i: number, o: Record<string, unknown>) => { o.radius = v.radius[i]; o.dps = v.dps[i]; o.left = v.left[i]; o.life = v.life[i]; return o; } });

export type RestartRequestedViews = Record<string, never>;
export type RestartRequestedValue = Record<string, never>;
/** The player pressed Restart on the end screen. (event, sim) */
export const RestartRequested = typeToken<RestartRequestedViews, RestartRequestedValue>('RestartRequested', 'event');

export interface RollRequestedViews {
  /** The Luxury roll (paid with star charge, Rare or better) instead of the coin Roll */
  luxury: Uint8Array;
}
export interface RollRequestedValue {
  /** The Luxury roll (paid with star charge, Rare or better) instead of the coin Roll */
  luxury: boolean;
}
/** The player pressed Roll or Luxury on the Upgrades screen. (event, sim) */
export const RollRequested = typeToken<RollRequestedViews, RollRequestedValue>('RollRequested', 'event', { sig: 'luxury:bool:1', read: (v: RollRequestedViews, i: number, o: Record<string, unknown>) => { o.luxury = v.luxury[i] !== 0; return o; } });

export interface RunViews {
  phase: Uint8Array;
  /** Bumped on every restart */
  runId: Uint32Array;
  /** Game seconds, scaled by speed (slow motion while dragging) */
  time: Float32Array;
  /** Game speed: 1 normal, 0.05 while a finger drags an item */
  speed: Float32Array;
  /** Waves started so far (0 before the first) */
  wave: Uint32Array;
  lives: Uint32Array;
  gold: Uint32Array;
  /** Fractional gold from swarm kills, paid out as whole coins */
  goldFrac: Float32Array;
  /** Walls bought this run (the first FREE_WALLS are free) */
  wallsBuilt: Uint32Array;
  nextWaveAt: Float32Array;
  /** Spawn group of the current wave */
  group: Uint32Array;
  groupSpawned: Uint32Array;
  spawnAt: Float32Array;
  spawning: Uint8Array;
  alive: Uint32Array;
  kills: Uint32Array;
  /** Steps left of the boss intro beat */
  bossSteps: Uint32Array;
  placements: Uint32Array;
  refusals: Uint32Array;
  shots: Uint32Array;
  booms: Uint32Array;
  /** Damage events on enemies (the camera tremor follows it) */
  hurts: Uint32Array;
  baseHits: Uint32Array;
  bosses: Uint32Array;
  /** Round-robin counter: which open nest the next ant leaves from */
  nestTurn: Uint32Array;
  /** Nests open so far (presentation plays the opening) */
  nestsOpen: Uint32Array;
  /** The end-of-run reward was paid into the meta */
  paid: Uint8Array;
  /** Stars this run earned (0 on a defeat) */
  stars: Uint8Array;
  /** Stars above the best already won on this level (they charge the Luxury roll) */
  newStars: Uint8Array;
  /** Meta coins this run paid */
  coinsWon: Uint32Array;
}
export interface RunValue {
  phase: RunPhaseName | number;
  /** Bumped on every restart */
  runId: number;
  /** Game seconds, scaled by speed (slow motion while dragging) */
  time: number;
  /** Game speed: 1 normal, 0.05 while a finger drags an item */
  speed: number;
  /** Waves started so far (0 before the first) */
  wave: number;
  lives: number;
  gold: number;
  /** Fractional gold from swarm kills, paid out as whole coins */
  goldFrac: number;
  /** Walls bought this run (the first FREE_WALLS are free) */
  wallsBuilt: number;
  nextWaveAt: number;
  /** Spawn group of the current wave */
  group: number;
  groupSpawned: number;
  spawnAt: number;
  spawning: boolean;
  alive: number;
  kills: number;
  /** Steps left of the boss intro beat */
  bossSteps: number;
  placements: number;
  refusals: number;
  shots: number;
  booms: number;
  /** Damage events on enemies (the camera tremor follows it) */
  hurts: number;
  baseHits: number;
  bosses: number;
  /** Round-robin counter: which open nest the next ant leaves from */
  nestTurn: number;
  /** Nests open so far (presentation plays the opening) */
  nestsOpen: number;
  /** The end-of-run reward was paid into the meta */
  paid: boolean;
  /** Stars this run earned (0 on a defeat) */
  stars: number;
  /** Stars above the best already won on this level (they charge the Luxury roll) */
  newStars: number;
  /** Meta coins this run paid */
  coinsWon: number;
}
/** Run (resource, sim) */
export const Run = typeToken<RunViews, RunValue>('Run', 'resource', { sig: 'phase:enum:1,runId:u32:1,time:f32:1,speed:f32:1,wave:u32:1,lives:u32:1,gold:u32:1,goldFrac:f32:1,wallsBuilt:u32:1,nextWaveAt:f32:1,group:u32:1,groupSpawned:u32:1,spawnAt:f32:1,spawning:bool:1,alive:u32:1,kills:u32:1,bossSteps:u32:1,placements:u32:1,refusals:u32:1,shots:u32:1,booms:u32:1,hurts:u32:1,baseHits:u32:1,bosses:u32:1,nestTurn:u32:1,nestsOpen:u32:1,paid:bool:1,stars:u8:1,newStars:u8:1,coinsWon:u32:1', read: (v: RunViews, i: number, o: Record<string, unknown>) => { o.phase = $r.enm('RunPhase', v.phase[i]!); o.runId = v.runId[i]; o.time = v.time[i]; o.speed = v.speed[i]; o.wave = v.wave[i]; o.lives = v.lives[i]; o.gold = v.gold[i]; o.goldFrac = v.goldFrac[i]; o.wallsBuilt = v.wallsBuilt[i]; o.nextWaveAt = v.nextWaveAt[i]; o.group = v.group[i]; o.groupSpawned = v.groupSpawned[i]; o.spawnAt = v.spawnAt[i]; o.spawning = v.spawning[i] !== 0; o.alive = v.alive[i]; o.kills = v.kills[i]; o.bossSteps = v.bossSteps[i]; o.placements = v.placements[i]; o.refusals = v.refusals[i]; o.shots = v.shots[i]; o.booms = v.booms[i]; o.hurts = v.hurts[i]; o.baseHits = v.baseHits[i]; o.bosses = v.bosses[i]; o.nestTurn = v.nestTurn[i]; o.nestsOpen = v.nestsOpen[i]; o.paid = v.paid[i] !== 0; o.stars = v.stars[i]; o.newStars = v.newStars[i]; o.coinsWon = v.coinsWon[i]; return o; } });

export interface TrayCoinViews {
  slot: Uint8Array;
}
export interface TrayCoinValue {
  slot: number;
}
/** TrayCoin (component, sim) */
export const TrayCoin = typeToken<TrayCoinViews, TrayCoinValue>('TrayCoin', 'component', { sig: 'slot:u8:1', read: (v: TrayCoinViews, i: number, o: Record<string, unknown>) => { o.slot = v.slot[i]; return o; } });

export interface TrayIconViews {
  slot: Uint8Array;
}
export interface TrayIconValue {
  slot: number;
}
/** TrayIcon (component, sim) */
export const TrayIcon = typeToken<TrayIconViews, TrayIconValue>('TrayIcon', 'component', { sig: 'slot:u8:1', read: (v: TrayIconViews, i: number, o: Record<string, unknown>) => { o.slot = v.slot[i]; return o; } });

export interface TrayLabelViews {
  slot: Uint8Array;
}
export interface TrayLabelValue {
  slot: number;
}
/** TrayLabel (component, sim) */
export const TrayLabel = typeToken<TrayLabelViews, TrayLabelValue>('TrayLabel', 'component', { sig: 'slot:u8:1', read: (v: TrayLabelViews, i: number, o: Record<string, unknown>) => { o.slot = v.slot[i]; return o; } });

export interface TraySlotViews {
  slot: Uint8Array;
  shownVersion: Int32Array;
  shownPrice: Int16Array;
  affordable: Uint8Array;
}
export interface TraySlotValue {
  slot: number;
  shownVersion: number;
  shownPrice: number;
  affordable: boolean;
}
/** TraySlot (component, sim) */
export const TraySlot = typeToken<TraySlotViews, TraySlotValue>('TraySlot', 'component', { sig: 'slot:u8:1,shownVersion:i32:1,shownPrice:i16:1,affordable:bool:1', read: (v: TraySlotViews, i: number, o: Record<string, unknown>) => { o.slot = v.slot[i]; o.shownVersion = v.shownVersion[i]; o.shownPrice = v.shownPrice[i]; o.affordable = v.affordable[i] !== 0; return o; } });

export interface UpgradeRolledViews {
  upgrade: Uint8Array;
  rarity: Uint8Array;
  level: Uint8Array;
  luxury: Uint8Array;
}
export interface UpgradeRolledValue {
  upgrade: UpgradeKindName | number;
  rarity: RarityName | number;
  level: number;
  luxury: boolean;
}
/** Signal: a roll gave an upgrade (the reveal popup shows it). (event, sim) */
export const UpgradeRolled = typeToken<UpgradeRolledViews, UpgradeRolledValue>('UpgradeRolled', 'event', { sig: 'upgrade:enum:1,rarity:enum:1,level:u8:1,luxury:bool:1', read: (v: UpgradeRolledViews, i: number, o: Record<string, unknown>) => { o.upgrade = $r.enm('UpgradeKind', v.upgrade[i]!); o.rarity = $r.enm('Rarity', v.rarity[i]!); o.level = v.level[i]; o.luxury = v.luxury[i] !== 0; return o; } });

export interface WaveStartedViews {
  wave: Uint32Array;
  boss: Uint8Array;
  newNest: Uint8Array;
}
export interface WaveStartedValue {
  wave: number;
  boss: boolean;
  newNest: boolean;
}
/** Signal: a wave started. (event, sim) */
export const WaveStarted = typeToken<WaveStartedViews, WaveStartedValue>('WaveStarted', 'event', { sig: 'wave:u32:1,boss:bool:1,newNest:bool:1', read: (v: WaveStartedViews, i: number, o: Record<string, unknown>) => { o.wave = v.wave[i]; o.boss = v.boss[i] !== 0; o.newNest = v.newNest[i] !== 0; return o; } });

/** A level layout: its nests, its base, and what stands on the board when a run starts. */
export type LevelDefData = {
  /** Stable id saves and analytics use; never changes once shipped */
  id: string;
  /** Shown on the level menu */
  name: string;
  /** Position on the level menu, from 1; 0 keeps it off the menu (test layouts) */
  order: number;
  /** Pre-placed blocks */
  blocks: {
    shape: "b1x1" | "b2x2" | "b2x1" | "b1x2" | "b3x1" | "b1x3";
    /** Column of the top-left cell, 0 on the left */
    col: number;
    /** Row of the top-left cell, 0 at the top */
    row: number;
  }[];
  /** Pre-placed weapons, each standing on a pre-placed block cell */
  weapons: {
    kind: "tower" | "cannon" | "frost" | "mine" | "boostPad" | "mortar" | "flamethrower" | "radar" | "bank";
    /** Column, 0 on the left */
    col: number;
    /** Row, 0 at the top; the cell must hold a pre-placed block */
    row: number;
  }[];
  /** Board width in cells, 4 to 10; absent: 7 */
  cols?: number;
  /** Board height in cells, 4 to 14; absent: 11 */
  rows?: number;
  /** Ant nests, 1 to 5, in path-colour order; absent: the default nests (src/grid.ts) */
  nests?: {
    /** Column, 0 on the left */
    col: number;
    /** Row, 0 at the top */
    row: number;
    /** Wave it opens on (1: open from the start) */
    fromWave: number;
  }[];
  /** The base to defend; absent: the default base (src/grid.ts) */
  base?: {
    /** Column, 0 on the left */
    col: number;
    /** Row, 0 at the top */
    row: number;
  };
  /** Waves to hold to win: the first N of the Waves tab of the sheet, 1 to all; absent: all */
  waves?: number;
  /** Advised POWER (meta upgrades) shown on the level map popup; absent: none shown */
  power?: number;
};
/** A loaded LevelDef as `loadData` returns it (frozen). */
export type ReadonlyLevelDefData = DataRecord<LevelDefData>;
export const LevelDef = dataToken<LevelDefData>('LevelDef');
