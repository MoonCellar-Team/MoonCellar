# SEO

An inventory of the search-related functionality in `apps/web`: what exists and where it lives.

## Metadata

`src/app/layout.tsx` declares the defaults every route inherits:

- `metadataBase` from `FRONT_URL`, so relative canonicals and image paths resolve to absolute URLs.
- `title.default` — `MoonCellar — Game Tracker & Database`; `title.template` — `%s | MoonCellar`.
- A site description and a `keywords` list.
- Open Graph defaults: `siteName: "MoonCellar"`, `type: "website"`, `locale: "en_US"`, and
  `/images/og-default.png` (1200×630, PNG) as the fallback image.
- `twitter.card: "summary_large_image"`.

Each route adds its own metadata on top:

| Route                            | Title                                       | Canonical                        | Other                                                                                                                                                                                                                                                                                                                      |
| -------------------------------- | ------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                              | `MAIN_PAGE_META_TITLE` via `title.absolute` | `/`                              | own `keywords`; the template does not apply to the root segment                                                                                                                                                                                                                                                            |
| `/games`                         | `Games`                                     | `/games`                         | own `keywords`                                                                                                                                                                                                                                                                                                             |
| `/games/[slug]`                  | game name                                   | `/games/<slug>`                  | description from `game.summary`, keywords from name + genres + themes + IGDB keywords, Open Graph block restated in full with the cover as `og:image` (200×266); `robots: { index: false, follow: true }` unless the slug is in `INDEXABLE_GAME_SLUGS`; an edition in `GAME_CARD_REDIRECTS` answers a 308 to its base card |
| `/games/genre/[slug]`            | `<Genre> Games`                             | `/games/genre/<slug>`            | description carries the game count; `robots: { index: false, follow: true }` when the genre has fewer than 100 games                                                                                                                                                                                                       |
| `/games/platform/[slug]`         | `<Platform> Games`                          | `/games/platform/<slug>`         | same shape as the genre hub, count fetched with a `take: 1` query                                                                                                                                                                                                                                                          |
| `/gauntlet`                      | `Gauntlet`                                  | `/gauntlet`                      | own `keywords`                                                                                                                                                                                                                                                                                                             |
| `/collections`                   | `Collections`                               | `/collections`                   | own `keywords`; a generated list on a profile URL 308s here instead of duplicating the ranking                                                                                                                                                                                                                             |
| `/collections/[slug]`            | collection name                             | `/collections/<slug>`            | description from the generated text, `openGraph` with the first cover through `/img/image-proxy` (200×266), else `og-default.png`                                                                                                                                                                                          |
| `/user/[name]`                   | `Profile: <name>`                           | `/user/<name>`                   | description from the user's own bio when set                                                                                                                                                                                                                                                                               |
| `/user/[name]/[tab]`             | `<Tab label>: <name>`                       | `/user/<name>/<tab>`             | one route per `profileTabs` entry; `robots: { index: false, follow: false }` on `settings`; an unknown tab is a 404 from the page component                                                                                                                                                                                |
| `/user/[name]/favourites/[kind]` | `<Tab label>: <name>`                       | `/user/<name>/favourites/<kind>` | `games` or `characters`; the former `/favorites` and `/characters` tabs `permanentRedirect` here                                                                                                                                                                                                                           |
| `/user/[name]/lists/[slug]`      | `<List> — a list by <author>`               | `/user/<name>/lists/<slug>`      | description from the list's own text or its game count; `robots: { index: false, follow: false }` for a private list; a generated list answers a 308 to `/collections/<slug>`                                                                                                                                              |
| `/lists`                         | `Lists`                                     | `/lists`                         | own `keywords`                                                                                                                                                                                                                                                                                                             |
| `/news`                          | `News`                                      | `/news`                          | own `keywords`; the archive and game filters (`?year`, `?month`, `?game`, `?type`) keep the same canonical                                                                                                                                                                                                                 |
| `/news/[slug]`                   | post title                                  | `/news/<slug>`                   | description from the post summary, `og:type` `article` with `publishedTime`/`modifiedTime`, `og:image` from the post image, else the game cover, else `og-default.png`                                                                                                                                                     |
| `/requests`                      | `Requests`                                  | —                                | `robots: { index: false, follow: true }`                                                                                                                                                                                                                                                                                   |
| `not-found`                      | `Page not found`                            | —                                | `robots: { index: false, follow: false }`                                                                                                                                                                                                                                                                                  |

