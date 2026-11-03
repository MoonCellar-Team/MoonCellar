# GamePage

The page of one game: hero, overview, ratings, media, characters, the MoonCellar record, details,
related games, reviews and discussion, release dates and multiplayer. Public, and the site's main search
landing page — the catalogue holds 439 455 of them and 31 are indexable.

## Routes

- `/games/[slug]` — `src/app/games/[slug]/page.tsx`.
- ISR: `export const revalidate = 3600` together with `generateStaticParams() { return []; }`,
  so nothing is prerendered at build time and each page is cached on first visit.
- `getGame` is `React.cache`d and shared by `generateMetadata` and the page. A slug containing
  `.` is rejected without a request. `generateMetadata` returns "Page not found" + `noindex`
  for a missing game (404) and a neutral `{ title: "Game" }` when the lookup fails for any other
  reason; only the page component calls `notFound()`.
- Metadata: title = game name, description = `summary` (or a fallback), keywords from name,
  genres, themes and IGDB keywords, canonical `/games/<slug>`, and a full `openGraph` block with
  the cover through `/img/image-proxy` (200×266).
- Only the slugs of `INDEXABLE_GAME_SLUGS` (`shared/constants/games.const.ts`) are indexable; every
  other card answers `robots: { index: false, follow: true }` and stays out of the sitemap. The
  list and the audit behind it are in [`docs/seo.md`](../../../../../docs/seo.md), "Game cards:
  keep, merge or noindex" — a card joins it only once it carries 600+ characters of our own text.
- An edition card in `GAME_CARD_REDIRECTS` calls `permanentRedirect` to its base card right after
  `getGame`, before the stats, reviews and related fetches; the two pages carry the same IGDB text.
- The route renders `VideoGame` and `BreadcrumbList` JSON-LD next to the page.
- No segment `error.tsx`: an API failure reaches `src/app/error.tsx` (`ErrorPage`), never a
  404 body.

## Data

- Server, all in the route: `gamesApi.getBySlug` (via `fetchOrNull`, 404 → `null`), then in
  parallel `gamesApi.getStats`, `commentsAPI.getReviews`, `gamesApi.getRelated`,
  `gamesApi.getCommunity` and `listsAPI.getByGame` — each falls back to `undefined` on error so a
  failing side block never breaks the page.
- The game service (`apps/game`), also in parallel: `getPortGameAchievements` — the MoonCellar Team
  port whose `siteGame` (in its `GET /games`) is this page, with every achievement, or `undefined`.
  It reaches the service with its own axios client (`portAchievementsApi`): no cookies, no toasts.
  `getSitePort` reads the same `GET /games` for the port itself, whatever its achievements, so the
  hero can offer its browser version (`playUrl`).
  The viewer's own states load in the browser once the port's modal opens.
- The page receives `game`, `stats`, `reviews`, `related`, `portAchievements`, `port`,
  `community` and `lists` as props and renders them directly.
  Widgets below may run their own client queries (reviews paging, discussion), but the
  first render needs none.
- No URL state in the route. The `#reviews` and `#discussion` hashes (notification links) open
  that community tab and scroll to it; `GameCommunity` reads `window.location.hash` in an effect, never during
  render.

## Composition

1. `BGImage` — background derived from the game (deterministically, not at random).
2. `widgets/game/GameHero` — cover, name (`h1`), stats, controls, a "Play <port> in the browser"
   accent `Button` under the rating when the port has a `playUrl` (a new tab), and the "Suggest an edit" link
   to `/requests` in the banner's top-right corner, so it shows even when `GameDetails` has no rows.
   Under the name, `entities/game/ui/GameFacts` (shared with the Gauntlet winner): single facts
   (year, type, perspectives, status) are one line of catalogue links; a status with a tone from
   `getGameStatusTone` (`entities/game/model`) is a `Badge`, Released stays plain text. Genres and
   platforms are `Chip` rows labelled in a `dl`, so a genre such as "Platform" is never read as a
   platform (mockup: `docs/mockups/game-hero-facts.html`, variant B).
