/**
 * Waves, enemies following the flow field, towers and cannons shooting. Sim code; every timer
 * runs on game time (ctx.dt × Run.speed), so slow motion slows the whole battle.
 *
 * Built for swarms (thousands of ants): one entity per ant, no per-frame presentation work per
 * ant, no trigonometry in the per-ant loop, and a spatial grid (counting sort by cell, rebuilt
 * once per step) so targeting and area damage only look at nearby ants. The hot loops use
 * typed arrays, columns and enums only, so they stay inside what the engine transpiles to Rust.
 */
import { added, burstAt, defineSystem, math, query, read, write, LocalTransform, entityAt, Shape, type Chunk, type EntityId, type SystemContext } from '@gameengine/runtime';
import { Block, Board, Enemy, EnemyKilled, FlowCell, FxHost, FxKind, Item, ItemKind, Projectile, Run, WaveStarted } from '../schema.gen.ts';
import { CELLS, COLS, ROWS, cellX, cellY, colAt, nearestCell, nextCell } from '../grid.ts';
import { ENEMIES, ENEMY_SPEED, HP_PER_WAVE, ITEMS, MAX_ENEMIES, SWARM, WAVES, WAVE_COUNT, WAVE_GAP, swarmOf, type EnemyKindName } from '../balance.ts';
import { ENEMY_NAMES } from '../kinds.ts';
import { ENEMY_BODY_COLORS, ENEMY_LOOKS, ORDER, SHOT_LOOKS, enemyScale, shapeValue } from '../looks.ts';

/** Seconds of quiet after the board is cleared before the next wave comes early. */
const CLEAR_BREAK = 5;
/** Steps of the boss intro beat (slow motion and banner). */
const BOSS_INTRO_STEPS = 80;
/** Most spawns in one step (a fast swarm group can owe several). */
const MAX_SPAWNS_PER_STEP = 12;
const FLASH_STEPS = 5;
/** Knockback damping per game second: the push dies out in a few frames, then the walk takes over. */
const KNOCK_DAMP = 12;
/** Fastest knockback an enemy can carry, cells per second (stacked hits never fling it far). */
const KNOCK_MAX = 4;
/** Share of the push along the shot; the rest points away from the impact (the shockwave). */
const KNOCK_ALONG = 0.6;

/** Spawns an enemy at (atX, atY), or around the nest at `nestCell` when no point is given. */
export function spawnEnemy(ctx: SystemContext, kind: EnemyKindName, wave: number, time: number, atX: number | undefined, atY: number | undefined, nestCell: number): void {
  const def = ENEMIES[kind];
  const look = ENEMY_LOOKS[kind];
  const n = swarmOf(kind);
  const hp = Math.max(1, Math.round((def.hp * (1 + HP_PER_WAVE * (wave - 1))) / n));
  const x = atX ?? cellX(nestCell) + ctx.rng.between(-0.3, 0.3);
  const y = atY ?? cellY(nestCell) + ctx.rng.between(-0.2, 0.2);
  const big = kind === 'beetle' || kind === 'boss';
  const k = enemyScale(kind);
  const spread = SWARM > 1 ? 0.3 : 0.14;
  const enemy = {
    LocalTransform: { position: [x, y, 0] as [number, number, number], rotation: [0, 0, -Math.SQRT1_2, Math.SQRT1_2] as [number, number, number, number], scale: [k, k, 1] as [number, number, number] },
    Shape: shapeValue(look.body, ORDER.enemy),
    Enemy: {
      kind, hp, maxHp: hp, speed: def.speed * ENEMY_SPEED * ctx.rng.between(0.94, 1.06), reward: def.reward / n, damage: def.swarms ? def.damage : def.damage * SWARM,
      hx: 0, hy: -1, remaining: 99, lane: kind === 'boss' ? 0 : ctx.rng.between(-spread, spread), bornAt: time,
    },
  };
  if (!big) {
    ctx.commands.spawn(enemy);
    return;
  }
  const e = ctx.commands.spawn({ ...enemy, VisualOffset: {}, Big: {} });
  ctx.commands.spawn({
    LocalTransform: { position: [look.headX, 0, 0], rotation: [0, 0, 0, 1], scale: [1, 1, 1] },
    Shape: shapeValue(look.head, ORDER.enemy + 1),
    Parent: { entity: e },
  });
}

