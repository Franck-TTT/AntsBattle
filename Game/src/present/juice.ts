/**
 * Game feel, derived from sim state each frame: enemy flashes and waddle, squash and stretch on
 * drop, refused-pick shakes, the base's red flash, camera shakes and sounds. Presentation only.
 */
import { audio, burstAt, defineSystem, onSignal, parseColor, query, read, shakeCamera, withTag, write, Camera, RenderTime, Shape, VisualOffset, type EntityId } from '@gameengine/runtime';
import { Base, Big, Block, Board, Enemy, FxHost, FxKind, Item, Placement, PlacementRefused, Puddle, Run, TraySlot, WaveStarted } from '../schema.gen.ts';
import { ENEMY_NAMES, ITEM_NAMES } from '../kinds.ts';
import { cellX, cellY } from '../grid.ts';
import { COLORS, ENEMY_LOOKS, FLASH, PUDDLE } from '../looks.ts';
import { ITEMS } from '../balance.ts';

/** Recoil per ItemKind: how far the weapon kicks back (cells) and how fast it settles (1/s). */
const RECOIL: Record<(typeof ITEM_NAMES)[number], [number, number]> = { none: [0, 1], wall: [0, 1], tower: [0.03, 30], cannon: [0.09, 9], frost: [0.05, 16], mine: [0, 1], boostPad: [0, 1], mortar: [0.07, 10], flamethrower: [0.012, 30], radar: [0, 1], bank: [0, 1] };
const RECOIL_KICK = ITEM_NAMES.map((k) => RECOIL[k][0]);
const RECOIL_SETTLE = ITEM_NAMES.map((k) => RECOIL[k][1]);
const PERIOD = ITEM_NAMES.map((k) => (k === 'none' || k === 'wall' ? 0 : ITEMS[k].period));
const MINE = ITEM_NAMES.indexOf('mine');
/** Camera tremor when enemies take damage: trauma per hit burst, at most every TREMOR_GAP seconds. */
const TREMOR = 0.07;
const TREMOR_GAP = 0.12;

const lin = (hex: string) => parseColor(hex);
const WHITE = lin(FLASH.hit);
const BASE_RED = lin(FLASH.base);
const BASE_BLUE = lin(COLORS.base);
const ENEMY_BODY = ENEMY_NAMES.map((k) => lin(ENEMY_LOOKS[k].body.color));

function setColor(col: Float32Array, i: number, c: readonly number[], alpha = 1): void {
  col[i * 4] = c[0]!;
  col[i * 4 + 1] = c[1]!;
  col[i * 4 + 2] = c[2]!;
  col[i * 4 + 3] = c[3]! * alpha;
}

function rotZ(r: Float32Array, i: number, a: number): void {
  r[i * 4] = 0;
  r[i * 4 + 1] = 0;
  r[i * 4 + 2] = Math.sin(a / 2);
  r[i * 4 + 3] = Math.cos(a / 2);
}

