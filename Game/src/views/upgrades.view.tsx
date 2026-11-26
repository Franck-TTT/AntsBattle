/**
 * Upgrades (design 3B, neon): the collection as a 4-column grid of tiles (rarity rim, level pips,
 * locked weapons), POWER, and the Roll (coins) and Luxury (star charge) buttons near the thumb.
 */
import { defineView, For, Row, View, Widget, type UINode } from '@gameengine/ui';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type ButtonAccent = 'gold' | 'purple' | 'gold-off' | 'purple-off';
export type Ink = 'white' | 'cyan' | 'orange' | 'gold' | 'blue';
/** Where the lit tile leans: toward the next tile the roll animation lights. */
export type Lean = 'none' | 'left' | 'right' | 'up' | 'down';

export interface UpgradeTile {
  /** The upgrade kind (UpgradeKind), or a locked weapon's id. */
  key: string;
  /** Short name on the tile. */
  name: string;
  /** Icon texture key (assets/ui/meta/ic_*). */
  icon: string;
  ink: Ink;
  level: number;
  max: number;
  rarity: Rarity;
  owned: boolean;
  locked: boolean;
  /** What unlocks a locked tile ("Unlock Lvl 8"). */
  unlock: string;
}

export interface UpgradesModel {
  coins: string;
  stars: string;
  power: number;
  /** Keep the same array while the tiles don't change: a new one rebuilds the grid. */
  tiles: readonly UpgradeTile[];
  /** The tile lit by the roll animation (its key), or ''. */
  lit: string;
  /** Where the lit tile slides (toward the next one); it snaps back when the light moves on. */
  lean: Lean;
  /** Cost of the next Roll ("150"), or "MAX". */
  rollSub: string;
  /** Roll button look: gold when it can be bought, gold-off when not. */
  rollAccent: ButtonAccent;
  /** Stars toward the next Luxury roll ("2/10"). */
  luxurySub: string;
  luxStars: number;
  luxGoal: number;
  luxCount: string;
  luxReady: boolean;
  /** Luxury button look: purple with a charge, purple-off without. */
  luxAccent: ButtonAccent;
}

const COLUMNS = 4;

const tile = (key: string, name: string, icon: string, ink: Ink, level: number, max: number, rarity: Rarity): UpgradeTile => ({ key, name, icon, ink, level, max, rarity, owned: level > 0, locked: false, unlock: '' });
const SAMPLE_TILES: UpgradeTile[] = [
  tile('towerDmg', 'Tower DMG', 'ui/meta/ic_dmg', 'cyan', 3, 5, 'common'),
  tile('cannonDmg', 'Cannon DMG', 'ui/meta/ic_dmg', 'orange', 1, 5, 'common'),
  tile('startGold', 'Start gold', 'ui/meta/ic_gold', 'gold', 2, 5, 'common'),
  tile('killGold', 'Kill gold', 'ui/meta/ic_gold', 'gold', 0, 5, 'common'),
  tile('fireRate', 'Fire rate', 'ui/meta/ic_rate', 'white', 1, 5, 'rare'),
  tile('towerRange', 'Tower range', 'ui/meta/ic_range', 'cyan', 0, 5, 'rare'),
  tile('cannonAoe', 'Cannon AoE', 'ui/meta/ic_aoe', 'orange', 0, 5, 'rare'),
  tile('freeCell', 'Free cell', 'ui/meta/ic_cell', 'blue', 1, 5, 'rare'),
  tile('globalDmg', 'Global DMG', 'ui/meta/ic_dmg', 'white', 0, 3, 'epic'),
  tile('life', '+1 Life', 'ui/meta/ic_life', 'cyan', 0, 3, 'epic'),
  tile('reroll', 'Free reroll', 'ui/meta/ic_reroll', 'white', 0, 3, 'epic'),
  tile('freeTower', 'Free tower', 'ui/meta/ic_tower', 'cyan', 0, 1, 'legendary'),
  tile('slowmo', 'Deep slow-mo', 'ui/meta/ic_slow', 'white', 0, 1, 'legendary'),
  { ...tile('flameDmg', 'Flame DMG', 'ui/meta/ic_dmg', 'white', 0, 5, 'rare'), locked: true, unlock: 'Unlock Lvl 8' },
];

function rows(tiles: readonly UpgradeTile[]): UpgradeTile[][] {
  const out: UpgradeTile[][] = [];
  for (let i = 0; i < tiles.length; i += COLUMNS) out.push(tiles.slice(i, i + COLUMNS));
  return out;
}