/** Plays one effect at up to 64 positions in a single host call. */
function burstAll(hosts: Chunk[], kind: number, xs: Float32Array, ys: Float32Array, n: number): void {
  if (n === 0) return;
  const at: number[][] = [];
  for (let i = 0; i < n && i < 64; i++) at.push([xs[i]!, ys[i]!]);
  for (const c of hosts) {
    const k = c.col(FxHost).kind;
    for (let i = 0; i < c.length; i++) if (k[i] === kind) burstAt(c.entity(i), at);
  }
}

export const Waves = defineSystem({
  name: 'Waves',
  after: ['GameSpeed'],
  resources: [write(Run), read(Board)],
  runIf: [
    { resource: Run, field: 'phase', value: 'playing' },
    {
      any: [
        { resource: Run, field: 'time', op: '>=', value: { resource: Run, field: 'spawnAt' } },
        { resource: Run, field: 'time', op: '>=', value: { resource: Run, field: 'nextWaveAt' } },
        { resource: Run, field: 'alive', op: '==', value: 0 },
      ],
    },
  ],
  run(ctx) {
    const run = ctx.resource(Run);
    const board = ctx.resource(Board);
    const nests = board.nestCount[0]!;
    const time = run.time[0]!;
    let wave = run.wave[0]!;
    // Board cleared between waves: the next one comes after a short break.
    if (wave > 0 && wave < WAVE_COUNT && !run.spawning[0] && run.alive[0] === 0 && run.nextWaveAt[0]! - time > CLEAR_BREAK) run.nextWaveAt[0] = time + CLEAR_BREAK;
    if (wave < WAVE_COUNT && time >= run.nextWaveAt[0]!) {
      wave++;
      run.wave[0] = wave;
      run.group[0] = 0;
      run.groupSpawned[0] = 0;
      run.spawnAt[0] = time + 0.6;
      run.spawning[0] = 1;
      run.nextWaveAt[0] = time + WAVE_GAP;
      let newNest = false;
      for (let n = 0; n < nests; n++) if (wave > 1 && board.nestWave[n] === wave) newNest = true;
      ctx.signal(WaveStarted, { wave, boss: WAVES[wave - 1]!.some((g) => g.kind === 'boss'), newNest });
    }
    let spawned = 0;
    while (run.spawning[0] && time >= run.spawnAt[0]! && spawned < MAX_SPAWNS_PER_STEP) {
      const groups = WAVES[wave - 1]!;
      const g = groups[run.group[0]!]!;
      const n = swarmOf(g.kind);
      // Ants leave the open nests in turn.
      let open = 0;
      for (let k = 0; k < nests; k++) if (board.nestWave[k]! <= wave) open++;
      let pick = run.nestTurn[0]! % Math.max(1, open);
      let nestCell = board.nestCell[0]!;
      for (let k = 0; k < nests; k++) {
        if (board.nestWave[k]! > wave) continue;
        if (pick === 0) {
          nestCell = board.nestCell[k]!;
          break;
        }
        pick--;
      }
      run.nestTurn[0] = run.nestTurn[0]! + 1;
      spawnEnemy(ctx, g.kind, wave, time, undefined, undefined, nestCell);
      spawned++;
      run.alive[0] = run.alive[0]! + 1;
      if (g.kind === 'boss') {
        run.bosses[0] = run.bosses[0]! + 1;
        run.bossSteps[0] = BOSS_INTRO_STEPS;
      }
      run.spawnAt[0] = run.spawnAt[0]! + g.every / n;
      run.groupSpawned[0] = run.groupSpawned[0]! + 1;
      if (run.groupSpawned[0]! >= g.count * n) {
        run.groupSpawned[0] = 0;
        run.group[0] = run.group[0]! + 1;
        if (run.group[0]! >= groups.length) {
          run.spawning[0] = 0;
          run.spawnAt[0] = 1e9;
        } else run.spawnAt[0] = time + 1.2;
      }
    }
    if (wave === WAVE_COUNT && !run.spawning[0] && run.alive[0] === 0) ctx.set(Run, { phase: 'won' });
  },
});