export const Juice = defineSystem({
  name: 'Juice',
  stage: 'LateUpdate',
  queries: {
    enemies: query(read(Enemy), write(VisualOffset), withTag(Big)),
    items: query(read(Item), write(Shape), write(VisualOffset)),
    blocks: query(read(Block), write(Shape), write(VisualOffset)),
    base: query(withTag(Base), write(Shape), write(VisualOffset)),
    slots: query(read(TraySlot), write(VisualOffset)),
    puddles: query(read(Puddle), write(Shape)),
    camera: query(read(Camera)),
    fx: query(read(FxHost)),
  },
  resources: [read(Run), read(Placement), read(RenderTime), read(Board)],
  run(ctx, q) {
    const s = ctx.local(() => {
      const st = { t: 0, runId: -1, placements: 0, refusals: 0, shots: 0, booms: 0, hurts: 0, lastTremor: 0, baseHits: 0, kills: 0, bosses: 0, nestsOpen: 0, wave: 0, active: 0, phase: 0, baseFlash: 0, slotShake: -1, slotShakeT: 0, lastShot: 0 };
      onSignal(PlacementRefused, (sig) => {
        if (sig.fields.reason === 'gold') {
          st.slotShake = 1;
          st.slotShakeT = 0;
        }
      });
      onSignal(WaveStarted, () => audio.play('audio/wave', { bus: 'SFX', volume: 0.7 }));
      return st;
    });
    const dt = ctx.resource(RenderTime).realDelta[0]!;
    s.t += dt;
    const run = ctx.resource(Run);
    const board = ctx.resource(Board);
    const p = ctx.resource(Placement);
    const time = run.time[0]!;
    let cam: EntityId | null = null;
    for (const c of q.camera.chunks()) if (c.length > 0) cam = c.entity(0);

    // Counters → sounds, shakes, flashes. A restart resets them without playing anything.
    if (s.runId !== run.runId[0]) {
      s.runId = run.runId[0]!;
      s.placements = run.placements[0]!; s.refusals = run.refusals[0]!; s.shots = run.shots[0]!; s.booms = run.booms[0]!; s.hurts = run.hurts[0]!;
      s.baseHits = run.baseHits[0]!; s.nestsOpen = run.nestsOpen[0]!; s.kills = run.kills[0]!; s.bosses = run.bosses[0]!; s.phase = run.phase[0]!;
    }
    if (p.active[0] && !s.active) audio.play('audio/pickup', { bus: 'SFX', volume: 0.6 });
    s.active = p.active[0]!;
    if (run.placements[0] !== s.placements) {
      s.placements = run.placements[0]!;
      audio.play('audio/place', { bus: 'SFX', volume: 0.9, pitchRandom: 0.06 });
    }
    if (run.refusals[0] !== s.refusals) {
      s.refusals = run.refusals[0]!;
      audio.play('audio/deny', { bus: 'SFX', volume: 0.7 });
    }
    if (run.shots[0] !== s.shots) {
      s.shots = run.shots[0]!;
      if (s.t - s.lastShot > 0.06) {
        s.lastShot = s.t;
        audio.play('audio/shot', { bus: 'SFX', volume: 0.35, pitchRandom: 0.12, maxVoices: 4 });
      }
    }
    if (run.booms[0] !== s.booms) {
      s.booms = run.booms[0]!;
      audio.play('audio/boom', { bus: 'SFX', volume: 0.8, pitchRandom: 0.08, maxVoices: 3 });
      if (cam) shakeCamera(cam, 0.22);
    }
    if (run.hurts[0] !== s.hurts) {
      // A barely-there tremor while the swarm is being hit; the boom's bigger shake rides on top.
      s.hurts = run.hurts[0]!;
      if (cam && s.t - s.lastTremor > TREMOR_GAP) {
        s.lastTremor = s.t;
        shakeCamera(cam, TREMOR);
      }
    }
    if (run.kills[0] !== s.kills) {
      s.kills = run.kills[0]!;
      audio.play('audio/pop', { bus: 'SFX', volume: 0.55, pitchRandom: 0.15, maxVoices: 5 });
    }
    if (run.baseHits[0] !== s.baseHits) {
      s.baseHits = run.baseHits[0]!;
      s.baseFlash = 1;
      for (const c of q.fx.chunks()) {
        const k = c.col(FxHost).kind;
        for (let i = 0; i < c.length; i++) if (k[i] === FxKind.baseHit) burstAt(c.entity(i), [[cellX(board.baseCell[0]!), cellY(board.baseCell[0]!)]]);
      }
      audio.play('audio/basehit', { bus: 'SFX', volume: 0.9 });
      if (cam) shakeCamera(cam, 0.3);
    }
    if (run.nestsOpen[0]! > s.nestsOpen) {
      // A nest opens: a shake and a burst of dirt on it.
      const wave = run.wave[0]!;
      for (let n = 0; n < board.nestCount[0]!; n++) {
        if (board.nestWave[n] !== wave) continue;
        const nc = board.nestCell[n]!;
        for (const c of q.fx.chunks()) {
          const k = c.col(FxHost).kind;
          for (let i = 0; i < c.length; i++) if (k[i] === FxKind.dust || k[i] === FxKind.boom) burstAt(c.entity(i), [[cellX(nc), cellY(nc)]]);
        }
      }
      audio.play('audio/boom', { bus: 'SFX', volume: 0.7 });
      if (cam) shakeCamera(cam, 0.45);
    }
    s.nestsOpen = run.nestsOpen[0]!;
    if (run.bosses[0] !== s.bosses) {
      s.bosses = run.bosses[0]!;
      audio.play('audio/boss', { bus: 'SFX', volume: 1 });
      if (cam) shakeCamera(cam, 0.55);
    }
    if (run.phase[0] !== s.phase) {
      s.phase = run.phase[0]!;
      if (s.phase === 1) audio.play('audio/win', { bus: 'SFX', volume: 0.9 });
      if (s.phase === 2) audio.play('audio/lose', { bus: 'SFX', volume: 0.9 });
    }

    // Big enemies only (beetles, boss): grow in, squash on hit. Plain ants get no per-frame
    // presentation work so a swarm of thousands costs nothing here; their flash is set by the sim.
    for (const c of q.enemies.chunks()) {
      const en = c.col(Enemy);
      const vo = c.col(VisualOffset);
      for (let i = 0; i < c.length; i++) {
        const age = time - en.bornAt[i]!;
        const grow = en.kind[i] === 3 ? Math.min(1, 0.2 + age * 0.8) : Math.min(1, 0.3 + age * 4);
        const squash = en.flashSteps[i]! > 0 ? 0.12 : 0;
        vo.scale[i * 3] = grow * (1 + squash);
        vo.scale[i * 3 + 1] = grow * (1 - squash);
        vo.scale[i * 3 + 2] = 1;
      }
    }

    // Items: squash and stretch on drop, a shake when a pick-up is refused, faded while held.
    for (const c of q.items.chunks()) {
      const it = c.col(Item);
      const sh = c.col(Shape);
      const vo = c.col(VisualOffset);
      for (let i = 0; i < c.length; i++) {
        const age = time - it.placedAt[i]!;
        let sx = 1;
        let sy = 1;
        if (age >= 0 && age < 0.5) {
          const k = Math.exp(-age * 9) * Math.cos(age * 30);
          sx = 1 + 0.28 * k;
          sy = 1 - 0.28 * k;
        }
        vo.scale[i * 3] = sx;
        vo.scale[i * 3 + 1] = sy;
        vo.scale[i * 3 + 2] = 1;
        const deny = it.denySteps[i]!;
        // Recoil: kicked back against the aim on each shot, then eased back into place.
        const kind = it.kind[i]!;
        let kick = 0;
        if (RECOIL_KICK[kind]! > 0 && !it.held[i]) {
          const since = PERIOD[kind]! - it.reload[i]!;
          if (since >= 0 && since < 0.6) kick = RECOIL_KICK[kind]! * Math.exp(-since * RECOIL_SETTLE[kind]!);
        }
        const aim = it.aim[i]!;
        vo.position[i * 3] = (deny > 0 ? Math.sin(deny * 1.6) * 0.09 : 0) - Math.cos(aim) * kick;
        vo.position[i * 3 + 1] = -Math.sin(aim) * kick;
        // A mine that blew up shows dimmed until it re-arms.
        sh.color[i * 4 + 3] = it.held[i] ? 0.35 : kind === MINE && it.reload[i]! > 0 ? 0.45 : 1;
      }
    }

    // Mortar puddles: fade in on landing, fade out as they dry.
    for (const c of q.puddles.chunks()) {
      const pd = c.col(Puddle);
      const col = c.col(Shape).color;
      for (let i = 0; i < c.length; i++) col[i * 4 + 3] = PUDDLE.alpha * Math.max(0, Math.min(1, pd.left[i]! / 0.5, (pd.life[i]! - pd.left[i]!) / 0.15));
    }

    // Blocks: a heavier squash on drop, a shake when a pick-up is refused, faded while held (moved in its grace window).
    for (const c of q.blocks.chunks()) {
      const b = c.col(Block);
      const vo = c.col(VisualOffset);
      const col = c.col(Shape).color;
      for (let i = 0; i < c.length; i++) {
        const age = time - b.placedAt[i]!;
        let k = 0;
        if (age >= 0 && age < 0.5) k = Math.exp(-age * 8) * Math.cos(age * 26);
        vo.scale[i * 3] = 1 + 0.22 * k;
        vo.scale[i * 3 + 1] = 1 - 0.22 * k;
        vo.scale[i * 3 + 2] = 1;
        const deny = b.denySteps[i]!;
        vo.position[i * 3] = deny > 0 ? Math.sin(deny * 1.6) * 0.07 : 0;
        const alpha = b.held[i] ? 0.35 : 1;
        if (col[i * 4 + 3] !== alpha) col[i * 4 + 3] = alpha;
      }
    }

    // Base: red flash and a punch when an enemy gets in.
    s.baseFlash = Math.max(0, s.baseFlash - dt * 2.5);
    for (const c of q.base.chunks()) {
      const sh = c.col(Shape);
      const vo = c.col(VisualOffset);
      for (let i = 0; i < c.length; i++) {
        const k = s.baseFlash;
        for (let j = 0; j < 4; j++) sh.color[i * 4 + j] = BASE_BLUE[j]! + (BASE_RED[j]! - BASE_BLUE[j]!) * k;
        const punch = 1 + Math.sin(k * Math.PI) * 0.18;
        vo.scale[i * 3] = punch;
        vo.scale[i * 3 + 1] = punch;
        vo.scale[i * 3 + 2] = 1;
      }
    }

    // Tray: the slot being dragged from dips; an unaffordable pick shakes.
    if (s.slotShake >= 0) s.slotShakeT += dt;
    for (const c of q.slots.chunks()) {
      const ts = c.col(TraySlot);
      const vo = c.col(VisualOffset);
      for (let i = 0; i < c.length; i++) {
        const slot = ts.slot[i]!;
        const held = p.active[0] === 1 && p.fromCell[0]! < 0 && p.slot[0] === slot;
        const sc = held ? 0.92 : 1;
        vo.scale[i * 3] = sc;
        vo.scale[i * 3 + 1] = sc;
        vo.scale[i * 3 + 2] = 1;
        const shaking = s.slotShake >= 0 && p.slot[0] === slot && s.slotShakeT < 0.35;
        vo.position[i * 3] = shaking ? Math.sin(s.slotShakeT * 60) * 0.1 * (1 - s.slotShakeT / 0.35) : 0;
      }
    }
    if (s.slotShakeT >= 0.35) s.slotShake = -1;
  },
});
