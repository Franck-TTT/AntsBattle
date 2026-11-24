---
name: multiplayer
version: 1.17.0
tier: optional
description: Online multiplayer — fixed matches, open rooms (join while it runs), always-open worlds, authoritative or relay servers, web/native clients, rollback, turn and snapshot sync, matchmaking and LAN. Use for online play, persistent worlds, deploying servers, late join or reconnect.
---

# Multiplayer

One system for phones, PCs and browser builds, real-time and turn by turn. Players send only their **input**,
packed: buttons and a stick per frame (a few bytes, delta-coded), or one event per turn. A
**match server** is the clock: it confirms every player's input for every frame (or turn) and
sends the confirmed stream to everyone. Each device runs the whole game from that stream; real-time
games predict ahead and roll back when the confirmed input differs (skill `rollback-multiplayer`).

| | Relay server | Authoritative server |
|---|---|---|
| Runs game code | no | yes: steps every room from the cooked game |
| Truth | the clients' hashes (it compares them) | its own hash: a client that differs is told `desync` |
| Clients | any build | only the same build (`E_MISMATCH` otherwise) |
| Cost per room | bytes only | one sim step per frame per room |

Pick relay for casual and turn games with trusted clients; authoritative when a cheating client
must not be able to win (ranked play, economies).

## 1. Set it up

Add the block to `project.gameengine.json` (every field is optional; the scalars shown are the defaults, `buttons` and `stick` are empty by default):

```json
"multiplayer": {
  "server": "ws://127.0.0.1:7600",
  "mode": "realtime",
  "players": 2,
  "authority": "relay",
  "turnOrder": "roundRobin",
  "port": 7600,
  "window": 12,
  "buttons": { "dash": [{ "key": "Space" }, { "button": 0 }], "fire": [{ "key": "KeyJ" }, { "button": 1 }] },
  "stick": {
    "x": [{ "negative": "KeyA", "positive": "KeyD" }, { "axis": 0 }],
    "y": [{ "negative": "KeyS", "positive": "KeyW" }, { "axis": 1 }]
  }
}
```