/** Copies the flow field into the FlowCell entities, only when the board changed. */
export const SyncFlow = defineSystem({
  name: 'SyncFlow',
  after: ['DragItems'],
  query: query(write(FlowCell)),
  resources: [read(Board)],
  // On a board change, and once the cells exist (they are spawned the step the board is built).
  runIf: { any: [{ changed: Board }, { query: query(added(FlowCell)) }] },
  run(ctx, q) {
    const dist = ctx.resource(Board).dist;
    for (const c of q.chunks()) {
      const f = c.col(FlowCell);
      for (let i = 0; i < c.length; i++) {
        const cell = f.cell[i]!;
        f.dist[i] = dist[cell]!;
        f.next[i] = dist[cell] === 0 ? cell : nextCell(dist, cell);
      }
    }
  },
});

export const MoveEnemies = defineSystem({
  name: 'MoveEnemies',
  after: ['Waves', 'SyncFlow'],
  queries: { cells: query(read(FlowCell)), enemies: query(write(Enemy), write(LocalTransform)) },
  resources: [write(Run)],
  runIf: [{ resource: Run, field: 'phase', value: 'playing' }, { resource: Run, field: 'alive', op: '>', value: 0 }],
  run(ctx, q) {
    const run = ctx.resource(Run);
    const dt = ctx.dt * run.speed[0]!;
    const turn = Math.min(1, dt * 12);
    // The field as two small typed arrays, read once per step.
    const next = new Int16Array(CELLS);
    const dist = new Int16Array(CELLS);
    for (const c of q.cells.chunks()) {
      const f = c.col(FlowCell);
      for (let i = 0; i < c.length; i++) {
        next[f.cell[i]!] = f.next[i]!;
        dist[f.cell[i]!] = f.dist[i]!;
      }
    }
    // The base is the cell at distance 0 of the field.
    let baseCell = -1;
    for (let c = 0; c < CELLS; c++) if (dist[c] === 0) baseCell = c;
    const bx = cellX(baseCell);
    const by = cellY(baseCell);
    let baseHits = 0;
    for (const c of q.enemies.chunks()) {
      const en = c.col(Enemy);
      const tr = c.col(LocalTransform);
      for (let i = 0; i < c.length; i++) {
        if (en.remaining[i]! < 0) continue;
        if (en.flashSteps[i]! > 0) {
          en.flashSteps[i] = en.flashSteps[i]! - 1;
          if (en.flashSteps[i] === 0) ctx.commands.setField(c.entity(i), Shape, 'color', ENEMY_BODY_COLORS[en.kind[i]!]!);
        }
        const x = tr.position[i * 3]!;
        const y = tr.position[i * 3 + 1]!;
        const cell = nearestCell(x, y, COLS, ROWS);
        if (cell === baseCell && (x - bx) * (x - bx) + (y - by) * (y - by) < 0.16) {
          // Reached the base.
          en.remaining[i] = -1;
          ctx.commands.despawn(c.entity(i));
          run.alive[0] = run.alive[0]! - 1;
          const lives = run.lives[0]!;
          run.lives[0] = lives > en.damage[i]! ? lives - en.damage[i]! : 0;
          baseHits++;
          continue;
        }
        const goal = next[cell]! < 0 ? cell : next[cell]!;
        // Walk to the next cell's centre, offset sideways along the ant's own lane.
        const hx = en.hx[i]!;
        const hy = en.hy[i]!;
        const lane = goal === baseCell ? 0 : en.lane[i]!;
        const dx = cellX(goal) - hy * lane - x;
        const dy = cellY(goal) + hx * lane - y;
        const len = math.sqrt(dx * dx + dy * dy);
        if (len > 1e-5) {
          const stepLen = en.speed[i]! * dt;
          const k = stepLen >= len ? 1 : stepLen / len;
          tr.position[i * 3] = x + dx * k;
          tr.position[i * 3 + 1] = y + dy * k;
          // Turn the facing towards the walking direction (vector lerp, no trig).
          let nx = hx + (dx / len - hx) * turn;
          let ny = hy + (dy / len - hy) * turn;
          const nl = math.sqrt(nx * nx + ny * ny);
          if (nl > 1e-6) {
            nx /= nl;
            ny /= nl;
            en.hx[i] = nx;
            en.hy[i] = ny;
            // Quaternion about z from the unit vector: half-angle identities.
            tr.rotation[i * 4 + 2] = (ny >= 0 ? 1 : -1) * math.sqrt(Math.max(0, (1 - nx) * 0.5));
            tr.rotation[i * 4 + 3] = math.sqrt(Math.max(0, (1 + nx) * 0.5));
          }
        }
        // Knockback: drift along the push while it dies out; the walk above steers back to the lane.
        const kx = en.kx[i]!;
        const ky = en.ky[i]!;
        if (kx !== 0 || ky !== 0) {
          const px = tr.position[i * 3]! + kx * dt;
          const py = tr.position[i * 3 + 1]! + ky * dt;
          // Never pushed onto a cell the field does not cross (a block).
          if (dist[nearestCell(px, py, COLS, ROWS)]! >= 0) {
            tr.position[i * 3] = px;
            tr.position[i * 3 + 1] = py;
          }
          const damp = Math.max(0, 1 - KNOCK_DAMP * dt);
          const nkx = kx * damp;
          const nky = ky * damp;
          const still = nkx * nkx + nky * nky < 1e-4;
          en.kx[i] = still ? 0 : nkx;
          en.ky[i] = still ? 0 : nky;
        }
        en.remaining[i] = (dist[cell]! < 0 ? 50 : dist[cell]!) + len;
      }
    }
    if (baseHits > 0) {
      // The base's burst is presentation (Juice follows Run.baseHits), so this loop stays in Rust.
      run.baseHits[0] = run.baseHits[0]! + baseHits;
      if (run.lives[0] === 0) ctx.set(Run, { phase: 'lost' });
    }
  },
});

