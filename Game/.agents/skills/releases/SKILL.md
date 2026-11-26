---
name: releases
version: 1.2.0
tier: required
description: Over-the-air releases and hubs — gameengine release pack/apply, releases.manifest, releases.trusted, channels, release and content keys, the content manifest, services.releases (check, download, apply) and services.launcher for a hub that launches other games. Use when updating a shipped game without a store build, or building a hub app.
---

# Over-the-air releases and hubs

## The rules that matter most

1. **A release carries script, settings and content, never machine code.** Rust systems (`native/`) ship in a store build and keep running from the binary; transpiled systems run their TypeScript when a release changed them. Only the game's own app applies a release of a game with `native/` (`E_NATIVE`). A store update retires installed releases.
2. **A release key and a content key, never the same one.** The **release key** (`releases.trusted[].publicKey`) signs code. The **content key** (`contentKey`, the content team's) signs releases that keep a code the device already trusts, so it cannot ship code (content bundles holding scripts or settings are refused). Keep both out of the repo. Whether each game has its own release key or one studio key signs them all is the studio's decision (§ Keys).
3. **The version only grows** (use the build number), and a device refuses a manifest older than the one it keeps.
4. **A content release reaches only devices already on its code.** Release code changes with the release key, and make content releases `--content-of` the release that shipped that code (or the store build's `shipped/`).
5. **Upload the manifest last**, after the files it names.

## Commands

| Goal | Command |
|---|---|
| Update over the air (script, settings, content) | `gameengine release pack --version N --key release-key.json`; the game's own `name` must be in `releases.trusted` (`gameengine release keygen` makes a key pair and prints the entry), `release apply <dir> --dir <releases dir>` tests it on desktop |
| A content release on shipped code | `gameengine release pack --version N --key content-key.json --content-of <dir>` (a release directory, or a store build's `shipped/` beside its report: keep it) |
| Publish a release | Upload the release's `files/` as it is (names change only with their bytes: skip what the CDN has), its `content-manifest-<platform>-<abi>.json` last; `--files-url https://…` when the manifest is served from elsewhere than its files |
| Cook only the bundles the CDN lacks | `gameengine cook --plan --json` lists each bundle's published name; `gameengine release pack … --only <missing names> --previous <folder of the present bundles' records>` (`<name>.json` beside each `.gpak`) |

On a phone the manifest and its files are served over https (iOS lets plain http reach only the device itself, `127.0.0.1`, which the iOS simulator shares with the Mac; Android's shell allows none), and the release is packed for that platform (`release pack --platform ios|android`).

## Keys

How keys are split is the studio's decision; the engine checks only that a release's signature matches a public key the app trusts for it (the game's own entry, or `"*"` in a hub). Either:

- **A key per game:** run `gameengine release keygen` for each game. A leaked key exposes one game.
- **One studio key for every game:** run `gameengine release keygen` once, keep the private key in the studio's secret store, and add `{ "id": "<game name>", "publicKey": … }` to each game's `releases.trusted` (and `"*"` in a hub). A new game needs no new key; a leaked key exposes every game that trusts it.

Either way the content key stays a separate key, and a lost key means no more releases until a store update ships a new public key.

## A game's own updates

- **They need no code:** set `releases.manifest.url` and list the game's id in `releases.trusted`. After start and on return to the foreground the engine checks the manifest for this app's release channel, downloads what it offers and applies it (live when only content changed, else at the next start), and logs `self-update: …`. A release staged for the next start is not fetched again; loose desktop runs and web players skip the engine's update.
- **Channels:** `{channel}` in the URL is the app's channel, any name you choose (`inhouse`, `store`, `beta`, a branch): `releases.channel` in `project.gameengine.json`, or `gameengine build --channel <name>` for one build (`releases.status` reports it). Testers or a branch get a release before players do: publish each channel's manifest at its own URL, e.g. `https://cdn/…/{id}/{channel}/content-manifest-{platform}-{abi}.json`. `release pack --channel <name>` picks the channel its files and manifest are for (unset: `releases.channel`). A missing manifest (404, or 403 from a bucket that does not list) means nothing is published yet; an unknown `{…}` in the URL fails the config.
- **Cheats:** a release keeps the cheat console only for a channel `releases.cheatChannels` lists, e.g. `["qa", "qa-*"]` (a trailing `*` matches a prefix); every other channel's releases strip them. List only channels whose apps never reach a store.
- **Deprecated:** `{buildType}`, `--build-type` and a project with no `releases.channel` (the bundle id then decides: `inhouse` for `.inhouse`, else `store`) warn `W_DEPRECATED_BUILD_TYPE`, and `gameengine check` reports it: do what the warning says.
- **The content manifest:** `release pack` writes `files/content-manifest-<platform>-<abi>.json`: one release, its files by published name, size and SHA-256, signed with the release or the content key. `releases.manifest` in `project.gameengine.json` has `url` (a template with `{id}`, `{channel}`, `{platform}` and `{abi}`) and `refresh` (`onStart`, `onForeground`, `minIntervalSec`, default 900; `retrySec`, default 60, after a failed fetch). Without it, fetch the manifest yourself (e.g. from your studio's asset service) and pass its text to `check({ manifest })`.
- **From the game (`services.releases`, UI code only):**
  - `check({ manifest? })` checks the game's content manifest, passed in or from `releases.manifest.url`, for a release this device can apply (`{ latest, available?: { version, live, bytes } }`; sends `available` once per version). One check per game runs at a time: calls meanwhile share its answer.
  - `download({ id })` fetches the files of the release it offers that the device lacks (or any release directory by `url`) and keeps it.
  - `apply()` applies your own update (live when only content changed, else at the next start, `now: true` for a new session behind a cover).
  - `status({ id })` says what the device keeps.
- Content releases of data and art, with an example: skill `content-database`. Testing a release: `tests/releases/<name>/` (skill `testing`).

## A hub (an app that launches other games)

Samples: `game-hub` and `hub-test-game` in the engine repo.

- **Trust:** list each game in `releases.trusted` with its public key, or one studio key as `{ "id": "*", "publicKey": … }` that signs every game the hub launches (the hub then finds its games at runtime in a list of its own; a studio key never turns the hub's own updates on). A game's own project lists its key in `releases.trusted`, which also gives that game's own app a release store.
- **Manifests:** point `releases.manifest.url` at the games' content manifests (`{id}` is the game's id, `{channel}` the game's channel: `releases.channels`, else the app's) or pass each game's manifest to `check({ id, manifest })`.
- **Launching:** on Play, `releases.check({ id, force: true })`, `releases.download({ id })` when it offers one, then `services.launcher.launch({ id, data })`. `data` is optional JSON of at most 64 KB the hub defines, e.g. `{ level: 7 }`, which the game reads with `services.launcher.status()` → `{ launched, by, data }` and starts from: the hub then owns which level a game plays. A kept copy launches when nothing is newer or the check or a download fails.
- **Several downloads at once** (a feed the player swipes through): pause those the player moved away from with `releases.pause({ id })`. That `download` fails with `E_PAUSED` (no error to show), keeps what it fetched, a part of a big bundle included, and the next `releases.download({ id })` goes on from there.
- **While the game runs** the hub's session waits, suspended, under the game's (its state, views and memory stay; save anyway, a phone may end the app). Its own downloads and sockets keep going and report when it runs again.
- **Handing back:** the game ends with `services.launcher.exit({ result })` (64 KB of JSON at most); the hub resumes where it was and gets `services.launcher.on('exited', ({ id, result, reason }) => …)` (`reason`: `exit`, `error` or `quit`). The hub is not restarted, so its `exited` handler clears what it set up to launch (a busy flag, a cover, a status line). A game's `app.quit()` hands back to the hub, on iOS too.
- **Asking the hub mid-level:** the game calls `services.launcher.ask({ message })` with JSON the hub defines (e.g. `{ type: 'booster', booster: 'hint' }`). The game pauses after that frame, the hub runs over its last frame with `launcher.on('asked', ({ ask, id, message }) => …)` and answers with `services.launcher.answer({ ask, reply })`, and the game's `ask` resolves with `{ reply }`. Turn a reply into sim input with `emit` (never act on it in the sim directly); one question at a time (`E_BUSY`); the hub launches nothing while one is open.
- **What a launched game cannot do:** download, apply or launch; `net.downloadFile` writes only into its own data folder. It draws on the hub's device, so the hub's `render.android.drawIntoWindow` decides (skill `device-tiers`).
- **A result screen over the game that just ended:** draw `<Sprite src={RELEASES_LAST_FRAME} />` (from `@gameengine/runtime`, sized explicitly, e.g. to fill the screen): the frame the game handed back on, kept until the next launch, an app update applied now or a lost GPU device; before any hand back it draws nothing. `releases.launchFadeMs` (0–5000, default 0) fades the hub's last frame out over the game's first frames instead of cutting.
- **Purchases and ads:** finish them before `launcher.exit` (and a hub before `launcher.answer`): a store event that arrives after the switch reaches the hub.
- **One game from another channel:** `releases.channels` maps a game id to its channel (`{ "PuzzleGame": "feat-hint-booster" }`), or `gameengine build --channel-for <id>=<name>` sets it for one build. That game's manifest URL, signed channel and `release fetch --channel-for` use it; every other game and the hub's own updates stay on `releases.channel`. A code release of the hub replaces its shipped config, map included: pack it with the same `--channel-for` as the build its devices run (`release pack --channel-for`), or those games go back to the hub's channel after the update. A content release (`--content-of`) keeps the map.
- **Where it runs:** on phones, in the desktop player, in the editor's Play (hot reload waits until the game hands back) and in `gameengine run --headless`.
- **Store review:** a release build of a hub stops with `E_POLICY` until the App Store and Play review of what the hub downloads is done; then build with `--store-policy-reviewed`.
- **Tests:** game tests mock the hub with `ctx.services.mock('launcher.ask', { result: { reply } })`; hub tests play a question with `ctx.services.emit('launcher', 'asked', { ask, id, message })`.
