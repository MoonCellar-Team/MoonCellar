# MoonCellar API (apps/api)

Rules that apply to the NestJS service. Repository-wide rules live in the root
[`CLAUDE.md`](../../CLAUDE.md).

## Runtime

- **Bun runs the TypeScript source directly — `start`, `start:dev` (`bun --watch`) and the
  container all execute `src/main.ts`.** Bun strips types without checking them, so `build`
  runs `typecheck` and `check:boot` instead of compiling. The container image runs `build`,
  so either failure stops the deploy there.
- **`tsconfig.build.json` type-checks with Bun's semantics (`module: preserve`,
  `verbatimModuleSyntax`); do not relax it.** It is the only thing that catches two boot
  failures before they ship:
  - A type imported without `import type` and named in decorator metadata — a decorated
    constructor, method _or property_, such as `@Prop() settings: IUserSettings` — stays in
    Bun's output, and the boot dies with `SyntaxError: Export named 'IUserSettings' not found
in module …`. tsc reports it as `TS1484`. `isolatedModules` alone (`TS1272`) misses the
    property case.
  - `import * as x` of a CommonJS package whose export is a function yields a namespace Bun
    will not call: `cookieParser is not a function. (In 'cookieParser()', 'cookieParser' is
an instance of Module)`. Use a default import; tsc reports the call as `TS2349`.
- **A named value import from a CommonJS package must be an own property of its exports, and
  tsc cannot check that.** mongoose's `Connection` lives on the prototype, so
  `import { Connection } from "mongoose"` in a decorated constructor dies with
  `SyntaxError: Export named 'Connection' not found in module …/mongoose/index.js`. Import it
  as a type — `@InjectConnection()` supplies the injection token. `check:boot` exists for this
  class of error: it loads `AppModule`, resolves the DI graph in Nest's preview mode without
  instantiating providers or touching MongoDB, and generates the OpenAPI document. It needs no
  `.env`.
- **Run a Bun script that imports decorated API code with `apps/api` as the working directory.**
  Bun takes decorator settings from the `tsconfig.json` of the working directory, not of the
  imported file. Started from the repository root, the same script dies inside `@Prop` with a bare
  `TypeError` thrown by `Reflect.getMetadata`; started from `apps/api` it runs. This applies to
  scratch scripts kept outside the app too.

## Errors

- **Every error response is `{ statusCode, message, ... }`, and `message` is a non-empty English sentence
  the web shows as is.** `agent.api.ts` toasts `message` for every failed request, so a missing or vague one
  reaches the user as "Request failed with status 500" with no way to act on it. This applies to every
  endpoint, new or changed.
- **Throw a Nest `HttpException` with a specific message for anything the caller can act on; never a plain
  `Error` in a request path.** Say what failed and, where it helps, what to do: "The game is not a
  candidate", "Steam hides this library. Set Game details to Public…". Pick the status by who is at fault —
  4xx for the request, 502 for an upstream service (`BadGatewayException`, as `HltbSearchFailedError` and
  `remote-image.ts` do), 503 for a missing key or a disabled feature. Never construct an exception without
  a message, and an exception with an object body carries `message` next to its data
  (`PossibleDuplicatesErrorSchema`).
- **`ErrorResponseFilter` (`shared/error-response.filter.ts`, `APP_FILTER`) is the net under that rule, not a
  replacement for it.** It normalises a list of messages into one sentence, spells out a Zod validation
  failure field by field ("Validation failed: name: …"), maps a malformed id (`CastError`) to 400, a duplicate
  key to 409, a failed axios call to 502 naming the host, and a body-parser error to its own status. Anything
  else becomes 500 with a generic message: the real text stays in the log, because an unknown error's message
  can carry internals (a connection string, a query) that must not reach a browser. A 500 the user meets is
  therefore a bug to fix at the throw site.
- **A guard throws its own message; it never returns `false`.** `false` makes Nest answer
  "Forbidden resource", which tells an admin nothing; `RolesGuard` names the role the action needs.
- **A handler that answers through `@Res()` still throws for errors**, never `res.status(4xx).send()`
  without a body: the filter only shapes what is thrown.
- **WebSocket gateways are outside the filter** (global filters never reach them, see Sockets) and answer
  through the ack or `connect_error`.

## Auth

- **Every path that ends a session clears the cookies in its own response, before anything
  that can throw.** The browser cannot drop the `httpOnly` cookies itself, so a logout that
  fails on the user update, or a refresh rejected because a logout elsewhere nulled
  `refreshToken`, otherwise leaves a valid `accessMoonToken` behind for up to seven days, and the
  web profile keeps treating that browser as its owner. `JwtRefreshGuard` and the refresh handler
  clear them on `UnauthorizedException` only — a database error must not log everyone out.

## Game sign-in

- **Game tokens are signed with `JWT_SECRET + ":game"`, never with the plain `JWT_SECRET`.**
  `JwtStrategy` accepts any token signed with the plain key as the `accessMoonToken` cookie, so a
  game token signed with it would open the site as that user. The flow, the endpoints and the
  introspection contract are in [`docs/game-sign-in.md`](../../docs/game-sign-in.md).
- **A game token is only valid while its `game_sessions` row is not revoked** — check it through
  `GameAuthService.introspect`, never by verifying the signature alone, or signing a device out
  on the site would not stop it.

## Rate limits

- **A request without `X-Forwarded-For` is one of our own containers and is never limited; never
  send a server-side caller through nginx.** The global `ThrottlerGuard` skips it (`skipIf` in
  `shared/throttle.ts`) because the web server (`INTERNAL_API_URL`), the game service (`API_URL`) and
  Prometheus call `mooncellar-backend:3228` directly. Pointed at `https://api.mooncellar.space`
  instead, all server-side rendering would share one address and get `429` under crawler load.
- **`trust proxy` stays `1`, never `true`.** nginx appends the real address to whatever
  `X-Forwarded-For` the client sent, and `true` makes `req.ip` the first entry: a forged header
  escaped every limit. The limits, what they count and how to make a route stricter
  (`@Throttle(SIGN_IN_THROTTLE)`) are in [`docs/rate-limits.md`](../../docs/rate-limits.md).

## Sockets

- **Pin `@nestjs/websockets` and `@nestjs/platform-socket.io` to the major of `@nestjs/core`.**
  The npm `latest` of both is already 12.x while the app runs Nest 11, so a bare
  `bun add @nestjs/websockets` installs a gateway runtime that does not match the core it plugs
  into.
- **Global `APP_PIPE`/`APP_INTERCEPTOR` providers never reach a gateway handler.** Nest builds the
  WebSocket context creators without the application config, so `ZodValidationPipe` does not
  validate a `@MessageBody()` DTO and `HttpMetricsInterceptor` does not run. Validate a socket
  payload inside the handler (`DiscussionRoomRequestSchema.safeParse`) and answer through the ack.
- **Never broadcast a decorated `IComment`.** `decorate()` fills `isLiked`, `isReported` and the
  admin-only `reportsCount` for one viewer and keeps hidden bodies for admins, while a discussion
  room is anonymous — every subscriber would receive that one viewer's flags and the moderators'
  view. Events carry only what an anonymous reader already gets from REST, and anything
  viewer-specific is refetched. The contract is in [`docs/sockets.md`](../../docs/sockets.md).
- **Socket.IO server options belong in `SocketIoAdapter`, never in `@WebSocketGateway`.** Nest
  creates one server per port from the options of whichever gateway it initialises first and
  ignores the rest, so a `cors` block on one gateway silently decides CORS for every namespace —
  or for none, depending on module order. `src/shared/socket-io.adapter.ts` sets the origins and
  `credentials: true`, without which the `/royal` handshake receives no session cookie over
  long-polling.
- **An authenticated namespace reads the session once, from the handshake.** `RoyalGamesGateway`
  verifies `accessMoonToken` from `socket.handshake.headers.cookie` in namespace middleware; a
  rejected socket gets `connect_error` with `Unauthorized`, and Socket.IO does not retry it. The
  handshake belongs to the underlying engine connection, not the namespace, which is why the web
  client opens `/royal` and `/notifications` on their own account `Manager`.
- **Pass `ObjectId`s into the `royalGames` update pipelines.** Mongoose casts ordinary updates but
  not aggregation-pipeline updates, so a string id would be stored as a string next to ObjectIds
  and the `$in` checks that deduplicate the list would never match it.

## Projects (status hub)

- **A project has one upload token per machine or CI (`tokens`: id, name, sha256, `lastUsedAt`), and
  only the hash is stored.** The add and exchange answers are the only place a token exists; nothing
  reads it back. The check hashes the token and compares with `timingSafeEqual`. Projects created
  before the list kept one `tokenHash`; `ProjectsService.onModuleInit` moves it into `tokens` as "First
  token" with the same hash, so their uploaders keep working — keep that migration until no project
  carries `tokenHash`.
- **A connect code is single-use and short-lived: `projectconnectcodes` stores its sha256 with a TTL
  index on `expiresAt` (ten minutes), and the exchange is one `findOneAndDelete`.** The code travels
  through the browser (a redirect to `127.0.0.1`), the token never does; a second exchange of the same
  code answers 400.
- **`PUT /projects/:slug/data/:block` answers the same 401 for a missing header, a wrong token and a
  project that does not exist,** so the public endpoint does not tell which addresses are taken. It
  sits in its own controller (`ProjectUploadsController`) because the admin controller's class-level
  JWT and role guards would otherwise run before the token check.
- **A block is validated with its schema (`PROJECT_BLOCK_SCHEMAS`) and stored as a JSON string in
  `projectdata.body`, never as a document.** Decompilation units are keyed by file paths full of dots,
  which Mongo field names handle badly, and the admin read returns the string untouched
  (`@Header("Content-Type", "application/json")`). The menu's progress comes from `uploads` on the
  project, written with each upload by `getProjectBlockProgress`, so listing projects never reads a
  block.
- **A plan is one `projectplans` document per project, and every task change is one
  `findOneAndUpdate` that matches the task by `$elemMatch` on its id _and_ the owner and done flag read
  just before.** Two people taking the same task at once: the second update matches nothing and answers
  409 "changed meanwhile". Never write `tasks.$` with a query that matches the array a second way (a
  top-level `"tasks.done"` next to the `$elemMatch`): the positional operator then points at whichever
  element matched last. A task's state is derived on read (`getPlanTaskState`), never stored.
- **What a project uploads beside a block (`decomp/functions` in `projectdata`) is listed in
  `BLOCK_EXTRAS` and goes away with the block; deleting a project also deletes its plan and plan
  events.** A new kind of upload beside a block goes into that list, or a dropped block leaves it behind.
