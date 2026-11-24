# Capacity sweep: how much load a device holds

To find how many entities, effects or voxels a phone holds at 60 and 30 fps, declare a capacity
sweep in a cheats file. To establish 60 fps capacity, its resolved target must be at least 60.
A 30 fps target only establishes the 30 fps criterion. `quality.setTargetFps` is a per-screen cap;
it does not lift every project, device or quality cap. Use an explicit benchmark configuration
and confirm the resolved target before timing, without changing shared-device settings:

```ts
// src/crowd.cheats.ts
import { read } from '@gameengine/runtime';
import { defineCapacityCheat, defineCapacitySweep } from '@gameengine/runtime/capacity';
import { runCheat } from '@gameengine/runtime/cheats';
import { Crowd } from './schema.gen.ts';
import { SetCrowd } from './debug.cheats.ts'; // a sim cheat that respawns `agents` agents

const CrowdSweep = defineCapacitySweep({
  name: 'crowd',
  unit: 'agents',
  steps: [250, 500, 1000, 2000, 4000, 8000], // smallest first
  resources: [read(Crowd)], // what ready/report/finish read; resources only, no queries
  start: (n) => runCheat(SetCrowd, { agents: n }), // change sim state through input, as a UI would
  ready: (n, ctx) => ctx.resource(Crowd).alive[0] === n, // asked every frame until true (default: at once)
  report: (_n, ctx) => ({ alive: ctx.resource(Crowd).alive[0]! }), // extra numbers for the log line
  finish: () => runCheat(SetCrowd, { agents: 100 }), // put the normal load back
});
export const Capacity = defineCapacityCheat({ sweeps: [CrowdSweep] }); // cheat benchmark.capacity
```

Each step starts its load, waits for `ready`, warms up `warmSec` (2), measures `measureSec` (4) of
frame intervals and logs `[capacity] {json}`: fps, p50/p90/p99/max ms, `simSpeed` (below 1: the
sim fell behind), thermal, governor step (`qualityChanged`: it moved mid-step) and `targetFps`
(below 60, nothing holds 60: lift the cap first). A step **holds 60** at p90 ≤ 17.5 ms and **holds 30**
at p90 ≤ 35 ms (a 60 Hz screen paces a missed frame to exactly 33.3 ms, so that still holds 30).
The sweep stops after the first step over 35 ms, a load not ready in 120 s, or the ladder's end;
the `summary` line gives per sweep the largest step at which it and every smaller step held
(`hold60`, `hold30`). Read the lines from the device log (`gameengine device logs`, logcat). Only
a presenting player on a phone measures frames: headless sessions and game tests report the sim
step (16.67 ms) as every frame interval. In a game test, run two small steps with `ctx.cheat(Capacity, { maxSteps: 2, warmSec: 0.25,
measureSec: 0.5 })` and step with `ctx.clock.advance(16)` until `capacityProgress()?.summary`:
test frame times are the runner's, so check the run's shape, not the numbers. Make the ladder
double each step and start below what a `phone-low` phone holds.
