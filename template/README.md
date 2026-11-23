# Tactile Game Engine game template

This is the template for games built on the **Tactile Game Engine** (TypeScript game code, the Rust
engine in tactilegames/game-engine). It is not Tactile's other game template, the Unity one
(GameTemplate on the Build Server). Use this one only for a Game Engine game.

A Game Engine game with nothing in it but what the engine itself creates (`gameengine new`, the 2d-casual
starter) and the Build Server setup: the pipelines, the identity and signing values, and content updates.
It has no analytics, attribution, crash reporting, notifications or other services, and no packages: a
game adds what it needs when it needs it. A new game starts here.

## Start a new prototype: one line

With a coding agent (Claude Code or similar), paste this line into it:

```text
Start a new Tactile prototype: clone tactilegames/tactile-game-template with gh into a new temporary folder (gh repo clone tactilegames/tactile-game-template "$(mktemp -d)/template" -- --depth 1), then read _agents.md in that clone and follow it. If the clone fails, my GitHub account has no access to tactilegames: tell me to ask a tactilegames GitHub admin.
```

The agent asks the name, shows the bundle ids, repository and project, and creates nothing until you
confirm (`_agents.md`). Nothing is ever pushed to the template. In a terminal, without an agent:

```sh
gh api repos/tactilegames/tactile-game-template/contents/template/new-game.sh -H "Accept: application/vnd.github.raw" | bash
```

