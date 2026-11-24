---
name: cheats
version: 1.14.0
tier: optional
description: Cheats and debug commands — defineCheat in src/**/*.cheats.ts, the in-game console, `gameengine cheat list|run`, MCP cheat_*, the Cheats panel, cheat() in tests, the engine.perf widget, screenshots (engine.capture store shots, devCapture.frame for QA reports), release stripping. Use for any debug or QA shortcut, or to set up a test or agent state.
---

# Cheats

A cheat is one declaration next to the feature it changes. The engine lists it in the in-game
console (grouped, searchable, with fields for its params), in `gameengine cheat list`, in the
editor's **Cheats** panel while Play runs, and runs it the same way from all of them and from
game tests. Cheats ship in dev and probe builds only; the bundler adds them, so a release build
has no trace of them unless the project opts in.

## Add a cheat

Put it in a file ending `.cheats.ts` under `src/`, next to the feature (`src/board.cheats.ts`,
`src/shop/shop.cheats.ts`). **Nothing may import a `*.cheats.ts` file** — not `main.ts`, not a
system. The bundler imports them in builds with cheats; a build without cheats fails if game code
reaches one (the `cheats` rule in `FORBIDDEN_MODULES`).

```ts
import { query, read, write } from '@gameengine/runtime';
import { defineCheat } from '@gameengine/runtime/cheats';
import { addMoves } from './board.ts';
import { progress } from './progress.ts';
import { Board, Moves, Score, Tile, TileKind } from './schema.gen.ts';

// A sim cheat: runs as a system in PreUpdate of the next step, from a recorded CheatRequested
// event, so it is deterministic and replays repeat it. Same rules as any system.
export const AddMoves = defineCheat({
  id: 'moves.add', // stable: CLI, tests and agents use it; ids starting `engine.` are the engine's (refused)
  group: 'Moves', // one group per feature
  title: 'Add moves',
  description: 'Continues a level lost on moves',
  params: { amount: { type: 'int', default: 5, min: 1, max: 99 } },
  resources: [write(Moves), write(Board), read(Score)],
  run(ctx, { amount }) {
    addMoves(ctx, amount); // reuse the feature's own code
  },
});

// With a query and an enum param (the args are typed: kind is 'Red' | … | 'Bomb').
export const SetTile = defineCheat({
  id: 'tile.set',
  group: 'Board',
  title: 'Set a tile',
  params: {
    x: { type: 'int', min: 0, max: 15 },
    y: { type: 'int', min: 0, max: 15 },
    kind: { type: 'enum', values: ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Bomb'], default: 'Bomb' },
  },
  query: query(write(Tile)),
  run(_ctx, { x, y, kind }, q) {
    for (const c of q.chunks()) {
      const t = c.col(Tile);
      for (let i = 0; i < c.length; i++) if (t.cell[i * 2] === x && t.cell[i * 2 + 1] === y) t.kind[i] = TileKind[kind];
    }
  },
});

// A presentation cheat: runs at once, outside the sim — saves, meta documents, service mocks,
// UI. It must not write sim state directly; raise the sim event the feature already handles.
export const ResetProgress = defineCheat({
  id: 'progress.reset',
  group: 'Progress',
  title: 'Reset saved progress',
  presentation: true,
  async run() {
    await progress.write({ bestScore: 0, levelsCompleted: 0, purchases: 0 });
  },
});
```

Params: `int`, `number` (`min`, `max`, `step`), `bool`, `string`, `enum` (`values`), each with an
optional `default`, `doc` and `current`. Arguments arrive checked: unknown names, out-of-range numbers and unknown enum
values are refused with `E_PARAMS` before anything runs; strings from the command line are coerced.

`step` is what the console's -/+ and the editor's slider (shown when `min` and `max` are set) move
by. A cheat's `current` reports the game's values now for its params, so the console, the editor
and `gameengine cheat list` (`now 1234`) start from them instead of the defaults:

```ts
export const SetScore = defineCheat({
  id: 'score.set',
  group: 'Level',
  title: 'Set score',
  params: { value: { type: 'int', default: 2900, min: 0, max: 1_000_000, step: 100 } },
  current: (world) => ({ value: world.resource(Score).value }),
  resources: [write(Score)],
  run(ctx, { value }) {
    ctx.set(Score, { value });
  },
});
```

`current` runs when the cheats are listed, between steps, with a read-only `world`
(`world.resource(T)`; read a document with its handle's `get()`). Keep it a plain read: it gets no
`ctx`, cannot write and never changes a hash. Return only the params it knows; a getter that
throws, a value of the wrong type or an unknown name is left out (a `cheats` warning in the log).

**Sim or presentation?** If the state is in components or resources (moves, score, board, a
level's phase), write a sim cheat: it goes through the input record like a tap. If it is in a
save, a meta document, a service or the UI, write a presentation cheat. Never change sim state
from a presentation cheat except through `emit(SomeEvent)`.

## Run cheats

| Who | How |
|---|---|
| Player / QA on a device or the desktop player | two-finger double tap (or Shift+Escape, the `cheats.key` default; also in the editor's Play view) opens the console; tap a group, set params, **Run** |
| Agent with a shell | `gameengine run --headless --paused`, then `gameengine cheat list`, `gameengine cheat run moves.add amount=3` (or `--arg amount=3`, `--args '{"amount":3}'`), then `gameengine step 1` |
| Agent over MCP | `cheat_list`, `cheat_run { id, args }` (then `step`) |
| Editor | the **Cheats** panel while Play runs |
| Game test | `await cheat(AddMoves, { amount: 7 })` in `worldTest` (runs it and steps once) |

A sim cheat applies on the **next** step: on a paused session run `gameengine step 1` before
reading the world. Several sim cheats requested for the same step run in system order, not in
the order they were requested; step between them when the order matters.

```ts
import { expect, worldTest } from '@gameengine/test';
import { AddMoves } from '../src/board.cheats.ts'; // tests may import cheat files; tests never ship

worldTest('moves.add continues a lost level', async ({ world, step, cheat }) => {
  await step(2);
  const before = world.resource(Moves).left;
  await cheat(AddMoves, { amount: 7 });
  expect(world.resource(Moves).left).toBe(before + 7);
});
```

Use cheats to put a test or a screenshot into a state quickly instead of scripting many taps.
A presentation cheat's `run.done` settles when it finishes; step until it does.

## Engine cheats: the performance widget

Every build with cheats also has the engine's own cheats in the console's **Engine** group, even
when the project declares none. `engine.perf` (**Performance widget**) shows a bar at the top of
the screen: fps, `<24fps` (the share of frames slower than a 24 fps frame, 41.7 ms) and `var`
(frame-interval stddev / mean), all over the last 10 s. Its record button measures 20 s and puts
a plain-text report (device model and OS, interval percentiles, hitches, CPU / script / GPU per
frame, draw calls / triangles / upload bytes per frame, GC pauses, thermal state at start and end
with changes, memory, and the worst frames with their time, render load and any GC) on the clipboard — paste it to an agent — and in the log; its X
turns it off. Off, it costs nothing; on, it updates twice a second.

To keep it on across sessions, switch on **Keep performance widget on between runs**
(`engine.perf.keep`, `on: true`): the device remembers the choice
(`perf-hud.json` in the app's user data) and the widget opens by itself at every boot, rebuild and
hot reload of a build with cheats — in a hub and in each game it launches — until it is switched
off (which leaves the open widget alone). X still closes it until the next boot; a hand-back, an
ask or its answer is not a boot, so the widget stays as it was in the game. A recording in progress ends with its session, so take the report before switching.

| Who | How |
|---|---|
| QA on a device | open the console, **Engine** → **Performance widget** → Run; later tap the record dot |
| Measuring across sessions or game switches | console → **Engine** → **Keep performance widget on between runs**, on (later off); or `gameengine cheat run engine.perf.keep on=true` |
| Agent with a shell | `gameengine cheat run engine.perf action=on`; `gameengine cheat perf` prints the numbers; `gameengine cheat perf --record` records and prints the report (also on a device session) |
| Agent reading a device | `gameengine device logs` has the report (category `perf`) |

The clipboard needs the `system` plugin; without it the widget says so and the report is only in
the log. For budgets and CI use `perf.stats` and T1/T2 budgets (skill `mobile-performance-review`):
the widget is for a person holding the phone.

`engine.crash` (**Native crash**, `kind=segfault|abort|panic`) crashes the engine in Rust: SIGSEGV in
`gameengine_core::forced_crash::segfault`, SIGABRT, or a panicking host op, which aborts with the
panic as the abort message on Android. Use it on a device build to check that native
engine crashes reach the game's crash reporter plugin (the engine captures none itself).
Another cheat in a `*.cheats.ts` file can run it with `runCheat('engine.crash', { kind: 'segfault' })`.
Builds without cheats have neither the cheat nor a working host op; a release build with cheats
(`--cheats`, `cheats.release`) has it for anyone who opens the console.

## Engine cheats: store screenshots

`engine.capture` (**Store screenshots**) freezes one moment of real gameplay (F9) and renders it at every store size and in every language (Enter). Configuration (`configureStoreCapture`), output paths and what to hide: `references/store-screenshots.md`.

## QA report screenshots

A game's own bug-report UI gets a JPEG of the game from presentation code:

```ts
const shot = await services.devCapture.frame({ maxSide: 960, quality: 80, maxBytes: 300 * 1024, previewSide: 24 });
```

Limits: `maxSide` 1–1024 px, `quality` 1–100, `maxBytes` up to 1 MiB, `previewSide` 1–64 px
(omit it for no thumbnail); out-of-range options reject with `E_RANGE`. It resolves
`{ format: 'jpeg', width, height, bytes, data, preview? }`: `data` is the base64 JPEG, `preview`
an optional raw RGB thumbnail. Quality drops first, then size, until the JPEG fits `maxBytes`.

It captures the next presented frame, so request and await it **before** opening the report
dialog (for a retake, hide the dialog first and keep it hidden until the promise settles). It
answers only in builds with cheats and the debug protocol (editor Play, `gameengine run`, dev and
probe builds); elsewhere, in tests and in replays it rejects with `E_UNAVAILABLE`, so the report
UI must work without a picture.

## Builds

| Build | Cheats |
|---|---|
| editor Play, `gameengine run`, tests | yes |
| `build android|ios --config dev|probe`, `cook` | yes |
| `--config release`, `cook --release` | no — unless `--cheats`, or `"cheats": { "release": true }` in project.gameengine.json (in-house builds, installed directly) |

`gameengine build … --report` says `cheats: included` when they are in. Release builds have no
debug protocol, so there only the in-game console runs them.

Cheats never reach a store: `--upload` refuses a build that carries them (Play, App Store Connect,
Steam), so install in-house cheat builds directly. `release pack` always leaves them out and refuses a `--content-of` base that has them.

Console settings in `project.gameengine.json` (all optional):

```json
"cheats": { "gesture": "twoFingerDoubleTap", "key": "Shift+Escape", "release": false }
```

`gesture`: `twoFingerDoubleTap` (default), `cornerDoubleTap` (two taps in the top-left corner;
works with a mouse), `none`. `key`: a `KeyboardEvent.code` name with optional `Shift+`, `Ctrl+`, `Alt+` or `Meta+` prefixes
(default `Shift+Escape`), empty for none.

## Checks

- `gameengine cheat list` shows yours with the right group, params and defaults.
- A game test runs each new sim cheat and asserts its effect (`gameengine test --js both`).
- `gameengine build android --config release --dry-run --report` has no `cheats:` line.
- `gameengine cheat list` also lists `Engine: engine.perf`, `Engine: engine.capture` and `Engine: engine.crash`; a game test that pins the list includes them.
