---
name: playable-ad-porting
version: 1.18.0
tier: optional
description: Porting a playable-ad slice onto @gameengine/playable so the web ad runs the game's own systems — the web entry, supported features, input, sprites, HUD and sound, `gameengine playable verify`. Use when an ad's web build should run the game's code, or when verify reports a divergence.
---

# Porting a slice to a playable ad (`@gameengine/playable`)

Playable ads use a smaller runtime than full WebGPU engine browser exports (`ship-web`).
`@gameengine/playable` is a TypeScript copy of the engine's
ECS core (world, scheduler, commands, events, RNG, tweens, gestures, transforms) that runs a
slice's **own systems, unchanged** inside the ad. You write only presentation; the rules come from
the game. `gameengine playable verify` proves the port by playing the same input on the engine
and the mirror and comparing state hashes step by step.

Read the `playable-ads` skill first: the slice, `playable.json`, assets, networks and their rules
are the same. This skill is the port half of its step "Port or rewrite for the web".

## The goal: the ad looks and plays like the engine slice

**The port must be as close to the engine slice as you can make it — look, framing, effects, HUD,
end screen — not only its rules.** `verify` proves the rules and `validate` proves the networks'
rules; nothing automated proves the look, so you must (workflow step 5). A port that passes every
check with flat-colour stand-ins for the game's shader, a text counter for its HUD and the generic
end card is a prototype, not a port. Rebuilding the look
from the game's own shader, effect files and views costs little (about 114 kB in one port) and no sim change.

- **Rebuild, don't drop.** Presentation the profile refuses (materials, UI views,
  rotation, tint) moves to `web/` and is rebuilt there from the game's own sources (`references/profile.md`).
  Cutting it from the slice never means cutting it from the ad.
- **No silent downgrades.** Never replace engine presentation with a stand-in (flat colour,
  generic end card, plain text, a missing effect) without telling the user first and getting
  their agreement. A "known gaps" line at the end of the summary is not that.

## Port or rewrite?

Ask the user the size target first if the `playable-ads` skill's question has not been answered
(below 2 MB for every network, below 4 MB without Meta, below 5 MB without Meta and ironSource):
a port costs about 230 kB, skeletons add the ~600 kB evaluator, and the networks in
`playable.json` must match the answer.

Decide by what the **sim** needs. Port when the slice's systems use only what the playable
profile has (below). Rewrite by hand (the `playable-ads` skill) when the loop's rules need 2D
physics, joints, character controllers, navigation, video or services, or when the ad must be far
smaller than about 230 kB (skeletons add the ~600 kB evaluator, 3D physics ~530 kB inlined).
**3D physics ports** when its bodies fit the lite profile (`references/physics-3d.md`). Presentation (materials,
meshes, UI views, sprite rotation or tint) never forces a rewrite: it moves to `web/`.

**Physics:** 3D bodies that fit the lite profile port (`references/physics-3d.md`). 2D physics (rigid bodies,
colliders and joints in 2D), 3D joints and character controllers are outside the profile, and the
port refuses a slice that spawns or loads them.
Either cut the 2D physics from the slice when the loop only needs physical-looking motion (tweens
or kinematics in a slice system port fine), or rewrite the ad. Never fake physics in `web/` while the slice keeps
it: `verify` would pass on a slice the ad no longer matches.

**New effects, flipbooks and 2D animation** made for the ad live in the slice
(`playable-ads/<ad>/assets/`), never in the game's `assets/` (skill `playable-ads`, step 2); the
port plays them like the game's own.

## The format

```
playable-ads/<ad>/
  project.gameengine.json   the slice ("playable": { "game": "../.." }), runs in the engine
  playable.json             "web": "web/mirror.ts", networks, assets (keys → aliases)
  src/main.ts               the slice's systems: re-exports from the game + ad-only systems
  assets/scenes/main.scene.json  the slice's start scene, at the game scene's path (cooked into the ad)
  web/index.html            the template with <!--playable:script-->
  web/mirror.ts             presentation only: input in; sprites, HUD, sound, end card out
```