- `mode`: `realtime` (frames at the game's rate, rollback) or `turns` (one event per turn). A
  match runs at `sim.dt`'s rate (30, 60 or 120 Hz); the server never mixes rates in a room
  (`E_FRAME_RATE`) and quick match pairs only players at one rate. Anything you write in frames
  (`window`, `interest.every`, `snapshot.interpolation`) is frames at that rate.
- `players`: 1–32, or 1–256 with `"sync": "snapshot"` (every peer steps every player in input
  sync, so above 32 use snapshot sync).
- `buttons` (≤ 32, in the order of your `defineButtons`) and `stick` map keys and gamepad 0 to the
  packed input, with the same bindings as `input.json` (`key`, `negative`/`positive` keys, gamepad
  `button` and `axis`). Touch controls add to it
  with `multiplayer.setInput(buttons, [x, y])`, OR-ed with the mapped keys.
- `window`: how many frames a real-time client may run ahead of what the server confirmed (a rollback
  keeps this many sim snapshots). A client needs about `rtt + margin` frames of it: past roughly
  130 ms round trip the default 12 stalls the sim (`status().windowStalls`).
- `pacing` (real-time; client scheduling only, the confirmed inputs and hashes do not change):
  `adaptive` (default true) takes the margin the client keeps between its inputs and the server's
  clock from measured jitter, between `minMarginMs` (33) and `maxMarginMs` (150);
  `maxWindow` (default 0) lets the window follow the round trip up to that many frames, so a slow link
  does not stall while a fast one keeps rollbacks shallow (costs `maxWindow + 2` snapshots, set it
  to 30–40 for a game played on mobile data, 0 for a LAN game); `inputDelay` (0–4, default the
  server's 1) is the frames between a local input and the frame it applies to: 0 applies it to the
  frame being simulated and the client then runs that much further ahead. `adaptive: false` gives a
  fixed margin and window. `status()` shows `marginMs`, `jitterMs`, `window`, `inputDelay`,
  `stalls` split in `windowStalls` and `pacingWaits`.

## 2. Join from presentation, read the match in sim

```ts
import { multiplayer } from '@gameengine/runtime';

// UI or a LateUpdate system: differs per device
multiplayer.join({ room: 'abc' });             // or {} for a quick match; seat: '<token>' to come back
for (const e of multiplayer.events()) {        // welcome, start, joined, left, desync, error, closed
  if (e.type === 'welcome') saveSeat(e.seat);
}
const s = multiplayer.status();                 // phase, player, rttMs, rollbacks, turnPlayer, …

// sim: the same on every device and the server
const m = multiplayer.match();                  // { players, mode, seed } or null outside a match
```

When the match starts the world is **rebuilt** from the scene and the RNG is seeded with the
match seed on every device, so all peers and the server start from the same state. During a
match the sim sees the project's reference resolution as `ViewInfo` (not the device's screen),
and device events (taps, keys, UI events) never reach the sim: only `PlayerInputs` (real-time)
or the turn events do. Layout and touch targets read the real screen in presentation as usual.
A mouse-look game reads the mouse with `multiplayer.pointer()` (`x`, `y`, `dx`/`dy` since the last
call, `buttons` bit 0 left, 1 middle, 2 right) in a LateUpdate system and sends the look through
`setInput`. `leave()` from a started match rebuilds the world on the next frame, so the game is
back in a fresh offline world, not the match's last state.

`join`, `leave`, `status`, `events`, `setInput`, `pointer`, `onSample`, `onPredict` and `submitTurn` throw
inside a sim system.

### Input latency and prediction (real-time)

- **Sample at the latest moment.** `setInput` from a LateUpdate system reaches the sim one step late
  (it runs after the frame's steps), plus `pacing.inputDelay`. `multiplayer.onSample(() => { … })`
  (module level, one function) is called by the engine before every match step, outside the sim: read
  `pointer()`, call `setInput`, and the mouse of this frame is in the frame about to be simulated.
  With `inputDelay: 0` that is zero frames from mouse to sim (two with LateUpdate and the default).
  The function has no `ctx`; keep what it needs (the look angles) in presentation state and show
  the same state in LateUpdate.
- **Show your own look at once.** The sim learns a rollback correction of your seat later; show the
  camera from presentation state instead: write a `VisualOffset` rotation on the entity a
  `VirtualCamera` sits on (relative to its sim pose), which the camera follows.
- **Predict other players.** A missing remote input repeats that seat's last one, wrong at every
  change. `multiplayer.onPredict(({ seat, frame, history }) => ({ buttons, stick }))` returns a better
  guess from the seat's last eight confirmed inputs (`history`, oldest first, each with its frame);
  null repeats the last. It must be **pure** (no `Math.random`, clock or state of its own), cheap (a few
  calls a frame per remote seat, re-simulated frames too), and only decides speculative frames:
  the server's input replaces it and the frames that differ are re-simulated, so it cannot desync.
  Extrapolate by `frame − history.at(-1).frame`, not by one step: the history lags by the round trip.

### Browser builds

`gameengine build web` uses the same multiplayer API, wire protocol and match client as native
players. A configured browser game joins the same authoritative or relay server and follows the
same balancer redirects, with input, snapshot or turn sync. Use `wss://` from HTTPS and keep build
identity compatible across targets. Browser clients cannot host a server or discover LAN hosts.
Name entry, lobby screens and invitation parsing belong to the game.

Browser callbacks only queue packets; the engine polls them at its normal match boundary. Each
match permits 256 KiB packets and a 2 MiB / 256-event receive queue. Its pre-open queue permits
8 packets / 64 KiB, so the hello waits safely for the connection. Backpressure, overflow and failed
connections reach `multiplayer.status().error` / `events()` explicitly. Hidden tabs stop stepping
and can disconnect. Save the seat token and use the game's reconnect policy on return.
Browser clients: skill `ship-web`.

## 3. Real-time games

Sim systems read `PlayerInputs` with `playerInput(inputs, index)` and `defineButtons` exactly as
in `rollback-multiplayer`. Seats 4 and up live in `MorePlayerInputs`: a game for more than four
players reads them with `playerInput(inputs, index, ctx.get(MorePlayerInputs))` (declare
`read(MorePlayerInputs)`; a match of four or fewer never writes it, so its hashes do not change).
`rollback-multiplayer` lists the rules (all state in the world, `math.*`, no physics
bodies: a real-time match on a physics game leaves with `E_ROLLBACK`). Keep a step well under
2 ms: a rollback re-simulates several frames at once.

- **Open rooms** (an arena people drop into: `lateJoin`, seats that exist always, a lobby list with `multiplayer.rooms`): `references/open-rooms.md`.
- **Always-open worlds** (`multiplayer.world`, one shared world instead of fixed matches): `references/worlds.md`.

## 4. Turn games

A turn is one schema event. Declare it, raise it with `submitTurn`, handle it in a system:

```ts
// schema: PlaceMark { player: u8, turn: u32, cell: u8 }
multiplayer.submitTurn({ $event: 'PlaceMark', cell: 4 });   // presentation
```

Once the server accepts the turn, every device (and an authoritative server) steps the world
**once** with that event; `player` and `turn` are filled in when the type has those fields. The
world also steps once when the match starts. With `turnOrder: roundRobin` the server refuses a
turn out of order (`E_NOT_YOUR_TURN` in `events()`); `free` accepts anyone's. A payload is a JSON
object of at most 4 KB. Validate the move in the system (it is the rule), not only in the UI.

Turn matches survive a server restart when it runs with `--store <dir>`, and players come back
to their seat with the `seat` token from `welcome`. With a store, a turn reaches the players (its
player included) only once it is written, so a server killed at any moment never loses a turn a
player saw: expect up to a tick more per turn (the write itself is well under a millisecond on
a local disk). While the store falls
behind (its queue three quarters full, or its heartbeat late) turns and joins get `E_BUSY`: retry.

**Async turn games** (matches that last days). With a store, a match nobody is
connected to leaves the server's memory after a minute and comes back when a player rejoins, so
one server holds about 100,000 matches. Keep the `seat` token (save it with the player's data)
and join with it to come back. Servers behind one balancer may share the store folder; a match is
open on one at a time (another answers `E_ELSEWHERE`: join again).

```jsonc
"multiplayer": { "mode": "turns", "turnOrder": "roundRobin",
  "turnLimit": { "seconds": 86400, "event": "TurnTimedOut" } }   // 10 s – 30 days
```

When a turn runs out, the server takes it **as that player** with the event (`TurnTimedOut`
with a `player` field tells the system whose it was): handle it like any move (skip, forfeit
after N). `multiplayer.events()` gets `{ type: 'turnDue', player, at }` when each turn begins
(`at`: the Unix second it runs out, null without a limit) and `status().turnDue` holds it, for a
countdown. To tell a player who is away, join with `notify` (a push token or your player id, at
most 256 bytes):

```ts
multiplayer.join({ room: savedRoom, seat: savedSeat, mode: 'turns', notify: pushToken });
```

and run the server with `--notify-url https://your-backend/turns`: it POSTs
`{ type: 'yourTurn', game, room, seat, turn, due, notify }`, signed with
`X-Gameengine-Signature: sha256=<HMAC-SHA256 of the body with GAMEENGINE_MP_KEY>`. Check the
signature in your backend, then send the push. Real-time matches and live turn matches played in
one sitting need none of this.

## 5. What the server sends that is not input

Pick by what it touches:

| You want | Use | Reaches |
|---|---|---|
| A message players see (quest live, maintenance soon) | a **notice** | `multiplayer.events()`: `{ type: 'notice', topic, from: null, data }`; never the sim |
| An emote or chat line from a player | `multiplayer.say('emote', { id: 3 })` | the room's other players as a notice `from` that seat (four a second, 256 bytes) |
| Something that changes the match (the arena shrinks, a quest spawns) | a **server event** | the sim, as a schema event, at the same frame on every device |

A server event is an ordinary sim event (`event('ShrinkArena', { radius: f32() }, { sim: true })`)
handled by a system with `runOn`. In a real-time match it lands at the next frame (or `inFrames`
later) and clients that ran ahead roll it back in; in a turn match it is a turn of the server's
(no `player`; round robin skips it), sent only to the room the command names (`--room`,
`{ room }` from a task): a broadcast leaves turn matches alone. Never put an emote or anything a player can spam into the
sim through button bits: it is presentation, so `say` it.

Send them by hand or from a backend (the server needs `GAMEENGINE_MP_KEY`, 16+ characters, set
when it starts; send to a balancer to reach every server of the game):

```bash
export GAMEENGINE_MP_KEY=…
gameengine mp send --server ws://host:7600 --notice quest --data '{"id":"A","text":"Seek the tower"}'
gameengine mp send --server ws://balancer:7700 --event '{"$event":"ShrinkArena","radius":5}' --in-frames 60 --game RollbackArena
gameengine mp send --server ws://host:7600 --room abc --seat 1 --notice hint --data '{"text":"Look north"}'   # one seat only
```

Or from the game itself on an **authoritative** server, every N seconds:

```ts
export const closeIn = defineServerTask({
  name: 'closeIn',
  every: 20,
  run(ctx) {
    const radius = 8 - (Math.floor(ctx.seconds / 20) % 6);    // from the clock: every server agrees
    ctx.notice('arena', { radius });
    ctx.event({ $event: 'ShrinkArena', radius }, { inFrames: 60 });
  },
});
```

Each server instance runs its own tasks, so derive what all servers must share from the time,
not from chance, or pick it centrally and `mp send` it. A relay runs no game code: drive it from
outside. Task code ships in the game bundle, so keep secrets in a backend.

**Scores and standings.** Points inside a match (one per kill, all lost on death) are sim
state: a document or component written by sim systems, the same on every device frame by frame.
The leaderboard is a view reading it; send nothing. A standing across matches (the best current
streak on the server) must come from the server's worlds, not a device: name the document in
`reads` and read each room's copy with `ctx.read` (8 documents per task, copied only for due
tasks, at most 256 KiB a run across every room: keep read documents small). `rollback-arena`'s `streaks` task:

```ts
export const streaks = defineServerTask({
  name: 'streaks',
  every: 10,
  reads: [scores],                                         // a defineDoc handle or its name
  run(ctx) {
    for (const r of ctx.rooms) {
      const streak = ctx.read<{ streak: number[] }>(r.room, scores)?.streak ?? [];
      // … find the leader, then:
      ctx.notice('streak', { player, streak: n }, { room: r.room });
    }
  },
});
```

A high score across every server needs a backend fed by the servers, never by devices; a task
posting to a backend is not built yet.

## 6. Hidden things and fog of war

By default every device holds the whole match, so a hacked client can read where everything is.
Two tools keep things off devices; both need `"authority": "server"`.

**Who sees what: `InterestArea`.** An engine component on the entity a seat sees from: `seat`,
`shape` (`Circle` with `radius`, or `Box` with `half`). It is sim state (a sim system may widen or
narrow it, e.g. darker as the arena closes), and the server reads it from its own world, so a
client cannot claim to see more. Tune it in the block:

```json
"interest": { "every": 6, "margin": 0.5, "maxRadius": 64 }
```

`every`: frames between the server's passes (1–60; raise it on a busy server, a pass costs seats ×
objects × areas). Claims are tested at pass frames too, so a game with small claim radii and fast
players keeps `every` low (2–3) or a player can run through a gem between two passes. `margin`: a thing leaves view only past the area plus margin, so nothing flickers
at the edge. `maxRadius`: the server clamps every area to it.

**Things to find: `defineHiddenSet`.** Items, loot, traps that only the server holds and shows to a
seat while its area covers them. Players stay visible (to hide players, use snapshot sync below).

```ts
export const gems = defineHiddenSet({
  name: 'gems',
  claim: { radius: 0.5, event: GemFound },           // reaching one claims it ({ player, id, position })
  start(ctx) { scatter(ctx, 0); },                    // server only, when the match starts
  claimed(ctx, c) { if (ctx.count() === 0) scatter(ctx, 100 + c.frame * 16); },
});
function scatter(ctx, first) {
  for (let i = 0; i < 10; i++) ctx.place(first + i, [14 * ctx.random() - 7, 14 * ctx.random() - 7]);
}

// presentation: draw what this device was shown
for (const g of multiplayer.hidden(gems)?.objects ?? []) pool.show(g.at[0], g.at[1]);
```

- `start` and `claimed` run **on the server only**, outside every sim. Place things with
  `ctx.random()` (the OS's randomness), never `Math.random` or `ctx.rng`/the match seed: every
  client has the seed, and `Math.random`'s state can be recovered from what players see.
- The hooks also have `move`, `remove`, `list`, `count`, `notice(topic, data, { seat })` (one seat
  only), `event(payload, { inFrames })` and `read(doc)` for documents named in `reads`.
- A claim is the server's decision: the nearest seat within `claim.radius` (with `claim.buttons`
  held, if set) wins, and `claim.event` lands in every peer's sim at one frame, so count scores in a
  sim system that reads that event (hash-checked like any input). Never score from
  `multiplayer.hidden()`: it is presentation and differs per device. A seat with several areas
  claims from any of them (the claim is tested from each area's entity), so give a seat a second
  area only where reaching from it is fair.
- A server task's hidden moves in one run go out as one batch per set, and a turn room's store is
  compacted after 256 hidden lines, so a task may move many objects a run.
- Limits: 8 sets, 1,024 objects a room, 256 bytes (UTF-8) of `data` each, 16 areas a room.

**Players too: snapshot sync.** Fog of war, stealth, battle royale, extraction: anything where a
player's position must not reach the others. Input sync cannot hide players (every peer needs every
input to step the world), so the server sends each seat the state it may see instead:

```json
"sync": "snapshot",
"snapshot": {
  "components": ["Player", "LocalTransform", "Mine", "Shape", "Bounds2D", "Arena"],
  "always": ["Arena"],
  "docs": ["arena:scores"],
  "maxBytes": 1200,
  "interpolation": 6
}
```

- `components`: what is replicated (≤ 16); an entity with none of them stays as the scene made it.
  `always`: sent to every seat wherever it is (≤ 8). `docs`: documents sent when they change (≤ 8,
  4 KiB each). `maxBytes`: the budget per snapshot (nearest first; deferred ones age up).
  `interpolation`: how many frames in the past other entities are shown (2–30).
- Your sim code does not change and must not branch on the mode. The device predicts its own
  entity and corrects it when the server differs; others are interpolated. Keep sim systems
  correct on a partial world: a system that needs what the seat cannot see must not change the
  seat's own entity from it, or it will mispredict (`status().corrections`, `maxCorrection`).
- `multiplayer.join({ sync: 'input' })` overrides the block for one match, so a game may offer both.
  Snapshot sync needs an authoritative server (`E_SYNC` on a relay) and real time (`E_MODE`).

| Your game | Sync | Why |
|---|---|---|
| Open information, ≤ 32 players, tight mobile data | `input` (default) | constant bytes, relay works, hash-checked |
| More than 32 players (up to 256) | `snapshot` | a seat steps and receives only what it sees |
| Fighting, precise timing | `input` | everyone at the present, no interpolation delay |
| Only items hidden, players may be seen | `input` + hidden sets | adds well under 0.1 KB/s |
| Players must be hidden (fog, stealth, battle royale) | `snapshot` | only state sync can hide players |
| Large worlds where a seat sees little | `snapshot` | bytes grow with what a seat sees |
| Turn games | `input` (turns) | snapshot turn matches are not built |

Measured on `samples/rollback-arena`, 4 players: input sync 2.2 KB/s up and 2.4 KB/s down per
player on the wire, snapshot 2.1 up and 2.8 down. On `samples/crowd-match` (bots that change
input every frame): 32 players in input sync 2.2 up and 6.3 down, 200 in snapshot sync 2.1 up and
4.0 down. Not built in snapshot mode: predicting your own
spawns (they appear after a round trip), lag compensation, sim events a seat may see (hits,
sounds: show them from state), physics, per-seat RNG streams.

`ctx.rng` is not reconciled in snapshot mode: corrections write replicated components, not the RNG
state, and every client has the match seed. Anything a player must not predict (loot, spawns,
cards) is decided by the server in hidden-set hooks with `ctx.random()`, never by `ctx.rng` in a
sim system. A client that falls more than the rollback window behind (a hitch, a rejoin) jumps to
the server's frame from one snapshot instead of re-simulating; a server room of 100 replicated
entities and 4 seats holds about 82 KB of replication state.

## 7. Test every change

```bash
gameengine mp test --players 2                         # relay, bots, simulated 4-frame latency + jitter
gameengine mp test --authority server --latency 3 --jitter 3 --adaptive off   # the fixed pacing; compare stalls, late inputs and depth
gameengine mp test --players 4 --authority server      # the server steps the game; hashes compared to it
gameengine mp test --latency 10 --jitter 6 --frames 1200 --js hermes
gameengine mp test --authority server --frames 1500 --event '{"$event":"ShrinkArena","radius":5}'
gameengine mp test --players 4 --authority server --sync snapshot   # snapshot sync: truth and leak checks
gameengine mp test --players 32 --authority server     # up to 32 in input sync, 256 with --sync snapshot
gameengine mp test --authority server --players 4 --open on --initial 1 --churn join@300,drop:0@900,back:0@1100 --frames 1800   # open room: joins from the world
```

`mp test` runs at the game's rate and reports it (`rate`), with ms per tick for everything, the
server alone (`serverMsPerTick`) and one client frame with its rollbacks (`clientMsPerFrame`), and
`rollback`: every peer's rollbacks summed (it lists the first 8 peers).

With hidden sets, an authoritative run places a probe where each seat stands and one far outside,
and fails on a leak (a seat shown anything outside its areas plus margin) or a probe never shown.
`--sync snapshot` fails when a seat's decoded state differs from what the server sent it
(`truthDiffs`) or an entity reached a seat outside its area (`leaks`); it prints `corrections`
per peer (mispredictions of its own entity) instead of hashes. `truthDiffs` also counts a seat
whose decoded cache no longer matches its live world (`staleCache`: a correction that missed an
entity). The server's hidden-set randomness comes from `--seed` in a test run, so a failing run
repeats with the same seed.

`--event` raises a server event a third of the way in; an authoritative run also runs the game's
server tasks (`server.taskCommands` in `--json`). Test a server event's handler like any event:
`input.emit(ShrinkArena, { radius: 5 })` in a game test.

`--latency` and `--jitter` are one way, in frames; the pacing flags (`--adaptive on|off`, `--max-window N`,
`--input-delay N`) override `multiplayer.pacing` for the run. It prints per player the margin and
jitter it measured, the window in force and the stalls (at the window / waiting on purpose), and
`lateInputs`: inputs that reached the server after their frame, which it repeated the previous one for
(the player's own input is then corrected on their device).

`ok: false`, a `divergence` or a `desyncs` entry means state lives outside the world or depends
on the device: fix it, never loosen the test. It also prints payload and on-wire bytes and packets per
player per second (`--send-every 1|2|4` compares packet rates) and ms per server tick. `gameengine net test` (peers against a perfect reference, `--synctest`)
stays the fastest check for real-time sim code. Keep one `mp test` line in CI (one per sync mode
the game uses).

In the editor: **Build → Multiplayer…** runs the match test and starts a local server.

## 8. Servers

`gameengine mp serve` runs a server from this project, and `gameengine build server` (or **Build → Build Multiplayer Server…**) makes the folder to deploy. Rebuild and redeploy an authoritative server with every game release: it accepts only clients of its exact build. Always `wss://` on the internet. Status lines, deployment, TLS, flood limits and the load balancer (`gameengine mp balance`): `references/servers.md`.

## 9. Matchmaking the game writes

Quick match is enough for casual play. For skill, region, parties or modes the game writes a `defineMatchmaker` that the balancer runs: `references/matchmaking.md`.

## 10. Hosted on a player's PC (no server)

On PC one player's game can be the match server: a relay on a thread inside the game.
Phones cannot host (`E_UNAVAILABLE`); they join servers.

```ts
// presentation code: the lobby
const hosted = multiplayer.host({ players: 4, name: 'Ana' }); // port 7600, room 'host', found on the LAN
const found = multiplayer.lanHosts();                         // poll each frame or on a timer; non-blocking
const h = found.find((h) => h.sameBuild);
if (h) multiplayer.joinHost(h);                               // or multiplayer.join({ server: 'ws://192.168.1.20:7600', room: 'host' })
```

- It is a relay: input sync only (whatever `multiplayer.sync` says), 1–32 players, one room, no
  hidden sets or server tasks. The match ends when the host leaves; there is no host migration.
- Finding hosts uses UDP port 7601 on the local network only. Over the internet the host forwards
  TCP 7600 on its router and others join its address; there is no NAT traversal.
- A blocked connection fails in 5 s with the port the host's firewall must allow, and the host
  gets `{ type: 'unreachable', address, port, message }` from `multiplayer.events()`: show both to
  the players, the firewall is the usual cause.
- Try any game without a lobby: `gameengine run --host` on one PC, `gameengine run --join lan`
  (or `--join ws://<ip>:7600`) on the others. `gameengine doctor` checks the ports and, on Windows,
  the network profile and the firewall rules for the game.

## Limits

- A server steps every authoritative room in turn on one thread and one JS VM; it measures its
  rooms per tick at start and tells its balancer that (`capacity` in the status line). Measure with
  `mp test --authority server` (ms per tick) before sizing machines, and add servers behind the
  balancer rather than threads. `WallClock` stands still on the server: do not base match rules
  on real time.
- An authoritative server's binary is the desktop host without the debug protocol (about 70 MB on
  Linux); a relay's is `gameengine-relay` (about 5 MB).
- 1–32 players per match in input sync and turns, 1–256 in snapshot sync; a snapshot room
  replicates at most 4,096 entities and a seat holds at most 1,024–4,096 of them (fewer the more
  seats).
- Protocol 8: clients and servers of an older engine refuse each other (`E_VERSION`).
- A balancer holds `--max-conns` (10,000) connections at once, waiting players too, on its
  reactor threads. Tickets live in its memory, so a restart drops them (players rejoin).
- Phone builds link the match client when the project has a `multiplayer` block, but no match has
  been played on a device yet; an iPhone joining a server on the local network needs local network
  permission, which the iOS shell does not ask for yet (use a public server or the simulator).
- Replays and `--hash-trace` do not cover match steps yet, server events included.
- A notice reaches only players connected when it is sent; a turn match gets a server event only
  when it has started and the command names its room. Server tasks run only on authoritative servers.
- Hidden sets and snapshot sync need an authoritative server; hidden hands in turn games are not
  covered yet.
- A stored turn match comes back on the server's thread (about 0.2 ms each); a rejoining device
  still steps every turn from the first. Free-order turn matches have no turn limit, and server
  tasks see only the matches in memory.

Samples: `samples/rollback-arena` (real-time, authoritative), `samples/crowd-match` (one runner
per seat, 32 in input sync or 200 in snapshot sync).
