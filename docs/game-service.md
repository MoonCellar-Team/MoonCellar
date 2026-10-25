# Game service

`apps/game` is the online service of the game ports: a NestJS 11 application on Bun, next to
`apps/api` and built the same way. It answers on `game.mooncellar.space` (port 3229 in the
container and in development) and keeps its data in the `game` database of the stack's MongoDB.

It is not tied to one game. Sign-in, friends and match signalling are shared by every port;
leaderboards, challenges and achievements live under `/games/:game/…`, where `:game` is a slug registered in
`src/games/games.ts` (see "Adding a game"). The first registered game is `rooftops`, the
port of a rooftop-running game from the decompilation project.

## Endpoints

| Method | Path                                                | What it returns                                                                                                                                                                                                                                                                      |
| ------ | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET`  | `/health`                                           | `{ status, database, uptimeSeconds }` — `database` is `up` while MongoDB is connected                                                                                                                                                                                                |
| `POST` | `/account/device`                                   | Starts signing in: `{ deviceCode, userCode, verificationUrl, … }` ([game-sign-in.md](game-sign-in.md))                                                                                                                                                                               |
| `POST` | `/account/device/token`                             | Polls the sign-in: `{ status: "pending" }`, then `{ status: "approved", token, account }`                                                                                                                                                                                            |
| `GET`  | `/account/me`                                       | Game token. The account the game is signed in with: `{ id, userName, avatar }`                                                                                                                                                                                                       |
| `GET`  | `/account/friends`                                  | Game token. MoonCellar followings and followers, `[{ id, userName, avatar }]` by name                                                                                                                                                                                                |
| `POST` | `/account/sign-out`                                 | Game token. Revokes the token; the device disappears from the site's Settings → Game devices                                                                                                                                                                                         |
| `GET`  | `/games`                                            | The registered games: `[{ slug, name, scoreOrder, scoreUnit, replayRequired, siteGame, achievements }]` — `siteGame`: the slug of the game's page on the site (or `null`), `achievements`: how many it has                                                                                                                                                                                                      |
| `GET`  | `/games/:game/leaderboards/:board`                  | A leaderboard, best score first (`scoreOrder` of the game): `{ game, board, total, entries }`, paged by `limit` (1–100, default 20) and `offset`; 404 for an unknown game or a board the game does not have                                                                          |
| `PUT`  | `/games/:game/leaderboards/:board`                  | Game token. Submits `{ score, replay? }` (replay — the game's own recording, base64, up to 256 KiB); the game's replay check runs (see "Replay checks"), and the player's entry is replaced only by a better score: `{ improved, entry }`; a score that does not hold up answers 422 |
| `GET`  | `/games/:game/leaderboards/entries/:entryId/replay` | The replay of an entry: `{ entryId, game, board, userId, displayName, score, replay }`; 404 when it has none                                                                                                                                                                         |
| `POST` | `/games/:game/challenges`                           | Game token. Challenges a friend: `{ toUserId, board, score, comment, replay? }`, checked like a leaderboard score; 403 for someone who is not a friend, 429 after five unopened challenges to the same friend                                                                        |
| `GET`  | `/games/:game/challenges/incoming`                  | Game token. Challenges of this game sent to the player since the last call, oldest first, without replays; each is handed out once                                                                                                                                                   |
| `GET`  | `/games/:game/challenges/:challengeId`              | Game token. The challenge with its replay (or `null`), for its recipient or sender; challenges expire after 30 days                                                                                                                                                                  |
| `GET`  | `/games/:game/levels`                               | Player levels, `{ game, total, levels }`: `sort` `new` (default) or `best` (rating, then number of ratings), `q` — part of the name or author, `mode` — `race` or `bags` only, `limit` (1–50, default 20), `offset`; hidden levels are left out |
| `GET`  | `/games/:game/levels/:levelId`                      | A player level: `{ id, name, description, base, mode, timeLimit, authorId, authorName, version, board, size, rating, ratings, downloads, createdAt, updatedAt }`; 404 when hidden                                                                                                                      |
| `GET`  | `/games/:game/levels/:levelId/file`                 | The level's map `{ id, version, data }` (base64); counts a download                                                                                                                                                                                                                  |
| `POST` | `/games/:game/levels`                               | Game token. Uploads `{ name, description, base, mode, timeLimit, data }`; the game's level check runs (see "Player levels"); 409 at 50 levels of one author                                                                                                                                          |
| `PUT`  | `/games/:game/levels/:levelId`                      | Game token, the author only. A new version of the level: `version` grows, and with it the level's leaderboard `board`                                                                                                                                                                |
| `DELETE` | `/games/:game/levels/:levelId`                    | Game token, the author only. Deletes the level                                                                                                                                                                                                                                       |
| `PUT`  | `/games/:game/levels/:levelId/rating`               | Game token. `{ stars }` 1–5, replacing the player's earlier rating; not for one's own level                                                                                                                                                                                          |
| `POST` | `/games/:game/levels/:levelId/report`               | Game token. `{ reason }`; three players reporting a level hide it: `{ reported, hidden }`                                                                                                                                                                                            |
| `GET`  | `/games/:game/levels/reported`                      | `MODERATION_TOKEN`. Reported and hidden levels with their reports                                                                                                                                                                                                                    |
| `PUT`  | `/games/:game/levels/:levelId/moderation`           | `MODERATION_TOKEN`. `{ hidden }`; showing a level again clears its reports                                                                                                                                                                                                           |
| `GET`  | `/games/:game/storage/:bucket`                      | Game token. The player's files in a storage bucket of the game, without data: `{ game, bucket, revision, usedBytes, maxBytes, maxFileBytes, maxFiles, files: [{ path, size, sha256, updatedAt }] }`; 404 for a bucket the game does not have (see "Cloud storage") |
| `GET`  | `/games/:game/storage/:bucket/file?path=`           | Game token. The file as raw bytes (`application/octet-stream`), with `X-Content-SHA256` and `Last-Modified` |
| `PUT`  | `/games/:game/storage/:bucket/file?path=&revision=` | Game token. Writes the file from a raw `application/octet-stream` body (up to 8 MiB): `{ revision, usedBytes, file }`; with `revision`, 409 unless the bucket is still at it; 422 past the bucket's limits |
| `DELETE` | `/games/:game/storage/:bucket/file?path=&revision=` | Game token. Deletes the file: `{ revision, usedBytes, file: null }` |
| `GET`  | `/games/:game/achievements`                         | The game's achievements in its order: `{ game, total, achievements: [{ key, title, description, icon, hidden, progress }] }` — `title` and `description` by language (`en` always), `null` for a hidden achievement; `icon` — the path of its SVG on this service; `progress` — `{ target, unit }` of a counter, or `null`; 404 for a game without achievements (see "Achievements") |
| `GET`  | `/games/:game/achievements/icons/:icon`             | An achievement icon as `image/svg+xml`: a 24×24 outline in `currentColor`, coloured by the page |
| `GET`  | `/games/:game/achievements/me`                      | Game token. The player's achievements of the game: `{ game, userId, total, unlocked, achievements }`, each with `unlocked`, `unlockedAt` and `current` |
| `GET`  | `/games/:game/achievements/players/:userId`         | The same for any player, for the profile |
| `PUT`  | `/games/:game/achievements/:key`                    | Game token. Reports `{ unlocked?: true, unlockedAt?, current? }`: the unlock is kept once, with its first time (`unlockedAt` — the game's time of an unlock it queued offline, taken when it is no older than 400 days and not ahead of the server); `current` only grows; repeating a report changes nothing. Answers the achievement as in `…/me`; 404 for a key the game does not have |
| `GET`  | `/achievements/players/:userId`                     | The games with achievements a player has started: `[{ game, name, total, unlocked, lastUnlockedAt }]` |
| `GET`  | `/api`                                              | Swagger UI and the OpenAPI document of the service                                                                                                                                                                                                                                   |
| `GET`  | `/metrics`                                          | Prometheus metrics, behind `Authorization: Bearer <METRICS_TOKEN>`                                                                                                                                                                                                                   |

Request and response shapes are the `Game*` schemas of `@mooncellar/schemas`
(`packages/schemas/src/game.schema.ts`).

## Replay checks

A score is only as good as the replay recorded with it, so every game may bring a check
(`IGameDefinition.replay.check`): it gets the submitted replay, the score and the replays of the
board's twenty best entries, and returns a reason to reject or `null`. Challenges go through the
same check. The service itself never reads a replay; a game without a check stores it as is.

`rooftops` (`src/games/rooftops/ghost.ts`) reads its ghost file (version 3: big-endian frame
count, then per frame the milliseconds since the previous one and the 16.16 fixed-point
position) and rejects the time when:

- the file is not a complete version 3 run;
- the run, from the first step, lasts longer than the time plus 750 ms. The game starts recording
  during the camera fly-over before the countdown, while the race clock still stands, so the
  standing frames at the start are not counted; the last frame comes up to 500 ms before the
  finish;
- two frames are more than 2 s apart;
- the runner covers more than 35 m/s between two frames, unless the new spot is within 12 m of an
  earlier one — a respawn at a checkpoint;
- the runner moves for less than half of the time;
- more than a quarter of the moving time goes faster than 11 m/s. The runner tops out at about
  10 m/s: in a real run of the training level 83 % of the moving time is 9–11 m/s and 5 % is
  faster, while the same run sped up by 11 % is above 11 m/s for 80 % of the time;
- the board already has accepted runs and this one does not start within 15 m of the start, or
  finish within 30 m of the finish, of one of them. Every honest run of a level shares the spawn
  point and the finish, so a run cut short or recorded elsewhere stops there; the first run of a
  board is trusted.

The limits are `GHOST_LIMITS`, calibrated on real runs from the port; they use only the replays,
never level data, so a run built by hand along a plausible path, or one sped up by a few percent,
still passes. `bun --filter game test` runs the checks.

## Player levels

A game that takes levels made by its players has `levels` in its definition: `maxBytes` and an
optional `check` that gets the map file and the level's mode and returns a reason it would not
load, or `null`. A level's `mode` is `race` (start, checkpoints and a finish; the default, and the
mode of levels uploaded before modes existed) or `bags` (bags to collect against a time limit,
`timeLimit` of 120 000, 180 000 or 300 000 ms; a race has 0). The
service stores the file as it is (`select: false`, read only by `…/file`) and never reads it
otherwise. A level's leaderboard is the board `u<levelId>v<version>` (`levelBoard`), so the
game's `board` pattern must accept it; a new version starts an empty board.

`rooftops` (`src/games/rooftops/level.ts`) takes levels of the port's map format up to 128 KiB and
walks the structure the way the game's loader reads it, checking every index the loader follows,
so a level that passes cannot crash the game; a race needs a finish, a bags level a bag (object
type 3). It knows only the layout of the format and the
lengths of the game's lookup tables. A player level holds the player's layout and numbers of
pieces from the game's own data; levels copied from the game's chapters are not uploaded — the
port allows it only for levels made from scratch.

Reports hide a level after three different players; a moderator sees them at
`/games/:game/levels/reported` and hides or shows a level with `…/moderation`, both behind
`MODERATION_TOKEN`. Ratings are 1–5 stars, one per player; `rating` is their average.

## Cloud storage

A game that keeps files in the player's account has `storage` in its definition: buckets by name,
each with `maxFileBytes`, `maxFiles` and `maxBytes`, and optionally `maxFolders`: how many
top-level folders (the first segment of the paths that have one) the bucket may hold, so a write
that would start one more is refused with 422 while writes into the folders it already has go on.
The service stores a file as it is
(`storage_files`, one document per file, `data` with `select: false`) under the player's id, and
never reads it. A bucket's `revision` (`storage_buckets`) grows with every write and delete, so
a game can tell whether anything changed since it last looked, and can make a write conditional
with `revision`. Paths are up to four segments of `[A-Za-z0-9._-]`, never `.` or `..`.

Files travel as raw bytes, not base64 in JSON: `main.ts` takes `application/octet-stream`
bodies up to `GAME_STORAGE_MAX_FILE_BYTES` (8 MiB) and keeps JSON at 512 KiB. nginx lets
bodies of the same size through to `game.mooncellar.space` (`client_max_body_size` in
`infra/nginx/mooncellar.conf`); its default of 1 MiB would answer 413 to every larger file.

`rooftops` has four buckets: `save` — the game's progress, the files of the port's `Documents`
folder (1 MiB each, 64 files, 4 MiB); `skins` — the player's custom heroine models,
`<skin>/<file>` (8 MiB each, 256 files, 64 MiB, at most 10 skins); `levels` — the levels the player made,
`<level>/<file>` (512 KiB each, 400 files, 32 MiB); and `prefs` — the settings that travel between
computers (language, sound, controls, the chosen skin) and the player's colour grading image
(4 MiB each, 8 files, 8 MiB). The port syncs them on sign-in in its launcher and after a session,
so a player can go on from another computer.

## Achievements

Unlike Steam and RetroAchievements, which MoonCellar knows only by counts, the ports report
every achievement. A game's set is a catalog in the format shared by every port (the port
project's `docs/achievements.md`): `format`, `game`, and per achievement a `key`, `title` and
`description` by language, an `icon`, optional `progress` (`{ target, unit }` of a counter) and
`hidden`, and the port's own `trigger`, which the service neither reads nor returns.

- **The catalog comes from the port.** Its source is the port's `config/achievements/<game>.json`
  with the icons next to it; the service keeps a copy beside the game's definition
  (`src/games/<slug>/achievements.json`, icons in `src/games/<slug>/achievements/`), loaded by
  `loadAchievements` at startup. A catalog that does not hold up — a repeated key, a missing
  English text, languages that differ between achievements, an icon that is not a 24×24
  `currentColor` outline of paths, an icon no achievement uses — stops the service from starting,
  so `check:boot` catches it.
- **Keys are for ever.** Unlocks are stored by key: a key is never renamed or given to another
  achievement; a new achievement gets a new key.
- **Texts and icons are the team's own.** `en` is required, as the site is English only; the
  port shows the player's language. Never the game's own texts or art: they belong to its
  publisher (rule 5 of "Adding a game").
- **A player's state** is one document of `achievement_states` per player and achievement. The
  unlock is written once — on insert, or where `unlockedAt` is still `null` — so the first time
  stays; `current` changes only through `$max`. Two first reports at once meet the unique index,
  and the second one updates instead.
- **On the site.** A game's `siteGame` (in `GET /games`) is the slug of its page on
  mooncellar.space: that page counts the port's achievements in its Achievements block, in a row
  named after the port (its `name`), which
  opens a modal with all of them and the viewer's own states. Every game card of that page's game
  carries the moon mark in its bottom-right rail, which opens the same modal and loads the
  catalogue in the browser. A profile shows the player's ports compactly on its Profile tab and in
  full, with every achievement's icon, on its own MoonCellar tab (`/user/<name>/mooncellar`)
  (`apps/web`: `entities/port-achievement`, `widgets/game/GamePortAchievementsModal`,
  `widgets/game/GameCard`, `widgets/user/UserPortAchievements`). The site reaches the
  service at `NEXT_PUBLIC_GAME_URL` from the browser — without cookies, which its CORS does not
  allow — and at `INTERNAL_GAME_URL` from the server. Icons are drawn as CSS masks so they take the
  page's colours, which needs the CORS header on `/icons/` too (it has it, like every route).

## Adding a game

1. Pick a slug (`[a-z][a-z0-9-]`, up to 32 characters) and add `src/games/<slug>/<slug>.game.ts`
   with an `IGameDefinition`: `name` (the port's own name, which the site shows — `Glassline` for
   `rooftops`), `siteGame` (the slug of the game's page on the site, where its
   achievements are shown), `scoreOrder` (`asc` when lower is better, as with times),
   `scoreUnit` (`ms` or `points`), `board` — a regular expression of the board ids the game
   uses — and `replay` (`required`, `maxBytes`, an optional `check`).
2. Register it in `GAMES` in `src/games/games.ts`. Nothing else changes: the routes, the
   collections and the challenges take the slug from the URL.
3. Files the game keeps in the player's account go in `storage` (see "Cloud storage"); a
   bucket name is `[a-z][a-z0-9-]`, up to 32 characters.
4. Achievements: copy the port's catalog to `src/games/<slug>/achievements.json` and its icons to
   `src/games/<slug>/achievements/`, and set `achievements: loadAchievements(__dirname, "<slug>")`
   (see "Achievements").
5. A replay check reads only the replays and the score. Game data (levels, assets) belongs to
   the game's publisher and never enters this repository.

## Match signalling

`wss://game.mooncellar.space/signal` is a WebSocket where two game ports find each other before
they connect directly (plan G4 of the port). Messages are JSON text frames, shaped by
`GameSignalClientMessageSchema` and `GameSignalServerMessageSchema`:

