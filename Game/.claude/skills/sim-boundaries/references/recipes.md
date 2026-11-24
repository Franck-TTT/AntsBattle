# Sim boundaries: the longer recipes

The full answer for each row the skill's table shortens.

| Temptation | Instead |
|---|---|
| Real time (production while the app is closed, cooldowns, daily reward) | Export `wallClock.feed()` and read the `WallClock` resource (`ms`, `tzOffset`) in sim: the device clock arrives as recorded `WallClockTick` input, never goes back (a clock set back holds it), and tests move it with `clock.set/advance`. In-level timers and animation clocks stay on `ctx.step`/`ctx.time` |
| Spawn visuals from LateUpdate (a carried stack, a coin pile, floating labels) | A `visualPool({ name, prefab, size, draws: Sprite })` (`draws` names the root's drawn component, so unused items get `visible: false` and are culled): export its `system` (the sim spawns the items once), and in a LateUpdate system `const f = pool.begin(q)` over `pool.query()`, `f.show(x, y, z, scale)` per visual, `f.end()`. Only `VisualOffset` changes, so the hash never sees it |
| A view decides from the save (first-launch popup, onboarding done, welcome back) with `defineSave(...).load()` in UI | Keep that state in a persisted meta (`metaInWorld(meta, { persist: true })`, skill `meta-economy`): the save reaches the sim as recorded `MetaLoaded` input, so replays show what the player saw. The view waits for `state.loaded()` (before it, `get()` is the initial state) and reads `useDoc(state)` |
| An effect that follows a moving entity (a wake, a ring, a label) | Read `drawnTransform(e)` in LateUpdate: where the entity is drawn this frame (blended between steps, `VisualOffset` included). `WorldTransform` is where the last step left it, so a follower reading it lags or leads. A sim move that must not slide (a respawn, a portal): `teleport(e)` in that step |
| Shake, lean or pop an entity (tap shake, board shake, hint lean, scale pop) | Give it a `VisualOffset` where it is authored (scene, prefab, or the sim's spawn command) and write `position`/`rotation`/`scale` from a LateUpdate system (`write(VisualOffset)`). It is drawn over the sim transform, its children follow, and the hash, physics and sim queries never see it; never write `LocalTransform` for juice. Never place, turn or size an entity with it: author the pose in `LocalTransform` and leave the authored `VisualOffset` at rest (`{}`), or the editor's gizmo sits away from the drawn object and Inspector edits snap back to what LateUpdate writes (`gameengine validate` warns `W_VISUAL_OFFSET`) |
| Extra checks or cheats in dev (`if (DEV)` in a system) | Never branch sim code on `DEV` (false in cooked builds, so hashes differ); gate debug overlays and logs in presentation; a cheat is a `defineCheat` in a `*.cheats.ts` file, and a sim cheat runs from a recorded `CheatRequested` event (skill `cheats`) |
| Tilt controls (roll a ball by tilting the phone) | `motion.setEnabled(true)` when the tilt screen starts (`false` when it ends; it resets on world rebuild), then read `ctx.get(DeviceMotion).gravity` in the sim: gravity in g in screen axes (+x right, +y up, +z out of the screen; zero until the first reading), recorded input in 1/4096 g steps, so replays and both JS engines agree. Tests inject readings with `input.motion(x, y, z)`; the sensor only runs on phones |
| Show text in the player's language | Translate through the localization package's own skill (`localization`; skill `packages` says how to add it): translated text is presentation. The language is the platform's (`--lang`, the phone's): presentation code reads it from `quality.device().language`; sim code never branches on it (devices differ) |
| Show the device, OS, app version, build config, engine version or locale (support screen, analytics, a flavour's services) | `platform.info()` and `await platform.storage()` from UI controllers or startup code: presentation only, they throw in sim. `platform.slowSteps({ after })` (the slow, stuck and stalled steps the engine recorded, for a crash-reporting package) is presentation only too. `app.config` (`dev`, `probe`, `release`) tells a probe from a release, which `DEV` cannot, and `app.cheats` says the build carries cheats; both are `null` outside a built player. The channel and running content release are `releases.status()`. A phone re-reads `locale` on returning to the foreground; a desktop reads it once at start. Missing values are `null`, and `target`, `os.name` and `formFactor` are open: keep a default branch. Tests answer a fixed value (`host: 'test'`), except `engine.version`, which is the real one and changes with every engine update: compare it by shape, never in a whole-object `toEqual` |
| Slow motion, a pause menu, a hit-stop | `timeScale.set(0.3)` / `pause()` / `resume()` (`@gameengine/runtime`, Unity's `Time.timeScale`, 0–4): it paces the fixed-step clock, so fewer steps run a second and each keeps its size; hashes and replays are unchanged. Tweens, Animator, particles, flipbooks and physics slow with it; UI, cameras and LateUpdate keep wall time, so a pause menu still animates. `set` is allowed in sim (a hit-stop), `get` is presentation only, and a paused sim runs no step, so only UI code can resume it. It resets to 1 on a world rebuild; `gameengine test` steps by count and ignores it. Never scale `ctx.dt` yourself |
| A LateUpdate system that remembers something between frames (a footstep timer, the last value a sound followed) | `const s = ctx.local(() => ({ lastStep: 0 }))`: the same object every run of that system, never hashed, recorded or rolled back, made again on a new boot (a new world, a test). LateUpdate only (it throws in sim); not a module-level `let`, which survives world rebuilds and leaks between tests |
| React to any app, Activity or view event (a link, a notification tap, covered, hidden, memory, the safe area, an ad over the game) | `lifecycle.addListener({ android: { app, activity }, ios: { app, view }, shared })` with only the methods you need, each named as the OS names it: `android.activity.onNewIntent(intent)`, `ios.app.openURL(url)`, `android.app.onCover(callback, activity)`, `ios.view.presented(screen)`, `shared.hidden(e)`, `shared.quitting(e)` (the app closing, like Unity's `Application.quitting`; not sent when the OS kills it) (`e.source` is the OS callback); from presentation code; returns a remover. Save progress in `app.onLifecycle`'s `'background'` (Android onPause, iOS didEnterBackground); use these methods to react. Phones only. Never feed one into the sim except as recorded input |

## Large external results

Do not put changing full JSON snapshots in an event string field: the world interns every
unique string for its lifetime. Declare an empty `sim: true` marker and use the transient
recorded-input API:

```ts
// schema: export const SnapshotArrived = event('SnapshotArrived', {}, { sim: true });
// presentation:
emitInputData(SnapshotArrived, validatedWireJson); // from @gameengine/runtime
// sim system: events: [SnapshotArrived], runIf: { event: SnapshotArrived }
for (const value of ctx.inputData<Snapshot>(SnapshotArrived)) applySnapshot(value);
```

Pass encoded JSON to avoid serializing whole snapshots again inside the API. Payloads must
fit 512 KiB UTF-8 and 64 JSON container levels; marker names fit 128 UTF-8 bytes. The live UI outbox permits eight pending data records
and 2 MiB of encoded payload, rejecting excess with `E_BACKPRESSURE`. Apply results only in
sim. Empty marker rows retain normal event scheduling; payloads stay in the current recorded
input frame, so replays retain them without a growing world string table. Ordinary small typed
events remain the default. Full engine browser builds support this API; playable ads reject it.
Check native V8/Hermes and the web hash lane, plus actual service input in a compiled player.

Ordinary `ctx.input` keeps empty marker rows without their large payloads. Use `ctx.inputData`
to read those values; it selects one marker and decodes it once per system context. Different
contexts receive separate values, and the cache does not survive a step.
