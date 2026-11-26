---
name: ship-mobile
version: 1.45.0
tier: required
description: Building, running and measuring the game on phones — probe builds, devices, `gameengine device perf`, the T2 lab, what a build ships (bundles, cheats, plugins), the release gate on pipelines.json and the frame-rate cap. Use for anything that must run on a real device.
---

# Shipping to mobile

## The rules that matter most

1. **Measure probe builds, not dev builds**, on a real phone, and the low-end phone first.
2. **A release build refuses a pipeline warm-up that is not ready**: record `pipelines.json` before the store build.
3. **Read what a build ships** (`--dry-run --report`) before uploading: no test code, no secrets, no unused plugins, cheats only when asked for.
4. **`gameengine check` and `gameengine test --cooked` pass** before any device build: devices read cooked bundles, tests read loose files.

Updates without a store build (over-the-air releases, channels, hubs that launch other games) are skill `releases`.

## Commands

| Goal | Command |
|---|---|
| Toolchain check | `gameengine doctor` |
| Device build with the debug protocol | `gameengine build android --config probe` (or `ios`) |
| Install, run, inspect | `gameengine device install`, `gameengine device run`, `gameengine device logs --follow`, `gameengine device screenshot` |
| An iPhone build with no Apple account in Xcode | `gameengine build ios --provisioning-profile <file.mobileprovision> [--bundle-id <id the profile covers>]` (or `GAMEENGINE_IOS_PROVISIONING_PROFILE`), then `gameengine device install --platform ios` and `gameengine device run --platform ios [--bundle-id <id>]` (an in-house app gets its debug protocol session too; `device push-bundle` cannot copy into one); `--unsigned` builds an app nobody signs. The profile and its certificate stay on your machine, never in the project |
| Performance on the phone (Android, dev/probe build) | `gameengine device perf [--seconds 20] [--counters] [--json]`: the 20 s performance report (frame loop, top sim systems; on OpenGL ES also the render phase handed to the GPU thread and its render and present), CPU per thread (the GPU thread is `gameengine-gpu`, the Vulkan render thread `gameengine-render`), `dumpsys meminfo`; `--counters` adds CPU hardware counters per thread role and core from simpleperf (IPC, branch mispredicts, SIMD share, cache misses, stalls, which core types each role ran on; dev builds, or probe builds that are profileable) |
| All attached phones, one command (builds the probes) | `gameengine lab phones tests/lab/t2.json` (`--dry-run` to see what counts) |
| Parity + budgets on devices | `gameengine lab run tests/lab/t2.json --devices android-low-mid-mali --build android=<apk>` |
| Store build | `gameengine build android --config release --upload [--version-code n]` |
| Install a release bundle as Play delivers it | `gameengine device install build/android/<Game>-<version>-release.aab` |
| What a build ships (modules, cooked files, features, unused and unshipped assets, cheats) | `gameengine build android --dry-run --config release --report` (`--json` for data) |
| The cooked game boots | `gameengine check` (validate, cook, a headless smoke run of the desktop cook that fails on a data asset or streamed cell read from storage mid-frame, or an asset-group member it cannot read; a `pipelines` warning), `gameengine test --cooked` |
| Pipeline warm-up for every tier | `gameengine test --tier t1 --record-pipelines` (skill `testing`) |

## Building and measuring