A page-level `openGraph` object replaces the parent's rather than merging with it, which is why
the game and hub routes repeat `siteName`, `type` and `locale`.

When `generateMetadata` cannot find the entity (game, hub, user, list) it returns
`title: "Page not found"` with `robots: { index: false, follow: false }`. When the lookup fails
for any other reason (an API outage, a 5xx) it returns neutral metadata without `robots` —
`Game`, `Games`, `Profile`, `List`, or `{}` on a profile tab — and the page component's own
throw renders `src/app/error.tsx` (`ErrorPage`), which is never cached.

## Status codes

`fetchOrNull` (`src/lib/shared/utils/not-found.utils.ts`) turns a 404 from the API into `null`
and rethrows anything else, a 400 included. Routes with a dynamic segment wrap their lookup in
`React.cache`, call it from both `generateMetadata` and the page component, and call
`notFound()` only from the page component — so a missing entity answers with a real 404 rather
than a 200 carrying the not-found page.

The hubs resolve their slug against the full genre or platform list, which is not a
`fetchOrNull` lookup: the list request throws on failure, and the slug is a 404 only when the
list loaded and does not contain it. The three game blocks below the lookup fall back to an
empty list on error, so one failing query does not take the hub down.

Three routes answer with a permanent redirect (308) instead of a duplicate page: the legacy
`/user/<name>?list=<tab>` goes to `/user/<name>/<tab>` with the rest of the query kept, a
list opened by an outdated slug goes to its current `/user/<name>/lists/<slug>`, and a
generated list (`isGenerated`, owned by the `MoonCellar` account) goes to its collection at
`/collections/<slug>` — the ranking has one address, not two.

No route segment has its own `error.tsx`: every error reaches `src/app/error.tsx`, which renders
`ErrorPage`, never `NotFoundPage`.

The root layout has no `Suspense` boundary; routes that need one (`/games`, `/lists`,
`/requests`, and `/user/[name]` in its profile layout) declare it inside the route, and
`GauntletPage` declares its own.

## Rendering

Everything a crawler needs is in the server response.

- `/games` is an async server component. It rebuilds the query string from `searchParams`,
  parses it with the same `parseQueryFilters` the client uses, fetches page 1 (`take: 60`) and
  passes it to the client page as `initialData`. `GamesPage` compares the two React Query keys
  with TanStack's `hashKey`, so the client reuses the server payload instead of refetching.
- The catalogue grid is CSS (`repeat(auto-fill, …)` in `GamesCards.module.scss`), so all 60 game
  links exist in the HTML without any DOM measurement. `react-virtualized` is used only by the
  dropdown list component.
- The game page, both hubs, a collection and the homepage fetch their data in the server
  component and render it directly.
- A collection page loads every game it ranks in one `POST /games/by-ids` and renders the whole
  grid without `limit`, so the grid is `auto-fill` and all 100 cards are in the HTML; the rank
  comes from the list's stored `position`.

`<h1>` per page: the homepage banner title, `Games` on the catalogue, `Lists`, `Gauntlet`, the
game name on a game page, the hub title on both hubs, the collection name on a collection page,
the user name on a profile, the list name on a list page, the Requests heading, and the 404 and
error pages. The catalogue, `Lists`, the list page and the Gauntlet render theirs through
`SectionTitle as="h1"`; the hubs and a collection use its `display` variant.

Visible breadcrumbs (`src/lib/shared/ui/Breadcrumbs`) appear on the game page, the catalogue,
both hubs, the Gauntlet, `Lists`, list pages, `Requests`, user profiles and both collection
pages.

## Structured data

`src/lib/shared/ui/JsonLd` renders a `<script type="application/ld+json">` with `<` escaped;
the builders live in `src/lib/shared/utils/json-ld.utils.ts`.

| Type                       | Where                                                                                     | Contents                                                                            |
| -------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `WebSite` + `SearchAction` | root layout, every page                                                                   | search endpoint `/games?search={search_term_string}`                                |
| `VideoGame`                | game page                                                                                 | name, url, description, cover, genres, `datePublished` from `first_release`         |
| `AggregateRating`          | inside `VideoGame`                                                                        | only when the game has at least 10 MoonCellar ratings; scale 1–10                   |
| `Review`                   | inside `VideoGame`                                                                        | the loaded reviews that have a rating, an author and text and are not spoilers      |
| `BreadcrumbList`           | game page, catalogue, both hubs, Gauntlet, `Lists`, `News`, a post, both collection pages | the same trail as the visible breadcrumbs                                           |
| `Article`                  | a post (`/news/[slug]`)                                                                   | headline, summary, dates, author, image, and the game as `about` for a game article |
| `ItemList`                 | catalogue, both hubs, a collection                                                        | the games rendered on the page, with position, url and name                         |

