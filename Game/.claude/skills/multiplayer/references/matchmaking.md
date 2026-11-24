# Matchmaking the game writes

Quick match is enough for casual play. For skill, region, parties or modes that fill differently,
write the rule in the game's TypeScript and export it from `main.ts`:

```ts
import { defineMatchmaker, type MatchGroup, type MatchTicket } from '@gameengine/runtime';

export const ranked = defineMatchmaker({
  queue: 'ranked',       // a room name's rules; at most 16 queues a game
  every: 1,              // seconds between rounds, 0.1 or more
  match(tickets: readonly MatchTicket[], servers, round): MatchGroup[] {
    // tickets: { id, players, waitSec, attributes, verified, party? }, at most 4,096 a round
    // servers: { url, region, tags, rate, rooms, capacity, players, freeSeats, load }
    return [{ tickets: [tickets[0]!.id, tickets[1]!.id], server: { region: 'eu' } }];
  },
  bot: (i) => ({ attributes: { region: 'eu' }, verified: { rating: 800 + i } }), // for mp match
});
```

```ts
// presentation, against the balancer's address
multiplayer.join({ queue: 'ranked', attributes: { region: 'eu' }, token, party: { id: partyId, size: 2 } });
// events(): { type: 'queued', queue, waiting } while it waits, then the usual welcome
```

- **No secrets in it:** `defineMatchmaker` (like `defineServerTask`) is in the device bundle too,
  where it does nothing; the token key lives only in your backend and in `GAMEENGINE_MM_KEY`.
- **Run it:** `gameengine mp balance samples/my-game` (`--match-budget-ms`, default 250). Without a
  project, or for a queue no matchmaker defines, the balancer quick-matches.
- **Rounds:** each pool (one queue for one build, rate, mode, sync and room size) is offered every
  `every` seconds: the oldest 2,048 tickets, then 2,048 from a cursor through the rest, so a long
  queue is seen over several rounds. Return groups of ticket ids. `server` is a url, `{ region,
  tags }` (that region first, most tags, least loaded) or nothing (least loaded). The balancer names
  the room and redirects every player with its size. A group naming a gone ticket, a ticket twice,
  half a party, more players than a match holds or a full server is dropped; its tickets wait.
- **Keep `match` cheap and pure:** one round is in flight at a time, on a thread of its own. Past
  the budget a round is skipped and logged; a throw or malformed answer too. Stuck 10 s on one round,
  the matchmaker is stalled and its players get `E_MATCHMAKER` until it answers or, after 30 s, a
  fresh session takes over (at most 3 times; then restart the balancer). `match` is a plain function: test it
  in a `worldTest` on both engines (`rollback-arena/tests/game.test.ts`).
- **Parties:** every member joins with the same `party.id` and `size` (2–8); they wait as one ticket
  (`players` = size), offered once all are there, and are dropped with `E_PARTY` if not all there
  within 60 s. An unsigned party id can be guessed and joined: sign `"party"` into each member's
  token, and it wins over the id the client sends.
- **Trust:** `attributes` (a JSON object, at most 512 bytes) are hints a modified client can fake.
  Ratings, ranks and entitlements come in a token the game's backend signs:
  `v1.<base64url payload>.<base64url HMAC-SHA256 of "v1.<payload>">`, payload
  `{ "game": "<name>", "exp": <unix seconds>, "values": { "rating": 1520 } }` (optionally
  `"queue": "ranked"` to bind it to one queue and `"party": "<id>"`; `exp` at most 24 h away), key in
  `GAMEENGINE_MM_KEY` on the balancer (16+ characters, not the server key). `match` reads checked
  values from `ticket.verified` (null without a token); a bad or expired token gets `E_TOKEN`. Tokens
  are not bound to a player: keep `exp` to minutes.
- **Prove it:** `gameengine mp match samples/my-game --bots 2000 [--arrive-sec 10] [--regions eu,us]
  --json` (MCP `mp_match`) builds bots from `bot(i)`, signs real tokens, registers one server per
  region and reports matched players, room sizes, waits (p50, p95), the largest queue and round cost.
  `--bots 100000 --arrive-sec 0` is the scale case: a round of 4,096 tickets should stay well under
  the budget.
