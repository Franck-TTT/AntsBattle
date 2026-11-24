---
name: work-loop
version: 1.19.0
tier: required
description: The edit → test → inspect loop for a Game Engine game and the CLI command for each step — gameengine test, hash traces, goldens, headless sessions, step/screenshot/world query, ui press, view render, cheats, replays. Use at the start of any gameplay, UI or content task, or when unsure which command checks a change.
---

# Work loop

## The loop

1. Change code or content, keeping every save compiling (`gameengine gen` after a schema edit).
2. `gameengine test`: prove the behaviour with a test or a replay, never by reading code.
3. Look at it: `gameengine run --headless`, then `step`, `screenshot`, `world query`, `ui press`, `view render`.
4. `gameengine check` before handing back, and fix what it reports.
5. Stop every session you started.

**Done means a test or replay shows the behaviour, not that the code compiles.** Every command takes `--json`. Read errors; they name the fix.

## Commands

The commands below need `gameengine` on PATH. If the session started with "gameengine is not on PATH", put it there once: `node .gameengine/engine/tools/cli/bin/gameengine.mjs setup --path` (plain `setup` does it too, with the toolchain) writes a launcher into a user bin directory on PATH (`--dir <dir>` picks one; `gameengine doctor` checks it), then start a new session. Until then, `node .gameengine/engine/tools/cli/bin/gameengine.mjs` runs the same CLI.