- **`PUT /projects/:slug/data/plan` imports into an empty plan and answers 409 afterwards.** It is how a
  project that used to upload its plan migrates by itself; once the plan lives in the hub, a stale
  uploader must not overwrite what people changed on the site.
- **The global JSON limit is 2 MB of decoded body, gzip or not;** the API's nginx block passes up
  to 8 MB (`client_max_body_size`, sized for the 5 MiB `COMMENT_IMAGE_MAX_BYTES` plus multipart
  overhead), so for a JSON upload the API's limit is the one that answers.
- **Project addresses in `RESERVED_PROJECT_SLUGS` are routes of the hub** (`login`, `manage`, …); a
  project there would never be reachable. Extend the list together with a new top-level hub route.

## Notifications

- **A module whose provider injects `NotificationsService` must import `NotificationsModule`, and
  so must every other module that lists the same provider.** `AuthModule` provides its own
  `UserFollowingsService` next to `UserModule`'s, so importing the module into `UserModule` alone
  failed `check:boot` with "Nest can't resolve dependencies of the UserFollowingsService (UserModel,
  ?) … in the AuthModule module". Grep `providers:` for the service before wiring it.
- **Call `notify()`, `retract()` and `removeBySubject()` after the write and never `await` them
  in the request path.** They log and swallow their own errors, so a failed notification never
  fails the like, reply or decision behind it. The flow is in
  [`docs/notifications.md`](../../docs/notifications.md).
- **The upsert is an aggregation-pipeline update, so every id in it is an `ObjectId` and every
  stored string goes through `$literal`.** Mongoose casts neither, and a list or game name that
  starts with `$` would otherwise be read as a field path.
- **Grouping relies on the unique partial index `{ userId, groupKey }` where `isRead: false`.**
  Two events at the same moment race on the upsert; the loser gets `E11000` and `notify()`
  retries once, which then joins the winner's group. Do not drop the index or switch the filter
  to `readAt: null`.

- **A push endpoint is accepted only from `PUSH_SERVICE_HOSTS` over https.** `PushService` POSTs
  to the stored endpoint, so dropping the check lets any user point the server at an internal
  address. Extend the list when a browser ships a new push service, never replace it with a bare
  URL check.
- **`VAPID_*` must be one pair across every process on the same database.** A subscription is
  bound to the public key it was made with; a second pair makes the push services answer 403, and a
  new pair orphans every stored subscription.

## User logs

- **A log stores state, never text: `playthrough` (`action`, `before`, `after`), `rating`
  (`value`, `previous`) and `favorite`, and the web builds every sentence from them.** The
  former HTML text was parsed back with regexes on read, so rewording a header silently broke
  old rows, and a status stored as "Mastered" _or_ the category lost that a game was completed.
  Rows written before the change are converted by `scripts/migrate-user-logs.ts` (dry run unless
  `--apply`).
- **Every write goes through `recordUserLog`, which merges into the user's latest log when it is
  for the same game and the same playthrough, using `mergeLogChanges`.** A merge keeps the
  _first_ `before` and the _last_ `after`, and drops a part that nets to nothing (added then
  removed, rating set then removed, an update reverted). Replacing the whole part instead is what
  made a repeated save with nothing changed overwrite the recorded update with an empty one.
- **The playthrough state never includes the comment, only `hasReview`.** The comment is a review
  shown on the game page and the profile; copying it into the log made deleting the log the only
  way to take it back. `hasReview` must match `PUBLIC_REVIEW_FILTER` in `reviews.service.ts`
  (public, not wishlist, non-empty), or the feed announces reviews the game page does not show.
- **The platform name is stored next to `platformId`.** A log is a snapshot of the action, and
  the name saves a platform lookup in every module that provides `UserLogsService`.
- **A merge writes with the `__v` it read in the filter and retries on a miss.** Two requests
  for the same game (a playthrough save and a rating) otherwise read the same log and the second
  write drops the first one's change.

## Account deletion

- **A new collection that stores a user id must be cleaned up in `AccountDeletionService`
  (`module/user/services/account-deletion.service.ts`).** It is the only path that deletes a
  user — `DELETE /user/account/:userId` (password re-entered) and the admin
  `DELETE /admin/users/:userId` both call it — so a collection it does not know keeps orphaned
  personal data after the account is gone, and a counter it does not repair (`likesCount`,
  `helpfulCount`, `repliesCount`, game ratings) stays inflated forever.
- **It matches `Rating`, `UserLogs` and `Playthrough` by `{ $in: [ObjectId, string] }`.** Their
  `userId` is a bare `@Prop({ ref })`, i.e. `Mixed`, and older rows hold either form; the admin
  delete it replaced passed the string alone and left ObjectId rows behind.
- **The user's comments are soft-deleted (`status: "deleted"`, empty body), never removed,** so
  reply threads keep their structure; content requests, conflicts and comment reports keep the
  dangling `userId`, which resolves to no author. So do news posts (`articles.authorId`): they
  are site content, not the admin's personal data, and an unknown author renders as none.
- **A wrong password answers 403, not 401.** The web `agent` treats every 401 as an expired
  session and retries after a refresh, which would loop on a wrong password and then log the
  user out.

## Gauntlet history

- **Never add a single-segment `GET /user/<word>` route.** `UserProfileController` declares
  `@Get(":userId")` and is registered first, so `GET /user/gauntlet-history` reached `getUser`
  with `userId = "gauntlet-history"`. That is why the history has its own `gauntlet-history`
  controller prefix; take the viewer from `request.user`, not from a path id.
- **A history lives in `gauntlethistories`, one document per user and game (unique
  `{ userId, gameId }`), ordered by `wonAt`.** A re-won game moves to the top instead of
  appearing twice, unknown game ids are dropped, and every add trims the list to
  `GAUNTLET_HISTORY_LIMIT` (oldest first). The limit is what keeps `GET /gauntlet-history/ids`
  small — the web sends that whole list as `excludeGames` for "Exclude history".

## Custom lists and favourites

- **Public user search is `GET /users/search`; never point a search box at `GET /user/search`.**
  The older endpoint matches an exact e-mail as well as a user name, so exposing it would tell
  anyone whether an address has an account. The new one matches names only and returns public
  fields.
- **Every write to `CustomList.games` must also set `gamesCount`.** The catalogue filters on it
  (`gamesCount >= minGames`, and `>= 1` hides empty lists) and sorts by it without looking at the
  array, so a write that forgets it makes a list vanish from `/lists` or sort as empty.
- **A rename moves the old slug into `previousSlugs`; never drop that array.** `getBySlug` matches
  previous slugs so the web route can `permanentRedirect` — links shared before the rename keep
  working only through it.
- **`likesCount` changes only through `$inc` with `timestamps: false`, and only when the like
  document was actually inserted or deleted.** A like must not move `updatedAt`: "Recently
  updated", the popularity tie-break and the profile's Lists panel (after the owner's
  `position`) all order by it, so a like that bumps it reshuffles lists nobody edited. The unique `{ listId, userId }` index makes a repeated
  like a no-op — keep reading `upsertedCount`/`deletedCount` rather than incrementing blindly.
- **`PATCH /lists/order` must stay declared above `PATCH /lists/:id` in the controller, and it
  writes `position` with `timestamps: false`.** Express matches routes in declaration order, so
  below `:id` the reorder hits `updateList` with `id = "order"` and fails with 400 on the id. A
  list that was never reordered keeps `position: 0` and sorts first, which is where a new list
  should appear.
- **Lists with a `generator` belong to `GeneratedListsService`, never to a person.** They are owned
  by the `MoonCellar` account, rebuilt every Monday (and by `POST /lists/generated/refresh`), and a
  rebuild overwrites their games, name and description — an edit made by hand is lost within a
  week. The unique partial index on `generator.kind` + `generator.key` is what stops two API
  processes (the server and a local `dev:api` on the same database) from creating a list twice;
  keep it. The set is decades, each of the last `GENERATED_LIST_RECENT_YEARS` years, the
  standalone expansions, `GENERATED_LIST_COMPANIES` and `GENERATED_LIST_KEYWORDS`; the genre and
  platform lists were dropped on purpose. A refresh deletes every generated list (and its likes)
  whose `kind` + `key` is no longer defined, so the year window rolls forward without leaving a
  frozen list behind — and renaming a `key` deletes the old list with its likes instead of
  renaming it.
- **A company list matches the developer role only, by name pattern.** IGDB records regional
  publishers, so a publisher match put Warcraft III and GTA III into "Best Capcom games"; the
  patterns are prefixes so a family's studios (Rockstar North, Nintendo EAD, Ubisoft Montreal)
  count. Companies are chosen by popularity — the IGDB votes of their ten most-voted games — not
  by how many games they have, which would rank Konami above FromSoftware.
- **Game search ranks by match kind, never by the fuzzysort score.** `getSearchRelevanceTier`
  puts the exact name first, then names starting with the query as a whole word, then names
  holding it as a whole word later, then substrings, then fuzzy matches, and sorts by votes
  inside each tier. The score mostly measures title length:
  "eden" scored `edengrad` 0.907 and `metal eden` 0.884, so score thresholds put a dozen unrated
  short titles above every popular game with the word in its name.
- **The search index holds one entry per name variant — the name, each `alternative_names`
  entry, and the Arabic-numeral form of each — and a game takes the best tier of its entries.**
  `getSearchNames` builds them and `searchIndex` folds the matches back to one row per game;
  `getGames` counts `total` from that list, so a game matched twice must not appear twice.
- **Search text goes through `normalizeSearchText`, never `normalizeTitle`.** The latter keeps
  only `a-z0-9` because it feeds the stored `nameNormalized` that the source matchers compare;
  used for search it turned "Ведьмак 3: Дикая охота" into "3" and a Cyrillic query into an empty
  one. Query and index must use the same normaliser, or nothing matches.
- **`POST /lists/by-slug` filters a list's games with the catalogue's `gamesFilters`, restricted
  to the list's ids, and searches names by substring of `nameNormalized`.** The GET stays for the
  server render and the unfiltered page. The response keeps `gamesCount` as the full count and
  each game's list `position`, so ranks stay true inside a filtered view.
- **Adding or removing a game in a list never writes a user log.** Lists are edited in bulk, and
  logging every addition buried playthroughs and ratings in the activity feed; the feed records
  what happened to a game, not how it was filed. Favourites do log, through the `favorite`
  segment.
