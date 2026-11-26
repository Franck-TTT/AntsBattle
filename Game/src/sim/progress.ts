/**
 * The meta's sim side: pays each run's reward into the persisted meta (src/meta.ts), rolls
 * upgrades with the sim's random stream, and turns the owned upgrades into the Boost a run reads.
 * Sim code.
 */
import { defineSystem, loadData, read, write, type SystemContext } from '@gameengine/runtime';
import { Boost, ItemKind, Level, LevelDef, RollRequested, Run, RunPhase, UpgradeRolled } from '../schema.gen.ts';
import { START_GOLD, START_LIVES, SWARM } from '../balance.ts';
import { coinsFor, effectOf, levelOf, pickUpgrade, progress, starsFor, type MetaState } from '../meta.ts';

/** Lives a run starts with: the sheet's, plus the Extra life upgrade (swarm-scaled like them). */
export const runLives = (s: MetaState): number => START_LIVES + effectOf(s, 'life') * SWARM;
/** Gold a run starts with: the sheet's, plus the Starting gold upgrade. */
export const runGold = (s: MetaState): number => START_GOLD + effectOf(s, 'startGold');

/** Writes the Boost resource from the owned upgrades (the caller declares write(Boost)). */
export function applyBoost(ctx: SystemContext, s: MetaState): void {
  const b = ctx.resource(Boost);
  const global = effectOf(s, 'globalDmg');
  for (let k = 0; k < b.damage.length; k++) {
    b.damage[k] = 1 + global / 100;
    b.range[k] = 0;
    b.splash[k] = 0;
  }
  b.damage[ItemKind.tower] = 1 + (global + effectOf(s, 'towerDmg')) / 100;
  b.damage[ItemKind.cannon] = 1 + (global + effectOf(s, 'cannonDmg')) / 100;
  b.range[ItemKind.tower] = effectOf(s, 'towerRange');
  b.splash[ItemKind.cannon] = effectOf(s, 'cannonAoe');
  b.period[0] = Math.max(0.3, 1 - effectOf(s, 'fireRate') / 100);
  b.killGold[0] = 1 + effectOf(s, 'killGold') / 100;
  b.drag[0] = Math.max(0.1, 1 - effectOf(s, 'slowmo') / 100);
  b.freeWalls[0] = effectOf(s, 'freeCell');
  b.freeRerolls[0] = effectOf(s, 'reroll');
  b.freeTower[0] = effectOf(s, 'freeTower') > 0 ? 1 : 0;
}

/** Pays a finished run once: meta coins, and the level's stars when they beat its best. */
export const PayRun = defineSystem({
  name: 'PayRun',
  after: ['Waves', 'Combat'],
  resources: [write(Run), read(Level)],
  runIf: [{ any: [{ resource: Run, field: 'phase', value: 'won' }, { resource: Run, field: 'phase', value: 'lost' }] }, { resource: Run, field: 'paid', op: '==', value: 0 }],
  run(ctx) {
    if (!progress.loaded()) return;
    const run = ctx.resource(Run);
    const won = run.phase[0] === RunPhase.won;
    const ref = ctx.get(Level).data;
    const def = ref ? loadData(LevelDef, ref) : null;
    const level = def && def.order > 0 ? def.id : '';
    const stars = starsFor(won, run.lives[0]!, runLives(progress.get()));
    const coins = coinsFor(won, stars, run.wave[0]! - 1);
    const best = level ? (progress.get().stars[level] ?? 0) : 0;
    const r = progress.dispatch('finishRun', { level, stars, coins }, ctx.time);
    if (!r.ok) return;
    ctx.set(Run, { paid: true, stars, newStars: level ? Math.max(0, stars - best) : 0, coinsWon: coins });
  },
});

/** Roll and Luxury roll: draws an upgrade with ctx.rng, then lets the meta pay for it. */
export const RollUpgrade = defineSystem({
  name: 'RollUpgrade',
  events: [RollRequested],
  runIf: { event: RollRequested },
  run(ctx) {
    for (const e of ctx.events.read(RollRequested)) {
      if (!progress.loaded()) return;
      const s = progress.get();
      const luxury = !!e.luxury;
      const r1 = ctx.rng.range(0, 1);
      const r2 = ctx.rng.range(0, 1);
      const u = pickUpgrade(s, luxury, r1, r2);
      if (!u) continue;
      const r = progress.dispatch(luxury ? 'luxury' : 'roll', { kind: u.kind }, ctx.time);
      if (!r.ok) continue;
      const level = levelOf(s, u.kind) + 1;
      ctx.signal(UpgradeRolled, { upgrade: u.kind, rarity: u.rarity, level, luxury });
    }
  },
});
