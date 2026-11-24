---
name: sim-boundaries
version: 1.19.0
tier: required
description: The one-way flow input → sim → presentation — what each layer may read and write, what enforces it, and what to do instead of reading cameras, real time or UI from sim code. Use when a system, view, effect or controller needs data from another layer.
---

# Sim boundaries: input → sim → presentation, never back

Replays, `--js both`, device parity and rollback all re-run the sim from recorded input and
compare state hashes. That only works if the sim depends on nothing but its input and its own
state. Presentation may lag, drop frames or differ per device; it must never feed back.

## The rules that matter most

1. **Input → sim → presentation, never back.** The sim depends on nothing but recorded input and its own `sim: true` state.
2. **Sim systems never read** cameras, UI, real time, services, device facts or any `sim: false` state.
3. **Presentation never changes sim state directly:** it sends input (`emit` an event) and the sim decides.
4. **Presentation writes only `sim: false` fields** and cannot spawn or despawn.

| Layer | What it is | Reads | Writes |
|---|---|---|---|
| **Input** | Device input recorded per step | — | `ctx.input` events, `Tap`/`Swipe` events, the PC mouse (`PointerHover` with the left button up, `MouseDown`/`MouseUp` for the other buttons, which drive no gesture; `MouseWheel`), `PointerState`, `ViewInfo`, `DeviceMotion` (tilt), `PlayerInputs` (via `playerInput`); UI `emit(Event)` |
| **Sim** | `PreUpdate`/`Update`/`PostUpdate` systems (the default stage) | input above, `sim: true` components/resources/events, `ctx.rng`, `ctx.dt`/`ctx.step`/`ctx.time`, `WorldView`, documents | `sim: true` state, documents (`defineDoc`), events, commands; it may also *write* presentation components, write-only through commands (`ctx.commands.set(e, MeshRenderer, { color })`) |
| **Presentation** | `LateUpdate` systems, `defineUI` controllers, views (`*.view.tsx`), VFX, audio, cameras, tweens on visuals | anything sim, `sim: false` state, `RenderTime`, `gameengine.clock`, `gameengine.kv`, `services` | `sim: false` fields only; sim changes go back as input (`emit` an event) |

## Where it is enforced

- **Binding**: a sim system whose query or resources name a `sim: false` type fails with `E_SCHEMA … may not read presentation type` — `write(T)` too, since a write query's column is readable and presentation changes it; set presentation fields with `ctx.commands.set` (applied at the end of the step); a LateUpdate system that writes a `sim: true` type fails with `… may not write sim type`.
- **LateUpdate**: structural commands (spawn, despawn, remove) are refused (`LateStructural`); it gets its own RNG streams and empty `ctx.input`, and never changes the hash.
- **Runtime guards**: inside a sim system `Math.random` and `Date.now` throw, and so do `gameengine.kv`, `gameengine.clock.wallNow`, `gameengine.crash.describeStack`, `services.*` and `assetPath` (where a file is never decides gameplay: asset fields read as GUIDs, and sim code compares those). `defineDoc(...).set/update` throws *outside* a sim system: documents are sim state.
- **Hash**: only `sim: true` columns and resources are hashed, so presentation can change freely without breaking replays — and cannot rescue a sim that reads it.
- **Lint** (`@gameengine/eslint-plugin`):
  - `no-presentation-read-in-sim` — `read/write/withTag/without/changed/added(T)` or `ctx.get/resource(T)` of a `sim: false` type inside a sim system.
  - `no-presentation-import-in-sim` — a file that defines a sim system (any `defineSystem` not in `LateUpdate`) imports `@gameengine/ui`, `@gameengine/vfx`, `@gameengine/materials`, a `*.view.tsx` or any `.tsx` module (type-only imports are fine); and `gameengine.kv`, `gameengine.clock`, `services.*`, `quality.*` (including `quality.device()`; it throws in sim) and `platform.*` used inside a sim system. Per-device differences go in content `overrides` (skill `device-tiers`), never in sim code. Extra modules: `{ modules: ['./juice.ts'] }`.
  - `no-sim-nondeterminism` — wall clock, `Math.random`, `Math.sin`/`hypot`/… outside LateUpdate, and `DEV` inside a sim system's `run`.
  - `no-di-in-sim` — a file that defines a sim system imports `@gameengine/di`; the container is presentation-only and its APIs throw in sim (skill `dependency-injection`).

## How tests rely on it