- **A single favourite is added or removed through `POST`/`DELETE
/user/:userId/favorites/:gameId` (and `favorite-characters/:characterId`), never through the
  `PATCH` that replaces the whole list.** The client builds lists from the persisted auth-store
  profile, which can be older than the database (another tab or device), and a replace built from
  it silently deletes favourites added elsewhere. The `PATCH` is for the reorder editors only.
  Deleting a character must also pull it from `favoriteCharacters`, or every later replace fails
  with "One of the characters does not exist".

## News posts

- **A post's slug follows its title only until its first publication; after that it never
  changes.** `ArticlesService.update` keeps the stored slug once `publishedAt` is set, so a link
  shared or indexed after publishing keeps working through any later retitle. There is no
  `previousSlugs` redirect as lists have, which is why the slug must not move.
- **`publishedAt` is the date of the first publication and survives Unpublish.** The archive and
  the feed group and sort by it, in UTC (`$year`/`$month`, `getPublishedRange`); the web formats
  dates in UTC too, or a post published near midnight lands in a different month than the
  archive counts it in.
- **A comment belongs to a game or to a news post: exactly one of `gameId` and `articleId` is set,
  in one `gamecomments` collection.** `CreateCommentRequestSchema` refuses both or neither and a
  `reviewId` on a post comment; `CommentsService.findSubject` checks the game, or that the post is
  published (404 "The post was not found" for a draft). Every event carries both fields and the
  gateway picks the room from them (`discussion:game:<id>` / `discussion:article:<id>`), so a new
  event built with `gameId` alone never reaches a post's readers. A post comment has no author
  playthrough, and its notifications carry `articleSlug`/`articleTitle` instead of the game.
- **Deleting a post deletes its comments, their votes and reports, and the notifications about
  them** (`ArticlesService.removeComments`). Comments are site content tied to the post; left
  behind they would sit in the moderation lists with no post to open. Unpublishing keeps them.
- **A post's views change only through `POST /articles/:id/views`, with `$inc` and
  `timestamps: false`.** `updatedAt` is the sitemap's `lastmod` for the post and the order of the
  admin list, so a view that moved it would make every read post look freshly edited. A view is
  counted once per visitor per `ARTICLE_VIEW_WINDOW_SECONDS` (30 minutes): `articleviews` holds a
  row per post and visitor — a sha256 of the user id, or of the address and user agent for a
  guest — under a unique index, and a TTL index on `createdAt` drops it after the window. The
  hash is not a user id and the row lives 30 minutes, which is why account deletion does not
  clean the collection. Crawlers and requests without a browser user agent are not counted, and
  a draft answers 404.
- **`views` appears only in admin responses** (`AdminArticleSchema`, `AdminArticleListItemSchema`:
  `GET /articles/admin`, `GET /articles/admin/:id`, create and update). The public post is served
  through an ISR page, so a count in `GET /articles/by-slug` would land in the cached HTML.
- **Post images must be Space URLs** (`image` starting with `S3_CDN_URL`): the editor uploads
  through `POST /file/comment-image`, and the web renders the image with `next/image`, which
  only knows the configured hosts. Both `image` and `content` are in `REFERENCE_SOURCES`, or the
  orphan sweep would delete every post image a week after upload.

## Steam import

- **A linked Steam library lives in `steamlibraries` (one document per user), never in a custom
  list or on the user document.** `GET /user` responses return the whole user in many places, and
  a library of a few thousand games would travel with each of them. `POST /steam/library` reads
  it with the user's `steam.achievements`, filters through `CustomListsService.findMatchingGames`
  and sorts with `sortSteamLibrary`. Lists with `source: "steam"` are legacy: every import deletes
  the user's one (`deleteSourceList`), and `CustomListsService` still refuses edits to any list
  with a `source` (403). The flow and the endpoints are in [`docs/steam.md`](../../docs/steam.md).
- **The nightly Steam run is `SteamAccountService.syncAllCron` (05:15): it re-imports each
  library, which then reads achievement progress.** `SteamProgressService` has no cron of its own;
  a second one would read progress against a library the import is about to replace.
- **The OpenID `return_to` is compared exactly with `<FRONT_URL>/user/<name>/settings` of the
  signed-in user, and the assertion is linked only after Steam answers `is_valid:true` to
  `check_authentication`.** Skipping either lets anyone post a forged or replayed claimed id and
  import someone else's library.
- **`GetOwnedGames` can name an app by its old title, so the library match compares candidates
  with the store name (`steam.name`) first.** App 35720 is "Trine 2" in the library and "Trine 2:
  Complete Story" in the store; matched by the library name, everyone who owns the Complete Story
  got the base game.
- **`GetOwnedGames` answers `{ response: {} }` for a profile whose game details are private.**
  It is not an error status; treat a missing `games` array as "private" (422), never as an
  empty library, or the import replaces a full library with nothing.

- **Steam achievement counts come from `ISteamUserStats/GetSchemaForGame` with `STEAM_API_KEY`,
  never from the store's `appdetails`.** The Web API allows about 100,000 calls a day; the store
  endpoint about 200 per five minutes, which would take days for the ~180,000 games that carry a
  Steam app id (`externalPages` entry `Steam`, numeric `uid`). `SteamAchievementsService` runs
  nightly (`STEAM_ACHIEVEMENTS_CRON`, at most `STEAM_ACHIEVEMENTS_DAILY_LIMIT` games under the
  `steam-achievements-sync` lock): games never read first, then counts older than
  `STEAM_ACHIEVEMENTS_STALE_DAYS`. `200 {"game":{}}`, `403 {"game":{}}` and `400` mean "no
  achievements" and store `total: 0`; any other failure stores nothing, and 10 failures in a row
  stop the run — the HLTB sync once read failures as "not found" and hid 60,000 games. Steam
  answers an app without a stats schema with `403 {"game":{}}` and a bad key with a `403` HTML
  page, so `fetchTotal` reads the body of a 403 before failing: counting every 403 as a failure
  aborted each run after 10 schema-less games. Admins trigger it with
  `POST /steam/achievements/sync` and one game with `POST /steam/achievements/games/:gameId`.

- **A linked user's Steam progress comes from `IPlayerService/GetTopAchievementsForGames`, 100
  apps per request.** With a large `max_achievements` it returns, per app, the total and every
  achievement the user unlocked, so a 700-game library costs 8 requests instead of one
  `GetPlayerAchievements` per game. It is not in Steam's published docs; if it changes, fall back to
  `GetPlayerAchievements`. `SteamProgressService.syncUser` runs after every library import (link,
  Update library) and nightly for every linked account, stores only games with at least one
  unlocked achievement in `user.steam.achievements` (`appId`, `gameId`, `unlocked`, `total`,
  `masteredAt`), and takes `masteredAt` from the last unlock time of `GetPlayerAchievements` for
  newly mastered games only (`STEAM_PROGRESS_MASTERED_LOOKUPS` per run). A failure there never
  fails the library import. `SteamPlaythroughsService` mirrors the RA one: only for a user with
  `settings.steamSyncPlaythroughs`, a mastered game gets a `completed` + `isMastered` playthrough
  marked `steamAppId`, never on a game the user already has a playthrough of, and deleting it adds
  the app to `steamIgnoredApps`.
- **The RA sync fills in set data for every linked set that lacks it** (`fillMissingSetData`):
  from the downloaded lists when the set is there, otherwise one `getGameExtended` per set, at most
  `RA_MISSING_SET_LOOKUPS` per run. A link the run did not match again — kept on purpose — or a set
  on a console no platform maps to would otherwise stay without its icon and count forever.

- **Read every Steam page of a game (`getSteamUids`), never only the first.** A game often carries
  two (an expansion or a re-release on its own app); reading the first one alone sent 1,031 apps
  that were already linked to their game into conflicts as "another Steam app" (RACE On, app 8780,
  next to 8640). `steam` holds one app (`pickOwnApp`: the same name first).
- **A game's Steam link lives in `steam` (`appId`, `name`, `updatedAt`), filled by
  `SteamGamesService` from `IStoreService/GetAppList` (all ~190,000 Steam games, 50,000 per
  request).** A game whose `externalPages` already carries a Steam id is linked directly (~143,000).
  A Steam app nobody links is matched by exact `nameNormalized`: it links on its own only when
  there is one candidate, the candidate has no Steam id of its own and PC (`win`, `mac`, `linux`)
  among its platforms; any other name match becomes a `steam` conflict (direction `games`) with
  the app snapshotted in `externalData`. Skip creates the game, as for VNDB: `createGame` reads the
  store page (`appdetails`), takes the 600×900 library poster as the cover (the header image when
  there is none) and `library_hero` as the background, and saves it through
  `GamesService.addGame` (`isCustom`, images uploaded to the Space). A resolved conflict pins its
  winners on every later run, so a link survives an IGDB sync that rewrites `externalPages`. Apps
  with no name match (~44,000) are not imported as new games on their own.

## Database

- **Declare reference paths as `@Prop({ type: mongoose.Schema.Types.ObjectId, ref })`; a bare
  `@Prop({ ref }) x: mongoose.Types.ObjectId` becomes a `Mixed` path.** Mongoose casts string
  ids only on `ObjectId` paths, so a query with a string id against a `Mixed` path matches
  nothing and returns an empty result instead of an error — reviews on the game page showed
  "Not rated" for authors who had rated the game. `Rating.userId`/`gameId` are declared the bare
  way, which is why `UserRatingsService` wraps every id in `new mongoose.Types.ObjectId(...)`.
  Before querying a model with string ids, check `schema.path(name).instance`, or convert
  explicitly (`asObjectId`/`asObjectIds` in `module/comments/utils`). Writes break the same way:
  `Game.platformIds` was declared bare until 2026-10-22, and the 1,182 games `addGame` created
  (Steam and HLTB Skips, games added by hand) stored the platform ids as strings, which the
  catalogue's platform filter (`ObjectId`s in `shared/games.ts`) never matched. An array of
  references is `@Prop({ type: [mongoose.Schema.Types.ObjectId], ref })`.
- **The `.env` connection string points at the production database, and Mongoose `autoIndex`
  is on.** A new `Schema.index(...)` is built on production the first time any local process
  loads that schema. One-off scripts that import schemas connect with `autoIndex: false`.
- **A local API is a second production instance: keep `DISABLE_CRONS=true` in the local `.env`.**
  The `.env` also carries the production Space, so every cron a local `bun start:dev` runs writes
  to both. With the flag set, `ScheduleModule` is not loaded and no `@Cron` fires.
