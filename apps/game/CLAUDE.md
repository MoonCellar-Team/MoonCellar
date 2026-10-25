# MoonCellar Game API (apps/game)

Online service of the game ports: leaderboards now, accounts, challenges and match signalling
later. Repository-wide rules live in the root [`CLAUDE.md`](../../CLAUDE.md); what the service
does and how to run it is in [`docs/game-service.md`](../../docs/game-service.md).

## Runtime

- **The service follows the runtime rules of `apps/api`** ([`apps/api/CLAUDE.md`](../api/CLAUDE.md),
  "Runtime"): Bun runs `src/main.ts` directly, `build` is `typecheck` plus `check:boot`, types
  named in decorator metadata are imported with `import type`, and scripts that import decorated
  code run with `apps/game` as the working directory. Never start it with Node.
- **It listens on `PORT` (3229 by default), never on the API's 3228**, so both run side by side in
  development and in the compose network.
- **Its data lives in the `game` database of the stack's MongoDB** (`dbName` in `app.module.ts`),
  never in the API's `games` database: the connection string is the same, the database is not.

- **Rate limits follow the API's rules** ([`apps/api/CLAUDE.md`](../api/CLAUDE.md), "Rate
  limits"): `trust proxy` is `1`, a request without `X-Forwarded-For` comes from inside the stack and
  is not limited, and the numbers are in [`docs/rate-limits.md`](../../docs/rate-limits.md).

## Contracts

- **Every request and response shape is a Zod schema in `packages/schemas/src/game.schema.ts`**,
  wrapped with `createZodDto` in `src/shared/zod/dto/game.dto.ts`. The OpenAPI document at `/api`
  is generated from them; a shape written only as a TypeScript type never reaches it.
- **Errors are `{ statusCode, message }` with an English sentence**, as in `apps/api`
  ("Errors"); `ErrorResponseFilter` is the API's filter without the axios branch.

## Games

- **Nothing outside `src/games/` knows a particular game.** Leaderboards and challenges take the
  slug and board from the URL and the definition from `findGame`, which also rejects a board the
  game does not have; a game's replay format and its checks live in its own folder
  (`src/games/rooftops/`). A new game is a new definition registered in `GAMES`
  (`docs/game-service.md`, "Adding a game").
- **Data written before games existed is moved at startup**: `onModuleInit` of the leaderboards
  and challenges services turns documents that still have `level` into `rooftops` boards
  (`level-<n+1>`), then `syncIndexes` drops the old indexes. The update is idempotent.

## Achievements

- **A game's achievements are the port's catalog, copied as is** to
  `src/games/<slug>/achievements.json` with its icons (`docs/game-service.md`, "Achievements");
  texts are changed in the port's catalog and copied again, never edited here. `loadAchievements`
  checks the catalog at startup.
- **An unlock is written once and `current` only grows**: `$setOnInsert` and an update where
  `unlockedAt` is `null` keep the first time, `$max` keeps the progress, so a game may repeat a
  report safely.

## Accounts

- **The service never verifies a game token itself: `AccountService` asks the API**
  (`POST /auth/game/token/introspect`, [`docs/game-sign-in.md`](../../docs/game-sign-in.md)) and
  keeps the answer for 30 seconds. It holds no JWT key, and a device signed out on the site loses
  access within that window.
- **A made-up token must never cost an API call.** `accountOf(token, address)` answers a token
  that is not a game JWT without asking, lets one address cause `INTROSPECT_MISSES` (30) uncached
  checks a minute, and its caches drop their oldest entry when full instead of being cleared: a
  clear let 10,000 junk tokens push every player's cached answer out at once. Details in
  [`docs/rate-limits.md`](../../docs/rate-limits.md).
- **`/account/*` proxies the API's device sign-in**, so a game talks to one host only.
- **An endpoint that acts for a player uses `GameTokenGuard`**, which puts the account on
  `request.account`; the player's name is taken from it, never from the request body.

## Challenges

- **A friend is a MoonCellar following or follower** — `AccountService.friendsOf` reads the API's
  public `/user/followings/:id` and `/user/followers/:id` and keeps the answer for a minute. Only a
  friend can be challenged.
- **`GET /challenges/incoming` marks what it returns as delivered**, so the game queues each
  challenge once; the game keeps its own queue of pending challenges, as it did with push
  notifications on the iPad.
- **A challenge's replay passes the leaderboard check** (`LeaderboardsService.checkReplay`),
  against the replays of the same board.

## Signalling