// Spatial grid scratch: rebuilt in full at the start of every Combat run (no state between runs).
const ex = new Float32Array(MAX_ENEMIES);
const ey = new Float32Array(MAX_ENEMIES);
const erem = new Float32Array(MAX_ENEMIES);
const echunk = new Uint16Array(MAX_ENEMIES);
const erow = new Uint32Array(MAX_ENEMIES);
const ecell = new Int16Array(MAX_ENEMIES);
const cellStart = new Int32Array(CELLS + 1);
const cellFill = new Int32Array(CELLS);
const order = new Int32Array(MAX_ENEMIES);
const popX = new Float32Array(64);
const popY = new Float32Array(64);
const hitX = new Float32Array(64);
const hitY = new Float32Array(64);
const boomX = new Float32Array(64);
const boomY = new Float32Array(64);
const casingX = new Float32Array(64);
const casingY = new Float32Array(64);
const casingDX = new Float32Array(64);
const casingDY = new Float32Array(64);

const RANGE = [0, 0, ITEMS.tower.range, ITEMS.cannon.range];
const PERIOD = [0, 0, ITEMS.tower.period, ITEMS.cannon.period];
const DAMAGE = [0, 0, ITEMS.tower.damage, ITEMS.cannon.damage];
const SPLASH = [0, 0, ITEMS.tower.splash, ITEMS.cannon.splash];
const SHOT_SPEED = [0, 0, ITEMS.tower.shotSpeed, ITEMS.cannon.shotSpeed];
const KNOCKBACK = [0, 0, ITEMS.tower.knockback, ITEMS.cannon.knockback];
const SHOCK = [0, 0, ITEMS.tower.shockRadius, ITEMS.cannon.shockRadius];