- **A job that writes games or images guards itself with `withDbLock` (`shared/cron-mutex.ts`),
  not only with an in-memory flag.** `isRunning` and `runCronExclusive` exist per process. On
  2026-09-28 two processes ran the VNDB sync at once, and the unique `vndb.vnId` index rejected
  the loser's games after its images were uploaded, which left about 1,250 orphan folders in the
  Space. The VNDB sync, the IGDB games and characters syncs and the conflict decision worker take the lock
  today.

- **`TRIM_IGDB_STAGE` (`games.service.ts`) cuts `igdb` down to the fields it names in every game
  response — by slug, by id, lists, Gauntlet history.** A field stored on `igdb` and declared in
  `@mooncellar/schemas` still arrives as `undefined` until it is added there: the game page never
  showed IGDB's vote count although `total_rating_count` was in the database and the web already
  read it.
- **A game's characters are read from `character.gameIds`, never from `game.characters`.**
  `CHARACTERS_LOOKUP_STAGE` joins on `gameIds` because `linkGameCharacters` (IGDB) and
  `linkVndbCharacters` rewrite `game.characters` with only their own characters every run, so a
  character created by an admin or an approved request vanished from its game's page after the
  next sync. The syncs recompute `gameIds` only for characters that carry their `igdb`/`vndb`
  field, which leaves manual links alone.
- **Stored site cookies (`SitesService`, admin Sites tab) are sent only when a caller passes
  `{ useSessions: true }` to `downloadRemotePage`/`downloadRemoteImage`/`uploadRemoteImage`,
  and only admin paths do: AI drafts, portrait search, admin game and character saves.** A link
  from a user request must never get them, or anyone could make the server fetch a page as the
  admin's account. The headers are looked up per redirect hop, so a cookie never follows a
  redirect to another host.
- **An image URL that came from a user is fetched only through `FileService.uploadRemoteImage`.**
  It goes through `downloadRemoteImage`, which refuses non-http(s) links, private, loopback and
  link-local addresses on every redirect hop, non-image content types and bodies over 15 MB. A
  plain `axios.get` on a request's link lets anyone point the server at the cloud metadata
  endpoint or the internal network.

## Tests

- **A spec that imports anything reaching `shared/utils/rich-text.utils` must mock that
  module.** Jest runs the source as CommonJS and cannot load `htmlparser2`, the ESM-only
  dependency of `sanitize-html`, so the suite dies at import with `Must use import to load ES
Module` before a single test runs. `comments.controller.spec.ts` mocks it with `jest.mock`.

## Storage

- **Everything lives in one DigitalOcean Space (`S3_BUCKET`, `mooncellar`); the former buckets are
  top-level folders listed in `S3_FOLDERS` (`src/shared/s3.ts`).** Keys go through `FileService`,
  which prefixes the folder — never build a `Bucket`/`Key` pair anywhere else. The one exception is
  the standalone `mcp/game-adder`, which runs outside Nest's DI; it takes the bucket, folders and
  CDN from the same `src/shared/s3`, so the two cannot drift apart.
- **`mcp/game-adder` runs `sharp` in a `node` subprocess, never in its own Bun process.** Under
  Bun 1.4 the first `sharp(...)` call (even `.metadata()`) never resolves on the dev machine, while
  the same call under Node answers in milliseconds, so an in-process call hangs `create_game` with
  no error. The server also does not rely on `ffprobe`/`ffmpeg`: they were missing locally, and the
  upload code silently skipped the cover and every artwork, which left the external URLs in the
  game and made `next/image` fail the game page with 500 on an unconfigured host.
- **A client-supplied `bucketName` must pass `resolveS3Folder` before it reaches `FileService`.**
  With one bucket the name is only a key prefix, so an empty or unknown value addresses the root:
  `DELETE /file/clear-bucket?bucketName=` would wipe every folder at once, and the unauthenticated
  `GET /file/bucket-keys` would list the whole Space. The resolver accepts a folder name or the
  legacy `mooncellar-<folder>` name (old frontend bundles still send it); the controller answers
  400 for anything else.
- **Build public URLs only with `FileService.getPublicUrl(folder, storedKey)`, from the key
  `uploadFile` returns.** `uploadFile` appends the extension itself. The hand-built URLs this
  replaced dropped it, so admin cover uploads were saved as links to objects that did not exist.
- **The storage variables were renamed on purpose, and the old names are no longer read.** The
  former `S3_HOST_CDN` carried a `%backet` placeholder; reading it under the new scheme would put
  `%backet` into every URL the IGDB cron writes into `games`. Configure `S3_ENDPOINT`, `S3_BUCKET`
  and `S3_CDN_URL` (each defaults to the production Space) plus `S3_ID`/`S3_KEY`. The signing region
  is `us-east-1`, as DigitalOcean's SDK docs specify — the datacenter lives in the endpoint.
- **Objects are copied with `scripts/transfer-s3.ts`, which drives rclone once per folder in
  `S3_FOLDERS`.** The source keys are `LEGACY_S3_ID`/`LEGACY_S3_KEY`, separate from `S3_ID`/`S3_KEY`
  because the copy needs both providers at once; the script refuses to run when the two IDs match,
  since that means the Space would be written with the regru keys. `common` is copied `private`
  (the filters JSON is read through the API), every other folder `public-read`. It compares by
  `--size-only`: keys are generated IDs whose content never changes, and anything stricter costs a
  HEAD per object across 2.3 million of them. `--tpslimit 250` stays under the 300 write operations
  per second older Spaces allow — above it Spaces answers `503 SlowDown`. Run `--check` before
  applying the URL migration.
- **Stored URLs are rewritten by `scripts/migrate-s3-urls.ts`, not at read time.** It maps both
  legacy forms (`s3.regru.cloud/mooncellar-<folder>/…` and `mooncellar-<folder>.s3.regru.cloud/…`)
  to `S3_CDN_URL/<folder>/…` across `games`, `characters`, `users`, `playthroughs` and `userlogs`.
  It is a dry run unless called with `--apply`; apply it only after the objects are copied into the
  Space, or every rewritten link 404s.
- **Duplicate game images are found by md5 _and_ by perceptual hash, because neither alone finds
  them all.** `ImageDedupeService` (`POST /games/images/dedupe/:slug`, and the background run on
  `POST /games/images/dedupe`) needs both: IGDB serves the same picture under several `image_id`s,
  which is byte-identical and md5 catches it, while the copy of a picture that VNDB also has was
  fetched through IGDB's `t_1080p` transform (`getImageLink(url, "1080p")` in `igdb.service.ts`) —
  an upscale of a smaller original, so every byte differs and only the perceptual hash matches it.
- **The perceptual hash is a 256-bit dHash and `DEFAULT_PERCEPTUAL_THRESHOLD` is 10; do not raise it
  much.** Measured over the Grisaia and Patlabor screenshot sets, real duplicates land at distance
  0–7 and the nearest non-duplicate at 23 — and those non-duplicates are the same CG with different
  dialogue or a different localisation, which a looser threshold would delete. The 64-bit variant
  put that boundary at 4 against 10 and is too tight to use.
- **Delete a dropped image only after comparing `parseS3ImageUrl` refs, never URL strings.** A
  legacy `s3.regru.cloud/mooncellar-screenshots/<key>` URL and the current
  `S3_CDN_URL/screenshots/<key>` URL are different strings addressing the same object in the Space,
  so deleting the dropped one by URL would take the kept one with it. This is also what keeps the
  orphan sweep safe before `migrate-s3-urls.ts --apply` has run: a game still holding regru URLs
  resolves to the same keys, so its objects count as referenced instead of as orphans.
- **`FileOrphansService` (`POST /file/orphans`) reads every reference first and only then lists the Space, and it never
  deletes an object newer than `cutoff`.** An object uploaded between the two steps is in the
  listing but not in the reference set, so it would look like an orphan; `cutoff` is the earlier of
  the scan's start and `now - minAgeDays` (7 by default) and excludes it. Lowering `minAgeDays` to 0
  leaves only the scan-start guard, which is enough for a run nothing else is writing during.
- **Every field that stores a Space URL must be listed in `REFERENCE_SOURCES`
  (`file-orphans.service.ts`), or the sweep deletes its files.** Today that is `games.cover`,
  `screenshots`, `artworks`, `backgroundImage`, `bannerImage`, `characters.mugShot`,
  `users.avatar`/`background`, `generatedimages.url`, `articles.image` and the rich-text
  `gamecomments.body`, `playthroughs.comment` and `articles.content`.
  The first version read only the three game image arrays and would have removed every game
  background and banner. A new image field goes into that list in the same change.
- **`LastModified` in the Space is the rclone copy time, not the original upload, so a fresh
  `transfer-s3.ts` run hides the whole corpus behind `minAgeDays`.** The objects copied from regru
  all carry the date of the transfer — a cover for `the-fruit-of-grisaia` that no game has
  referenced for months still reads `2026-09-11`. After a transfer, either wait out `minAgeDays` or
  lower it deliberately; do not read a run full of `tooRecent` as "no orphans".
- **The sweep refuses to delete rather than trusting a scan that looks wrong:** an empty reference
  set for a folder, more than 500k orphans in one run, or orphans above `maxDeleteRatio` (0.2)
  all report `refusedReason` and delete nothing. Narrow a large run with `prefix`, which limits the
  listing while the references are still read from the whole catalogue.

## Docker

- **Keep the `mongodb` service in `infra/docker-compose.yml` pinned to `mongo:7` — do not move it to `mongo:latest` or any
  8.x tag.** MongoDB 8.x vendors a TCMalloc that violates the kernel rseq ABI, and recent 8.x
  builds refuse to start on Linux kernels 6.19 through 7.0.13 with a fatal
  `MongoDB cannot start: Linux kernel versions 6.19 and newer has a known incompatibility`
  (log id `12257600`, container exits 1). Ubuntu 26.04 reports `7.0.0-XX` from uname whatever
  its ABI bump, so the parsed version stays 7.0.0 and every kernel upgrade still trips the
  check. There is no bypass: `GLIBC_TUNABLES=glibc.pthread.rseq=0` does not skip it and the
  binary exposes no override. `mongo:8.2` starts only because the guard was never backported
  to that branch — the crash bug is still there. See https://jira.mongodb.org/browse/SERVER-121912.

## IGDB