- Every rule lives in `src/` (the slice), never in `web/`. If the ad needs a different rule (fewer
  moves, a timeout, a scripted first move), it is a slice system, verified in the engine like
  any system.
- `web/` may import the slice (`../src/main.ts`), `@gameengine/runtime`, `@gameengine/playable`,
  `playable:manifest`, `playable:slice` and `playable-ads/_shared/`. Game code never imports
  `@gameengine/playable` (lint fails, it does not resolve, and the bundler refuses it).
- Every asset a sprite or `PlaySound` names (`tiles/gem_red`, `audio/swap`) needs a key in
  `playable.json` `assets`: the build inlines only those and maps alias → key (`aliases`).

## The playable profile

The profile is the part of the engine `@gameengine/playable` mirrors: the ECS, pointer input and its gestures, tweens, sprites, 2D skeletons, flipbooks, particles, 3D bodies of the lite physics profile and instanced 3D meshes. Anything outside it is refused by name. The full table of what is supported, what is refused and what to rebuild each refused piece from in `web/`: `references/profile.md`.

Cut the slice until `gameengine playable verify` runs: a **sim** system the ad does not need is
better removed from `src/main.ts` than stubbed in `web/`. Presentation you cut from the slice is
rebuilt in `web/` to match the game, from what `references/profile.md` lists.

## Workflow

1. **Slice first** (`playable-ads`: create, cut the slice, verify in the engine): `gameengine playable run <ad> --headless --steps 600 --json`
   in the engine. The loop must read in 30 seconds there before you port anything.
2. **Point the build at the port:** in `playable.json` set `"web": "web/mirror.ts"` (or pass
   `--web web/mirror.ts` to `build`), and list every asset the slice's sprites and sounds name.
3. **Write `web/mirror.ts`** from the template below: input → `p.step`, a fixed-step loop,
   `drawSprites`, the HUD from resources, sounds and the end card from this step's events.
4. **Prove it:** `gameengine playable verify <ad> [--seeds 1,2,3] [--steps 2400]`. Each seed is
   seeded taps, swipes, drags and long presses over the view, played on the mirror, written to
   `dist/verify/seed-N.greplay` and verified on the engine. All seeds must pass.
5. **Compare it with the slice.** Screenshot the engine slice (`gameengine playable run <ad>` +
   `gameengine screenshot`) and the web preview at the same moments — intro, mid-play, end
   screen — and compare them side by side. Fix every difference you can; list the rest to the
   user plainly ("the water is flat blue instead of the shader") and ask before shipping them.
6. **Build and validate:** `gameengine playable build <ad> --json`, then
   `gameengine playable validate <ad> --json` (sizes, single file, no requests, MRAID, CTA).
7. **Look at it** in the editor's Playable Ads mode (`dist/preview`) and tell the user what to try.

## `web/mirror.ts` template

The template is the minimum wiring, not the target: it draws sprites, a text HUD and the generic
end card. Replace those with the game's own look (§ The goal).