## Hub pages

`/games/genre/[slug]` and `/games/platform/[slug]` render from one component
(`src/lib/pages/HubPage`) and read only `gamesApi.getAll`.

| Block           | Query                                                                                                           |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| Most popular    | `sortBy: "rating"`, `sortOrder: "desc"`, `types: ["Main Game"]`, `votes`, `take: 5`                             |
| Recent releases | `sortBy: "first_release"`, `sortOrder: "desc"`, `types: ["Main Game"]`, `years: [null, currentYear]`, `take: 6` |
| All games       | `take: 30`, page 1                                                                                              |

The vote threshold is 100 for genres with 5 000 games or more and 20 otherwise; the platform hub
always uses 20. `types: ["Main Game"]` keeps DLC and re-releases out of the ranked blocks, and
`years: [null, currentYear]` keeps unreleased titles out of the recent one.

Each hub ends with a link into the catalogue with the filter applied
(`/games?selectedGenres[]=…`, `/games?selectedPlatforms[]=…`) and a block of sibling links —
every genre with at least 100 games, or the first 24 platforms. Hubs have no pagination and read
no `searchParams`, which is what lets them be cached.

The platform hub's "recent releases" hint states that dates are a game's first release anywhere,
not its release on that platform.

## Collections

`/collections` and `/collections/[slug]` publish the ranks `GeneratedListsService`
(`apps/api/src/module/collections/services/generated-lists.service.ts`) rebuilds every Monday:
the best games of each recent year and decade, the standalone expansions, `GENERATED_LIST_COMPANIES`
and `GENERATED_LIST_KEYWORDS`. The same documents used to be reachable only as
`/user/MoonCellar/lists/<slug>`, a system account's profile URL; `GET /collections` and
`GET /collections/:slug` expose exactly the lists carrying a `generator`, and the old URL answers
a 308 to the collection.

On 2026-11-03 that is 53 collections holding 5 to 100 games each; every one of them is listed in
the sitemap and indexable. The order is the combined IGDB / HowLongToBeat / MoonCellar rating
described in each collection's own generated description, and the page prints the stored
`position` as the card's rank instead of its array index.

The wave exists for the internal links as much as for the pages: a collection links to every game
it ranks, and each game card answers through `GameRecord`'s "Collections and lists that include it"
block, so a card and the rankings that mention it are two clicks apart. `/lists` links to the hub
with its "Collections" button, and the hub links back to every ranking.

## Caching

