# Tuning the governor and pipeline compiles

- **Tell the governor when the game is loading.** It already ignores frames while assets and
  pipelines load and for 0.5 s after a start or launch. Work the engine cannot see, such as
  building a level's meshes or spawning its contents over a few frames, would read as load and
  lower the render scale or frame rate for the rest of the level: call `quality.settle(seconds)`
  (presentation, at most 3 s) from the `LateUpdate` or UI code that starts it, once per load:
  asks that run into each other hold for their first 3 s only. Thermal steps still apply.
- **First-launch pipeline compiles use the device's cores.** Vulkan and Metal devices compile
  pipelines on a pool the engine sizes per device (Android: cores − 2, up to 6; iOS: 2). It is
  set before the tier is known, so it is no `render.tiers` field: `render.pipelineWorkers` (a
  number, or `{ "android": 4 }` per platform, 1–8) overrides it when a phone measures better with
  fewer; `render.pipelineFreeCores` (same shape) instead keeps that many cores free on every
  phone, e.g. `{ "android": 3 }` when the game runs its own worker threads or a loading animation
  stutters. `adb shell setprop debug.gameengine.pipeline_workers <n>` tries a count on a dev
  build. The log line `pipelines compile on <n> threads` shows what a device got.
