---
name: upgrade-to-guid-references
version: 1.1.0
tier: optional
description: One-time upgrade of a project made before scenes and prefabs moved under assets/ and references became GUIDs — documents move, refs migrate, refs fix, re-pinning hashes and replays, code comparing paths. Use when the project has root scenes/ or prefabs/ folders, or validate reports I_ASSET_REF_PATH, E_ASSET no .gmeta or E_DOCUMENT_GUID.
---

# Upgrade to GUID references

A one-time migration for projects made with an engine from before scenes and prefabs moved under
`assets/` and references became `{ "guid" }`. It applies only when one of these holds:
the project has `scenes/` or `prefabs/` folders at its root; `gameengine validate` prints
`I_ASSET_REF_PATH` info lines, `E_ASSET: … no .gmeta sidecar` or `E_DOCUMENT_GUID`. A project
without them is already migrated: this skill has nothing for it, whatever the engine version.

Do the steps in order and commit the result as one change the user can review. Before updating
the engine, if the project has game tests, record a baseline with the old engine:
`gameengine test --js both --hash-trace .gameengine/pre-upgrade`. After, it shows which hash
changes come from the migration and nothing else (step 6).

1. **Move documents:** `gameengine documents move --dry-run`, read the plan, then
   `gameengine documents move` (`--to assets/<dir>` for one folder of your own). It rewrites the paths
   to them in `src/`, `ui/`, `tests/`, JSON content, `startScene`, bundle, asset-group and collection
   globs and playable-ad slices. It **lists what it cannot rewrite** — paths built at run time, bare
   scene names, paths in comments — with `file:line`: fix each by hand. Read the reference from
   configuration where one exists; otherwise write the document's new project path
   (`'level_02'` → `'assets/scenes/level_02.scene.json'`): a bare name now means the legacy
   `scenes/` folder, which is gone. Then `gameengine gen` (collections).
2. **Write references:** `gameengine refs migrate --dry-run`, then `gameengine refs migrate`. It
   writes a `.gmeta` for every asset without one and turns every path where a reference belongs
   (scenes, prefabs, content, data assets, the project file) into `{ "guid": "…" }`. Flipbook frame
   patterns become frame lists; skeleton2d files move to `$schemaVersion` 2 with `images` relative to
   the skeleton.
3. **Settle GUIDs:** `gameengine refs fix --dry-run`, then `refs fix` if it lists anything
   (duplicates from copies made outside the editor; `--keep <path>` names the original).
4. **Format and check:** `gameengine fmt`, then `gameengine validate`: no errors and no
   `I_ASSET_REF_PATH` lines left.
5. **Game code that compared engine values with paths.** These now return GUIDs, so a comparison
   with a path literal silently stops matching (search `src/` and `tests/` for each):
   - `listData(token)` and `collection(name).scenes` (GUIDs, sorted by GUID — no meaningful order).
   - `Clip2DEvent.clip`, `Clip2DFinished`, `clip2DFrame(e).sprite`, skeleton slot images.
   - `EnterScene.scene` (events and replay input) and `scenes.current()`.
   - `VideoFinished` / `VideoCue` `.video`; pool names (a pool without `name` is named after the
     prefab's GUID) and `pool.stats()` `prefab`; loading-run names; `scene.inspect` values.
   Compare GUIDs with GUIDs (take one from configuration or `gameengine refs which <guid>` to check);
   use `assetPath(id)` only to show a path to a person, never in sim logic.
6. **Hashes and replays move once.** With a baseline from before the update:
   `gameengine test --hash-trace .gameengine/hash-trace --hash-trace-baseline .gameengine/pre-upgrade`
   (every test that touches a pool or a scene diverges; expected), then
   `gameengine trace diff .gameengine/pre-upgrade/v8 .gameengine/hash-trace/v8` with `--allow` for
   the GUID-carrying parts only: `doc:pool-ops`, `doc:pool:*`, `doc:scenes:current`, `EnterScene`,
   and those the project uses of `Clip2DEvent`, `Clip2DFinished`, `VideoFinished`, `VideoCue`,
   `LoadingResumed`, `TunablesChanged`. Anything else that differs is a real behaviour change: stop
   and report it, don't re-pin. Then re-pin:
   - `expectHash` values, to the new hashes the tests print.
   - Replays: one whose recorded input names a path (an `EnterScene` input, a prefab or asset
     path) is **recorded again** (`gameengine test --filter "<test>" --record-replays`);
     `replay rehash` keeps the old input, so it would pin a different game. Rehash only the others.

   Without a baseline, say so to the user before re-pinning.
7. **Commit the `.gmeta` files** with the rest. `gameengine test` writes any still missing before a
   loose run and logs them; an uncommitted one gets a different GUID on a teammate's machine.
8. **Devices:** this engine's cooked content (content ABI rev 4) is refused by app builds made with an
   older engine. Ship a new app binary before OTA content cooked with this engine, and expect every
   device to download content once (atlases repack).

Verify: `gameengine validate`, `gameengine test --js both`, `gameengine test --cooked`, and
`gameengine check` for a smoke run of the cooked game.