| Client sends                        | Server answers                                                                                             |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `{ type: "host", port }`            | `{ type: "hosted", code, turn? }` — a four-character room code to give the other player                    |
| `{ type: "join", code, port }`      | `{ type: "joined", code, peer, turn? }` to the guest and `{ type: "peer", peer, turn? }` to the host       |
| `{ type: "signal", data }`          | `{ type: "signal", data }` delivered to the other player (up to 4 KiB, e.g. connection candidates)         |
| `{ type: "leave" }`, or disconnects | `{ type: "left" }` to the host when the guest leaves; `{ type: "closed" }` to the guest when the host does |

`peer` is `{ name, address, port }`: the address the server saw the player connect from
(the last `X-Forwarded-For` entry, the one nginx appended) and the port that player announced. A game token
(`Authorization: Bearer` or `?token=`) makes `name` the MoonCellar user name, otherwise it is
`Player`. A room holds two players; mistakes answer `{ type: "error", message }`. The server pings
every 30 seconds and drops a socket that misses a pong; nginx keeps an idle socket for 120 seconds.
One address may hold 8 sockets; the next one gets `{ type: "error", message }` and is closed with
code 1013 ([rate-limits.md](rate-limits.md)).

### TURN relay

When the two players' networks block a direct path (NAT traversal fails), the game relays its
traffic through the `coturn` service of `infra/docker-compose.prod.yml`. With `TURN_SECRET` and
`TURN_URLS` set (in production the deploy writes both from the `TURN_SECRET` repository secret),
`hosted`, `joined` and `peer` carry
`turn: { urls, username, credential, ttl }` — coturn REST credentials (`use-auth-secret`):
`username` is `<expiry unix time>:<room code>`, `credential` is base64 HMAC-SHA1 of it with
`TURN_SECRET`, valid for `ttl` seconds (12 hours). Without them the field is absent and players
connect only directly. coturn listens on UDP 3478 and relays through UDP 49160–49200 on the host
network, refuses peers in private and loopback ranges, and caps a session at 256 KB/s. It runs a
single relay thread: with one per core, the kernel spread clients over per-thread `SO_REUSEPORT`
sockets on the production host and about half of them answered only now and then.