Needs git, gh logged in with access to tactilegames, Node 24 or later, and the Build Server token in
`~/.tactile_env` (`BUILD_SERVER_API_KEY=<token>`, from https://tactile.build/profile). It asks the name,
which is also the display name. The in-house builds testers install are `prototype.<slug>.inhouse`,
"<Name> Inhouse", on both platforms, and the store values `prototype.<slug>` (the slug is the name in
lowercase letters and digits, no leading digit), all signed by the one wildcard `prototype.*` profile in app-signing
`ProvisioningProfiles/Prototypes`, so a prototype needs no App ID of its own. It makes the game in a
folder named for its code name, creates its private repository, pushes `chore/initial`, creates the
Build Server project and starts the Android and iOS in-house builds. `bash -s -- --dry-run` prints what
it would create, and `bash -s -- --yes --name "<name>"` asks nothing (`template/new-game.mjs`).

The `Prototypes` profiles are on app-signing's master (app-signing PR #32).

## One call

```sh
node template/setup.mjs ../my-game --engine ../game-engine --set GAME_NAME=PuzzleQuest --set ... [--values v.json] [--verify]
```

From this repository it makes a new game. From a game made with it (`node template/setup.mjs .
--set ...`) it updates only what changed: a new value fills its placeholders. It installs when the game
declares packages and they changed, generates, prints one line per change and the checklist. `--verify`
adds check --tests and the size budget. Exit 0 done, 1 a check failed, 2 refused with nothing changed (a
mandatory value missing, a value that doesn't match its pattern, a value already set: those are
changed by hand, since the same string can stand for several values and for the game's own code).

Setup also works from an extracted repository archive, without a template Git checkout or template
history. `--configure-only` copies and configures the game without installing packages or running the
engine. Tactile Create runs the full setup with its installed engine, including code generation and
`gameengine skills update`. This installs the engine instructions, skills, session hooks and MCP
configuration in `Game/` for Claude Code and Codex. Re-running setup preserves `PROJECT.md` and local
skill edits through the engine's updater. Skills come from the installed engine and require no
separate GitHub access. The starter declares no packages, so npm is needed only once a game adds one.
GitHub publishing is a separate step and does not prevent working on the local game.

Every value, what it is and where to get it is in `template/placeholders.json`. The values given so
far live in `template/state.json`. Commit it with the game.

The skill `create-game-from-template` gathers the values with a person and makes this one call.

## Placeholders

Every per-game value is written `__TACTILE_<NAME>__`: the game's identity, the Apple signing account and
the Build Server project. They are all mandatory; there are no secrets and no optional values. A game that
later needs a service (analytics, crash reporting, ...) adds it with its own values and Build secrets.

## Build Server project

The build-server tools can't create a project. Before the first build, a person sets up:

1. **Apple App IDs** for BUNDLE_ID in the store account (APPLE_TEAM_ID) and BUNDLE_ID_INHOUSE in
   Tactile's enterprise account (M985P8DJ45).
2. **app-signing** (a Build Server owner): a `games_config` entry and `ProvisioningProfiles/<APPSIGNING_NAME>/`
   with `appstore.mobileprovision` and `appstore_adhoc.mobileprovision` (BUNDLE_ID, store team) and
   `inhouse.mobileprovision` (BUNDLE_ID_INHOUSE, enterprise team).
3. **1Password**: every `*_REF` exists in the `automation-tactile-build-server` vault. A reference
   that resolves empty fails the build.
4. **The project** (a Build Server owner): name BUILD_SERVER_PROJECT, Git repository
   `git@github.com:tactilegames/<CODE_NAME>.git`, build config `Build/build_config.json`, build
   pipeline branch `v1`.
5. **Agents**: Apple Silicon. iOS with Xcode 26.2. Android with the SDK and NDK at
   `~/android-sdk-macosx-j17` and `~/android-ndk-r27c`. RocketCab's agents qualify.
6. **Git access**: the Build Server's GitHub identity reads the new repository and
   tactilegames/game-engine. Confirm it with the owner.

## Version

The **Versioning** step (BuildPlugins.ProjectVersioning) takes the version name from the Git branch,
and the version code from the build id. A branch named as a release (`1.0.0`) builds that version. A
release line (`1.0.x`) builds the next patch after its highest release branch or tag: 1.0.0, then
1.0.1 once `1.0.0` exists. Any other branch builds the next minor after the highest version branch or
tag, and 0.1.0 while there is none, so a new game starts at 0.1.0. `"version"` in
`Game/project.gameengine.json` is only the desktop's: the build overwrites it.

Store builds then run **Verify Release Candidate**. It flags a store build as a release candidate
when it is a build or a patch of a release branch, with no skipped steps, no precompiler directives and
no validator groups, and only warns on any other.

Games made from the template before this pinned `VERSION_NAME: 0.1.0` in `values/game/game.yml`, so
every build of theirs is 0.1.0. To fix one, remove that line and its comment. To flag release candidates
as well, add `BuildPlugins.VerifyReleaseCandidate` (version `1.*`) to `Build/Pipeline/nuget.yml` and to
the plugins of both store definitions, and add the step block after Versioning in each.

## Tests in the build

Every pipeline runs a **Run Tests** step right after Versioning, and after Verify Release Candidate on
store builds: `Build/Pipeline/scripts/run_tests`
runs every game test, renderTest and structural budgets included, on the JS engine the platform ships:
V8 on Android, Hermes on iOS (`gameengine test --tier t0,t1 --js <engine>`). Then `gameengine check`:
typecheck, validate, the recorded pipelines, a desktop cook and a smoke run. A failing test, or a run
that finds no test, fails the build there, before it builds or signs: a game with no tests fails this
step, so add one. Each engine is tested by its own platform's builds, so a test that breaks on one
engine only shows up in that platform's build. Build both platforms before merging.
`gameengine check --tests` alone is not enough: it runs only T0 tests, so it skips every renderTest.

Logic tests go in `Game/tests/` as `worldTest`: T0, nothing drawn. `tests/game.test.ts` is the
example every game starts with. Screen tests are `renderTest` (T1).

For a new game it adds about 2 to 3 minutes to an Android build and about 5 to 6 to an iOS one, mostly
the engine host builds. iOS also builds the desktop Hermes host. The test time grows with the
renderTests: the engine runs them one after the other in a single process. A game with about 500
renderTests spends about 5 minutes on them on V8 and about 9 on Hermes. The engine checkout doesn't
survive between builds, so there is no faster second build: a slow step is not a hung one.

An in-house build can skip the step: tick **Skip Unit Tests (in-house only)** when ordering it. The
runner skips any step named "Run Tests" when that setting is on, so the store definitions name theirs
**Run Store Tests**, and a store build always runs its tests.

To give another Game Engine game the same step, copy `run_tests` next to its build script, set
`BUILD_SCRIPT` at its top to that script's name, and add the step block after Versioning in each
definition, named as in the template's in-house and store definitions. Copy the `skip_test` setting
from `Build/build_config.json` too. The build script must have the functions `run_tests` loads (`use_node`, `use_toolchain`,
`checkout_engine`, `install_packages`, `build_host_tools`), and its engine revision must have
`gameengine test --tier` and `gameengine check`.

## Content updates

Every game updates itself over the air without code of its own (engine ADR 0122). A **Content** build
(`Content iOS (Inhouse)`, `Content Android (Store)`, …, configs 5 to 8) packs the game's code and content
as a signed release, with BuildPlugins.GameHub's `GameHubPublishReleaseStep`, and publishes it to Tactile's automatic asset
bundles CDN, in the game's own folder `game-engine/<GAME_NAME>/` (`values/content/content.yml`; to use
another folder, change it there and in `releases.manifest.url` in `Game/project.gameengine.json`):

- the bundles under names that change only with their bytes, so each is uploaded once and a later build
  cooks only the bundles the CDN lacks;
- last, `<channel>/content-manifest-<platform>-<content ABI>.json`, the signed list of the release's
  files. A build of a main branch (`GAME_MAIN_BRANCHES` in `values/game/game.yml`: `main` and
  `chore/initial`, the branch a new game is built from) publishes to the channel of its build type
  (`GAME_BUILD_TYPE` in `values/product/*.yml`: `inhouse` or `store`), so in-house apps get a release
  before store apps do.
  An in-house build of any other branch publishes to `inhouse-<branch>` and never replaces what in-house
  apps read. A store build of another branch fails. A game that moves its work to another branch adds it
  to `GAME_MAIN_BRANCHES`, or its normal builds never reach `inhouse`.

The app finds its manifest through `releases.manifest.url` in `Game/project.gameengine.json`. After
start and on return to the foreground the engine checks it, downloads what is new and applies it: live
when only content changed, else at the next start. An in-house app is one whose bundle id ends in
`.inhouse`; desktop runs read the in-house folder too. A manifest that is not published yet is not an
error. `releases.trusted` lists the game with the studio's public key; the build signs with the studio's
private key (`CONTENT_SIGNING_KEY`, 1Password item `game-engine-studio-release-key`) and uploads with the
bucket's key (`tactile-automatic-asset-bundles-s3`). A new app build on a newer engine (a new content
ABI) finds only manifests made for it, so run its Content builds after an engine update.

The version of a release is the Build Server's build id, which only goes up, as devices require. Store
Content builds run their tests as **Run Store Tests**, which the skip setting never skips. Content builds
use the same engine revision as this starter, pinned in Build/Pipeline/values/game/game.yml. Keep the starter tests, replay and pipeline recordings compatible when changing that revision.

## Checks

Every check of the template's tools touches the real filesystem or starts processes, so each is an
explicit E2E under `template/e2e/` (`*.e2e.mjs`), outside default test discovery. Run them from the
repository root, in a scratch folder you own under `/work/agents/tmp/`:

```sh
AGENT_SCRATCH_DIR=/work/agents/tmp/<owned-task> node --test template/e2e/*.e2e.mjs
```

They copy the working tree (not `HEAD`) into the scratch folder and clean it up afterwards.

The full skill-bootstrap check also needs `ENGINE_TEMPLATE_E2E_ENGINE` pointing to an engine
installation or checkout with a working CLI. Without it, that check is skipped. It runs full setup
against the real engine, then repeats setup to check that project notes and skill edits survive.
