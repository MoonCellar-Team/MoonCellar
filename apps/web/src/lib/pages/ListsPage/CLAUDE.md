# ListsPage

The catalogue of public custom lists made by players, filterable by name, author, contained
games, size and last update, 24 per page. Public.

## Routes

- `/lists` — `src/app/lists/page.tsx`.
- Dynamic: the route reads `searchParams`, parses them with `parseListsQuery`
  (`features/lists/model/lists-query.utils`), fetches `listsAPI.getLists(params)` and passes
  `initialParams` + `initialData`. A failed fetch passes `undefined`.
- Static metadata: title `Lists`, canonical `/lists`, own keywords. The route renders
  `BreadcrumbList` JSON-LD and wraps the page in `Suspense` with `PageSkeleton`.

## Data

- `useListsQuery(params, { initialData: seededData })` — seeded only when
  `hashKey(listQueryKeys.catalogue(params))` matches the key of `initialParams`.
- `useGamesByIdsQuery(getListsGameIds(params))` — resolves game ids in the "contains" filter to
  names for the chips.
- URL state: `search`, `author`, `games`, `gamesMode`, `minGames`, `updated`, `sortBy`,
  `sortOrder`, `page`. Every write goes through `pushListsQuery`, which uses
  `window.history.pushState`.

## Composition

1. `BGImage`.
2. Left `ExpandMenu` "Filters" → `features/lists/ui/ListsFilters`.
3. `Pagination` (fixed, `take={CUSTOM_LISTS_PAGE_SIZE}`).
4. `Box`: `Breadcrumbs`, `SectionTitle as="h1"` "Lists" with the total as its `count` and a
   "Collections" `Button` as its `action` (the way to `/collections`, which no other page
   links to), `AppliedFilters` chips derived here from the parsed query, then `EmptyState` or
   `ListCardsGrid` of `ListCard`s. While loading, `ListCardsGrid isLoading` holds
   `CUSTOM_LISTS_PAGE_SIZE` `ListCardSkeleton`s.

## Rules and gotchas

- **The URL is the only filter state.** Chips are derived from `parseListsQuery` on every render
  and removed with `pushListsQuery`; keeping a copy in component state makes chips and results
  drift apart.
- **Write with `pushListsQuery` (`pushState`), never `router.push`** — the server re-render
  delays `useSearchParams` and the client query sees the new key too late.
- **Seed `initialData` only for the server's key**, or a new filter shows the old results until
  `staleTime` runs out.
- **"Clear all" keeps `sortBy`/`sortOrder`.** Sorting is not a filter.
- **The grid's container-query thresholds duplicate tokens.** `ListsPage.module.scss` copies
  `--list-card-min-width` and `--gap-x4` into `$listCardMinWidth`/`$listCardsGap`; change both
  together, and keep every column count a divisor of `CUSTOM_LISTS_PAGE_SIZE` (24).
- Gate the skeleton on `isLoading` (wrapped in `useMinimumLoading`), never on `isFetching`.