- **`/signal` is a plain `ws` server on the HTTP server's `upgrade` event, not a Nest gateway or
  socket.io**: the game ports speak raw WebSocket frames through libcurl. `SignalGateway` attaches
  it at bootstrap and destroys any other upgrade request. Rooms live in memory
  (`SignalService`), so the service must stay a single instance while it holds them.
- **`/signal` takes at most `SIGNAL_SOCKETS_PER_ADDRESS` (8) sockets per address, and the address
  is the last `X-Forwarded-For` entry (`clientAddress`), never the first.** nginx appends the real
  address after whatever the client sent, so the first entry let a client dodge the cap and choose
  the address handed to the other player. One socket hosts one room, which caps rooms too.
- **Every client message goes through `GameSignalClientMessageSchema.safeParse`**; a bad one
  answers `{ type: "error" }` and never closes the socket.
- **nginx needs its own `location = /signal` with the upgrade headers** for `game.mooncellar.space`,
  and `location = /game-api/signal` for `play.mooncellar.space` (the port in the browser reaches the
  service on its own origin); the plain `location /` sends `Connection: ""` and the handshake fails.
- **TURN credentials ride on `hosted`, `joined` and `peer`** (`signal-turn.ts`): coturn REST
  credentials bound to the room code, only when both `TURN_SECRET` and `TURN_URLS` are set. The
  secret never leaves the server; it must match coturn's in `infra/.env`.

## Player levels

- **A level file is opaque to the service: only the game's `levels.check` reads it**, and the
  service stores it with `select: false`, read only by `GET …/levels/:levelId/file`. A check reads
  the format alone — never level data of the game's publisher, which must not enter this
  repository.
- **A level's leaderboard is the board `levelBoard(id, version)` = `u<levelId>v<version>`**, so a
  game taking levels must accept that pattern in `board` (`rooftops` does); a new version starts a
  new board. Keep it within `GAME_BOARD_PATTERN` (32 characters).
- **Moderation takes `MODERATION_TOKEN`, not a MoonCellar role** (`ModerationGuard`, like
  `/metrics`); three reports from different players hide a level until a moderator shows it again.

## Leaderboards

- **A score is recorded only with a replay that holds up**, when the game defines a check
  (`docs/game-service.md`, "Replay checks"). `rooftops`' checks use only its ghost files — never
  level geometry or other game data, which belong to the game's publisher and must not enter
  this repository. Change `GHOST_LIMITS` only together with `ghost.spec.ts`, and against real
  runs from the port.
- **A submitted score replaces the entry only when it is better** (the game's `scoreOrder`),
  together with its replay; a worse one answers `improved: false` and refreshes only the display
  name.
- **The replay is stored with `select: false`** and read only by
  `GET /games/:game/leaderboards/entries/:entryId/replay`, so a leaderboard page never carries
  them. `main.ts` raises the JSON body limit to 512 KiB; the schema caps a replay at 256 KiB.
- **One entry per user and board** (unique index `{ game, board, userId }`). Ranking sorts by
  `score` in the game's order, then by `updatedAt`, so an earlier equal score ranks first.

## Storage

- **Storage files travel as raw `application/octet-stream`, never base64 in JSON**: `main.ts`
  registers the raw body parser up to `GAME_STORAGE_MAX_FILE_BYTES` next to the 512 KiB JSON one.
  A body sent with another type reaches the controller as a non-`Buffer` and answers 415; an empty
  octet-stream body arrives as `{}`, so the controller turns it into an empty `Buffer` itself.
- **`client_max_body_size` of `game.mooncellar.space` in `infra/nginx/mooncellar.conf` must be at
  least `GAME_STORAGE_MAX_FILE_BYTES`**; nginx defaults to 1 MiB and answers 413 with its own
  HTML page to any larger file before the service sees it. Raise them together.
- **A bucket exists only when the game's definition names it** (`storage` in `IGameDefinition`);
  limits are checked by `quotaProblem` against the sum of the player's files in that bucket,
  counting a replaced file once. Change limits only together with `docs/game-service.md`.
- **`revision` of `storage_buckets` grows with every write and delete**, and a write or delete
  with `revision` answers 409 when the bucket moved on; the ports rely on it to tell a change
  made on another computer from their own.
- **The list's `createdAt` is the `storage_buckets` document's own, never reset or rewritten**:
  the ports compare it with the one they saw last to notice a bucket that was removed and started
  again, and keep their files instead of treating the missing ones as deleted elsewhere.