- **Editions are linked from IGDB `version_parent`, which no array field mirrors.** IGDB leaves an
  edition's `dlcs`, `remakes`, `similar_games` and the rest empty and builds its "Editions" block
  from `version_parent` alone, so `linkRelatedGames` reading only the arrays gave the 8,046 editions
  no related games at all. `buildEditionLinks` sets `relatedGames.version_parent` (the original)
  and `relatedGames.editions` (the original's other editions, or on the original every edition);
  the web shows both in the Versions tab. Requests cannot set either: the nightly run recomputes them.
- `linkGameCharacters()` loads every game to reconcile both sides, so it must only write rows
  that actually changed — `isSameObjectIdList` guards each `bulkWrite` op. Without that guard a
  nightly re-run rewrites all ~376k game documents and bumps their `updatedAt`, which
  `getGameSlugs` feeds to the sitemap as `lastmod` — every game would look freshly edited
  every day.
- **A game with a non-empty `vndb.vnId` belongs to VNDB, and no IGDB write may touch it.** VNDB
  is the priority source: `upsertGameFromIgdb` returns early on `existingGame.vndb.vnId`, and
  `linkRelatedGames` / `linkGameCharacters` skip those games. Check the id, never the presence
  of the `vndb` object: a leftover `vndb` with `vnId: ""` hid the IGDB parse buttons and made
  the sync skip an IGDB game. Every `select` that feeds `upsertGameFromIgdb` must include
  `vndb`, or the guard sees `undefined` and the nightly sync silently overwrites VNDB data. Do
  not move the guard into the upsert filter: with `upsert: true` a filter that matches nothing
  inserts a duplicate game.
- **The unique indexes on `igdb.characterId`, `vndb.characterId` and `vndb.vnId` must stay
  partial (`$exists: true`).** MongoDB indexes a missing field as `null`, so the second document
  without it fails with `E11000 duplicate key ... { igdb.characterId: null }`. Mongoose
  `autoIndex` never changes the options of an existing index, so on an existing database the old
  `igdb.characterId_1` must be dropped by hand before the partial one can be built.

- **The nightly IGDB sync checks a new IGDB game against the catalogue before inserting it;
  nothing else does.** `syncGamesFromIgdb` passes `matchNew`, and `matchNewIgdbGame` runs the
  shared matcher with `IGDB_MATCH_PROFILE`. A match goes to Conflicts unless `IGDB_AUTO_LINK` is
  `true`, and a hand-made game (`isCustom`) always goes to Conflicts. Without this check a game
  added by hand got a second IGDB copy with a `-2` slug, because `upsertGameFromIgdb` matches
  only on `igdb.gameId`. An explicit parse by id (admin, content request, backfill) skips the
  check on purpose.
- **A new IGDB game is never matched to a catalogue game that already carries another IGDB id,
  and only a confirmed match links itself.** `matchNewIgdbGame` drops candidates linked to a
  different `igdb.gameId` before scoring (`withoutOtherIgdbGames`): an IGDB entry can only be one
  catalogue game, and without this every edition, bundle and pack ("Premium Box", "Digital Deluxe
  Edition", "Pack / Addon") went to Conflicts against its own base game — admins skipped all of
  them. A match links without review when it is the only candidate and title, companies and date
  all confirm it (`isConfirmedIgdbMatch`), even with `IGDB_AUTO_LINK` off; anything weaker waits
  in Conflicts. A title that normalises to nothing ("***") gets no candidates, and a conflict keeps
  at most `IGDB_CONFLICT_CANDIDATES_LIMIT` (10) candidates — one such title once stored 784.
- **The game schema's name hook must never leave `nameNormalized` in both `$set` and `$unset`.**
  A symbol-only name normalises to an empty string; the hook unsets the field and removes it from
  `$set`, or Mongo rejects the write with "Updating the path 'nameNormalized' would create a
  conflict" and the game cannot be created.
- **Adding a game by hand checks the catalogue first and answers `409` with the likely
  duplicates.** `POST /games/add` and approving a new-game request call
  `GameMatcherService.assertNoDuplicates`; `force` skips the check once the admin has looked.
  Approving a new-character request answers the same `409` shape from a name/akas lookup.
  The game-adder MCP checks `POST /games/add/duplicates` before it uploads anything, because it
  uploads images to the Space before it calls `/games/add`, and a refusal after the upload
  leaves orphans in the bucket.
- **A content request is decided only through its claim.** `decide` claims the request with one
  `findOneAndUpdate` on `status: "pending"` and no live `claimedAt` before it creates anything,
  and every other write (reject, withdraw, the final `approved`) filters the same way and answers
  `409` on `matchedCount: 0`. Reading `pending` and writing later let two admins approve one
  request at once: two games, two image uploads. A claim older than `CLAIM_TTL_MS` (15 minutes)
  is taken over, which is the recovery path after a crash. A failed approval deletes the entry
  it created (and its images) and clears the claim; leaving the entry made every retry fail with
  the duplicate `409` against it. The flow is in [`docs/requests.md`](../../docs/requests.md).
- **IGDB only fills the empty fields of a hand-made game, and never changes its slug.**
  `getFillOnlyPayload` keeps every non-empty field; images are fetched only for an empty cover,
  screenshot or artwork list; `forceParse` is ignored. Once a hand-made game is linked to IGDB
  the nightly sync reaches it by `igdb.gameId` again, so without this rule the first sync
  after linking would overwrite everything the admin wrote. To hand a game over to IGDB
  completely, clear `isCustom`.
- **`IgdbOrphansService` removes games whose `igdb.gameId` IGDB no longer returns, and it never
  deletes a game anyone owns or uses.** `POST /igdb/orphans` (`{ apply?, limit? }`, a dry run by
  default) answers 202 and runs in the background; `GET /igdb/orphans` reads the report. The
  same job runs every Monday at 02:00 Moscow time (`IGDB_ORPHANS_CRON`) in apply mode with the
  default delete limit (500); both take the `igdb-orphans` `withDbLock`, so a manual run and the
  cron never overlap. Games with `isStopParsing` are not scanned. A VNDB-owned (`vndb.vnId`) or
  hand-made (`isCustom`) game only loses its dead `igdb` field; a game referenced by playthroughs,
  ratings, user logs, comments, custom lists, favourites or royal games is kept and reported for
  the admin to decide. The rest goes through `GamesService.deleteGame`, which also removes the
  game's images from the Space and pulls it from `characters.gameIds`/`spoilerGameIds`.
- **The orphan run writes nothing when the IGDB answer looks wrong.** A batch that still fails
  after three attempts, more than `IGDB_ORPHANS_MAX_MISSING` (5000) missing games, or more than
  `IGDB_ORPHANS_MAX_RATIO` (2%) of the scanned games missing sets `refusedReason`, and the run
  only reports. An IGDB outage that answers with empty arrays would otherwise read as "every
  game is gone" and wipe the catalogue. An unknown answer counts as present, never as missing.

## Conflicts

- **Every parser queues its unsure matches in the one `conflicts` collection, keyed by
  `(source, externalId)`, and applies decisions through its own handler.** A source calls
  `ConflictsService.register` in `onModuleInit` with `describe` (the live entry shown on the
  review screen) and `apply` (writes the decided batch, returns the game id per entry).
  `ConflictsService` owns statuses, the socket and the queue, so it never imports a parser, and
  a parser can write conflicts without a cycle. A source with no registered handler answers 400.
- **`scripts/migrate-vndb-candidates-to-conflicts.ts --apply` runs once, right after the API
  that reads `conflicts` is deployed.** Until then the running API still reads
  `vndbcandidates`, and the migration only inserts records that are missing, so a decision
  made on the old API after the copy is lost. Drop `vndbcandidates` only after checking the
  Conflicts tab on production.
- **A conflict has a direction, and it decides what the candidates are.** `games` (every source
  today) lists catalogue games for one source entry, and the decision carries `gameId`. `entries`
  lists source entries for one catalogue game and carries `entryId`; HLTB used it until 2026-10-14,
  when it moved to `games` so its conflicts get the game search and a Skip that creates a game.
  What Skip means belongs to the source: it creates a game for every source today, and an RA Skip
  leaves a hack, homebrew, prototype, demo, test kit or subset unlinked instead (`isRaVariantTitle`).
- **A handler's `apply` returns `null` for an entry it applied without a game.** Leaving an entry
  out of the map sends the decision back to review, so an RA Skip of a hack that returned nothing
  would come back to the queue forever.
- **A skipped conflict goes back to the queue only through Undo, never through a rebuild of its
  candidates.** A Skip has created a game (or, for an RA hack, nothing), and a requeue that keeps
  that game leaves it behind and lets a Match link the entry a second time. The former
  `POST /conflicts/:source/:externalId/reopen` and the handlers' `rematch` were removed on
  2026-10-22, when RA, the last source that used them, started creating games on Skip.
- **An RA Skip builds the game with `GameAiDraftService.createDraft` from the set's
  `retroachievements.org/game/<id>` link and saves it with `addGame` without `retroachievements`,
  then pushes the set itself.** `addGame` pins every RA set it is given, and that pin would turn
  the conflict being applied into a resolved Match: the card would read Matched and Undo would only
  unlink, leaving the AI's game behind. The draft is saved unreviewed and with `force` (its
  candidates are the duplicates the check would refuse); a draft that fails or does not parse as
  `AddGameRequestSchema` sends the decision back to review. One draft is a few minutes of research,
  so the RA decision worker is that slow per Skip.
- **A game the matcher missed is matched by adding it to the candidates first, never by passing
  its id to `decision`.** `decide` only accepts winners that are already among `candidates`
  (otherwise `400 The game is not a candidate`), so `POST /conflicts/:source/:externalId/candidates`
  prepends the game an admin found by search or named by id, slug or game link (the web takes the
  slug out of `/games/<slug>`; the body's `game` is an id or a slug), unscored (`score: 0`, an all-zero breakdown,
  `isManual: true`), to a waiting `games`-direction conflict; the admin then matches or skips as
  usual. The list filters by `state`, each mapped onto `status`/`decision` in `STATE_FILTERS`; a
  Skip is `new-game` or, when `externalData.created` is `null`, `skipped` ("No game added"). A
  missing `created` (a Skip older than the field) stays `new-game`, because that Skip did add a game.
- **`matchGames` recomputes every RA link each run, so it must read the RA conflicts first.**
  A resolved conflict pins its winners, and so does a skipped one (`absent`) — its winner is the game
  the Skip created, or none for a hack the Skip left unlinked; a pending one links nothing. Without this
  the next nightly run replaces an admin's decision with the fuzzy match again. The run also
  pulls an RA set from every game it did not match when the run gave that set to another game, so
  one set never stays on two games after a conflict or a better title match moved it. It never
  clears a link just because nothing matched it: on 2026-10-01 that would have removed 561 correct
  links (localised titles such as "Wipeout 2097" on Wipeout XL, consoles whose platform mapping
  changed, sets waiting in a conflict) next to 78 stale ones. A match counts as ambiguous when the two best fuzzysort scores
  differ by less than `RA_AMBIGUITY_GAP` (0.05): about 570 of the 10,021 RA games that matched on
  2026-09-30. A set the run does not match keeps its link only while its game takes no other set:
  `$set` rewrites the whole `retroachievements` list of every matched game.
- **`RA_USE_MATCH_ENGINE` switches the RA sync from fuzzysort to the shared matcher
  (`createRaEnginePicker`, `RA_MATCH_PROFILE`), and it is flipped only after a reviewed dry run.**
  The engine also reads the games' `alternative_names`, so its first run on 2026-10-14 data adds
  about 450 links (Rockman & Forte → Mega Man & Bass) and moves or drops a few dozen; every one of
  them must be in the reviewed `bun scripts/matching-dry-run.ts ra` report. Keep the fuzzysort path
  until one nightly run on the engine has been checked, so a bad run is undone by flipping back.
- **RA candidates come only from platforms whose `raId` is the set's console, so a platform the
  name matcher misses hides all its games.** `matchConsolesToPlatforms` needs an exact shared name
  segment, and IGDB names regional and revision variants differently ("Family Computer" against RA's
  "NES/Famicom", "MSX2", "WonderSwan Color", "Pokémon mini"); Akira on the Famicom never reached its
  RA conflict. Map such a platform in `RA_CONSOLE_BY_PLATFORM_SLUG` (`constants/sync.ts`) instead of
  loosening the matcher, then run `POST /ra/sync` or wait for the nightly run.
- **RetroAchievements data is never stored in collections of its own; it lives on the records
  that use it.** The sync downloads RA's consoles and game lists on every run, matches them in
  memory, writes `raId` into `platforms` and the set's `consoleName`, `imageIcon` (absolute URL)
  and `numAchievements` into each game's `retroachievements` entry. A set that matched nothing is
  not kept. An ambiguous set has no game to live on, so its RA record is snapshotted into the
  conflict's `externalData`, and the RA handler's `describe` and `apply` read that
  snapshot instead of asking RA again; each run refreshes the snapshot of every RA set that has a
  conflict. A link added by hand (a content request) has only `gameId` and `consoleId` until the
  next sync fills in the rest, so the web must render an entry without them.
- **The weekly HLTB sync downloads HLTB's whole catalogue and matches every game in memory; only
  the single-game `POST /hltb/games/parse` still searches.** HLTB has no API; the site's search
  (`api/search/site`) with an empty query lists every entry — about 96,000, DLC included — sorted
  by `name` so pages do not shift during the download. It serves at most 25 per page and answers
  an empty `{}` to anything larger, so the run is about 3,850 pages, about 1.5 hours. Searching
  per game took 2–10 requests each and about 12 weeks for the 374,000 games without times.
  `POST /hltb/backfill` (admin) starts the same run.
- **Download the catalogue one page at a time.** Six pages in parallel got `429` after about 60
  pages; one page a second ran without a single one. HLTB sends no `Retry-After` and lifts the
  limit within a minute, so a failed page waits `HLTB_CATALOG_RETRY_DELAY_MS` (60 s). A search
  token stops working after about 100 requests (`403`), so the session takes a new one every
  `HLTB_CATALOG_TOKEN_REQUESTS` (90).
- **A catalogue that is not complete writes nothing.** A page still failing after
  `HLTB_CATALOG_PAGE_ATTEMPTS`, or fewer entries than `HLTB_CATALOG_MIN_COMPLETENESS` of HLTB's
  `count`, aborts the run before the first game. A partial catalogue reads as "not on HLTB": the
  per-game search once treated failed requests that way, marked about 60,000 games "not found"
  between 2026-08-30 and 2026-10-04 (two in three were on HLTB), wiped the times of games that had
  them and produced no conflicts. For the same reason a stored link whose entry is missing from
  this download is left untouched, and the single-game search throws `HltbSearchFailedError`
  rather than returning an empty result.
- **The weekly sync never re-matches a game that already has `hltb.hltbId`; it refreshes the times
  from the catalogue entry with that id.** Only games without HLTB go through the matcher. A link
  an admin chose in Conflicts or by `hltbId` must survive every run, and re-matching 57,000 links
  weekly would let any difference between the catalogue and the search clear them. A wrong old
  link stays until an admin relinks it with `POST /hltb/games/parse?hltbId`.
- **The catalogue stands in for HLTB's search, so `findCatalogCandidates` must keep returning what
  the search returned.** Per query of `buildHltbSearchQueries` it takes the entries holding every
  query word in their name or alias and keeps the `HLTB_SEARCH_RESULTS_PER_QUERY` (20) most popular
  — HLTB's first page. The matcher, the year tolerance and the loose-title rule were all measured
  on those pools; a wider pool turns unique titles into competing ones.
- **The sync writes a game only when its HLTB data changed** (`isSameHltb` ignores `updatedAt` and
  `similarity`), and a not-found mark never touches `updatedAt`. Every game is read every week,
  and `updatedAt` is the sitemap's `lastmod`. `hltbNotFoundAt` is only a record of the last miss;
  the next run checks the game again.
- **HLTB co-op and Vs. times are times: `hasHltbTimes` and the web tiles read `coop` and
  `multiplayer` next to the three single-player fields.** HLTB sets
  `comp_lvl_sp: 0` for co-op and multiplayer games and hides their single-player block, so
  `howlongtobeat-ts` returns no `mainTime` for them. Reading only the single-player fields marked
  It Takes Two, Split Fiction, Dota 2 and Team Fortress 2 "not found" — 44 of the 150 most-rated
  unmatched games. Do not take `raw.comp_main` instead: HLTB hides it on purpose, and it would show
  Team Fortress 2 a 290-hour "main story".
- **HLTB titles compare with Roman numerals as digits and against the entry's alias too**
  (`normalizeTitleWithNumerals`, `evaluateEntry`), so "Baldur's Gate III" meets HLTB's "Baldur's Gate 3".
  Single-letter numerals (I, V, X) stay words — "Mega Man X" is not "Mega Man 10".
- **HLTB dates an entry by its earliest release, so an exact title on a shared platform is
  accepted up to `HLTB_PLATFORM_YEAR_TOLERANCE` (2) years off; a wider gap goes to Conflicts.**
  Early access, the Japanese and the arcade originals are missing from our release dates; with a
  ±1 veto Tekken 7, Garry's Mod and Project Zomboid never matched. Do not raise it to 3: our 2013
  "Final Fantasy XIV Online" then matched HLTB's 2010 "Final Fantasy XIV" (aliased "Online"), and
  the right 2013 entry is not even in the search results for that title.
- **Every HLTB entry the rules found but could not accept goes to Conflicts.** `findHltbConflict`
  offers each strong title (a different release year included — the year vetoes only the
  automatic match) and each loose title — the shorter title's words at least 80% inside the
  other's, the same numbers — that also shares our platform and year (`weak-title`: "Pokémon X"
  against "Pokémon X and Y", "Rainbow Six Siege" against "Tom Clancy's Rainbow Six Siege"). Entries
  without times are never offered: applying one fails, and the decision would return to the queue
  forever. Loosen the loose rule only after measuring it — on a random 100 not-found games it adds
  about 4 conflicts, most of them noise ("Axolotl" against "Magic Axolotl").