- `worldTest` drives only input (`tap`, `swipe`, `input.*`) and asserts on sim state; replays store only `InputFrame`s plus the hash stream. Anything the sim reads that is not in that stream breaks `worldTest.replay` and `gameengine replay verify`.
- `gameengine test --js both` compares hashes of V8 and Hermes; presentation differences between them are invisible, sim differences fail.
- T1 goldens capture presentation from a fixed step count, so presentation must be a function of sim state (plus its own seeded RNG).
- `gameengine replay play`/`load` (and the editor's replay) show the recorded session only as far as the screen is derived from sim state: during playback every `services.*` call, `storage` reads included, answers with its mock (a save read returns `found: false`, so `defineSave(...).load()` gives the defaults with `fresh: true`). A view that decides from a save read in presentation (a first-launch popup, "welcome back", the best score) shows the mock's answer, not what the recorded player saw.
- Views render alone from samples (`gameengine view render`) because they never touch the world.

## Common temptations, and what to do instead

| Temptation | Instead |
|---|---|
| Read `Camera` in sim to convert a tap to world space | Tap events and `PointerState` already carry world coordinates; the sim owns `WorldView` and the camera follows it |
| Move the camera from gameplay | Write `WorldView` or set `WorldViewFollow` (2D, sim); in 3D put `CameraFollow`/`VirtualCamera` on presentation entities (skill `camera`) |
| Real time (production while the app is closed, cooldowns, daily reward) | Read the recorded `WallClock` resource in sim, fed by `wallClock.feed()` (skill `meta-economy`; `references/recipes.md`) |
| Spawn visuals from LateUpdate (a carried stack, a coin pile, floating labels) | A `visualPool` the sim fills once; LateUpdate only shows, hides and places its instances (`references/recipes.md`) |
| A constant a system imported, edited while the game runs | `defineTunables(Token, 'data/…json')` and `get()` it in the system: a dev edit reaches the sim as recorded `TunablesChanged` input at one step (skill `content-database`) |
| UI decides a rule ("can afford?", "level won") | The sim decides and exposes the result in a resource; UI shows it and `emit`s intents (`PurchaseRequested`), the sim validates them |
| Sim reads a settings value (`kv`, services, locale) | UI reads it and sends an event, or it is a sim resource written from recorded input |
| A view decides from the save (first-launch popup, onboarding done, welcome back) with `defineSave(...).load()` in UI | Keep that state in a persisted meta the sim owns, never `defineSave(...).load()` in UI (skill `meta-economy`; `references/recipes.md`) |
| Gameplay waits for an animation or particle to finish | Keep the duration in sim (steps or a timer component); presentation plays it in the same time |
| An effect that follows a moving entity (a wake, a ring, a label) | Read `drawnTransform(e)` in LateUpdate: where the entity is drawn this frame (`references/recipes.md`) |
| A tween/VFX on a sim value | Tween a presentation copy (`VisualTween`, sprite offsets) in LateUpdate; the sim value jumps |
| Shake, lean or pop an entity (tap shake, board shake, hint lean, scale pop) | Give it a `VisualOffset` and write that in LateUpdate; the sim transform never moves for looks (`references/recipes.md`) |
| A UI label or flying reward follows a 2D sprite | `worldToUi(x, y)` from the UI controller: UI reference px through `WorldView` and the canvas scale (`uiToWorld` back); the 3D twins are `worldToScreen`/`screenToWorld` (perspective camera first, else a tilted orthographic one) |
| Tint a mesh or flip a sprite from gameplay | `ctx.commands.set(e, MeshRenderer, { color })` in the sim system (write-only, applied at the end of the step), or a LateUpdate system that derives it from sim state |
| Extra checks or cheats in dev (`if (DEV)` in a system) | Never branch sim code on `DEV`; gate overlays and logs in presentation, and use cheats (skill `cheats`) (`references/recipes.md`) |
| Tilt controls (roll a ball by tilting the phone) | `motion.setEnabled(true)` from UI code, then read the recorded `DeviceMotion` input in sim (`references/recipes.md`) |
| Show text in the player's language | Translated text is presentation: the localization package (skill `packages` says how to add it) (`references/recipes.md`) |
| Show the device, OS, app version, build config, engine version or locale (support screen, analytics, a flavour's services) | `platform.info()` and `platform.storage()` from UI code; they throw in sim (`references/recipes.md`) |
| Slow motion, a pause menu, a hit-stop | `timeScale.set(0.3)` / `pause()` / `resume()`; sim code may set it but never branches on `get()` (`references/recipes.md`) |
| A LateUpdate system that remembers something between frames (a footstep timer, the last value a sound followed) | `ctx.local(() => ({ … }))`, never a module `let` (`references/recipes.md`) |
| Cap the frame rate while a menu shows | `quality.setTargetFps(30)` from the screen's UI controller: presentation only, never in the hash or replays |
| A click or menu sound from UI code | `audio.play(key, { bus: 'UI' })` from the controller (Button `sound` does it for you): presentation, never in the hash; emitting `PlaySound` from UI would record it as sim input |
| React to the app leaving or returning, or quit it | `app.onLifecycle((state) => …)` (`'background'`: save now; `'foreground'`: refresh) and `app.quit()` (false on iOS, which never quits itself), from presentation code; the sim does not run while backgrounded |
| React to any app, Activity or view event (a link, a notification tap, covered, hidden, memory, the safe area, an ad over the game) | `lifecycle.addListener` in UI code (skill `platform-services`) (`references/recipes.md`) |
| Shared helper imports `@gameengine/ui` | Split it: pure logic in a `.ts` module the sim imports; the signal/view glue next to the controller |

## Large external results

Large changing JSON from presentation (a server snapshot) reaches the sim as an empty event marker plus `emitInputData(marker, encodedJson)`, read with `ctx.inputData<T>(marker)`; never put it in an event string field, since the world interns every unique string for its lifetime. Limits and an example: `references/recipes.md`.
