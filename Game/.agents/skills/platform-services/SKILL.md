---
name: platform-services
version: 1.27.0
tier: optional
description: Third-party SDKs and backends as project services (analytics, consent, ad networks, login; in-app purchases come from a package) — services/*.schema.ts, mocks, plugin manifests, Kotlin and Swift sources, replay-safe rules. Use when adding, changing or testing any SDK, store, ad network or server call from native code.
---

# Platform services: integrate an SDK as a project service

The engine ships the **plumbing** (schema checks, routing, mocks, replay suppression, the
MessagePack bridge to Swift/Kotlin) and the platform basics.
Analytics, consent and every other SDK or backend are **your project's services**. Working
integrations to copy: `examples/services/{analytics,consent}` in the engine repo;
`samples/gem-cascade` uses both. In-app purchases are not an example to copy: they come from the
engine's in-app purchase package, installed with `gameengine package add` (skill `packages`). Before writing one, check whether a package already provides
the SDK: a game switches a package on rather than copying it, and the package's own skill says how
(skill `packages`): `gameengine package on <name>` brings its plugin with it, and
`gameengine package settings <name>` lists the ids it asks for.

## The rules that matter most

1. **Call services from UI and other non-sim code only.** A call from a sim system throws: its
   outcome would not be in the replay.
2. **Outcomes enter the game as recorded sim events or meta actions**, never by writing state in
   a promise callback: `emit(PurchaseDelivered, { transactionId, moves })` from UI, handled by a
   sim system. Replays and tests then reproduce the game without the SDK.
3. **Grants are idempotent.** Stores, ad callbacks and backends redeliver. Key every grant by
   the provider's id (transaction id, order id, reward id) in a **meta action that refuses an id it
   has already recorded** (`@gameengine/meta`, skill `meta-economy`), dispatched from the sim
   system that handles the event. Save that state before you acknowledge (`finish`) the
   transaction, and replay the saved ids into it at launch before you listen for redeliveries.
   The in-app purchase package's skill shows it for store orders.
4. **Consent before tracking.** Ask (`services.consent.request({ tracking: true })`, from
   `examples/services/consent`) before starting any ad, attribution or analytics SDK that collects
   identifiers.
5. **Test with mocks.** Every method has one; script cancels, failures, redeliveries and events:

   ```ts
   ctx.services.mock('store.buy', { error: 'E_CANCELLED: user cancelled' });
   ctx.services.emit('store', 'orderUpdated', { order: 'o-1', state: 'paid' });
   expect(ctx.services.calls('store.buy')[0]!.params).toEqual({ sku: 'gems_100' });
   ```

   Test that a redelivered id grants once, and that a saved and reloaded state still refuses it.
   A build without the plugin is `ctx.services.mock('store.*', { error: 'E_UNAVAILABLE: no store plugin in this build' })`:
   test that the game plays on.
6. **Replays never touch a store.** During replay playback and verification every call goes to
   the mock; the replay holds the recorded event, not the SDK's answer.

## Which services need a plugin in `plugins`

A service works on a phone only when a plugin implementing it is in the build. Without one, every
call answers `E_UNAVAILABLE`; mocks answer in the editor, so nothing looks wrong until a device.

| Service | On a device |
|---|---|
| `haptics`, `keyboard`, `net` | built in, always there |
| `storage`, `bundles`, `releases` | answered by the engine (`releases`: updates and launching other games, skill `releases`) |
| `devCapture` | answered by the engine in builds with cheats and the debug protocol (QA screenshots, skill `cheats`); `E_UNAVAILABLE` in store builds |
| `push`, `system`, `cloudSave` | only with `"plugins": ["push"]`, `["system"]`, `["cloudsave"]` |
| your own (`services/*.schema.ts`) | only with the plugin that lists it in `services` |

`gameengine check` / `validate` fail with `E_PLUGIN` when `src/` uses one without its plugin, and
`gameengine test` makes such calls answer `E_UNAVAILABLE` as the device would. Dev builds log the
first `E_UNAVAILABLE` of each method (logcat / the console). A game that swallows a rejection
(`.catch(() => undefined)`) relies on this check to learn that a call does nothing on a device.

The `system` plugin carries the store prompts: `services.system.requestReview()` (Play In-App
Review, StoreKit), and on Android `checkForUpdate()` → `{ available, stalenessDays?, priority? }`
and `startUpdate()` → `{ started }`, Play's immediate in-app update (an interrupted one reports
`available` again, so `startUpdate` resumes it). iOS has no update API and answers `E_UNAVAILABLE`.
Call them from UI code; mocks answer `{ available: false }` so tests never show an update prompt.

Development tools that write files (exporters, capture tools) can show the result with
`services.system.revealPath({ path })`, like Unity's `EditorUtility.RevealInFinder`: a folder opens
in the file manager, a file is selected in its folder, nothing is opened or run. A relative path is
read from the project folder. Only editor Play and `gameengine run` reveal; tests, headless runs,
cooked builds, the web and phones answer `{ ok: false, error }`, and so does a missing path. It
reveals at most once a second (`E_BUSY` sooner): reveal the folder once after writing many files,
not each file. Show the error instead of assuming the window opened. Release desktop players reject with `E_UNAVAILABLE`.

Haptics (named entries tuned per platform in `haptics.json`, the Android Vibrator vs view mode,
the player's switch) are covered by skill `haptics`.

## The pieces

```
<project>/
  services/store.schema.ts          the service: methods, params/results, events, a mock per method
  plugins/store-acme/plugin.json    what the build adds (Gradle deps, SPM packages, plist keys, …)
  plugins/store-acme/android/*.kt   class StoreAcmePlugin : GameEnginePlugin, StoreService
  plugins/store-acme/ios/*.swift    final class StoreAcmePlugin: GameEnginePlugin, StoreService
  project.gameengine.json           "plugins": ["store-acme"], "services": { "store": { … } }  (without it: E_UNAVAILABLE)
  src/services.gen.ts               generated: `services` = engine services + yours, typed
  services.gen.json                 generated: your catalog, loaded by the engine (dev and devices)
```

**1. Schema** (`services/<name>.schema.ts`, same format as the engine's):

```ts
import { p, service } from '@gameengine/schema';

export const store = service('store', {
  description: 'Acme store SDK.',
  methods: {
    buy: {
      params: { sku: p.str() },
      result: { order: p.str('Order id: the idempotency key'), state: p.oneOf(['paid', 'pending']) },
      description: 'Starts a purchase. Cancel is `E_CANCELLED`.',
      mock: { delayFrames: 2, result: { order: 'mock-{{call}}', state: 'paid' } },
    },
  },
  events: { orderUpdated: { params: { order: p.str(), state: p.str() }, description: 'Redelivered at launch until acknowledged.' } },
});
```

Names must not clash with engine services. Every method needs a `mock` (a result or an
`E_CODE: message` error, `delayFrames`, `events`; `{{call}}` and `{{param.x}}` fill ids and echo
params). Then `gameengine gen` writes `src/services.gen.ts` and `services.gen.json`; game code
does `import { services } from './services.gen.ts'` and calls `services.store.buy({ sku })`.

**2. Plugin manifest** (`plugins/<id>/plugin.json`, `id` = directory name):

```json
{
  "id": "store-acme",
  "services": ["store"],
  "android": {
    "class": "StoreAcmePlugin",
    "dependencies": ["com.acme:store-sdk:3.2.1"],
    "permissions": ["com.google.android.gms.permission.AD_ID"],
    "application": ["<meta-data android:name=\"com.acme.APP_ID\" android:value=\"{{services.store.appId}}\" />"]
  },
  "ios": {
    "class": "StoreAcmePlugin",
    "frameworks": ["StoreKit"],
    "packages": [{ "name": "AcmeStore", "url": "https://github.com/acme/store-ios", "version": "3.2.1", "product": "AcmeStore" }],
    "info": { "AcmeAppId": "{{services.store.appId}}", "NSUserTrackingUsageDescription": "{{services.store.why|Used for offers.}}" },
    "entitlements": {},
    "backgroundModes": []
  }
}
```

`services` lists what the plugin implements (default: its id); `gameengine validate` checks code
against it. Pin exact versions. `{{services.<path>}}` reads `project.gameengine.json` `services`; a setting
written as `{ "ios": …, "android": … }` resolves per platform (and each app ships only its own
platform's entry); a line or key whose placeholder has no value and no `|default` is left out. A plugin may have only one platform section.

More manifest fields (Info.plist texts per language, `gradlePlugins`, `gradlePrepareTasks`, `proguard`, iOS `buildPhases`, `linkerFlags`, `xcframeworks`, `files`): `references/manifest.md`.

**3. Native sources.** Implement the generated interface (Kotlin `StoreService`, Swift protocol
`StoreService`; generated per build, with typed params/results) and register in `install`:

```kotlin
class StoreAcmePlugin : GameEnginePlugin, StoreService {
    private lateinit var services: GameEngineServices
    override fun install(services: GameEngineServices, context: GameEnginePluginContext) {
        this.services = services
        services.store = this
        val appId = context.setting<String>("store", "appId")
        sdk.verboseLogs = context.buildConfig != "release" // "dev", "probe" or "release"
    }
    override fun buy(params: StoreBuyParams, reply: GameEngineReply<StoreBuyResult>) { /* SDK call */ reply.ok(StoreBuyResult(order, "paid")) }
}
```

`context.buildConfig` (Swift `context.buildConfig`) is the build's config, so a plugin can turn an
SDK's verbose or test mode on in dev and probe builds and keep it off in release without a setting.
`context.cheats` says whether the build carries cheats: dev and probe always, a release only with
`--cheats` or `cheats.release`. Gate a test feature a cheat calls, such as a test crash, on
`context.cheats`, not on `buildConfig`: a release with cheats keeps it, one without them does not.
Answer every call once (`reply.ok` / `reply.fail("E_CANCELLED", "…")`), from any thread; raise
events with `services.emitStoreOrderUpdated(…)`. Plugins never touch the ECS.

**App lifecycle in a plugin** (Android Activity and iOS app-delegate callbacks, links, notifications): implement the lifecycle listener; `references/lifecycle.md`.

**4. Settings and keys** in `project.gameengine.json` `services.<name>`; secrets as `"env:NAME"`,
read from the build environment (left out with a warning in dev builds, an error in release).
Ids that differ per platform and build type (in-house vs store) are per-platform `env:` values,
`{ "ios": "env:ACME_ID_IOS", "android": "env:ACME_ID_ANDROID" }`, which the build server fills: a
build reads only its own entry (an `ios` or `android` key; other settings ship to both apps).
`{{placeholders}}` resolve the entry for you, but `context.setting` returns the object, so native
code reads its own key: Kotlin `(context.setting<Map<String, Any?>>("store", "appId"))?.get("android") as? String`,
Swift `(context.setting("store", "appId") as [String: Any]?)?["ios"] as? String`. Reading it as a
`String` crashes at launch on Android.
Mocks for the editor and tests: `services.mocks["store.buy"]`.

Keys a backend dashboard serves per environment live in config files an installed package
declares (`gameengine.configFiles` in its `package.json`, one package per game). A setting points
at a key with `"ref:<dot.path>"`:

```json
"services": { "acme": { "apiKey": "ref:plugins.acme.apiKey" } }
```

Play, `gameengine run` and `test` read development, a `release` build production and
`dev`/`probe` builds development; `--environment` on `run`, `test` and `build`, or
`GAMEENGINE_ENVIRONMENT`, picks another. The files never ship, and a `ref:` works in `services`
and a package's own block, not in engine settings such as `sim`. `gameengine validate` checks each
reference's value in every file.

**5. Enable** it: `"plugins": ["store-acme"]`. `gameengine build android|ios` copies the sources,
applies the manifest and generates a dispatcher that routes your services
(`--dry-run` assembles the native project without a toolchain: check it there).

## Crash reporters

When a package provides your crash reporter (`gameengine package list`), switch it on: its service,
plugin, error forwarding and symbol upload are done, and its own skill says the rest. Any other crash
reporting SDK (Sentry, Crashlytics, …) is a project service like the others. To
hand it the game's uncaught TypeScript errors too (a system or handler threw; the engine catches
it and keeps the game running), give the service a method that takes the error and name it in
`project.gameengine.json`:

```ts
reportException: {
  params: { id: p.str(), name: p.str(), message: p.str(), stack: p.str(), log: p.arr(p.str()), metadata: p.record(p.json()) },
  result: {},
  description: 'A game error: uncaught (sent by the engine) or caught and reported by the game.',
  mock: { result: {} },
},
```

```json
"crash": { "forward": "crashReporter.reportException" }
```

The engine calls it once per distinct message and stack, as soon as the error happens, wherever
the game runs (device builds, the desktop player; the editor and `gameengine test` call the
method's mock), at most 20 times a session and never during replay playback.
`name` is the error's class (`TypeError`, else `Error`), `stack` the V8/Hermes `at …` lines, `log`
the last 100 engine log lines, `metadata` strings (release, engine version, bundle hash, JS
engine); `id` is unique per error. The engine writes and uploads nothing for it: send it on as a
non-fatal.
In dev and probe phone builds the `stack` lines already name your TypeScript and the engine's
(`at fn (src/board.ts:12:5)`, `<engine>/packages/…`). Errors the game catches and reports itself
get the same through `gameengine.crash.describeStack(error.stack)` (presentation code only), which
also returns the `bundleHash`. Release stacks stay minified: map one with
`gameengine stack symbolicate <stack.txt> --symbols <build out>/symbols`, the source maps every
phone build keeps under its bundle hash (a build server publishes them as `symbols` artifacts).
Native Rust frames, the engine's and your native systems', carry file and line through the
reporter's own symbol upload (Gradle plugin, dSYM).
`gameengine validate` checks that the method exists, that its plugin is in `plugins` and that its
params take the report, field by field.

The engine captures no native crashes itself: turn the SDK's own native capture on (its NDK or
signal handler). Check it on a device build with cheats through the engine cheat `engine.crash`
(`kind=segfault|abort|panic`, skill `cheats`). On Android an engine panic that ends the process is
the abort message (the tombstone's `Abort message:` line); a handler of your own can read it from
the `[anon:abort message]` mapping.

## Analytics

Report moments with signals (skill `signals`) and forward them with
`examples/services/analytics/src/forwardSignals.ts`; do not call analytics at every emit site.

## Check

- `gameengine gen` then `gameengine check` (includes the plugin check) and `gameengine test --js both` (both JS engines).
- `gameengine build android --dry-run` and `build ios --dry-run`: the assembled project under
  `.gameengine/build/<platform>/dev` has your plugin, its dependencies and plist/manifest entries.
- Real SDKs are verified on devices (sandbox/test accounts, test ads).