```ts
import { boot } from '@gameengine/runtime';
import { createPlayable, drawSprites, listenPointers, resource, stepEvents, viewEvent, type InputEvent } from '@gameengine/playable';
import { ad, aliases, images, sounds } from 'playable:manifest';
import * as slice from 'playable:slice';
import * as game from '../src/main.ts';
import { createStage, loadImages, showEndCard, Sounds, storeUrlFor, whenReady } from '../../_shared/runtime/index.ts';

function start(img: Record<string, HTMLImageElement>) {
  // 1080×1920 design units (1920, 1080 for landscape). It renders at most 2x density and 60 fps; on a
  // slow phone pass { renderScale: 0.75 } or { maxFps: 30 } as the 4th argument rather than drawing less.
  const stage = createStage();
  const audio = new Sounds(sounds);
  const p = createPlayable({ boot, game, scene: Uint8Array.from(atob(slice.scene), (c) => c.charCodeAt(0)), seed: slice.seed, dt: slice.dt });
  const byAlias = Object.fromEntries(Object.entries(aliases).flatMap(([alias, key]) => (img[key] ? [[alias, img[key]!]] : [])));
  // Each finger gets its own pointer id; the view and pointers are in points, as gestures measure millimetres.
  let pending: InputEvent[] = [viewEvent(stage)];
  window.addEventListener('resize', () => pending.push(viewEvent(stage)));
  listenPointers(stage, (e) => pending.push(e), () => audio.unlock());
  let ended = false;
  let acc = 0;
  stage.loop((dt) => {
    acc += dt;
    for (let n = 0; acc >= slice.dt && n < 5; n++, acc -= slice.dt) {
      p.step(pending);
      pending = [];
      for (const s of stepEvents(p.world, 'PlaySound')) {
        const key = aliases[s.sound as string];
        if (key) audio.play(key, { volume: s.volume as number, rate: s.pitch as number });
      }
      for (const e of stepEvents(p.world, 'LevelEnded')) // the slice's end event
        if (!ended) (ended = true), showEndCard({ title: ad.title, button: ad.cta, storeUrl: storeUrlFor(ad.storeUrl) });
    }
    p.render(Math.min(acc / slice.dt, 1));
    drawSprites(stage.ctx, p.world, { width: stage.width, height: stage.height, images: byAlias, sortingLayers: slice.sortingLayers, pixelsPerUnit: slice.pixelsPerUnit });
    // HUD: read sim resources, e.g. resource(p.world, 'Score')!.value, and draw text on stage.ctx.
  });
  return (muted: boolean) => audio.setMuted(muted);
}

let mute: (muted: boolean) => void = () => {};
whenReady(() => void loadImages(images).then((img) => (mute = start(img))), (visible) => mute(!visible));
```

**Skeletons.** When the start scene has `Skeleton2D`s, `playable:slice` also carries `skeletons`
(the rigs it names, base64) and `skel2dWasm` (the evaluator). Compile it asynchronously (browsers
refuse large synchronous compiles), pass both to `createPlayable`, and draw after the sprites;
list each rig image in `playable.json` `assets` (`"blob_body": "rig/blob/body"`):

```ts
import { Skel2dWasm } from '@gameengine/skel2d-wasm';
const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const skel2d = await Skel2dWasm.fromBytes(bytes(slice.skel2dWasm)); // start() becomes async
const skeletons = Object.fromEntries(Object.entries(slice.skeletons).map(([k, v]) => [k, bytes(v)]));
const p = createPlayable({ boot, game, scene: bytes(slice.scene), seed: slice.seed, dt: slice.dt, skel2d, skeletons });
// in the loop, after drawSprites:
drawSkeletons(stage.ctx, p.world, p.skeletons, { ...view, images: byAlias, alpha, dt: slice.dt });
```

`samples/rig-yard/playable-ads/blob-walk` is the worked example.

**Flipbooks.** The build embeds every `*.clip2d.json` the start scene or the slice's `src/` names
(a missing one fails the build) as `slice.clips`. Pass them to `createPlayable` and the frames to
`drawSprites`; list every frame image in `playable.json` `assets` (`"coin_0": "flip/coin_0"`):

```ts
const p = createPlayable({ boot, game, scene: bytes(slice.scene), seed: slice.seed, dt: slice.dt, clips: slice.clips });
drawSprites(stage.ctx, p.world, { ...view, images: byAlias, clips: p.clipFrames });
```

`samples/rig-yard/playable-ads/slime-flip` is the worked example.