export const Combat = defineSystem({
  name: 'Combat',
  after: ['MoveEnemies'],
  queries: {
    items: query(write(Item), write(LocalTransform)),
    blocks: query(write(Block)),
    enemies: query(write(Enemy), read(LocalTransform)),
    shots: query(write(Projectile), write(LocalTransform)),
    fx: query(read(FxHost)),
  },
  resources: [write(Run)],
  runIf: [{ resource: Run, field: 'phase', value: 'playing' }],
  run(ctx, q) {
    const run = ctx.resource(Run);
    const dt = ctx.dt * run.speed[0]!;

    for (const c of q.blocks.chunks()) {
      const d = c.col(Block).denySteps;
      for (let i = 0; i < c.length; i++) if (d[i]! > 0) d[i] = d[i]! - 1;
    }

    // 1. The grid: every live enemy bucketed by cell (counting sort).
    const chunks: Chunk[] = [];
    let n = 0;
    cellFill.fill(0);
    for (const c of q.enemies.chunks()) {
      const en = c.col(Enemy);
      const pos = c.col(LocalTransform).position;
      const ci = chunks.length;
      chunks.push(c);
      for (let i = 0; i < c.length && n < MAX_ENEMIES; i++) {
        if (en.remaining[i]! < 0) continue;
        const x = pos[i * 3]!;
        const y = pos[i * 3 + 1]!;
        ex[n] = x;
        ey[n] = y;
        erem[n] = en.remaining[i]!;
        echunk[n] = ci;
        erow[n] = i;
        const cell = nearestCell(x, y, COLS, ROWS);
        ecell[n] = cell;
        cellFill[cell] = cellFill[cell]! + 1;
        n++;
      }
    }
    cellStart[0] = 0;
    for (let c = 0; c < CELLS; c++) {
      cellStart[c + 1] = cellStart[c]! + cellFill[c]!;
      cellFill[c] = cellStart[c]!;
    }
    for (let j = 0; j < n; j++) {
      const cell = ecell[j]!;
      order[cellFill[cell]!] = j;
      cellFill[cell] = cellFill[cell]! + 1;
    }
    // Enemies are bucketed on the largest grid (cells past the level's board stay empty).
    const colOf = colAt;
    const rowOf = (y: number) => Math.floor(cellY(0) + 0.5 - y);

    let hurts = 0;
    const damage = (j: number, amount: number): void => {
      const c = chunks[echunk[j]!]!;
      const row = erow[j]!;
      const en = c.col(Enemy);
      hurts++;
      en.hp[row] = en.hp[row]! - amount;
      if (en.flashSteps[row] === 0) ctx.commands.setField(c.entity(row), Shape, 'color', '#ffffff');
      en.flashSteps[row] = FLASH_STEPS;
    };

    /** Adds a push to enemy j, capped at KNOCK_MAX. */
    const push = (j: number, px: number, py: number): void => {
      const en = chunks[echunk[j]!]!.col(Enemy);
      const row = erow[j]!;
      let kx = en.kx[row]! + px;
      let ky = en.ky[row]! + py;
      const l2 = kx * kx + ky * ky;
      if (l2 > KNOCK_MAX * KNOCK_MAX) {
        const k = KNOCK_MAX / math.sqrt(l2);
        kx *= k;
        ky *= k;
      }
      en.kx[row] = kx;
      en.ky[row] = ky;
    };

    // 2. Weapons: move cooldown, reload, aim at the nearest-to-base enemy in range, fire.
    let casings = 0;
    for (const c of q.items.chunks()) {
      const it = c.col(Item);
      const tr = c.col(LocalTransform);
      for (let i = 0; i < c.length; i++) {
        if (it.denySteps[i]! > 0) it.denySteps[i] = it.denySteps[i]! - 1;
        if (it.cooldown[i]! > 0) it.cooldown[i] = Math.max(0, it.cooldown[i]! - dt);
        const kind = it.kind[i]!;
        if (kind !== ItemKind.tower && kind !== ItemKind.cannon) continue;
        if (it.held[i]) continue;
        if (it.reload[i]! > 0) it.reload[i] = it.reload[i]! - dt;
        if (it.reload[i]! > 0 || n === 0) continue;
        const ix = tr.position[i * 3]!;
        const iy = tr.position[i * 3 + 1]!;
        const range = RANGE[kind]!;
        const r2 = range * range;
        let best = -1;
        let bestRem = 1e9;
        const c0 = Math.max(0, colOf(ix - range));
        const c1 = Math.min(COLS - 1, colOf(ix + range));
        const r0 = Math.max(0, rowOf(iy + range));
        const r1 = Math.min(ROWS - 1, rowOf(iy - range));
        for (let row = r0; row <= r1; row++) {
          for (let col = c0; col <= c1; col++) {
            const cell = row * COLS + col;
            for (let o = cellStart[cell]!; o < cellStart[cell + 1]!; o++) {
              const j = order[o]!;
              if (erem[j]! >= bestRem) continue;
              const ddx = ex[j]! - ix;
              const ddy = ey[j]! - iy;
              if (ddx * ddx + ddy * ddy > r2) continue;
              best = j;
              bestRem = erem[j]!;
            }
          }
        }
        if (best < 0) continue;
        const bx = ex[best]!;
        const by = ey[best]!;
        const adx = bx - ix;
        const ady = by - iy;
        const al = math.sqrt(adx * adx + ady * ady) || 1;
        const ux = adx / al;
        const uy = ady / al;
        it.aim[i] = math.atan2(uy, ux);
        tr.rotation[i * 4 + 2] = (uy >= 0 ? 1 : -1) * math.sqrt(Math.max(0, (1 - ux) * 0.5));
        tr.rotation[i * 4 + 3] = math.sqrt(Math.max(0, (1 + ux) * 0.5));
        it.reload[i] = PERIOD[kind]!;
        const cannon = kind === ItemKind.cannon;
        const target = chunks[echunk[best]!]!.entity(erow[best]!);
        // A spent casing flies out of the barrel's right side, a little backwards.
        if (casings < 64) {
          casingX[casings] = ix + ux * 0.1;
          casingY[casings] = iy + uy * 0.1;
          casingDX[casings] = uy - ux * 0.35;
          casingDY[casings] = -ux - uy * 0.35;
          casings++;
        }
        ctx.commands.spawn({
          // Same turn as the barrel: the tower's streak points along its flight.
          LocalTransform: { position: [ix + ux * 0.38, iy + uy * 0.38, 0], rotation: [0, 0, tr.rotation[i * 4 + 2]!, tr.rotation[i * 4 + 3]!], scale: [1, 1, 1] },
          Shape: shapeValue(cannon ? SHOT_LOOKS.cannon : SHOT_LOOKS.tower, ORDER.shot),
          Projectile: { kind: cannon ? 'cannon' : 'tower', target, tx: bx, ty: by, damage: DAMAGE[kind]!, splash: SPLASH[kind]!, speed: SHOT_SPEED[kind]!, knockback: KNOCKBACK[kind]!, shock: SHOCK[kind]!, ux, uy },
        });
        run.shots[0] = run.shots[0]! + 1;
      }
    }

    // 3. Projectiles: towers home on their target (found again through the grid), cannon shells
    //    fly to where it stood.
    let hits = 0;
    let booms = 0;
    for (const c of q.shots.chunks()) {
      const pr = c.col(Projectile);
      const pos = c.col(LocalTransform).position;
      const rot = c.col(LocalTransform).rotation;
      for (let i = 0; i < c.length; i++) {
        const cannon = pr.kind[i] === ItemKind.cannon;
        let tj = -1;
        if (!cannon) {
          const target: EntityId = entityAt(pr.target, i);
          const tcell = nearestCell(pr.tx[i]!, pr.ty[i]!, COLS, ROWS);
          const tc = tcell % COLS;
          const trw = (tcell / COLS) | 0;
          for (let row = Math.max(0, trw - 1); row <= Math.min(ROWS - 1, trw + 1) && tj < 0; row++) {
            for (let col = Math.max(0, tc - 1); col <= Math.min(COLS - 1, tc + 1) && tj < 0; col++) {
              const cell = row * COLS + col;
              for (let o = cellStart[cell]!; o < cellStart[cell + 1]!; o++) {
                const j = order[o]!;
                if (chunks[echunk[j]!]!.entity(erow[j]!) === target) {
                  tj = j;
                  break;
                }
              }
            }
          }
          if (tj >= 0) {
            pr.tx[i] = ex[tj]!;
            pr.ty[i] = ey[tj]!;
          }
        }
        const x = pos[i * 3]!;
        const y = pos[i * 3 + 1]!;
        const dx = pr.tx[i]! - x;
        const dy = pr.ty[i]! - y;
        const len = math.sqrt(dx * dx + dy * dy);
        const stepLen = pr.speed[i]! * dt;
        if (stepLen < len) {
          const nx = dx / len;
          const ny = dy / len;
          pos[i * 3] = x + nx * stepLen;
          pos[i * 3 + 1] = y + ny * stepLen;
          pr.ux[i] = nx;
          pr.uy[i] = ny;
          if (!cannon) {
            // A homing streak turns with its target.
            rot[i * 4 + 2] = (ny >= 0 ? 1 : -1) * math.sqrt(Math.max(0, (1 - nx) * 0.5));
            rot[i * 4 + 3] = math.sqrt(Math.max(0, (1 + nx) * 0.5));
          }
          continue;
        }
        // Impact.
        ctx.commands.despawn(c.entity(i));
        const hx = pr.tx[i]!;
        const hy = pr.ty[i]!;
        // A weapon with splash hits an area around the impact (the cannon); without (the tower),
        // only its target.
        const r = pr.splash[i]! > 0 ? pr.splash[i]! : -1;
        const r2 = r * r;
        const c0 = Math.max(0, colOf(hx - r));
        const c1 = Math.min(COLS - 1, colOf(hx + r));
        const r0 = Math.max(0, rowOf(hy + r));
        const r1 = Math.min(ROWS - 1, rowOf(hy - r));
        let hitTarget = false;
        for (let row = r0; r > 0 && row <= r1; row++) {
          for (let col = c0; col <= c1; col++) {
            const cell = row * COLS + col;
            for (let o = cellStart[cell]!; o < cellStart[cell + 1]!; o++) {
              const j = order[o]!;
              const ddx = ex[j]! - hx;
              const ddy = ey[j]! - hy;
              if (ddx * ddx + ddy * ddy > r2) continue;
              damage(j, pr.damage[i]!);
              if (j === tj) hitTarget = true;
            }
          }
        }
        // A homing shot always hurts its target, even at the edge of its area.
        if (tj >= 0 && !hitTarget) damage(tj, pr.damage[i]!);
        // Shockwave: every enemy inside the radius is pushed, along the shot and away from the
        // impact, weaker towards the edge. The target always takes the full push along the shot.
        const force = pr.knockback[i]!;
        const sr = pr.shock[i]!;
        const sux = pr.ux[i]!;
        const suy = pr.uy[i]!;
        let pushedTarget = false;
        if (force > 0 && sr > 0) {
          const sr2 = sr * sr;
          const s0 = Math.max(0, colOf(hx - sr));
          const s1 = Math.min(COLS - 1, colOf(hx + sr));
          const t0 = Math.max(0, rowOf(hy + sr));
          const t1 = Math.min(ROWS - 1, rowOf(hy - sr));
          for (let row = t0; row <= t1; row++) {
            for (let col = s0; col <= s1; col++) {
              const cell = row * COLS + col;
              for (let o = cellStart[cell]!; o < cellStart[cell + 1]!; o++) {
                const j = order[o]!;
                const ddx = ex[j]! - hx;
                const ddy = ey[j]! - hy;
                const d2 = ddx * ddx + ddy * ddy;
                if (d2 > sr2) continue;
                const d = math.sqrt(d2);
                const f = force * (1 - d / sr);
                const rx = d > 1e-4 ? ddx / d : sux;
                const ry = d > 1e-4 ? ddy / d : suy;
                push(j, f * (sux * KNOCK_ALONG + rx * (1 - KNOCK_ALONG)), f * (suy * KNOCK_ALONG + ry * (1 - KNOCK_ALONG)));
                if (j === tj) pushedTarget = true;
              }
            }
          }
        }
        if (force > 0 && tj >= 0 && !pushedTarget) push(tj, force * sux, force * suy);
        if (cannon) {
          if (booms < 64) {
            boomX[booms] = hx;
            boomY[booms] = hy;
          }
          booms++;
        } else {
          if (hits < 64) {
            hitX[hits] = hx;
            hitY[hits] = hy;
          }
          hits++;
        }
      }
    }
    run.booms[0] = run.booms[0]! + booms;
    if (hurts > 0) run.hurts[0] = run.hurts[0]! + hurts;

    // 4. Deaths: gold (fractional at swarm scale), one pop per death, coins for whole gold.
    let pops = 0;
    let kills = 0;
    for (let j = 0; j < n; j++) {
      const c = chunks[echunk[j]!]!;
      const row = erow[j]!;
      const en = c.col(Enemy);
      if (en.hp[row]! > 0) continue;
      en.remaining[row] = -1;
      ctx.commands.despawn(c.entity(row));
      kills++;
      if (pops < 64) {
        popX[pops] = ex[j]!;
        popY[pops] = ey[j]!;
        pops++;
      }
      const frac = run.goldFrac[0]! + en.reward[row]!;
      const whole = Math.floor(frac + 1e-6);
      run.goldFrac[0] = frac - whole;
      if (whole > 0) {
        run.gold[0] = run.gold[0]! + whole;
        ctx.signal(EnemyKilled, { x: ex[j]!, y: ey[j]!, gold: whole, kind: ENEMY_NAMES[en.kind[row]!]! });
      }
    }
    if (kills > 0) {
      run.alive[0] = run.alive[0]! - kills;
      run.kills[0] = run.kills[0]! + kills;
    }
    if (pops + hits + booms + casings > 0) {
      const hosts: Chunk[] = [];
      for (const c of q.fx.chunks()) hosts.push(c);
      burstAll(hosts, FxKind.pop, popX, popY, pops);
      burstAll(hosts, FxKind.hit, hitX, hitY, Math.min(hits, 64));
      burstAll(hosts, FxKind.boom, boomX, boomY, Math.min(booms, 64));
      if (casings > 0) {
        const at: number[][] = [];
        for (let k = 0; k < casings; k++) at.push([casingX[k]!, casingY[k]!, casingDX[k]!, casingDY[k]!]);
        for (const c of hosts) {
          const fk = c.col(FxHost).kind;
          for (let k = 0; k < c.length; k++) if (fk[k] === FxKind.casing) burstAt(c.entity(k), at);
        }
      }
    }
  },
});

