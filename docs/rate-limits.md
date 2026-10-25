# Rate limits

`api.mooncellar.space` (`apps/api`) and `game.mooncellar.space` (`apps/game`) limit how many
requests one address may send, with `@nestjs/throttler` as a global guard. The options live once
per app in `src/shared/throttle.ts`.

## Who is limited

- **Only requests that came through nginx.** nginx adds `X-Forwarded-For` to everything it proxies
  (`include proxy_params` in `infra/nginx/mooncellar.conf`), and the apps listen on `127.0.0.1` and
  the `mooncellar` network only, so a request without the header is one of our own containers: the
  web server's server-side calls (`INTERNAL_API_URL`), the game service's calls to the API
  (`API_URL`), Prometheus. Those are never limited. If one of them were pointed at the public host
  instead, all its traffic would share one address and run into the limits below.
- **The address is the last `X-Forwarded-For` entry, the one nginx appended.** Both apps set
  `trust proxy` to `1`, and `/signal` reads the same entry by hand. A client can put anything at the
  front of the header; with `trust proxy true` Express took the first entry, so a forged header
  escaped every limit and chose the address `/signal` handed to the other player.
- **IPv6 addresses count per `/64`**, the throttler's default, so rotating addresses inside one
  network does not help.

## Limits

Each limit counts per address and per route, over a sliding window. Past it the app answers `429`
with `Retry-After` and `{ statusCode, message }`, "Too many requests from this address. Try again in
N seconds", which the site shows as a toast.

| Where | Routes | Limit |
| --- | --- | --- |
| API and game service | every other route | 600 per minute |
| API | `POST /auth/login` | 10 per 5 minutes |
| API | `POST /auth/signup` | 10 per hour |
| API | `POST /auth/game/device`, `GET /auth/game/device/:userCode`, `POST /auth/game/device/approve` | 10 per 10 minutes |
| API | `POST /auth/game/device/token` (polled every 5 s) | 30 per minute |
| API | `POST /auth/game/token/introspect` | 30 per minute |
| Game service | `POST /account/device` | 10 per 10 minutes |
| Game service | `POST /account/device/token` | 30 per minute |

A stricter route takes `@Throttle(<constant>)` with a constant from `shared/throttle.ts`.

## Game tokens in the game service

Every request with a game token costs the game service a call to the API's introspection unless the
answer is cached (30 seconds), so a stream of made-up tokens would turn into a stream of API calls.
`AccountService` stops that in three steps:

1. A token that is not a game JWT (three parts, a payload with `typ: "game"`, `id`, `sid` and an
   unexpired `exp`) answers "signed out" without a call.
2. Each address may cause 30 uncached checks a minute (`INTROSPECT_MISSES`); past that the request
   answers `429` "Too many sign-in checks from this address". The count goes through the
   throttler's storage.
3. The caches of tokens and friends hold 10,000 entries and drop the oldest one when full. They used
   to be cleared whole, so 10,000 junk tokens signed every player out of the cache at once.

## Signalling

`/signal` takes at most 8 open sockets from one address (`SIGNAL_SOCKETS_PER_ADDRESS`); the next
one receives `{ type: "error", message }` and is closed with code 1013. A socket hosts one room at a
time, so that also caps rooms per address. Anonymous clients may still connect: a game token only
changes the name the other player sees.

## Token guards

`/metrics` (both apps) and the moderation routes of the game service compare
`Authorization: Bearer <token>` with `METRICS_TOKEN` and `MODERATION_TOKEN` through
`timingSafeEqual` on SHA-256 digests, so neither the time taken nor the length gives the token away.
