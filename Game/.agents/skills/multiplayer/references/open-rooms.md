# Open rooms: join a match that is running

A fixed match starts when every seat is taken. For an arena people drop in and out of, make the room **open**: it starts at its first seat, a quick match joins the fullest running room that has a seat free (else makes one), and a seat is retaken as players leave. Real-time, input sync, `authority: "server"` only:

```json
"multiplayer": { "mode": "realtime", "authority": "server", "players": 4, "lateJoin": true }
```

`lateJoin` is `true` or `{ "event": "SeatChanged", "graceSeconds": 15 }`; `join()` is open by default then (`join({ open: false })` for a fixed match). Declare the event in the schema with `seat: u32()` and `present: bool()` (the server refuses to start without them; `fresh: bool()` is optional and sent only when declared): the server raises `{ seat, present, fresh }` at the **same frame on every device and the server**, so the sim, not presentation, decides who exists:

```ts
// schema/game.schema.ts
export const SeatChanged = event('SeatChanged', { seat: u32(), present: bool(), fresh: bool() }, { sim: true });
// a sim system with events: [SeatChanged]
for (const e of ctx.events.read(SeatChanged)) { /* set the seat entity's `active` to e.present; reset it when e.fresh */ }
```

- **Seats exist always** (one entity each, an `active` flag the event sets): a seat without a player plays the neutral input, never its last one. Leave and disconnect both raise `present: false` (200 ms after the change, on the same frame everywhere, like every presence event); a reconnect that replaces its own live connection raises nothing; `fresh` is true when a new player takes the seat and false when the one it was held for returns, so reset a seat's score on `fresh` only.
- A clean leave (`multiplayer.leave()`) frees the seat; a lost connection holds it for `graceSeconds` (the player returns with `join({ seat })`, which the game does after a reconnect). A room with every seat free ends; it has no length limit.
- A player who joins a running room is sent the server's world (at most 1 MiB; a bigger world refuses the join with `E_LIMIT`) and continues from it: do not keep sim state outside the world (the same rule as for rollback), or the joiner differs from the others. The first `status().frame` is the room's frame, not 0.
- `MatchEvent` `joined` / `left` (presentation) arrive once each for toasts ("Ana joined"): `left` when the player leaves or drops, `joined` when a seat is taken or its held player returns. A hold running out sends nothing more, and a joiner is not told about the players already there (read the sim's seats). Use the sim event for anything that changes the game.
- **A lobby list:** `multiplayer.rooms({ server })` lists the open rooms running on one match server: `null` until it answers, then `{ server, rooms: [{ room, seats, taken, free }], ageMs }`, at most 64 rooms with a free seat first, then the fullest. Call it every frame the lobby shows (it asks once a second and stops 10 s after the last call or on `join`), and join a row with `join({ server: listing.server, room: row.room })`; a full room answers `E_FULL`. Its error is thrown, and thrown again for 5 s before it reconnects. The list is **per match server**: a balancer refuses it (`E_BALANCER`), so a lobby across servers asks each one (every frame is fine: one connection a server, up to 8). It shows room names and seat counts only, never players or seat tokens.
- Test: `gameengine mp test --authority server --players 4 --initial 1 --frames 2400 --churn join@300,join@600,drop:1@1200,back:1@1500,leave:2@1800` (hash agreement for every peer that joined, empty-seat input, `--grace-secs`, `--replay-join` to measure the replay it avoids; such a room keeps its whole log and ends at the 64 MiB limit). A server from before this release answers an open hello `E_VERSION`: ship the server and the clients from one engine release.