- **An HLTB conflict is one HLTB entry with every unlinked game the rules offered it to**
  (`externalId` is the HLTB id, `isMultiMatch`, because editions share one entry). The weekly run
  collects them over the whole catalogue before it writes: it rewrites every undecided one through
  `ConflictsService.refresh` and deletes the undecided ones no game offered any more, so the queue
  follows the current rules and catalogue. `refresh` keeps the games an admin added by search
  (`isManual`) and replaces the rest; `record` alone would leave an existing conflict as it was —
  the 1,769 conflicts recorded before HLTB entries carried `cover` never showed a poster.
  Candidates carry a breakdown in the shape the other sources use (title, platforms, release year).
  Match writes the entry to each chosen game; Skip adds the entry as a game (`createGame`), unless
  a game already carries that `hltb.hltbId` — then Skip returns that game and creates nothing.
- **An HLTB entry that a game already holds is offered to another game only on an exact title that a
  platform or the release year confirms and nothing contradicts** (`isOfferedLinkedEntry`, applied in
  `toConflictRecords` after the run, so links made in the same run count). The entry has found its game;
  another game with the same name and no supporting fact is almost always a different game. On
  2026-10-14, 11,894 of the 15,571 waiting conflicts offered a held entry: 7,787 only by a loose title
  ("Neon" against "Neon Beats"), 3,523 with a contradicting year, and most of the rest with an exact
  title and nothing else (the unreleased 1983 Atari "The Incredible Hulk" against the 2008 game's
  entry, platforms −1, no date). 29 are kept, a second catalogue entry of the same release among them
  ("Shiver: Vanishing Hitchhiker" next to its linked Collector's Edition), which is what multi-match is
  for.
- **HLTB's search and catalogue carry no description and no companies; only the game page does**
  (`getById` → `raw.profile_summary`, `profile_dev`, `profile_pub`, `release_world` as a full date,
  `profile_steam`; `readHltbPage`). It is read only when one entry is described, linked by id,
  matched or added as a game: linking fills the game's empty description, companies, release date
  and release dates (`fillEmptyFields`), and a game added from HLTB gets them plus its Steam page.
  The weekly run never reads pages — one request per game would take days.
- **HLTB writes an unknown date part as zeros, so `hltbDate` cuts a date at its first zero part
  before parsing, and `parsePartialDate` refuses a zero year, month or day.** `"0000-00-00"` (no
  date) and `"2015-00-00"` (year only) both match its pattern; the first once dated a new game to
  the year −1, and `Date.UTC(0, -1, 0)` made it 1899-11-30 for the games HLTB Skips added until
  2026-10-22. That date came through `releaseYear`: `howlongtobeat-ts` copies `release_world` into it
  as is, a year number in the search but the page's date string from `getById`, so
  `toSearchEntry` keeps only the year. A zero date adds no date at all. The page's
  NA, EU and JP dates become `release_dates` with the IGDB region codes (2, 1, 5), one row per
  platform of the game, because HLTB does not date platforms; regions that agree collapse into one
  Worldwide (8) row. `human` keeps HLTB's precision ("2015", "Apr 2006"), while `first_release` of a
  year-only date is January 1, as VNDB does.
- **An edition the matcher cannot place takes its original's HLTB link** (`getEditionParentId`:
  `relatedGames.version_parent`, never for an add-on type). Editions share their original's times,
  and HLTB lists most of them only under the original's name, so "Payday 3: Day One Edition" sat
  in Conflicts against "Payday 3" — 2,189 of the 26,271 conflicts of the 2026-10-13 run. The
  edition's own title match still wins. The weekly sync reads the originals' links once before
  the run (`loadLinkedHltbIds`), so an edition whose original was linked in the same run follows a
  week later; `POST /hltb/games/parse` reads it on the spot.
