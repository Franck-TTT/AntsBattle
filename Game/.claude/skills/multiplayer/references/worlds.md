# Always-open worlds instead of fixed matches

For a continuously available world, use `multiplayer.world`. This runs the cooked game in the real authoritative server export, without a separate Node simulation:

```json
"multiplayer": {
  "authority": "server",
  "world": { "inputEvent": "WorldInput", "document": "SharedState", "sendEvery": 6 }
}
```

Declare `WorldInput` as an empty `sim: true` event and `SharedState` with `defineDoc`. Import `WorldInputFrame` from the runtime and consume `ctx.inputData<WorldInputFrame>(WorldInput)` in the server's sim system. Each frame envelope contains ordered events: `{kind:'start'}`, `{kind:'join',player,name}`, `{kind:'input',player,data}`, or `{kind:'leave',player}`. `player` is a server-assigned 32-bit identity; validate `data` as player intent, never accept client-provided authority or another actor id. The start event initializes the world. Update the document from sim with `ctx.rng`/`ctx.dt`, not time or presentation. The initial step must create the configured document.

In presentation, `await multiplayer.world.connect({server: 'wss://host/game/socket', name})` returns a connection. `send(data)` sends intent. `subscribe(handler)` delivers `{kind:'welcome',player,version}`, `{kind:'snapshot',tick,document}`, `{kind:'error',error}`, and `{kind:'closed',reason}`. Validate the document and feed it to a local sim consumer using `emitInputData` on a separate empty marker. `poll()` is an alternative to subscription. Close the connection on view/session disposal. Implement reconnect and alias UI in the game; the connection supplies heartbeat replies. Rejoining obtains an available identity, so reset connection-local input and presentation state.

Build web and `build server --target linux-x64 --authority server` from matching source/engine/config. The engine enforces game/build identity. Use the public WSS URL; no game-owned wire protocol or Node gameplay server is needed. The Linux export includes its cooked `game/` and the WebGPU wrapper; from macOS or Windows it packages the release's published Linux server. `--dry-run` is not runnable.

A world starts immediately, accepts late joins, reuses disconnected identities and waits while empty without resetting. It ignores fixed-match `players`; actual capacity remains bounded by resources and operator connection guards. A process restart resets it. One changed full document is sent at most every `sendEvery` fixed steps, with fresh state for new joins and pacing for slow sockets. Input is limited to 4 KiB and full state to 256 KiB. Oversize state or sim failure stops the server explicitly for supervisor restart. This mode has no interest filtering, client prediction, accounts, database or multiple-world sharding. Fixed matches continue to use `multiplayer.join` and `PlayerInputs` below.

In a browser, a hidden page runs no frames; the web player keeps a world connection alive by itself meanwhile (it answers pings and keeps only the newest snapshot, which `subscribe` delivers on resume), so switching windows is not a departure. A frozen or discarded page still disconnects; treat that as a leave.

An authoritative server accepts only clients of its exact build (`<version>-<script hash>`); a browser build and a server build of one commit can still differ (a build step's define, one machine transpiling and the other not). Build the server from the browser build's script and check the pair before shipping:

```bash
gameengine build web --config release --out build/web
gameengine build server --target linux-x64 --script-from build/web
gameengine mp identity build/web .gameengine/build/server/linux-x64   # ok, or what differs and why
```

A refused hello says `E_MISMATCH: this server runs <game> build <id> (client: <game> build <id>)`.

Test two actual compiled clients against the published cooked server; a healthy socket alone does not prove gameplay.
