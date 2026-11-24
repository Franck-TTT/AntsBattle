# The plugin manifest: every field

Info.plist texts in other languages go in the plugin as `ios/<lang>.lproj/InfoPlist.strings`
(`"NSUserTrackingUsageDescription" = "…";`, the English one stays in `info`). The iOS build merges
every enabled plugin's into one file per language; two plugins giving one key in one language fail
the build unless the game gives it in its own `ios/<lang>.lproj/InfoPlist.strings`, which wins over
every plugin's (skill `ship-mobile`).

Android SDKs that ship a Gradle plugin and a config file (crash reporters, some attribution SDKs)
also take, in `android`:

```json
"gradlePlugins": [{ "id": "com.acme.crash.gradle", "version": "1.2.0" }],
"gradle": ["acmeCrash {", "    failBuildOnUploadErrors.set(false)", "}"],
"files": { "src/main/acme-crash-config.json": "config/acme-crash-config.json" }
```

`gradlePlugins` are declared at their version and applied in the app module; `gradle` lines go at
the end of the app's `build.gradle.kts`; `files` copies a file from the plugin directory (not from
`android/`, which is Kotlin source) into the app module, under `src/` but not in the engine's
`src/main/assets/gameengine/` or `src/main/java/dev/gameengine/`. In these three a placeholder with
no value and no `|default` fails the build; values are escaped for Kotlin strings, JSON and Android
XML resources. Placeholders are filled only in text files (`.json .xml .properties .txt .kt .kts
.pro .cfg`); images, `.so` files and the like are copied byte for byte. Don't list the Android or
Kotlin Gradle plugins: the template applies them. Google Play rejects native libraries whose LOAD
segments are not 16 KB aligned: every `.so` a plugin copies or its vendor SDK brings must be linked
with `-z max-page-size=16384` (pick an SDK version that supports 16 KB pages), and
`gameengine build android --config release` fails, naming the library in `play.problems`, when one
is not. An SDK that must start before the activity starts from a ContentProvider line in `application`
(`android:initOrder`), as the engine's push plugin starts Firebase.

A Gradle plugin that instruments its SDK with a file one of its own tasks writes (Embrace's native
symbol map) needs that file before Gradle configures the build. List its name (no `:app:` path) in
`"gradlePrepareTasks": ["encodeSharedObjectFiles{variant}"]`: `gameengine build` runs it in a Gradle
pass of its own first (`{variant}` is `Debug`, `Probe` or `Release`); a task the Gradle plugin did not
register for the build (an upload with no token) is skipped.

On iOS, `"buildPhases": [{ "name": "Upload dSYMs", "script": "…", "inputFiles": ["${DWARF_DSYM_FOLDER_PATH}/${DWARF_DSYM_FILE_NAME}"] }]`
runs scripts after the build, on every build (a crash reporter's symbol upload). Placeholders in
`script` must have a value or a default, and each becomes one single-quoted shell word: write
`--app {{services.reporter.appId}}`, not `--app "{{services.reporter.appId}}"`; read tokens from the build environment (`$REPORTER_TOKEN`), never write them
into `plugin.json` or `services`.

`"linkerFlags": ["-ObjC"]` adds flags to the app's `OTHER_LDFLAGS`, one self-contained flag per entry (a flag
with an argument takes the `-Wl,` form: `-Wl,-weak_framework,Foo`). Use it when an
SDK's setup guide asks for a linker flag: a static SDK that finds its own classes by name (Firebase
Analytics' IDFA support) needs `-ObjC`, or the linker drops those classes and the SDK silently does less.

`"xcframeworks": ["libs/AcmeSDK.xcframework"]` links an SDK that comes only as a prebuilt
XCFramework (a private fork Swift Package Manager cannot fetch; use `packages` when a Swift package
exists). Keep it in the plugin directory beside `ios/`, never inside it. It needs an iOS device slice
and an iOS simulator slice, and no symbolic link: npm pack drops links, so strip macOS slices. The
build reads static or dynamic from its binaries and embeds and signs a dynamic one; you declare
nothing. Two plugins shipping one framework (`AcmeSDK.framework`) fail the build. The framework must
import as built: the engine adds no Swift include path, so a Swift interface that imports a Clang
module kept in the framework's `Headers/` fails at `import`. A static framework's resources never
reach the app on their own: list its resource bundle in `"bundles": ["libs/AcmeSDK_AcmeSDK.bundle"]`
(same rules: beside `ios/`, no symbolic link), and the app carries it whole at its root, where
`Bundle.module` looks. A package using either key raises its `gameengine.engine` minimum to the engine
release that added them: an older engine ignores them, and `import AcmeSDK` fails to compile or the
SDK finds no resources. On Android the same SDK's `.aar` goes in `files`
(`"src/acme/acme.aar": "libs/acme.aar"`) with a `gradle` line
`dependencies { implementation(files("src/acme/acme.aar")) }`.

`"files"` (Android and iOS) can also copy **the game's own file** into the app: a source that is one
setting, `"{{services.firebase.configFile}}"`, copies the file that setting names, relative to the
project, untouched. That is how a vendor's per-build config file (Firebase's `google-services.json` and
`GoogleService-Info.plist`) reaches the app: the game keeps one file per build type and sets the path
per build type (`{ "ios": "env:FIREBASE_IOS_CONFIG", "android": "env:FIREBASE_ANDROID_CONFIG" }`).
The path must stay inside the project; a missing setting or file fails the build. On Android the
destination may also be a `.json` file beside the app's `build.gradle.kts` (`"google-services.json"`,
where Google's Gradle plugin reads it). On iOS, `"files": { "GoogleService-Info.plist": … }` names a
file at the app bundle's root; plugin files there are copied untouched too (no placeholders).
