# CollectionPage

One MoonCellar collection: its name, the generated description and the games in rank order.
The ranking has an address of its own here instead of a system account's profile URL.

## Routes

- `/collections/[slug]` — `src/app/collections/[slug]/page.tsx`.
- ISR: `revalidate = 3600` with `generateStaticParams() { return []; }`, so nothing is
  prerendered at build time and each page is cached on first visit.
- `getCollection` is `React.cache`d and shared by `generateMetadata` and the page. A missing
  collection answers "Page not found" + `noindex` from the metadata and `notFound()` from the
  page; a failed lookup returns neutral metadata (`Collection`) and the page's throw renders
  `src/app/error.tsx`, never a 404 body.
- Metadata: title = collection name, description = the generated one, canonical
  `/collections/<slug>`, and a full `openGraph` block with the first cover through
  `/img/image-proxy` (200×266), `og-default.png` when there is none.
- The route renders `BreadcrumbList` and an `ItemList` of the games.

## Data

- `collectionsAPI.getBySlug(slug)` → `ICustomListDetails` (`GET /collections/:slug`): the list in
  rank order, each game carrying its `position`.
- `gamesApi.getByIds({ _ids })` (`POST /games/by-ids`) loads the games in one request — a
  collection holds up to 100. The route rebuilds the collection order from `position` and drops
  the ids the API did not return.

## Composition

1. `BGImage game={games[0]}` — the top pick as the backdrop.
2. `Box`: breadcrumbs (Home → Collections → name), the `display` `SectionTitle` as `h1`, the
   stats row with the game count, and the collection's description.
3. `Box`: `GamesCards` (`isWithoutScroll`, `getRank` from each game's `position`, no `limit` so
   the grid is `auto-fill`) and an "All collections" `Button` back to the hub.

## Rules and gotchas

- **Never slice the games or move them behind a client pager.** Every card is a link into the
  catalogue and the whole ranking is what the page is for in search.
- **Take the rank from `collection.games[].position`, never from an index of the loaded games.**
  `getByIds` answers in catalogue order, so an index renumbers the ranking whenever a game is
  missing.
- **Do not read `searchParams`.** Sorting or paging in the URL drops ISR for all 53 pages.
- **The description is generated.** It comes from `GeneratedListsService` and says how the
  ranking is built; a manual rewrite is lost at the next weekly rebuild.
- **This is not the custom list page.** Likes, filters and Manage mode stay on
  `/user/<name>/lists/<slug>`; for a generated list that route answers a 308 here.