- **An add-on (`HLTB_ADDON_GAME_TYPES`) never takes, and is never offered, its base game:** an
  HLTB entry that is not `dlc`, `mod` or `hack` and whose title is the leading words of ours
  (`isBaseGameEntry`). The loose-title rule offered "Call of Duty: Black Ops 6" to every season of
  it, 6,780 such conflicts on 2026-10-13. Do not narrow it to "add-ons take only `dlc` entries":
  HLTB files many add-ons as `game` under their own title (105 linked DLC, 212 mods, Covert Front's
  episodes). `Update` and `Bundle` stay out — "FTL: Advanced Edition" and "X: Complete Edition"
  rightly take the base game's times.
- **A match is taken back only through `ConflictsService.undo`, from what the match changed.**
  `POST /conflicts/:source/:externalId/undo` accepts a `resolved` conflict, reverts its games and puts the
  conflict back to `pending` with no decision. For a source without its own `undo`, `applyBatch` reads every
  winner before and after the handler's `apply` and stores the top-level fields that changed in
  `externalData.changes` (`{ gameId, before, after }` per game). Undo restores the link field (the first segment
  of `linkField`) whatever it holds now, and every other changed field only while it still equals `after`, so
  an admin's later edit survives — and so does a field a sync rewrote since. A game whose `linkField` now names
  another entry is left alone, and a match made before `changes` existed only loses its link. Images the match
  uploaded stay in the Space until the orphan sweep. Two sources keep their own `undo`: HLTB, whose matches
  record `externalData.applied` (per game: the `hltb` it replaced and the fields the HLTB page filled) and
  were undone from it before `changes` existed; and RA, whose link is an entry of the `retroachievements`
  array, so undo pulls the set from the winners. Playthroughs the RA awards sync made through a wrong link
  stay.
- **A Skip is taken back through the same endpoint by deleting the game it created, and only while nobody
  uses it.** `applyBatch` records that game in `externalData.created`, or `null` when the game the handler
  returned is older than the decision (it already held the entry, nothing was created). It compares the
  game's `createdAt` with the conflict's `updatedAt`, never "was the entry linked before `apply`": a batch
  cut short by a restart is applied again, and its games then already exist. Undo deletes it through `GamesService.deleteGame` only while
  `findGamesWithUserData` finds no playthrough, rating, log, comment, list entry, favourite or royal-games
  entry for it, and answers 409 naming the game otherwise. `GamesModule` imports `ConflictsModule`, so
  `ConflictsService` cannot inject `GamesService`; `GamesService.onModuleInit` hands it `deleteGame` through
  `useDeleteGame`. A Skip made before `created` existed is refused: the game it added cannot be told apart
  from one that was already there. A Skip that created nothing (`created: null`: an RA hack, a game that
  already held the entry, every RA Skip before 2026-10-22) is only requeued. The item's `createdGame` names
  the game an undo deletes; the admin card asks for confirmation, naming that game, only when there is one,
  and calls the button Undo skip otherwise.
