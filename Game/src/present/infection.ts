/**
 * Infection trails: the lots the horde walks over glow green and fade back once it has passed, like
 * the green streaks a spreading infection leaves on a map. Presentation only (LateUpdate): the heat
 * per cell lives in the system's local state, the glow in a visual pool; nothing here touches the sim.
 */
import { defineSystem, query, read, visualPool, LocalTransform, RenderTime, Shape, parseColor, type Chunk } from '@gameengine/runtime';
import { Board, Enemy, Run } from '../schema.gen.ts';
import { CELLS, cellAt, cellX, cellY } from '../grid.ts';
import { INFECTION, ORDER } from '../looks.ts';

const trails = visualPool({ name: 'trails', prefab: 'assets/prefabs/shape.prefab.json', size: CELLS, draws: Shape });
export const trailsPool = trails.system;

const GLOW = parseColor(INFECTION.color);

export const Infection = defineSystem({
  name: 'Infection',
  stage: 'LateUpdate',
  queries: { pool: trails.query(), enemies: query(read(Enemy), read(LocalTransform)) },
  resources: [read(Board), read(Run), read(RenderTime)],
  run(ctx, q) {
    const heat = ctx.local(() => new Float32Array(CELLS));
    const dt = Math.min(0.1, ctx.resource(RenderTime).realDelta[0]!);
    const board = ctx.resource(Board);
    const f = trails.begin(q.pool);
    if (ctx.resource(Run).phase[0] !== 0) {
      heat.fill(0);
      f.end();
      return;
    }
    const cols = board.cols[0]!;
    const rows = board.rows[0]!;
    const fade = Math.exp(-dt / INFECTION.fadeSec);
    for (let c = 0; c < CELLS; c++) heat[c] = heat[c]! * fade;
    for (const c of q.enemies.chunks()) {
      const pos = c.col(LocalTransform).position;
      for (let i = 0; i < c.length; i++) {
        const cell = cellAt(pos[i * 3]!, pos[i * 3 + 1]!, cols, rows);
        if (cell >= 0) heat[cell] = Math.min(1, heat[cell]! + dt * INFECTION.gainPerAnt);
      }
    }
    for (let cell = 0; cell < CELLS; cell++) {
      const h = heat[cell]!;
      if (h < 0.02) continue;
      if (!f.show(cellX(cell), cellY(cell), 0, 1)) break;
      const s = (f.chunk as Chunk).col(Shape);
      const i = f.row;
      s.kind[i] = 0; // Rect
      s.size[i * 2] = INFECTION.size;
      s.size[i * 2 + 1] = INFECTION.size;
      s.radius[i] = 0.05;
      s.strokeWidth[i] = 0.03;
      s.order[i] = ORDER.trail;
      const a = INFECTION.alpha * Math.sqrt(h);
      for (let k = 0; k < 3; k++) {
        s.color[i * 4 + k] = GLOW[k]!;
        s.strokeColor[i * 4 + k] = GLOW[k]!;
      }
      s.color[i * 4 + 3] = a;
      s.strokeColor[i * 4 + 3] = Math.min(1, a * 2.2);
    }
    f.end();
  },
});
