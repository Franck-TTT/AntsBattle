/**
 * Home: the chapter's level map (design 1B, neon), the coins and stars, the Luxury roll charge,
 * PLAY on the current level and the bottom navigation. The map's nodes sit on a hand-drawn path
 * (positions from the mockup), drawn in the document's `map` code area.
 */
import { defineView, For, Row, View, Widget, type UINode } from '@gameengine/ui';

export type MapNodeState = 'done' | 'current' | 'locked' | 'boss';

export interface MapNode {
  /** The level's id (LevelDef.id). */
  key: string;
  num: number;
  state: MapNodeState;
  stars: number;
}

export interface LevelMenuModel {
  coins: string;
  stars: string;
  chapter: string;
  /** Whether there is a world before / after the one shown (the arrows beside the title). */
  hasPrev: boolean;
  hasNext: boolean;
  nodes: readonly MapNode[];
  luxText: string;
  /** Stars toward the next Luxury roll, out of luxGoal. */
  luxStars: number;
  luxGoal: number;
  luxReady: boolean;
  luxCount: string;
  playDetail: string;
  upReady: boolean;
  upBadge: string;
}

/**
 * Node centres along the chapter path, in % of the map area (mockup 1B, 10 levels a chapter). They
 * keep 12% clear at the top and 16% at the bottom for the glow and the stars, so nodes never reach
 * the chapter title or PLAY.
 */
export const MAP_PATH: readonly (readonly [number, number])[] = [
  [18, 84], [52, 80.5], [82, 70.5], [66, 58], [26, 51], [14, 38], [47, 29.5], [84, 23], [68, 15.5], [32, 12],
];
/** Path dots: spacing and the clear radius around each node, reference px (MAP_H_EST: a typical map height). */
const DOT_GAP = 26;
const NODE_CLEAR = 80;
const MAP_H_EST = 900;
/** Width of the map box in portrait, reference px (--map-w in ui/game.style.css), to space the path dots. */
const MAP_W = 1000;

function dots(nodes: readonly MapNode[]): { x: number; y: number; lit: boolean }[] {
  const out: { x: number; y: number; lit: boolean }[] = [];
  for (let i = 0; i + 1 < nodes.length && i + 1 < MAP_PATH.length; i++) {
    const [x0, y0] = MAP_PATH[i]!;
    const [x1, y1] = MAP_PATH[i + 1]!;
    const lit = nodes[i + 1]!.state === 'done' || nodes[i + 1]!.state === 'current';
    // A dot every DOT_GAP px, none under the two nodes (their radius NODE_CLEAR).
    const len = Math.hypot(((x1 - x0) * MAP_W) / 100, ((y1 - y0) * MAP_H_EST) / 100);
    const n = Math.max(2, Math.round(len / DOT_GAP));
    for (let k = 1; k < n; k++) {
      const d = (len * k) / n;
      if (d < NODE_CLEAR || len - d < NODE_CLEAR) continue;
      out.push({ x: x0 + ((x1 - x0) * k) / n, y: y0 + ((y1 - y0) * k) / n, lit });
    }
  }
  return out;
}

const sampleNodes = (current: number): MapNode[] =>
  Array.from({ length: 10 }, (_, i) => ({
    key: `l${i + 1}`,
    num: i + 1,
    state: i + 1 === current ? 'current' : i + 1 < current ? 'done' : i === 9 ? 'boss' : 'locked',
    stars: i + 1 < current ? 3 - (i % 3) : 0,
  }));