3. A text column and a sidebar (mockup: `docs/mockups/game-overview-row.html`, variant C). Left:
   `entities/game/ui/GameOverview` (summary, storyline, keywords), then `widgets/game/GameLinksPanel`
   (external pages and links). Right, as wide as the hero's counters plus the hero's padding so
   the two line up: `widgets/game/GameScoreColumn`, then `GameFriendsStatus` in its own panel.
   Ratings show each source's vote count in parentheses after the score (`9.4 (938)`). The score
   column's last block is `widgets/game/GameAchievementsBlock`,
   one clickable `StatRows` row per source: Steam links to the game's global achievements page
   (`steamcommunity.com/stats/<appId>/achievements`, never the viewer's own, which would differ
   between the server and the client render), each RetroAchievements set links to
   `retroachievements.org/game/<gameId>`, both in a new tab, and the MoonCellar Team port row (brand `logo-icon.png`, labelled with the port's `name` from
   `GET /games`, e.g. Glassline) opens `widgets/game/GamePortAchievementsModal`, titled the same.
4. `entities/game/ui/GameMedia` and `widgets/game/GameCharacters` (`game.characters`, ordered by role in `getGameBySlug` / `getGameById` with `sortCharactersByRole`: an admin's role, else VNDB's, else Protagonist from the description; `GET /characters?gameId=` uses the same order) — hidden for adult games
   when `useHideAdult()` is true.
5. `widgets/game/GameRecord` — the card's own record: paragraphs built by
   `getGameRecordParagraphs` (`shared/utils/game-record.utils.ts`) from our rating, the accounts
   per status, the logged hours and the newest entry, Steam, RetroAchievements and the MoonCellar
   port; then "The same accounts also tracked" (`community.alsoPlayed`) and "Lists that include
   it" (`lists`). The builder is a pure function over numbers the page already has, and the block
   renders nothing when it has nothing to say. [`docs/seo.md`](../../../../../docs/seo.md), "The
   MoonCellar record", measures what it produces: 143–364 characters per indexable card on
   2026-11-03, so it narrows but does not close the 600-character bar of the indexable list.
6. `entities/game/ui/GameDetails` — the remaining catalogue facts.
7. `widgets/game/GameRelated`.
8. `widgets/game/GameCommunity` — `features/comments/ui/GameReviews` (seeded with
   `initialReviews`) and the Discussion tab, `features/comments/ui/CommentThread` with the game as
   its target.
9. Two columns: `GameReleaseDates`, `GameMultiplayer`.
10. `features/game/ui/GameAdminControls` — admin-only `ExpandMenu` with parse/delete/revalidate.

## Rules and gotchas

- **The overview row's panels keep their own height; never stretch them to the tallest again.**
  Equal-height columns with `justify-content: space-between` opened holes in the middle of
  the shorter panels whenever one block was long. Each column is a stack aligned to the top. At
  `media960` and below the stacks become `display: contents` so the panels flow as one column,
  and `GameLinksPanel` takes `order: 1` to stay after the scores.

- **Do not read `searchParams` in the route.** It turns the page dynamic and drops ISR for all
  game pages.
- **Never call `notFound()` from `generateMetadata`, and do not put a `Suspense` boundary above
  the page.** Either one produces a soft 404 (status 200 with the not-found body).
- **A failed fetch in `generateMetadata` must never return `noindex`.** The page still renders
  with real content, and ISR caches the "Page not found" head for an hour.
- **Restate `siteName`, `type`, `locale` and `images` in `openGraph`.** A page-level object
  replaces the root layout's; it does not merge.
- **Keep all content in the server HTML.** No wrapper that returns `null` until a client value
  arrives, no list that measures the DOM, and collapse long keyword lists with CSS
  (`ExpandableBlock clampHeight`), never `slice`.
- **Admin edits must call `revalidateGamePage` before `router.refresh()`.** A refresh alone is
  answered from the same cached entry and refills the cache with stale data.
- **Keep `useDiscussionSocket` out of `GamePage` and `GameCommunity`.** The socket opens only
  when the Discussion tab mounts its `CommentThread`; anywhere higher, every visitor opens a
  socket.
- **Nothing read during render may differ between server and client** — no `document` lookups,
  no `Math.random()`. `ExpandMenu`'s portal and `BGImage`'s choice both broke hydration on every
  game page before.
- Adult filtering fails closed: on the server `useHideAdult()` is true, so adult media is
  absent from the HTML by design.
- Image URLs in metadata go through `/img/image-proxy`, never under `/api` (blocked by
  `robots.txt`).
- **`GameAdminControls` is rendered with `key={game._id}`.** Its id fields start from the game's
  current VNDB, RetroAchievements and HLTB ids; a client navigation to another game keeps the
  component mounted, and without the key the fields kept the previous game's ids (Terraria's RA and
  HLTB ids showed on Ever 17).