## Running it locally

```bash
docker compose -f infra/docker-compose.yml up -d mongodb
cp apps/game/.env.example apps/game/.env
bun run dev:game
curl localhost:3229/health
```

`bun run dev` starts it together with the API and the site. The site reaches it only when
`apps/web/.env` sets `NEXT_PUBLIC_GAME_URL` and `INTERNAL_GAME_URL` to `http://localhost:3229`.
Without them it falls back to `https://game.mooncellar.space`, whose CORS admits only
`https://mooncellar.space`: the server render still lists the achievements, but from
`localhost:3000` their icons stay empty squares and the profile shows no ports.

`bun --filter game build` type-checks the service and boots it in preview mode without touching
MongoDB, as the API's build does.

## Environment

| Variable                  | Default | Purpose                                                                                      |
| ------------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `MONGO_CONNECTION_STRING` | —       | The stack's MongoDB; the service uses its `game` database                                    |
| `PORT`                    | `3229`  | Listening port                                                                               |
| `API_URL`                 | —       | The MoonCellar API (`http://localhost:3228`); sign-in and token checks go through it         |
| `LOCAL_CONNECTION`        | —       | Extra CORS origins, comma-separated, next to `https://mooncellar.space`                      |
| `LOKI_HOST`               | —       | Sends logs to Loki under the label `app=mooncellar-game`; without it logs are pretty-printed |
| `PROMETHEUS_ENABLED`      | `true`  | Default process metrics, prefixed `mooncellar_game_`                                         |
| `TURN_SECRET`             | —       | coturn `static-auth-secret`; with `TURN_URLS` it turns on relay credentials in signalling     |
| `TURN_URLS`               | —       | TURN servers, comma-separated `host:port` (`game.mooncellar.space:3478`)                     |
| `METRICS_TOKEN`           | —       | Bearer token of `/metrics`                                                                   |
| `MODERATION_TOKEN`        | —       | Bearer token of the player-level moderation endpoints; without it nobody moderates           |

## Deployment

The `game` path filter of `.github/workflows/ci.yml` builds `apps/game/Dockerfile` with the
`HOST_ENV_GAME` secret as its `.env` and runs it as `mooncellar-game` in the `mooncellar` network;
nginx serves it as `game.mooncellar.space`, Prometheus scrapes it as the job `mooncellar-game`.
Variables and the first-deploy checklist are in [deploy-env.md](deploy-env.md#host_env_game-contents).