| Step | Command |
|---|---|
| Logic tests | `gameengine test` (sharded across cores, `--jobs N`; `--js both` runs V8 and Hermes at once; `--filter "*swap*"` for one, `--changed` for the test files you touched). The output starts with `host: <path> (debug|release)`; `gameengine check --rebuild` rebuilds stale engine binaries |
| Prove a change left the sim alone (refactor, optimisation, port to Rust) | before editing `gameengine test --hash-trace .gameengine/base`, after it `gameengine test --hash-trace-baseline .gameengine/base`: `N of N identical` is the proof, a failure names the step, system and components (skill `determinism`). No equivalence fuzzers, second copies of the project or end-of-test hash guessing |
| Render goldens | `gameengine test --tier t0,t1` (`--update-goldens` after an intended change) |
| Start a session | `gameengine run --headless` (`--paused` to step by hand). `gameengine run --headless --watch` stays in the foreground, so start it in the background: it reloads the session on every save and prints one line per reload, `::reload:: <script\|asset\|ui\|material> <ms> ms <ok\|refused: reason>` |
| Advance / look | `gameengine step 60`, `gameengine screenshot out.png`, `gameengine world query Tile --limit 5`, `gameengine call render.probe '{"points":[[180,320]],"regions":[[0,0,360,80]]}'` (pixel colours and region means, no image to read) |
| Edit live | `gameengine world set <entity> <Comp> '<json>'`, `gameengine cmd scene.createEntity --name Box` |
| Press the UI | `gameengine ui interactables --width 1179 --height 2556` (what takes presses, topmost first), `gameengine ui press <id>` / `ui drag <id> --by 0,300` / `ui type <id> <text>` (hit-tested, through the real input path), raw points on the game too: `ui tap --at x,y`, `ui drag --from x,y --by 0,-300 --duration 0.1` (a flick: timed in sim steps, the same paused or running and in a replay), `gameengine emit <Event> '<json>'` |
| A UI view alone | `gameengine view render Hud --sample midway --out hud.png` (`--model '<json>'` for any state, `--size WxH`, `--safe l,t,r,b`, `--landscape`, `--times` for animations and UI particles, `--times end` for the settled frame with every animation and flight at its end); `gameengine view lint` renders every view on the slim and wide device and lists squashed caps, children out of their parent, overlaps and text too big for its box |
| A material alone | `gameengine material preview materials/gem.mat.json --mesh torus --yaw 0.8 --time 1.5 --out m.png` (skill `vfx-materials`) |
| Put the game into a state | `gameengine cheat list`, `gameengine cheat run moves.add amount=3` then `gameengine step 1` (skill `cheats`) |
| Look at one thing | `gameengine mode sprite --entity 5:1`, `gameengine mode particles --entity 7:1`, `gameengine mode physics`, `gameengine mode sim` (no rendering), `gameengine mode full` |
| Play it for real | `gameengine run --perf` (frame times and the worst frames on exit; the game's console on stderr) |
| Replays | `gameengine replay record start --path tests/replays/x.greplay` (restarts the game from a fresh world) … `stop`; `gameengine replay verify <file>` names the first diverging step (and, recorded with `--checkpoint-every 1`, the system and components); skill `determinism` |
| Frame rate | `gameengine run --run-sec 10 --json`: the frame-rate target, the display's refresh rate and measured frame intervals (skill `mobile-performance-review`) |
| Memory and loading | `gameengine memory report --device phone-low` (asset groups against budgets; skill `asset-memory`) |
| Rust systems | `gameengine test --native both` (Rust = its TypeScript twin), `gameengine native asm <System>` (skill `perf-to-rust`) |
| What a build ships | `gameengine build android --config release --dry-run --report` (skill `ship-mobile`) |
| Playable ads | `gameengine playable new` / `run` / `build` / `validate <ad>` (skill `playable-ads`) |
| Stop the session you started | `gameengine session stop --session <pid>` (`--all` stops the user's sessions too: only when asked) |
| The editor the user watches | `gameengine editor state`, `gameengine editor mode editor.play`, `gameengine editor play` / `stop`, `gameengine editor stream on` (URL in `editor state`), `gameengine editor call render.stats --role game`, `gameengine editor restart-engine` (when `editor state` says `editEngine.running: false`), `gameengine editor screenshot out.png` (MCP `editor`, `editor_screenshot`) |
| The editor's console | `gameengine editor console --level error` (`--since <next>` for only new entries, `--follow` to keep reading): script errors, rejected hot reloads, cook failures, stale engine binaries |
| Before handing back | `gameengine check`: validate, cook, a smoke run of the cooked game (`check.smoke` in `project.gameengine.json`: `frames`, `input`), then the project's checks (`gameengine checks list`; `--only <id>` runs one alone, `--skip <glob>` leaves some out); `--tests` adds the game tests on V8 and Hermes, `gameengine test --cooked` runs them on cooked content |

- **An animated result is checked at its last frame.** A view at rest says nothing about where a flight, a fill or a slide ends: render it at the end (`view render <View> --times end`, or `--times` up to the end on the slim and the wide device) and assert where it landed in a test (`ui.finishAnimations()`, then `expect('coin').toLandOn('coins.target')`; skill `testing`).

## Hot reload

- Hot reload keeps the session's world. A bundle that fails to build or load is rejected and the last good build keeps running.
  - **A headless session started with `--watch`** reloads on every save. Wait for its `::reload::` line before you check the edit: `script … ok` means the new code runs, `refused: <reason>` means it does not (the reason names the file and position of a build error). `asset`, `ui` and `material` lines say the session reloaded that content from disk; a file that then fails to load is reported in the session's log (`gameengine session list` names it), not on the line. A changed `*.material.ts` is compiled for you.
  - **A headless session started without `--watch`** is reloaded by the next `step`, `screenshot`, `world`, `ui` or `view` command when the code changed since (stderr: `hot-reloaded session …`, or a warning when the code does not build), so a check right after an edit shows the edit. `gameengine call` does not reload.
  - **In the editor**, each reload logs `reloaded: …` (category `hot-reload`): wait for it with `gameengine editor console --since <next>` instead of asking the user to restart anything.
- A schema change is not a plain reload: the editor restarts its edit engine, which rebuilds the project's native host first. Run `gameengine gen` before saving code that uses new schema types, and wait for `edit engine restarted` or `restart failed: …` in the console (§ The live project says what to do on a failure).
- Session-start config (`project.gameengine.json`, `pipelines.json`, `input.json`) is the exception: a headless session needs `session stop` and `run` again (so does one whose reload was refused with `schema changed`); the editor restarts its edit engine itself and offers Restart Play.

## New files, scenes and prefabs

- **New asset files need a `.gmeta` sidecar** (its GUID and importer): create text assets (effects, materials, tilemaps, clips, banks, data) with `gameengine cmd asset.setText --params '{"path":"assets/fx/boom.vfx.json","text":"…"}'` (it writes a new file under `assets/` with its sidecar) or run `gameengine cook` once after adding files, and commit the `.gmeta`; until then `validate` fails with `E_ASSET: no .gmeta sidecar`.
- **Make a prefab** with the editor's commands, or by hand: a batch script (`gameengine editor --batch make-coin.json`) with `"new": true`, `"commands"` that build it (`scene.createEntity`, `scene.setComponentField`) and `"save": "assets/prefabs/coin.prefab.json"`; place it in a scene with `scene.instantiatePrefab` (`source`, `parent`, `name`, `overrides`; a `source` given as the prefab's GUID writes a `{ "guid" }` reference, a path writes a path string that `validate` notes as `I_ASSET_REF_PATH`). The commands are listed in `gameengine cmd --list`; each step is `{ "name": "scene.createEntity", "params": { … } }`.
- **A new scene or prefab can be hand-written without a `guid`**: leave it out and run `gameengine fmt`, which gives the file one and puts it in canonical form (until then `validate` fails it with `E_DOCUMENT_GUID`, or warns `W_FORMAT` on layout alone). Then read the GUID back from the file for `startScene` or a `{ "guid": "…" }` reference; never invent one. Keep a scene id and an entity id from sharing a name: they share one namespace (`E_PRECONDITION: an entity already has id …`).
- **Scenes and prefabs live under `assets/`**, anywhere but `assets/pkg/`: new ones in `assets/scenes/` and `assets/prefabs/`, or beside the art of their feature (`assets/shop/shop.prefab.json`). Code names one by a reference read from configuration (an `asset('prefab')` or `asset('scene')` field, a data asset's `p.ref`), which reads as its GUID; its full project path, exact case included, is the fallback for one nothing configures, and breaks when the file moves. Builds ship documents only from there (and the legacy `scenes/`/`prefabs/`, which `gameengine documents move` empties), so the engine refuses any other path in dev too (`E_DOCUMENT_PATH`), and `gameengine validate`/`cook` fail on the file and on string literals naming it. Paths you build at run time are only caught by running: `gameengine check` smoke-runs the cooked game.

## Finding things without paths in the files

Scenes, prefabs, data assets, content and the project file name every asset by GUID
(`{ "guid": "…" }`, with `"part"` for a piece of a file), never by where it is. A scene's or prefab's
GUID is its top-level `guid`; any other file's is the `guid` line of its `.gmeta`. So moving a file
with its `.gmeta`, by any tool, breaks no reference. Ask the tools instead of reading JSON for paths:

| Question | Command |
|---|---|
| What file is this GUID? | `gameengine refs which <guid>…` (`(no file)` and exit 1 for one that names nothing) |
| What uses this file? | `gameengine refs users <path or guid>` (`--deep`: also what reaches it through prefabs and content). It reads data, not code: grep `src/` and `tests/` for path literals |
| Wider questions (unused art, what a scene pulls in) | build a GUID → path map once (documents' `guid`, `.gmeta` `guid` lines) and answer from it, rather than opening files one by one |

- **Code reads references from configuration first**: an `asset()` field or a data asset's
  `p.ref`, set in a scene or a data file, and passed on as it reads (a GUID). A path literal
  (`spawnPrefab('assets/prefabs/x.prefab.json')`) is the fallback for content nothing configures;
  it still works, but breaks when the file moves, and no command rewrites it.
- **To write a reference by hand**, take the GUID from the target (`refs which` checks it) and write
  `{ "guid": "…" }`, or write the path and run `gameengine refs migrate`, which rewrites it (and
  gives a file without a `.gmeta` one). The editor's pickers and `scene.instantiatePrefab` with a
  GUID `source` write references for you.
- **`E_GUID_DUPLICATE`**: two files carry one GUID, usually a copy made outside the editor. The message
  says which copy was there first; `gameengine refs fix` gives the others new GUIDs (`--keep <path>`
  when it cannot tell). **`E_DOCUMENT_GUID`**: a scene or prefab lost its `guid`; `refs fix` (or
  `gameengine fmt`) puts back the one it had. **`E_ASSET_REF`**: a GUID names no file; the message
  names the GUID and, when this checkout's GUID record saw it, where the file was. A file moved without its `.gmeta` gets a new one at the next
  `gameengine cook`, then `refs fix` gives it its old GUID back. `refs fix --dry-run` shows what it
  would do.
- **`I_ASSET_REF_PATH`** (an info line from `validate`): a file still names assets by path, as
  projects made before GUID references do. `gameengine refs migrate --dry-run` lists each rewrite
  with its path; `refs migrate` writes them. A whole project from before then: skill `upgrade-to-guid-references`.

## The live project

The user may have the project open in the editor or running while you work. The editor follows the files on
disk, so a project change never needs the editor restarted, by you or the user.

- Scripts (`src/`, `schema/`, `ui/`, regenerated `*.gen.ts`) hot reload; assets, scenes, prefabs, locales, styles
  and `haptics.json` reload in place and content re-cooks; editor lists (Project browser, scenes, playable ads,
  textures, skills, cheats) relist by themselves.
- Order multi-file changes so every save compiles: create a file before saving the import that names it, and
  run `gameengine gen` after editing `schema/*.schema.ts`, before saving code that imports the new types from
  `schema.gen.ts`. Or work in a copy and apply the change in one go.
- Confirm a change landed with `gameengine editor console --since <next>`: category `hot-reload` logs
  `reloaded: …` per reload, or why it was rejected.
- After a schema change, wait for `scripts changed the schema: edit engine restarted with the new scripts` or
  `restart failed: …`. When the native build fails, the edit engine keeps running on the last host that built,
  or the stock host (`…; running the edit world on …`); fix the build error logged above it.
- `gameengine editor state` reports `editEngine` (`running`, and `error`: why the last start failed). When it is
  not running, fix the cause, then `gameengine editor restart-engine` (unsaved edits are restored); the next
  saved script change also retries. `gameengine editor play` works meanwhile and plays the saved scene.
- Do not run `gameengine test`, `check` or `run` while the editor is building native systems (`building the
  native systems of …` without a following `Finished`, `edit engine restarted` or `restart failed`): they
  build the same project host (V8) and wait for, or fail with, the editor's build.
- The open scene follows its file while the editor has no unsaved edits of it, and prefab instances follow
  their prefab files. With unsaved edits the editor keeps its copy and logs a warning (a save would overwrite
  your file), so prefer editing the open scene through the editor (`gameengine editor call cmd.execute …`).
- Never run importers that delete or rewrite assets while the game is playing.
- Only a change to the engine itself (its Rust binaries) needs a restart: rebuild every binary that reads the
  changed format (`gameengine doctor` lists stale ones), then ask the user to restart the editor.
- To make `gameengine check` a gate, add a Stop hook to `.claude/settings.json`. It blocks finishing once when
  the check fails; if it still fails, the agent stops and reports what is failing. The hook skips checks marked
  `slow: true` and names them:
  `"Stop": [{ "hooks": [{ "type": "command", "command": "gameengine check --hook", "timeout": 900 }] }]`