export const LevelMenuView = defineView<LevelMenuModel>({
  name: 'LevelMenu',
  description: 'Home: the level map of the current chapter, coins, stars, Luxury roll charge, PLAY and the bottom navigation. Intents: pick (payload: the level id), play, upgrades, prev-world and next-world (the arrows beside the world title).',
  samples: {
    start: { coins: '0', stars: '0', chapter: 'CHAPTER 1', hasPrev: false, hasNext: true, nodes: sampleNodes(1), luxText: '0 / 10', luxStars: 0, luxGoal: 10, luxReady: false, luxCount: '0', playDetail: 'Level 1 · Open Field', upReady: false, upBadge: '' },
    mid: { coins: '1,240', stars: '12', chapter: 'CHAPTER 1', hasPrev: false, hasNext: true, nodes: sampleNodes(6), luxText: '2 / 10', luxStars: 2, luxGoal: 10, luxReady: true, luxCount: '1', playDetail: 'Level 6 · Crossfire', upReady: true, upBadge: '1' },
  },
  render: (model, { intent }) => {
    // The map box is --map-w wide and --map-h tall (ui/game.style.css: taller on narrow phones, wider and lower in landscape).
    const at = (x: number, y: number) => ({ left: `calc(var(--map-w) * ${x / 100})`, top: `calc(var(--map-h) * ${y / 100})` });
    return (
    <Widget
      doc="home"
      props={{
        coins: () => model().coins,
        stars: () => model().stars,
        chapter: () => model().chapter,
        hasPrev: () => model().hasPrev,
        hasNext: () => model().hasNext,
        luxText: () => model().luxText,
        luxStars: () => model().luxStars,
        luxGoal: () => model().luxGoal,
        luxReady: () => model().luxReady,
        luxCount: () => model().luxCount,
        playDetail: () => model().playDetail,
        upReady: () => model().upReady,
        upBadge: () => model().upBadge,
      }}
      codeAreas={{
        map: (
          (<View class="map-root">
            <For each={() => dots(model().nodes)}>{(d) => <View class={d.lit ? 'map-dot map-dot-lit' : 'map-dot'} style={at(d.x, d.y)} />}</For>
            <For each={() => model().nodes.slice(0, MAP_PATH.length)}>
              {(n, i) => (
                <View class="map-node" style={at(MAP_PATH[i()]![0], MAP_PATH[i()]![1])}>
                  <Widget doc="map-node" id={n.key} props={{ num: n.num, stars: n.stars, state: n.state }} onIntent={() => intent('pick', n.key)} />
                </View>
              )}
            </For>
          </View>) as UINode
        ),
      }}
      onIntent={(_, e) => intent(e.path.at(-1)!)}
    />
    );
  },
});

export interface LevelPopupModel {
  /** The level's id. */
  key: string;
  kicker: string;
  name: string;
  stars: number;
  locked: boolean;
  boss: boolean;
  lockText: string;
  info: readonly { key: string; k: string; v: string; color: 'pink' | 'blue' | 'green' | 'gold' }[];
  /** The board: cols × rows, then per cell 0 free, 1 block, 2 nest, 3 base, 4 weapon. */
  cols: number;
  rows: number;
  cells: readonly number[];
}

const CELL_CLASS = ['pv-cell', 'pv-cell pv-block', 'pv-cell pv-nest', 'pv-cell pv-base', 'pv-cell pv-weapon'];

export const LevelPopupView = defineView<LevelPopupModel>({
  name: 'LevelPopup',
  description: 'A level of the map: name, best stars, its layout (nests, base, pre-placed blocks), nests, waves, board size, and PLAY or what unlocks it. Intents: play, close.',
  samples: {
    open: { key: 'l6', kicker: 'LEVEL 6', name: 'Crossfire', stars: 2, locked: false, boss: false, lockText: '', info: [{ key: 'n', k: 'Nests', v: '2', color: 'pink' }, { key: 'w', k: 'Waves', v: '8', color: 'blue' }, { key: 's', k: 'New', v: 'Beetle', color: 'green' }, { key: 'b', k: 'Power', v: '22', color: 'gold' }], cols: 7, rows: 11, cells: Array.from({ length: 77 }, (_, i) => (i === 3 ? 2 : i === 73 ? 3 : i % 9 === 4 ? 1 : 0)) },
    locked: { key: 'l7', kicker: 'LEVEL 7', name: 'Split', stars: 0, locked: true, boss: false, lockText: 'Win level 6 to unlock', info: [{ key: 'n', k: 'Nests', v: '3', color: 'pink' }, { key: 'w', k: 'Waves', v: '10', color: 'blue' }, { key: 's', k: 'New', v: '—', color: 'green' }, { key: 'b', k: 'Power', v: '24', color: 'gold' }], cols: 8, rows: 12, cells: Array.from({ length: 96 }, (_, i) => (i === 3 ? 2 : i === 92 ? 3 : 0)) },
  },
  render: (model, { intent }) => (
    <Widget
      doc="level-popup"
      props={{ kicker: () => model().kicker, name: () => model().name, stars: () => model().stars, locked: () => model().locked, boss: () => model().boss, lockText: () => model().lockText, info: () => model().info }}
      codeAreas={{
        preview: (
          (<View class="pv-board">
            <For class="pv-col" each={() => Array.from({ length: model().rows }, (_, r) => r)}>
              {(r) => (
                <Row class="pv-row">
                  <For class="pv-row" each={() => Array.from({ length: model().cols }, (_, c) => c)}>{(c) => <View class={CELL_CLASS[model().cells[r * model().cols + c] ?? 0]!} />}</For>
                </Row>
              )}
            </For>
          </View>) as UINode
        ),
      }}
      onIntent={(_, e) => intent(e.path.at(-1) === 'dismiss' ? 'close' : e.path.at(-1)!)}
    />
  ),
});