- **The AI judges conflicts only through `POST /conflicts/:source/ai` (`ConflictsAiService`), and it decides
  nothing until `apply=true`.** A run judges up to `limit` undecided conflicts of the source that have no
  verdict yet and stores the answer in `externalData.aiVerdict` (game ids, `high`/`medium`/`low`, a reason).
  The item and the list rows carry it as `aiVerdict`, and `GET /conflicts/list?aiOnly=true` lists only judged
  conflicts, which is how a dry run is reviewed. `sortBy=ai` orders the list by `AI_VERDICT_RANK_FIELDS`:
  high match, high no-match, medium match, medium no-match, low match, low no-match, then undone verdicts;
  conflicts without a verdict stay last in either `sortOrder`, as Steam games without achievements do.
  With `apply=true` every verdict, stored earlier or new, that names games at a confidence in `confidences`
  (a comma-separated query parameter; `CONFLICTS_AI_APPLY_CONFIDENCES`, `high` alone, when omitted — the
  admin screen's switch sends `high` or `high,medium`) goes through `ConflictsService.decide` as the admin
  who started the run, with `decidedBy.isAi` (shown as "AI (name)"); `limit=0&apply=true` applies
  the stored verdicts and judges nothing, which is the admin screen's "Apply verdicts" after a dry run.
  `POST /conflicts/ai` (the All tab) runs the same review for every source in turn, `limit` per source, and
  `POST /conflicts/ai/undo` undoes every source that can. One AI job runs at a time, whatever its source
  (in-process flag plus the `conflicts-ai` `withDbLock`), so two runs never spend the AI quota at once.
  A job counts its work before it starts (stored verdicts to apply plus conflicts to judge, or matches to
  undo, over every source it covers) and keeps its progress in memory; `GET /conflicts/ai/status` returns
  it, and the admin screen polls it every second while `isRunning` to draw the bar under the AI buttons.
  The status lives in the process that runs the job: a job refused because another process holds the lock
  ends at once with that reason in `error`.
- **A source judges with the generic prompt unless it registers its own judge.** The generic judge reads
  the review item (`getItem`: the handler's `describe` and every candidate as stored) and adds a per-source
  note on what one entry of that source is (`SOURCE_NOTES` in `conflicts-ai.utils.ts`); a new source needs
  its note there. HLTB registers `HltbAiService.judge` with `ConflictsAiService.register`, which reads the
  entry's HLTB page and hours and skips candidates already holding an HLTB id. The Steam judge calls `describe`, which reads the
  store page, so a long Steam run can meet the store's 200-per-5-minutes limit; the entry is then judged
  without its details.
- **The conflict decision worker runs under `withDbLock("conflicts-apply-<source>")`, never on its in-memory
  `applying` flag alone.** `getSummary` restarts the worker in whichever process serves it while decisions
  are queued, so a local API and the production one on the same database both wrote the same Skips on
  2026-10-15: Twilight Observer and Black Hole were created twice, and Asteroid Quest! got its game while its
  conflict went back to Waiting. A process that finds the lock held leaves the queue to the holder, which reads
  every queued decision, whoever made it.
- **Every source can take its AI matches back.**
  `POST /conflicts/:source/ai/undo` (or `/conflicts/ai/undo` for every source) undoes the resolved matches
  carrying `decidedBy.isAi` — every one, or only the `items` (`{ source, externalId }`) in the body, which the
  admin screen picks from `GET /conflicts/ai/matches` (newest first: all, the latest 10, or one by one).
  `ConflictsService.undo` marks the verdict of every undone match or Skip `undoneAt`, and such a verdict is
  never applied again. Undo only reads `resolved` conflicts, so run it after the queued decisions are written
  (the admin screen disables the button while any are), or the ones still queued stay linked. Apply never
  skips. Set the confidences from a labelled dry run, never by guess. A sync that replaces `externalData`
  drops the verdicts, and a later run judges those conflicts again. A whole batch failing stops the run, so a
  spent quota does not leave the queue half judged without a trace.
- **The AI adds a game only through `POST /conflicts/:source/ai/create` (and `POST /conflicts/ai/create`).**
  It turns every undecided conflict whose verdict names no game at a confidence in `confidences` (the same
  parameter and default as Apply), never undone, into a Skip as the admin with `decidedBy.isAi`; the handler
  then creates the game as for a manual Skip. A `canCreate` registered with `ConflictsAiService.register`
  narrows it: HLTB allows entries of type `game` only — DLC, mods and hacks stay for a person; RA skips
  every `isRaVariantTitle` set; the other sources register none and add every such entry. "No candidate is the entry" is not "the entry belongs in the
  catalogue", so this is a separate button with a confirmation, never part of Apply, and each entry first goes
  through `GameMatcherService.findLikelyDuplicates` with the conflict's subject: a likely duplicate is left
  waiting for a person and logged with the games it resembles. The handlers save with `force`, so this is the
  only duplicate check an AI Skip gets; without it HLTB added games the catalogue already had, with the same
  cover and platform (2026-10-22). Each such game is taken
  back from its conflict card (Undo new game, the Skip undo above); "Undo AI matches" does not touch them.
- **The AI routes (`ai`, `:source/ai` and their `/create` and `/undo`) stay declared above the `:source/:externalId`
  routes in `ConflictsController`.** Express matches in declaration order, so below them `ai/undo` reaches the
  per-conflict undo with `externalId = "ai"`.
- **An id set by hand ends the source's open conflicts for that game, never its decided ones.**
  `POST /hltb/games/parse?hltbId`, `POST /vndb/games/parse?vnId` and `POST /ra/games/parse?raId`
  call `ConflictsService.removeForGame`: it deletes the conflict of the linked id itself and every
  pending, undecided conflict that lists the game as a candidate. A decided conflict for another id
  stays, because deleting it drops the admin's decision and the next sync re-matches that id. RA
  keeps the pinned conflict of the linked set (`keepExternalIds`): the pin is what stops the nightly
  run from removing the link, and `matchGames` keeps a pinned set on its game even when the set's
  console is not downloaded.
- **A RetroAchievements account is connected only through the motto check, never by typing a
  name.** RA has no OAuth for third parties yet, so `POST /user/ra/connect` stores a pending
  `mooncellar-…` code (30 minutes), the user puts it into their RA motto, and `POST /user/ra/verify`
  reads the motto with `getUserProfile` before saving `raUsername`, `raUlid`, `raUserPic` and
  `raVerifiedAt`. The old `PATCH /user/ra/:userId/:raUserName` had no guard and accepted any name,
  so anyone could show someone else's awards. RA usernames can change since 2025: look users up by
  `raUlid` (the API accepts it wherever it takes a username), as the nightly awards refresh does.
  One RA account belongs to one verified MoonCellar user. `POST /user/ra/sync` reloads the awards
  on demand, at most once a minute per user (`raSyncedAt`); the nightly run sets `raSyncedAt` too.
- **RA awards become playthroughs only for a user who turned on `settings.raSyncPlaythroughs`,
  and only through `RaPlaythroughsService.sync`.** It reads the stored `raAwards` (no RA call), so it
  runs after verify, after `POST /user/ra/sync`, in the nightly awards refresh and from
  `POST /user/ra/playthroughs/sync` when the toggle is switched on. Mastery or Completion makes a
  `completed` playthrough with `isMastered`, Game Beaten a plain `completed` one, dated by the
  award. A game with any playthrough the user made is never touched; an automatic playthrough
  carries `raGameId`, is only ever upgraded to mastered, and writes no user log, so a first import
  of dozens of awards does not flood the feed. Deleting it adds the set to `raIgnoredSets`, which
  stops the next sync from creating it again.
- **One RA award stands for one game, even when its set is linked to several.** 32 sets belong to
  more than one catalogue game (multi-match, or two IGDB entries of one release such as the 1988
  and the 1992 Snatcher), and reading every linked game showed one award twice on the profile and
  would have created two playthroughs. `pickGamesForSets` (`ra-playthroughs.service.ts`) gives each
  set to the game the user has a playthrough of, then the one they rated, then the most rated one;
  both `getUserGames` and `RaPlaythroughsService.sync` go through it.
- **An RA link written outside the sync must be pinned with `ConflictsService.pin`, or the next
  nightly run removes it.** Approving a request with RA ids does this: `pin` upserts a resolved
  `ra` conflict and adds the game to its `winners`, which `matchGames` then keeps.
- **A conflict stores every game it links in `winners`; `winner` is the first of them.** Only a
  handler with `isMultiMatch` (RA) accepts `gameIds` with several games — one RA achievement set
  often covers two games ("Pokémon HeartGold | SoulSilver"), and with one winner the second game
  never got its set. Other sources answer 400, since a VNDB or IGDB entry is one game. Records
  decided before `winners` existed carry only `winner`; read them through `winnerIds`. An RA
  candidate also stores `matchedTitle`, the part of a `|` title it matched, so equal scores on two
  different games read as two different titles rather than a broken scorer.
- **The matcher lives in `games/matching`, and a profile, not the caller, decides the rules.**
  `resolveMatch` is the former VNDB scoring, and the snapshot specs
  `vndb-match.characterization.spec.ts` and `igdb-match.characterization.spec.ts` pin it. A new
  source adds a profile, and a rule one source needs is a profile option whose default leaves the
  others alone (`title.variant`, `title.alternative`, `title.minimum`, `title.fuzzy`,
  `requireEvidence`, all set only by `RA_MATCH_PROFILE`). Change VNDB or IGDB behaviour only on
  purpose: a changed snapshot is a behaviour change.
- **A change to RA or HLTB matching ships with a `scripts/matching-dry-run.ts` report.** The script
  runs the same functions as the syncs (`matchRaSets`, `decideHltbMatch`) against the production
  database, read-only, with RA's lists and HLTB's catalogue cached in `scripts/.dry-run/`, and lists
  links added, removed and moved and the conflicts that appear or go. A matcher is added to its
  `RA_PICKERS` / `HLTB_DECIDERS` map and compared with the current one before the sync uses it.
- **Spelling variants never collapse a Roman numeral.** `titleKeyVariants` folds Japanese long
  vowels ("ou" → "o", "aa" → "a"), which once turned "III" and "II" into "i": "Magical Drop III"
  matched "Magical Drop II" and "Ys II" matched Ys III. Numeral tokens skip that step.
- **Every RA link set by hand is pinned with `conflicts.pin("ra", …)`: "Link RetroAchievements by
  id", an approved content request, and `GamesService.addGame` for a game created with
  `retroachievements`.** The nightly RA sync matches each set by title and pulls it off every game
  it did not match, so an unpinned set on a game named or filed differently from the RA title
  silently disappears the next morning.

## AI providers

- **Every text AI call asks Claude first and OpenAI only after it, through `claudeFirst`
  (`shared/claude.ts`); never call `callOpenAi` alone for a new one.** Use `generateJson` for a single
  structured answer and `claudeFirst` with both branches for anything else, as the draft research loop
  and its web search do. Only image generation stays on OpenAI and Recraft, which Claude cannot do.
- **Only a `ClaudeError` falls back to OpenAI.** `callClaude` throws it for a failed request, a
  `refusal` and a `max_tokens` stop; any other error — a draft's own SearXNG abort, a bad query — is
  rethrown as is, because OpenAI would fail the same way and spend its quota on it. A draft that fails
  on Claude mid-research starts over on OpenAI, so the run's steps show "Asking OpenAI" after the
  Claude ones.
- **An `ANTHROPIC_API_KEY` created at the organization level needs `ANTHROPIC_WORKSPACE_ID`, which
  `callClaude` sends as the `anthropic-workspace-id` header.** Without it the API answers 400 "This
  API key is not scoped to a workspace…", which is a `ClaudeError`, so every call silently went to
  OpenAI and the verdicts and drafts carried a `gpt-…` model while the key looked set (2026-10-22).
  When AI answers come from OpenAI, look for "falling back to OpenAI" in the API log before
  suspecting the key itself.
- **A Claude JSON schema may hold at most 16 union-typed parameters (`["string", "null"]`, `anyOf`) and
  24 optional ones across the output schema and every strict tool of a request.** Above that the API
  answers 400 "Schema is too complex for compilation", which reads as a Claude failure and silently
  sends every call to OpenAI. The game draft uses 7 today.

## AI drafts

- **An AI draft runs unattended, so its prompt must forbid questions and its schema must let the
  model say "not found".** `research` returns whatever strict JSON the model fills; with no field
  for failure, a model that could not identify "SUCCUBUS T.G.D" put "Please provide a link…" into
  the character list, and the run spawned a draft for a "character" named "Clarification /
  Request". Keep `identified` on the character schema and `game` on the list schema, and turn a
  negative answer into a failed run whose error says what to change in the query.
- **A link the server cannot fetch is described before the model starts, never left to
  `fetch_page`.** `describeLink` turns a catalogue link (from our database) and a
  `retroachievements.org/game/<id>` link (from the RA Web API, `getGameExtended`) into facts
  appended to the query. RetroAchievements answers 403 to every server-side page fetch, so a draft
  started from an RA link knew nothing but the id. `/Images/000002.png` is RA's "no box art"
  placeholder and is dropped. A game draft from an RA link also carries the set in
  `retroachievements`, built by `toRaSetEntry` like every other RA link.
- **A search answered by the AI fallback is a success, even though its text quotes the SearXNG
  failure.** `searchWebWithFallback` prefixes the answer with `AI_SEARCH_PREFIX` and the
  reason, which contains `SEARCH_ENGINES_UNAVAILABLE`; the abort checks in `research` skip such
  outputs. Matching the phrase anywhere failed every draft with "rate-limited or ask for a
  CAPTCHA" while the fallback had already returned results.

## VNDB

- **`compareDescriptions` must drop the words of both titles before measuring overlap.** A game
  and a VN with the same name share those words in almost every description, and the 0.05
  threshold then reads as "descriptions match" — that is how a fan-made "Mass Effect 3" VN by
  sqbr was linked to BioWare's shooter with no company in common. It also needs at least
  `MIN_SHARED_DESCRIPTION_TOKENS` (2) shared words: the overlap divides by the shorter
  description, so one common word ("high") passed the threshold for "Up & Down".
- **A title key that several candidate games share is not distinctive.** `resolveMatch` adds
  those keys to `sharedTitles`; otherwise one of three games named "Up & Down" took the full
  distinctive-title score.
- **A candidate with an incompatible IGDB genre and no Visual Novel genre (`breakdown.genre < 0`)
  is never auto-matched; it goes to review as `genre-mismatch`.** A unique title plus a close
  date outweigh the genre penalty in the score, so without the veto a platformer or an RTS with
  the same name as a VN was linked on its own. Existing links are not re-scored.
- **Only ids of the form `v<digits>` may reach `getLastVnId`.** A game carrying `vndb.vnId: ""`
  made `$toInt` fail with `Failed to parse number ''`, and every daily sync died on its first
  step.
- **`bulkWrite` skips Mongoose middleware, so every VNDB game write sets `nameNormalized`
  itself.** The `name` hook in `game.schema.ts` only runs for `save`/`updateOne`/`updateMany`
  queries; a game written through `bulkWrite` without it is never found by the
  `nameNormalized` lookup that VNDB matching and search rely on.
- **VNDB images are stored under `<folder>/<gameId>/<vndbImageId>` and must stay that way.**
  `insertVndbGame` skips any image whose key the game already references, so `backFill` can be
  re-run without re-uploading. A random key (as `sendArrayToS3` uses) uploads every cover and
  screenshot again on each run and leaves the previous copies orphaned in the Space.
- **`insertVndbGame` writes an existing game only when a compared field actually changed, and
  every field it writes must also be in the `select` of existing games.** It compares each value
  with the stored one and skips the game otherwise, so `updatedAt` (the sitemap `lastmod`) does
  not move on a re-run. A field missing from the `select` always compares as changed, and every
  VNDB game gets a fresh `updatedAt` on each `backFill`.
- **Every VNDB API call goes through `VndbService.post`, which spaces requests
  `VNDB_REQUEST_DELAY_MS` apart.** VNDB allows 200 requests per 5 minutes; a call made straight
  through `httpService` skips the spacing, a long backfill starts collecting 429s, and once `post`
  runs out of retries the whole run aborts.
- **`post` spaces requests through the `requestTurn` promise chain, never by reading `lastRequestAt`
  alone.** The admin review preview, the decision worker and the sync call `post` at the same time;
  each reading the timestamp directly sees the same value, they fire together, and the combined
  rate breaks the 200-per-5-minutes limit mid-backfill.
- **A review decision is only recorded by `decideCandidate`; `applyDecisions` writes the games in
  batches of up to `VNDB_PAGE_SIZE`.** Building one VN costs about 18 VNDB requests (one per theme
  tag in `getThemes`), roughly 30 seconds at the enforced spacing, and the batched calls cost the
  same for 100 VNs. Writing the game inside the decision request holds it open for half a minute
  per keypress.
- **VNDB has no last-modified field, so the daily sync re-fetches the linked games with the
  oldest `vndb.syncedAt`.** `insertVndbGame` carries the stored `syncedAt` inside the `vndb` value
  it compares; dropping it makes `vndb` differ on every refresh and moves `updatedAt` for every
  refreshed game.
- **Code that reads a VNDB field must add it to that request's `fields` string.** VNDB returns
  only the fields asked for, while `IVndbCharacter`, `IVndbNovel` and the rest declare every
  field, so a missing one type-checks and reads as `undefined` at runtime. `vns.spoiler` was
  read without being requested, and every character's `vndb.spoilerVns` came out empty — no
  spoiler character was ever hidden.
- **A VNDB request that filters by several ids must pass `results`.** VNDB returns 10 items by
  default and reports the rest only through `more: true`; the detail request in `getVnMatches`
  once ran without it and silently processed 10 of every 100 VNs on a page, with no error.