**Particles.** The build embeds every effect the start scene or the slice's `src/` names
(`*.vfx.json`, or a `*.vfx.ts` as its compiled `*.vfx.gen.json`) as `slice.effects`. Pass them to
`createPlayable` and the particles to `drawSprites`; list every effect texture in `playable.json`
`assets` (`"shards": "fx/shards"`), trail textures (`trail.texture`) too: the build does not add
them, and a trail whose image is missing draws a flat strip:

```ts
const effects = Object.fromEntries(Object.entries(slice.effects).map(([k, v]) => [k, bytes(v)]));
const p = createPlayable({ boot, game, scene: bytes(slice.scene), seed: slice.seed, dt: slice.dt, effects });
drawSprites(stage.ctx, p.world, { ...view, images: byAlias, particles: p.particles });
```

`samples/fireworks/playable-ads/night-sky` (the game's own launch, tap and cleanup systems) and the
shards `slime-flip` throws with `burstAt` are the worked examples.

**Trails** draw on the canvas's CPU like the particles, every segment a quad (two clipped image
draws when the trail bends under a texture, one fill without), so they cost per point, not per
trail: keep an ad under the device budget's trail vertices (`gameengine vfx stats --device
android-low-…`, 4,000 on the low phones) or turn trails off for the ad with `ratio: 0` in the
slice's own copy of the effect. A trail with `dieWithParticles: false` keeps an instance drawing
until its last point expires, bursts included.

## 3D physics and 3D meshes

A slice with `RigidBody3D` or `Collider3D` ports on the lite physics module (about 530 kB inlined): `references/physics-3d.md`. `MeshRenderer`s draw through `createRenderer3D`: `references/meshes-3d.md`.

## Rules for the presentation code

- **Input reaches the sim only as `InputEvent`s** passed to `p.step`: use `listenPointers` (one
  id per finger, positions in view points) and `viewEvent` (first, and on resize), both given the `stage`. `p.step`
  rounds them as the engine does, so `ctx.input` reads the same numbers. Never write components
  or resources from `web/`; a tap the sim should see is a pointer event.
- **Fixed steps:** step at `slice.dt` from an accumulator (at most 5 steps a frame), never once per
  animation frame. `p.render(alpha)` once per frame runs LateUpdate systems and visual tweens.
- **Read, don't write:** `resource(world, 'Name')` and `stepEvents(world, 'Event')` (this step's
  events, each once) feed the HUD, sounds and end card.
- **The networks' rules still hold** (`playable-ads`): audio after the first touch, the CTA through
  `showEndCard`/`openStore`, `whenReady` to start, no requests. Timers that should start at the
  first touch are slice systems that wait for the first `Tap`/`Swipe`, not `web/` timers.
- Never call `p.hash()` in an ad: it is for `verify` and costs far more than a step.

## When `verify` fails

`✗ seed N: diverges at step S: <Component> (engine …, mirror …)` names the first step and the
types whose state differs. In order of likelihood:

1. **The slice reads something outside the profile** (the run fails first with `host op '…' is
   not in the playable profile` or `input '…' is not in the playable profile`): cut that system
   from the slice or rewrite the ad by hand.
2. **Engine-native behaviour the mirror lacks** (a native system writing that component): check
   the profile table; report it to the engine team with the replay from `dist/verify/`.
3. **A mirror bug**: the replay in `dist/verify/seed-N.greplay` reproduces it; hand it to the
   engine team with the step and components. Do not work around it in `web/`: a port that only
   matches with workarounds is a rewrite.

Nondeterminism in the slice (`Math.random`, wall clock) fails in the engine's own tests first;
the `determinism` skill covers it.

## Commands

| Step | Command |
|---|---|
| Run the slice in the engine | `gameengine playable run <ad> [--headless --steps N --json]` |
| Prove the port | `gameengine playable verify <ad> [--seeds 1,2,3] [--steps 2400] [--js v8\|hermes] [--json]` |
| Build every network | `gameengine playable build <ad> [--web web/mirror.ts] [--network meta,unity]` |
| Check the networks' rules | `gameengine playable validate <ad> [--network tiktok]` |