- Android device builds link the engine's pinned V8 build; `gameengine doctor` shows whether it is there.
- **Measure probe builds, not dev builds.** A dev build is a debuggable APK with Dawn validation and debug logging on; a probe build is release-optimised with the debug protocol. On a probe build on the phone: `gameengine device perf` (its `setup:` line says which profile, tier, render scale, msaa, hdr and memory class the device got), a Perfetto trace for the timeline (engine sections `frame`, `sim.step`, `script.*`, `render.*`, `present`), `gameengine device logs` for `hitch pipeline` and `memory` lines. Recipes: skill `mobile-performance-review`.
- Run the lab from the checkout that built the probe: its pairing key is what the device accepts.
- Budgets per device class live in `tests/budgets/*.json`; the lab fails on script time, GC pauses, heap, frame time.
- **Check which sim systems stay TypeScript**: an Android, iOS or desktop build logs `sim: system <name> runs as TypeScript, not transpiled Rust: …` with the reason, the file and line, that line of code and how to move it to Rust, for each sim system the transpiler left out, and lists them in `build-report.json` `untranspiledSystems` (with `system`, `reason`, `at` and `source`; a staged iOS job's `prepare-report.json`). These are not warnings: the build succeeds, the game behaves the same and a cold system is fine as TypeScript. After a build, tell the user which systems it names; a system that was not on it before means a change pushed it out of Rust. When that system is hot, fix the construct the line names (skill `perf-to-rust` § 3).
- **Release builds refuse a pipeline warm-up that is not ready**: `gameengine build android|ios --config release` stops when `pipelines.json` is missing, lacks a GPU tier (desktop, mobile, compat), names a material program no compiled material has, is older than a `*.material.ts`, or nothing can record it (no `tests/budgets/*.json` with a `structural` block and a `replay`). Re-record with `gameengine test --tier t1 --record-pipelines` and commit the file; `--allow-pipeline-issues` ships anyway (devices then compile those pipelines in play). Dev and probe builds and `gameengine check` only warn.
- Engine library size: `--report` prints `libgameengine (arm64-v8a): N MB linked and stripped, as the APK carries it` — the static library cargo builds (~300 MB: all of V8, debug info) is linked with unreached code dropped and stripped by the Android build (~41 MB for arm64 at V8 + the engine). The shell hides the static library's symbols, so the linker drops what the `gameengine_*` entry points never reach; `--report --json` has the number as `libs.<abi>.libgameengineLinked` (null without an NDK clang). Compare that number, not the static library, with an APK budget; it needs the NDK, and a `--dry-run` measures the library the last real build left (dev and probe ones carry the debug protocol).
- Low-end phones have their overrides (skill `device-tiers`): `gameengine validate` is clean and
  a T1 run at `--memory-class phone-low` passes; measure a probe build on a `phone-low` phone
  (about 3 GB RAM, Mali-G52-class GPU) before shipping.
- **Frame rate:** phones run at most 60 fps, and the `compat` tier and `phone-low` phones 30, unless the project says otherwise (skill `device-tiers`, § Rules, "The frame rate is a cap").
- **Android OpenGL ES phones draw into the window when the game opts in** (`render.android.drawIntoWindow`, about 3 ms of GPU a frame with post): skill `device-tiers`.

## Platform settings

- **Android API levels are the game's**: the engine builds with compileSdk 36, targetSdk 36 and AGP 8.13.2 unless `project.gameengine.json` sets `"android": { "compileSdk": 37, "targetSdk": 37, "agpVersion": "8.13.2" }` (each optional; compileSdk cannot go below the engine's). When Play announces a new minimum target, raise `android.targetSdk` (and `compileSdk` with it: a targetSdk above compileSdk fails) without waiting for an engine release. A level above the engine's tested one builds with a warning: the game owns that API's behaviour changes, so test it on a device running it. A release build below Play's minimum fails before cooking. `build-report.json` `sdk` shows each effective value and whether it came from the engine or the project.
- **32-bit Android phones are opt-in**: `"android": { "armv7": true }` in `project.gameengine.json` adds `armeabi-v7a` next to `arm64-v8a` in every build, so one release AAB serves both and Play gives each phone its own. The size budget's `artifact` is checked per ABI (`artifact (armeabi-v7a)` in the report), so the second ABI does not count against the first. The 32-bit player runs Hermes, not V8 (as iOS does), so keep game tests green with `gameengine test --js both`; an installed editor's Android player carries the 32-bit build, and a release build fails rather than leave it out when the player has none; from an engine checkout the first such build compiles Hermes for Android once (CMake and Ninja). `localeCompare` and locale-aware upper/lower case are locale-free there.
- **R8 is opt-in**: `"android": { "minify": true }` in `project.gameengine.json` runs R8 on release and probe builds, which removes unused Java and Kotlin code and renames the rest. R8 only sees Java and Kotlin callers, so code reached by reflection or native code needs keep rules: the engine ships its own, and each plugin adds its with `android.proguard`. A missing rule breaks at run time, not in the build, so smoke-test a minified probe or release build on a phone after turning it on or adding a plugin. Stack traces from the Java side are then renamed: Play reads the mapping file from the bundle; other crash reporters need `mapping.txt` (in the Gradle project's `app/build/outputs/mapping/`) uploaded.
- **Google Play's rules are checked locally**: an Android release build reads its `.aab` back and fails, with the reasons in the report's `play.problems` and `--upload` skipped, when Play would reject it: targetSdk below 36 (read from the packaged base manifest), a native library (yours, a plugin's or a vendor SDK's) not 16 KB aligned, or a base module over 500 MB per device (move content to on-demand bundles). Every upload needs a higher versionCode: pass `--version-code <build number>` (to `--stage project` on a build server). The `artifact` size budget counts the bundle without its native symbol tables, which Play keeps for crash reports and no player downloads.
- **The minimum iOS is the game's**: the engine builds for iOS 16 unless `project.gameengine.json` sets `"ios": { "deploymentTarget": "17.0" }` (a quoted `major.minor`; 16.0 is the floor). Raise it when the game needs a newer iOS API; it drops older iPhones from the store. The app and libgameengine get the same value. `build-report.json` `deploymentTarget` shows the effective value and whether it came from the engine or the project.
- **The iOS simulator run from Xcode aborts before the first frame** with ``failed assertion `Depth Clip Mode is not supported on this device'`` (the app logs `gameengine: Metal API validation is on in the simulator…` just before). It is a known Dawn bug (https://issues.chromium.org/issues/457771794, fix in review at https://dawn-review.googlesource.com/c/dawn/+/306675): Dawn's Metal backend makes a call the simulator's GPU lacks, and the Metal API validation Xcode turns on for ⌘R catches it. Real iPhones are not affected, nor is a simulator run outside Xcode: `gameengine build ios --simulator`, then `gameengine device install --platform ios` and `gameengine device run --platform ios` on a booted simulator. When a session needs Xcode (local StoreKit testing, debugging plugin Swift code), turn off Edit Scheme > Run > Diagnostics > Metal API Validation, tell the user you did, and check it again after each `gameengine build ios`: the build deletes a shared scheme (Manage Schemes > Shared), while Xcode's own per-user scheme keeps the setting. Dawn's own validation still runs in dev builds. Leave Metal API validation on for real iPhones.
- **iOS permission texts in other languages** (the ATT prompt, camera, notifications: Info.plist texts): plugins ship them as `<lang>.lproj/InfoPlist.strings`, and `gameengine build ios` merges every enabled plugin's into one file per language. To say something other than a package says (say app-tracking's ATT text, written for a game without ads, in a game with ads), put `ios/<lang>.lproj/InfoPlist.strings` at the project root with only the keys you change, one file per language you change (`"NSUserTrackingUsageDescription" = "…";`). Yours wins for that key and language; the package's other keys and languages stay. The build logs each key it replaced (`InfoPlist.strings: the game's ios/ replaces …`) and lists them in `build-report.json` `infoPlistStrings.overrides` (a build through a Mac agent only logs them): check it after a package update. Spell each language as the package does (`pt-BR.lproj`, not `pt-br.lproj`): two spellings fail the build. A language only you give ships too. Two plugins giving one key in one language fail the build, naming both: give the key yourself to settle it. `ios/` holds nothing else (native code goes in `plugins/<id>/ios/`, skill `platform-services`); Android strings are not covered.

## What a build ships

- Device builds ship minified code with `DEV` false: put debug-only presentation code (overlays, extra logs) under `if (DEV)` with `import { DEV } from '@gameengine/runtime'` and it is removed. Never let sim state depend on `DEV`.
- Cheats (`src/**/*.cheats.ts`, skill `cheats`) ship in dev and probe builds and are left out of release builds unless you pass `--cheats` or set `"cheats": { "release": true }`; `--report` says `cheats: included`. Nothing may import a `*.cheats.ts` file: a release build that reaches one fails.
- `validate` (and so `check` and every build) fails with `E_PLUGIN` when code uses a service no enabled plugin implements; `haptics`, `keyboard` and `net` are built in; `push`, `system`, `cloudsave` and project services need their plugin in `plugins` (skill `platform-services`).
- Cooked builds ship scenes and prefabs only from under `assets/` (and the legacy `scenes/`/`prefabs/`), by their exact path; the engine refuses other document paths in dev too, and `gameengine check` boots the cooked game before you build. Dev and probe builds draw the latest error as a red banner over the game (release builds only log it): a device stuck on a loading cover shows why.
- Never import `@gameengine/test`, the engine's `examples/services/*` (copy those into the project) or anything from `tests/`, `tools/`, `editor/` or `playable-ads/` in game code: the cook fails. Built-in packages a game switches on (`project.gameengine.json` `packages`) and npm packages ship their code, never their `editor/`, `tools/`, `dev/` or `tests/`.
- `project.gameengine.json`, `input.json`, `pipelines.json` and `services.gen.json` ship to the device as they are: never put secrets there (SDK keys are `"env:NAME"`; store builds drop `services.mocks`). Only files a bundle's `include` matches ship (samples use `"**"`): the cook warns about the rest, and `--report` lists them as "files no bundle includes" next to files nothing names. A bundle's `exclude` globs keep files out on purpose (source art kept for baking): no warning, listed as "files bundles exclude". Smaller textures: `compression = "astc6x6"` in a texture's `.gmeta` (skill `asset-memory`); sounds: skill `audio` (its pre-ship checklist).

## App icons and launch screen (`branding`)

`branding` in `project.gameengine.json` (editor: Build ▸ App Icons & Launch Screen…):

```json
"branding": {
  "icons": { "active": "default", "sets": {
    "default": { "source": "branding/icon.png",
                 "ios": { "dark": "branding/icon-dark.png" },
                 "android": { "foreground": "branding/icon-fg.png", "background": "#1a0f2e" } } } },
  "launch": { "image": "branding/launch.png", "background": "#1a0f2e", "fit": "cover" }
}
```

- Without `branding` the build has no app icon, and nothing warns: Android and iOS fall back to the platform's placeholder icon. Set at least `icons` with one `source` before a QA or store build.
- `source`: square PNG ≥ 1024 px, full bleed, no transparency (iOS flattens it onto black). Android `foreground`: ≥ 432 px on transparency, art inside the centred 66/108.
- Set ids are lower case (`[a-z][a-z0-9_]*`); non-active sets ship as alternate icons.
- `gameengine build <platform> --dry-run --json` checks the images (errors stop the build) and writes the files; look at `storeIcons` in the report and `<project>/.gameengine/build/<platform>/<config>/store/` for the listing icons.
- iOS keeps the launch screen up until the game's first frame is on screen, and that frame waits (at most 2 s) until the first screen's art and glyphs have loaded, so a cold start goes from the launch screen straight to a complete screen. Show `launch.image` in that first screen (a boot view, `loading.boot`) and the hand-off is seamless.
- Android 12+ splash is a centred icon on `launch.background`; the full `launch.image` is the engine's first frame, drawn as it loads. The file ships to devices: paths only, never secrets.