| Route                                | Strategy                                                                                                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/games/[slug]`, both hubs           | ISR: `export const revalidate = 3600` together with `generateStaticParams()` returning `[]` — nothing is prerendered at build time, and the route is cached on demand |
| `/`                                  | `force-dynamic`; featured platforms come from `unstable_cache` with a 3600 s revalidate                                                                               |
| `/games`                             | dynamic, it reads `searchParams`                                                                                                                                      |
| `/lists`                             | dynamic, it reads `searchParams` and passes page 1 to the client as `initialData`                                                                                     |
| `/news`                              | dynamic, it reads `searchParams` and passes the page and the archive to the client as `initialData`                                                                   |
| `/news/[slug]`                       | ISR like a game page (`revalidate = 3600`, empty `generateStaticParams`); the admin editor purges it with `revalidateArticlePage` after a save or a delete            |
| `/collections`                       | `force-dynamic`: a static route would prerender an empty hub at build time, when the API is not reachable; the list itself is `unstable_cache`d for 3600 s            |
| `/collections/[slug]`                | ISR like a game page (`revalidate = 3600`, empty `generateStaticParams`)                                                                                              |
| `/user/[name]`, `/user/[name]/[tab]` | dynamic: the profile layout reads `cookies()` to decide who is viewing                                                                                                |
| `/user/[name]/lists/[slug]`          | dynamic: it reads `cookies()` (forwarded to `by-slug` for private lists) and `searchParams` (`page`, sort)                                                            |
| `/requests`, `/gauntlet`             | static: no server fetch, no `revalidate`; the client page reads the query string inside its `Suspense`                                                                |
| `sitemap.xml`                        | `force-dynamic`, with each upstream call wrapped in `unstable_cache` at 3600 s                                                                                        |
| `/img/image-proxy`                   | `force-dynamic`; the upstream fetch revalidates hourly and the response carries `public, max-age=3600, s-maxage=86400`                                                |

A route that reads `searchParams` cannot be statically cached, which is why the two hubs take no
query parameters.

A cached game page is purged on demand by `revalidateGamePage`
(`src/lib/entities/game/api/game.actions.ts`), called after admin edits and by
`POST /api/revalidate` (header `x-revalidate-secret` matching `REVALIDATE_SECRET`, body
`{ slugs: string[] }`, up to 200).

## robots.txt and sitemap

`src/app/robots.ts` allows everything for `*`, disallows `/admin`, `/api`, `/games?` and
`/requests`, and points at `${FRONT_URL}/sitemap.xml`. A second group names the crawlers that once
filled the server disk with ISR and image caches (`ClaudeBot`, `Applebot`, `SemrushBot`,
`AhrefsBot`, …) and gives them `/_next/image` disallowed and a `Crawl-delay`.

`api.mooncellar.space` answers its own `robots.txt` from the API's nginx block
(`infra/nginx/mooncellar.conf`) with `Disallow: /`. The API serves JSON and has no page to index,
while Googlebot was spending a third of the site's crawl requests on it (25 511 of 71 500 in the
ninety days to 2026-10-31).

`src/app/sitemap.ts` emits, in order:

1. The static links from the `links` constant — `/`, `/games`, `/collections`, `/gauntlet`,
   `/news`, without `lastModified`: nothing tracks when those pages change, and a `new Date()`
   here made the file differ on every request.
2. The game cards of `INDEXABLE_GAME_SLUGS`: `/games/<slug>` with `lastModified` from the record
   and, when the game has a cover, an `<image:loc>` pointing at `/img/image-proxy`. A card of that
   list that the popular query does not return — the MoonCellar port's card — is still listed, on
   its own, without `lastModified`.
3. Genre hubs with at least `MIN_GAMES_FOR_INDEX` games (100), slugged with `toSlug`.
4. Platform hubs with at least `MIN_GAMES_FOR_INDEX` games, from `GET /games/count-by-platform`.
5. Every published post: `/news/<slug>` with `lastModified`, from `GET /articles/slugs`.
6. Every generated collection: `/collections/<slug>` with `lastModified`, from `GET /collections`.
   They are the site's own rankings and the only pages that link to dozens of game cards at
   once, so they are listed whole rather than by a threshold.

An entry is listed only while the page it points at is indexable, which is why both hubs read the
same `MIN_GAMES_FOR_INDEX` constant their metadata uses instead of a threshold of their own. User
profiles are not listed: they carry no editorial value and their tabs only duplicate the profile.

Each of the five upstream calls has its own `unstable_cache` entry and falls back to an empty
list on error, so one failing endpoint does not empty the whole sitemap.

## Game cards: keep, merge or noindex

The October 2026 re-evaluation was about the catalogue: 1,100 game cards, nearly all of them an
IGDB summary and "No reviews yet". The audit of 2026-11-03 measured what the cards actually carry
(`scripts/audit-game-cards.ts`):

| Measurement                                                             | Value     |
| ----------------------------------------------------------------------- | --------- |
| Games in the catalogue                                                  | 439 455   |
| Games with any first-party data (playthrough, rating, comment or list)  | 1 097     |
| Accounts on the site                                                    | 32        |
| Public playthroughs / games with a public review in the whole catalogue | 5 / 4     |
| Cards in the sitemap                                                    | 1 100     |
| … keep                                                                  | 30        |
| … merge                                                                 | 14        |
| … noindex                                                               | 1 056     |
| … of them thin (no first-party data at all)                             | 720       |
| … of them weak (our data, below the shortlist)                          | 336       |
| Median IGDB summary length of a thin card                               | 457 chars |

A card carries content Google cannot get from IGDB only when it has one of our own signals: a
MoonCellar Team port with its achievements, a playthrough, a rating, a written note, a discussion
post or a public list. Everything else repeats the IGDB summary. Every card is therefore filed in
`apps/web/src/lib/shared/constants/games.const.ts`:

- `INDEXABLE_GAME_SLUGS` — 31 cards: the 30 most searched cards that carry our data, plus the card
  of the MoonCellar port (`Glassline` on the iOS Mirror's Edge), which is always indexable. The
  limit is what keeps the set small enough to rewrite by hand; a card joins the list only once it
  carries 600+ characters of our own text, and `scripts/audit-game-card-text.ts --check` enforces
  it ("The MoonCellar record" below).
- `GAME_CARD_REDIRECTS` — 14 edition cards (`… Game of the Year Edition`, `… Ultimate Edition`,
  `… Complete Edition`, the GTA V bundle) whose `relatedGames.version_parent` is another card in
  the sitemap. They carry the same IGDB text as their base card, so they answer a 308 to it.
- Every other card answers `robots: { index: false, follow: true }`: reachable and linked from the
  hubs and the catalogue, out of the sitemap, and out of Google's index.

`scripts/audit-game-cards.ts` reproduces all of it: run `bun run mongo` (the SSH tunnel to the
production database), then `bun --env-file=apps/api/.env scripts/audit-game-cards.ts`. It prints
the three lists with a reason per card, `--csv <path>` writes the whole table, and `--check` fails
when either list in `games.const.ts` no longer matches the database — run it after a catalogue
change or an IGDB sync that moves the popular cards.

## The MoonCellar record

Every game page renders `widgets/game/GameRecord` between the characters and the details: the part
of the card that is ours rather than IGDB's. It is built on the server and travels in the ISR
entry, and it renders nothing when the card has no editorial note, no rating, no playthrough, no
achievements, no port and no list to show.

Its paragraphs come from `getGameRecordParagraphs`
(`src/lib/shared/utils/game-record.utils.ts`), a pure builder over the card's own data:

| Paragraph    | Source                                                                      |
| ------------ | --------------------------------------------------------------------------- |
| Editorial    | `GAME_EDITORIAL[slug]` (`src/lib/shared/constants/game-editorial.const.ts`) |
| Rating       | `averageRating` / `ratingsCount` on the game                                |
| Tracking     | `GET /games/:id/stats` — accounts per status                                |
| Playtime     | `GET /games/:id/community` — hours logged and the newest entry              |
| Achievements | `steamAchievements.total`, `retroachievements`, the MoonCellar port count   |

The editorial paragraph is the one part nothing generates: a note written by the team, one per
indexable card, about what the game asks of a player and how it sits next to its sequels. It lives
in the repository rather than in the database, so the whole set is reviewed in the pull request
that changes it and no admin edit can ship copy nobody read.

Two lists follow the paragraphs. "The same accounts also tracked" comes from the same endpoint: the
games the accounts of this card tracked as well, most shared first, up to six. "Lists that include
it" comes from `GET /lists/game/:gameId`: the lists people made first, then the MoonCellar
generated ones, up to eight. Both are links, so the block also gives crawlers a path through our
own content.

The blocking is measured, not assumed: `bun --env-file=apps/api/.env
scripts/audit-game-card-text.ts --check` rebuilds the same facts from the database and prints the
characters of our own text each indexable card renders. On 2026-11-03, with the editorial notes in
place, that is **604–910 characters, median 695, and 31 of 31 cards above the 600-character bar**.
`--check` fails when a card of `INDEXABLE_GAME_SLUGS` has no note, when the note map holds a slug
outside that list, or when a card falls below the bar — so a card cannot be added to the indexed
set without its text.

## Images

- `/img/image-proxy` (`src/app/img/image-proxy/route.ts`) streams remote covers. It requires
  `https`, matches the hostname against an allowlist (IGDB, the S3 and DigitalOcean Spaces
  buckets), verifies that the upstream content type starts with `image/`, and answers 400, 403
  or 502 otherwise. It sits outside `/api` so that `robots.txt` does not block the images the
  sitemap and Open Graph tags reference.
- `next.config.mjs` lists the same hosts in `images.remotePatterns` for `next/image`, plus
  RetroAchievements, YouTube thumbnails, VNDB, Alphacoders, the API host and `localhost`.
- `/_next/static/media/*` is served with `X-Robots-Tag: noindex`.
- Game covers use ``alt={`${game.name} cover`}``; decorative images carry an empty `alt`.

## Headers

`next.config.mjs` sends `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
on every path.

## Search engine verification

- `public/yandex_058d2e4bbfa6f684.html` — Yandex Webmaster.
- `public/74a6b85cd7164d77a0cccb5baae3d563.txt` — a key file in the IndexNow format, its body
  repeating its own name.

`meta keywords` are declared on the root layout, the homepage, the catalogue, `Lists`, the
Gauntlet, game pages and user profiles.
