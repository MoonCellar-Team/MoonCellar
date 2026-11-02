# NewsPage

The feed of published posts — site news and game articles — ten per page, filterable by kind,
publication date and the game an article is about. Public.

## Routes

- `/news` — `src/app/news/page.tsx`.
- Dynamic: the route reads `searchParams`, parses them with `parseNewsQuery`
  (`features/news/model/news-query.utils`), fetches `articlesAPI.getArticles(params)` and
  `articlesAPI.getArchive()` in parallel and passes `initialParams`, `initialData` and
  `initialArchive`. A failed fetch passes `undefined`.
- Static metadata: title `News`, canonical `/news`, own keywords. The route renders
  `BreadcrumbList` JSON-LD and wraps the page in `Suspense` with `NewsPageSkeleton`.

## Data

- `useArticlesQuery(params, seededData)` — seeded only when `hashKey(articleQueryKeys.feed(params))`
  matches the key of `initialParams`.
- `useArticleArchiveQuery(initialArchive)` — post counts per year and month, over every published
  post whatever the other filters.
- `useGamesByIdsQuery([game])` — the name for the "About: …" chip when the page holds no post of
  that game.
- URL state: `type`, `year`, `month` (only with `year`), `game`, `page`. Every write goes through
  `pushNewsQuery`, which uses `window.history.pushState`.

## Composition

1. `BGImage`.
2. A grid that fills the page container — the same width as every other page, with no cap of its
   own: a head `Box`, the list `Box`, and an `aside` of `--news-sidebar-width`.
3. Head `Box`: `Breadcrumbs`, `SectionTitle as="h1"` "News" with a "Write a post" button for
   admins, segmented `Tabs` All / Site news / Game articles with `counts` from the response,
   `AppliedFilters` (date and game), and below `media960` the compact filters —
   `NewsArchiveSelect` (a `Dropdown`) and `NewsGameFilter`.
4. List `Box`: `ArticleRow` per post (or four `ArticleRowSkeleton`s, or `EmptyState`), then
   `Pagination` when there is more than one page.
5. `aside` (hidden below `media960`): `Box` "Archive" with `NewsArchive` and `NewsGameFilter`.

## Loading state

- `NewsPageSkeleton` (`NewsPageSkeleton.tsx`, its own `"use client"` module sharing
  `NewsPage.module.scss`) is the route's `Suspense` fallback. It draws the page's own frame —
  the `page` grid at the container's full width, the head and list `Box`es and the
  `--news-sidebar-width` archive `aside` — so the panels, columns and widths are already in place
  when the data arrives.
  The `aside` is drawn even though the page drops it when the archive is empty: the grid keeps
  its sidebar track either way, so the list width does not depend on it.
- `ArticleRowSkeleton` repeats `ArticleRow`'s grid and classes: the `row__thumb` column, then the
  chip line, the two-line title, the two-line summary and the meta line in `row__body`. Change
  the row's columns, rows or their order and change the skeleton in the same edit, or the list
  jumps in width and shape on the swap.
- The head is one panel with the same rows as the loaded page — crumbs, `h1`, the segmented tabs
  row and the compact filters (below `media960`) — so both heads are the same height and the list
  starts at the same offset. `page__crumbs`, `page__tabs`, `page__field` and
  `row__title_skeleton`/`row__summary_skeleton` exist only for it: they give the placeholders the
  crumbs' 13px/1 line box (16px below `mediaSm`), the tab row's 32px pills inside its padding, a
  label + field column, and the width a `shape="text"` bar needs inside `row__body` — that column
  is `align-items: flex-start`, so a text bar without it collapses to zero width.

## Rules and gotchas

- **The URL is the only filter state.** Tabs, chips, the archive and the dropdown all read
  `parseNewsQuery` on every render and write with `pushNewsQuery`; never `router.push`, which
  re-renders the route on the server and delays `useSearchParams`.
- **Both filter sets are always rendered and CSS picks one.** The archive tree and the compact
  dropdown switch at `media960`; gating either on the viewport in JS would drop the archive
  links from the server HTML.
- **The archive links are real `href`s with `onClick` → `pushNewsQuery`.** Crawlers follow them
  to the filtered pages; people stay on the client. They carry `prefetch={false}`, or every
  month in the tree would prefetch a server render.
- **"Clear all" keeps `type`.** The kind is a tab, not a chip.
- **The admin button waits for `useIsAuthHydrated`.** `isAdmin` comes from the persisted auth
  store, which the server render does not have; reading it before hydration mismatches the HTML.
- Dates are formatted in UTC (`formatArticleDate`), the same zone the API groups the archive
  by, so a post published near midnight sits in the month the archive counts it in, on the server
  and in every browser.
- **The feed fills the page container and takes no cap of its own.** It used to stop at
  `--news-page-width` (1080px) while Games, Lists and the rest used the container's 1400px, so on
  a wide screen the list sat in a visibly narrower column. That token is `--article-page-width`
  now and belongs to `ArticlePage` and `ArticleEditor`: the article keeps a narrower reading
  measure, a feed does not need one.
- **The sidebar sticks below the fixed header, not at the top of the scrollport.** The page
  scrolls `#page-scroll` while the header is `position: fixed` over it, so `top: 0` slid the
  archive card under the header and cut off its top. `top: var(--container-padding-top)` is the
  container's own top padding (the header plus the gap) and follows
  `.container_topMenu`/`.container_bare`; below `media960` the aside is `display: none`, so the
  offset only matters on the desktop layout.