export const UpgradesView = defineView<UpgradesModel>({
  name: 'Upgrades',
  description: 'The upgrades collection (4-column grid), POWER, the Roll and Luxury buttons and the bottom navigation. Intents: tile (payload: the upgrade key), roll, luxury, back.',
  samples: {
    fresh: { coins: '120', stars: '3', power: 0, tiles: SAMPLE_TILES.map((t) => ({ ...t, level: 0, owned: false })), rollSub: '150', rollAccent: 'gold-off', luxurySub: '3/10', luxStars: 3, luxGoal: 10, luxCount: '0', luxReady: false, luxAccent: 'purple-off', lit: '', lean: 'none' },
    ready: { coins: '1,240', stars: '12', power: 10, tiles: SAMPLE_TILES, rollSub: '150', rollAccent: 'gold', luxurySub: '2/10', luxStars: 2, luxGoal: 10, luxCount: '1', luxReady: true, luxAccent: 'purple', lit: 'fireRate', lean: 'right' },
  },
  render: (model, { intent }) => {
    // Rows are rebuilt only when the tiles array changes, so lighting a tile only flips its `lit` pose.
    let lastTiles: readonly UpgradeTile[] | null = null;
    let lastRows: UpgradeTile[][] = [];
    const tileRows = () => {
      const t = model().tiles;
      if (t !== lastTiles) {
        lastTiles = t;
        lastRows = rows(t);
      }
      return lastRows;
    };
    return (
    <Widget
      doc="upgrades"
      props={{
        coins: () => model().coins,
        stars: () => model().stars,
        power: () => model().power,
        rollSub: () => model().rollSub,
        rollAccent: () => model().rollAccent,
        luxurySub: () => model().luxurySub,
        luxStars: () => model().luxStars,
        luxGoal: () => model().luxGoal,
        luxCount: () => model().luxCount,
        luxReady: () => model().luxReady,
        luxAccent: () => model().luxAccent,
      }}
      codeAreas={{
        grid: (
          (<For class="up-grid" each={tileRows}>
            {(row) => (
              <Row class="up-row">
                {row.map((t) => (
                  <View class="up-cell">
                    {/* The lit tile (roll animation) draws above the screen: its grown glow is neither cut by
                        the scrolling grid nor covered by the tiles drawn after it. */}
                    <Widget
                      doc="upgrade-tile"
                      id={t.key}
                      lift={() => (model().lit === t.key ? 'Upgrades' : null)}
                      props={{ label: t.name, icon: t.icon, ink: t.ink, level: t.level, max: t.max, rarity: t.rarity, owned: t.owned, locked: t.locked, unlock: t.unlock, lit: () => model().lit === t.key, lean: () => (model().lit === t.key ? model().lean : 'none') }}
                      onIntent={() => intent('tile', t.key)}
                    />
                  </View>
                ))}
                {Array.from({ length: COLUMNS - row.length }, () => <View class="up-cell" />)}
              </Row>
            )}
          </For>) as UINode
        ),
      }}
      onIntent={(_, e) => {
        const name = e.path.at(-1)!;
        intent(name === 'maptab' ? 'back' : name);
      }}
    />
    );
  },
});

export interface RevealModel {
  kicker: string;
  name: string;
  levels: string;
  stat: string;
  effect: string;
  rarity: Rarity;
  /** Button label: COLLECT after a roll, OK on a tile's details. */
  cta: string;
}

export const UpgradeRevealView = defineView<RevealModel>({
  name: 'UpgradeReveal',
  description: 'An upgrade: rarity, level and its effect before → after; after a roll or on a tile tap. Intents: collect.',
  samples: {
    epic: { kicker: 'LUXURY · EPIC', name: 'Extra life', levels: 'Level 1 / 3', stat: 'Base lives', effect: '+0 → +1', rarity: 'epic', cta: 'COLLECT' },
    common: { kicker: 'COMMON', name: 'Tower damage', levels: 'Level 3 / 5', stat: 'Tower damage', effect: '+15% → +20%', rarity: 'common', cta: 'OK' },
  },
  render: (model, { intent }) => (
    <Widget
      doc="upgrade-reveal"
      props={{ kicker: () => model().kicker, name: () => model().name, levels: () => model().levels, stat: () => model().stat, effect: () => model().effect, rarity: () => model().rarity, cta: () => model().cta }}
      onIntent={(_, e) => intent(e.path.at(-1) === 'dismiss' ? 'collect' : e.path.at(-1)!)}
    />
  ),
});
