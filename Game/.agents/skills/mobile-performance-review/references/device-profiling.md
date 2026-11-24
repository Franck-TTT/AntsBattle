# Profiling on a device: reading the reports

## `gameengine device perf`

`gameengine device perf --seconds 20` (Android; `--json` for data; `--seconds` up to 300 sets the
window, and the HUD it turns on goes off again afterwards): the engine's performance report (frame intervals, slow frames, CPU/script/GPU per frame, render load, GC,
thermal, memory, worst frames), CPU per thread of the app from `/proc` over the same window
(game, the GPU thread `gameengine-gpu` on OpenGL ES or the render thread `gameengine-render`
on Vulkan, audio, V8 workers, Dawn), and `dumpsys meminfo`
(Java, native, graphics, code). Its `setup:` line names what the device runs: profile and
source (`project` when the project's `device-profiles.json` matched, `database` for the
engine's), quality level, tier, render scale, msaa, hdr format, memory class; the report also
prints its frame-rate target. To compare two builds (an optimisation, a regression hunt), add
`--unlocked`: frames are no longer held at the 60 (or 30) fps cap and quality is pinned to the
device profile, so a gain below the cap shows as more fps instead of more idle time, and the
governor cannot lower quality in one build and not the other. Compare an unlocked run only
with other unlocked runs (its slow-frame counts use the unlocked display-rate target and CPU hints may ask for
higher clocks); ship decisions still use the capped run. Read its thread lines together:
- `per frame ms: cpu (main thread)` is the frame loop's whole frame, waits excluded. It
  includes `render phase on the GPU thread (main waits)`: the snapshot, UI layout and submit the
  frame loop hands to the GPU thread and waits through. A large handed-over phase is UI layout
  or extraction cost (UI nodes, 2D content, skeletons), not GPU time.
- `gpu thread ms: render and present (vsync waits excluded)` is what the GPU thread does
  while the next frame simulates: recording, uploads, present. It only costs the frame when it
  exceeds the frame loop's time, so compare the two; `render.wait` in a trace is the frame loop
  waiting for it.
- `systems (ms per frame, top N)` lists the sim systems that cost the most, with per-run mean
  and max; `(LateUpdate)` marks presentation systems. The first capture frame's times are
  skipped (they hold everything since launch). Point a `perf-to-rust` or `ecs-systems` finding
  at the named system.
Launch time is in the device log: `startup: first frame N ms after launch` and `startup: interactive
N ms after launch` (the first frame with nothing loading).
Only OpenGL ES phones have a GPU thread; Vulkan and Metal phones and the desktop player lend
the renderer to a render thread per frame and print neither the `render phase` nor the
`gpu thread` line.
`gameengine device perf --counters` adds the CPU's hardware counters per thread role (game
loop, render, job pool, V8 workers, audio…) and per core, from simpleperf (dev builds, or
probe builds that are profileable). Read a hot role's row: low IPC with high back-end stalls
and L2 refills is memory-bound (data layout, skill `ecs-systems`); high front-end stalls or
branch mispredicts per 1k instructions is branchy or large code; a SIMD share near zero in a
numeric native system means it is not vectorised (`gameengine native asm`); a game loop that
runs mostly on little cores is a scheduling problem, not slow code. Missing events on a CPU
are listed, not fatal.

## A Perfetto timeline

For a timeline, record a Perfetto system trace with app tracing on for the game (Android
Studio's System Trace, or a Perfetto config whose `ftrace_config.atrace_apps` names the app id
and `atrace_categories` includes `gfx` and `view`). Without app tracing the engine's sections
are missing. The engine adds sections:
`frame`, `sim.step`, `script.system`, `script.call`, `render.wait`, `render.acquire`,
`render.encode`, `present` — next to the CPU frequency, scheduling and (where the device
exposes it) GPU frequency tracks. Inside `render.encode`: `render.warm`, `render.batch2d`,
`render.skel2d`, `render.3d`, `render.particles`, `render.graph`, `render.submit`, and the
one-time work `render.preload`, `render.pipeline`, `render.texture-upload`,
`render.atlas-page`, `render.glyph-page`, `render.glyph-upload`, `render.buffer-grow`,
`render.bind-group`, `render.target`. A long `render.encode` names its cause there. Script
sections are named per system and function (`script.system:<name>`, `script.call:<fn>`; on
desktop they appear in `profile.markers`), so a long `sim.step` names the system. Named
sections cost nothing while tracing is off.

## Android ADPF scheduling comparison

For an Android ADPF scheduling comparison, dev/probe builds read `debug.gameengine.adpf` when a hint session starts, including a normal probe launch without a debug listener. `off` disables hints; decimal 25–100 scales the work deadline; empty/invalid input uses 100. Set before launch and restart between conditions. This changes scheduling hints, not the frame-rate target or thermal policy. Hold the device lease, record and restore the previous property value, and compare the same unit/workload. Release builds ignore this property, including release test builds with protocol access. Do not infer a performance gain from the switch alone.

## Diagnose "GPU busy at low clocks"

Symptom: frames over budget, but CPU per thread (`device perf`) is low and `render.encode` is
short; the time sits in `render.acquire` / `present` (waiting on the GPU), often with the GPU at
a low frequency in Perfetto. On OpenGL ES (most Mali-class phones) the `gpu` number is the whole
frame, timed from Dawn's work-done callback (a millisecond or two late from polling), and the
governor counts a window GPU-bound when it misses the target with the GPU 85 % busy; the driver
may block for a buffer inside the first draw, so look at `render.encode` too, not only the
waits. Where timestamps exist (Vulkan, Metal) `gpu` is the whole frame too, every pass from the
world to UI, post and the present blit, but it times execution, not a frame held back
for a buffer: read the waits as well, as the governor does: an overrunning frame that waited at
least a quarter of its interval on the surface counts as GPU-bound, unless its main-thread work
alone already misses the budget. Fix fill and
bandwidth, not draw calls: render scale, `msaa: 1`, `hdr: false`, no post profile in 2D, less
overdraw (below). Low clocks under a light load are the driver saving power, not a fault; the
same load at a high clock is what heats the phone.
