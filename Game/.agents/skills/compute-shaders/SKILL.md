---
name: compute-shaders
version: 1.1.0
tier: optional
description: GPU compute shaders for presentation — compute.create/set/dispatch/read, *.compute.wgsl, storage textures, ping-pong, compute:<program>/<texture> material keys, vertexOffset displacement, dynamic mesh vertices written on the GPU. Use for fluid, gas, wave, cloth or crowd simulation that only needs to look right.
---

# Compute shaders

Compute programs (`compute` in `@gameengine/runtime`) are WGSL compute shaders that run on the GPU
before each frame's 3D work; materials and dynamic meshes read their results without a trip to
the CPU. For a texture your code computes texel by texel on the CPU use dynamic textures
(`textures`, skill `vfx-materials`); for painting onto a mesh use skill `surface-paint`.

## The rule: presentation only

GPUs differ in float results, so nothing a program computes may decide sim state. Programs are
not hashed, saved, replayed or sent over the network. Create and drive them from UI code or a
`LateUpdate` system; the calls throw inside fixed-step systems. Gameplay feedback that may lag a
few frames (a splash sound, a UI value) uses `compute.read`. Rules that must agree across
players stay in the sim (skill `determinism`).

## A program

```ts
import { defineSystem, compute } from '@gameengine/runtime';

export const BuildOcean = defineSystem({
  name: 'BuildOcean',
  stage: 'LateUpdate',
  run() {
    if (compute.info('ocean') !== null) return; // once per world
    compute.create('ocean', {
      shader: 'compute/ocean.compute.wgsl', // under assets/
      textures: {
        height: { size: [256, 256], format: 'rgba16float', pingPong: true },
        tint: { size: [256, 256], format: 'rgba8unorm' },
      },
      buffers: { probe: { count: 4, type: 'f32' } },
      params: { stiffness: 0.22, damping: 0.996, deep: [0.02, 0.12, 0.3] },
      passes: [{ entry: 'step', size: [256, 256] }],
      rate: { hz: 60, maxSteps: 2 }, // or 'frame' (default) or 'manual'
    });
  },
});
```

- `create(name, decl)` creates or replaces; it compiles in the background and runs from the
  first frame the shader is ready. `info(name)` gives `state` (`loading`, `compiling`, `ready`,
  `paused`, `error`), `error` (with your shader's line numbers), `gpuMs`, `runs` and `bytes`.
- `set(name, params)` changes uniforms (all or none); `enable(name, false)` stops its runs and
  keeps its results; `dispatch(name)` runs it once more next frame (for `'manual'`);
  `destroy(name)` frees it.
- Passes run in order. `size` is threads, rounded up to whole workgroups of the entry's
  `@workgroup_size`; `groups` gives workgroups directly. `repeat` (at most 64) runs a pass
  several times, e.g. a pressure solve.
- A fixed `hz` rate keeps a simulation independent of frame rate; `maxSteps` caps the catch-up
  after a slow frame.

## The shader

`*.compute.wgsl` holds only your entry points and helpers. The engine appends the bindings, so
error line numbers stay yours:

- `globals.time`, `globals.dt` (the program's own step), `params.<name>` (`f32` or `vec2f`…`vec4f`).
- A texture `<name>` is a write-only storage texture (`textureStore`). A ping-pong one also gets
  `<name>_prev`, the previous result as a sampled texture (`textureLoad`, or `textureSampleLevel`
  with the appended samplers). `r32*` formats can be read and written in place.
- A buffer `<name>` is a storage array (`probe[0] = h;`).
- A mesh buffer `{ mesh: 'pool' }` (a dynamic mesh from `meshes.create`) gets `pool_count()`,
  `pool_position(i)` / `pool_set_position(i, p)` and the same for `normal`, `uv` and `color`.

Ping-pong textures swap after each pass, all together. A pass that only reads them (for example
one that moves mesh vertices from a height field) sets `swap: false`, or the next pass reads
stale data. A pass that swaps must write every texel of every ping-pong texture.

## Using the results

- **Any material texture slot:** `"baseColorMap": "compute:ocean/tint"` in a `.mat.json`, or a
  `*.material.ts` param set to `compute:ocean/height`. Materials can sample `rgba8unorm`,
  `rgba8snorm` and `rgba16float` textures.
- **Displacement:** a `*.material.ts` `vertexOffset` may sample textures (top mip level), e.g.
  `worldNormal().mul(texture(height, uv()).r.mul(lift))` lifts a sphere into waves.
- **Mesh vertices:** the mesh draws what the program wrote. Culling uses the CPU vertices, so
  give the CPU mesh bounds that cover the motion (lift two corners, as `samples/wave-pool` does).
- **Back to the CPU:** `const r = compute.read('ocean', 'probe', { bytes: 16 })`, then poll
  `r.take(out)` each frame until it returns true (two or three frames). At most 1 MB a read and
  8 waiting per program; read small ranges, not every frame unless you need to.

## Budgets and devices

- Desktop: 512 MB for all programs and 6 ms of GPU time a program; phones: 64 MB and 2 ms; 32 programs.
  A program over the time budget for three measurements in a row pauses with the reason until
  its shader is saved again: check `info(name).gpuMs` and `gameengine compute list`.
- Compat-tier phones (OpenGL ES) run no programs: `create` succeeds, `info` says why it does not
  run, and materials see their slot's default. Give the material a fallback through `overrides`
  (a scrolling texture, a flat colour) so the scene still reads.
- Phone-low: a 256² field with one or two passes is about the ceiling; prefer `rgba8unorm` over
  float formats where precision allows, and a fixed `hz` of 30.
- A world without programs pays nothing.

## Testing

Programs run in the frames the renderer draws, not in sim steps: a headless session that only
calls `engine.step` runs none, so `info(name).runs` stays 0 there. Draw frames to run them
(`render.stats` with `render: true`, a screenshot, or a `renderTest`'s `render` calls).
Headless game tests have no GPU: assert on `compute.info(name)` (declared resources, `bytes`,
errors in your declaration). Use a `renderTest` with a T1 golden for how it looks, and assert
`info(name).runs` and a `compute.read` there. `gameengine compute list` against a running game
shows each program's state, GPU time and memory.
